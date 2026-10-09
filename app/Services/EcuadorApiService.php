<?php

namespace App\Services;

use Illuminate\Http\Client\Pool;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Consulta de datos de una persona por cedula en EcuadorAPI, para llenar solo
 * el nombre y la fecha de nacimiento en el alta de un paciente.
 *
 * Es una ayuda, nunca un requisito: sin key, sin saldo, con la API caida o con
 * una cedula que no devuelve nada, `lookupPerson()` responde null y el alta
 * sigue a mano. Nada de aqui lanza excepciones ni muestra errores al usuario.
 *
 * El servicio cobra por consulta: nombres y nacimiento son dos endpoints (se
 * piden en paralelo), el resultado completo se cachea un dia y, cuando la API
 * rechaza la key o el saldo, las consultas se pausan en vez de reintentar en
 * cada alta.
 *
 * La key va en `ECUADORAPI_KEY` (entorno), no en Ajustes.
 *
 * Documentacion: https://api.ecuadorapi.com/api/docs/
 */
class EcuadorApiService
{
    /** Mientras exista esta entrada de cache no se consulta la API. */
    public const CACHE_PAUSED = 'ecuadorapi:paused';

    private const CACHE_PERSON = 'ecuadorapi:person:';

    private const PERSON_TTL_SECONDS = 86400;

    /** Key rechazada, sin saldo o limite alcanzado: insistir no sirve. */
    private const PAUSE_STATUSES = [401, 402, 403, 429];

    private const PAUSE_DEFAULT_SECONDS = 900;

    /** Tope de la pausa: tras recargar saldo vuelve a funcionar en una hora. */
    private const PAUSE_MAX_SECONDS = 3600;

    public function isEnabled(): bool
    {
        return filled(config('services.ecuadorapi.key'));
    }

    /**
     * Nombre, apellido y fecha de nacimiento del titular de una cedula, o de
     * un RUC de persona natural (cedula + establecimiento).
     *
     * La fecha puede venir en null si solo respondio el endpoint de nombres.
     *
     * @return array{nombre: string, apellido: ?string, fecha_nacimiento: ?string}|null
     */
    public function lookupPerson(string $document): ?array
    {
        $cedula = $this->cedula($document);

        if ($cedula === null || ! $this->isEnabled() || Cache::has(self::CACHE_PAUSED)) {
            return null;
        }

        $cacheKey = self::CACHE_PERSON.sha1($cedula);
        $cached = Cache::get($cacheKey);

        if (is_array($cached)) {
            return $cached;
        }

        try {
            $responses = $this->fetch($cedula);
        } catch (\Throwable $e) {
            // El mensaje trae la URL con la cedula: solo se anota el tipo de fallo.
            Log::warning('EcuadorAPI: fallo de conexion', ['exception' => $e::class]);

            return null;
        }

        $this->pauseIfRejected($responses);

        $person = $this->person($this->data($responses['nombres'] ?? null));

        if ($person === null) {
            return null;
        }

        $birth = $this->data($responses['nacimiento'] ?? null);
        $person['fecha_nacimiento'] = $this->birthDate($birth['birth_date'] ?? null);

        // Un resultado a medias no se guarda: la proxima consulta puede completarlo.
        if ($person['fecha_nacimiento'] !== null) {
            Cache::put($cacheKey, $person, self::PERSON_TTL_SECONDS);
        }

        return $person;
    }

    /**
     * Los 10 digitos de la cedula, o null si el documento no es una cedula ni
     * un RUC (pasaporte, codigo provisional).
     */
    private function cedula(string $document): ?string
    {
        $document = trim($document);

        return preg_match('/^(\d{10})(\d{3})?$/', $document, $match) ? $match[1] : null;
    }

    /**
     * @return array<string, mixed> Una `Response` o una excepcion por endpoint
     */
    private function fetch(string $cedula): array
    {
        $baseUrl = rtrim((string) config('services.ecuadorapi.base_url'), '/');
        $key = (string) config('services.ecuadorapi.key');

        $request = fn (Pool $pool, string $name) => $pool->as($name)
            ->withToken($key)
            ->acceptJson()
            // Corto a proposito: el formulario ya esta habilitado y nadie espera.
            ->timeout(5)
            ->connectTimeout(3)
            ->withoutRedirecting()
            ->get("{$baseUrl}/cedulas/{$cedula}/{$name}");

        return Http::pool(fn (Pool $pool) => [
            $request($pool, 'nombres'),
            $request($pool, 'nacimiento'),
        ]);
    }

    /**
     * Contenido de `data` en el sobre `{data, error, message, code}`, o null si
     * el endpoint fallo.
     *
     * @return array<string, mixed>|null
     */
    private function data(mixed $response): ?array
    {
        if (! $response instanceof Response || ! $response->successful() || $response->json('error') === true) {
            return null;
        }

        $data = $response->json('data');

        return is_array($data) ? $data : null;
    }

    /**
     * @param  array<string, mixed>|null  $names
     * @return array{nombre: string, apellido: ?string, fecha_nacimiento: ?string}|null
     */
    private function person(?array $names): ?array
    {
        $nombre = $this->text($names['first_name'] ?? null);
        $apellido = $this->text($names['last_name'] ?? null);

        // Sin el desglose, el nombre completo va en `nombre`, como en los
        // registros historicos.
        if ($nombre === null) {
            $nombre = $this->text($names['full_name'] ?? null);
            $apellido = null;
        }

        return $nombre === null ? null : ['nombre' => $nombre, 'apellido' => $apellido, 'fecha_nacimiento' => null];
    }

    private function text(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $value = trim((string) preg_replace('/\s+/u', ' ', $value));

        // 150 es el `max` de nombre y apellido en StorePatientRequest.
        return $value === '' ? null : mb_substr($value, 0, 150);
    }

    /**
     * La API documenta `birth_date` como texto, sin formato: se aceptan
     * AAAA-MM-DD (con o sin hora) y DD/MM/AAAA. Devuelve AAAA-MM-DD, o null si
     * la fecha no pasaria la validacion del alta.
     */
    private function birthDate(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $value = trim($value);

        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})(?!\d)/', $value, $match)) {
            [$year, $month, $day] = [(int) $match[1], (int) $match[2], (int) $match[3]];
        } elseif (preg_match('#^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$#', $value, $match)) {
            [$day, $month, $year] = [(int) $match[1], (int) $match[2], (int) $match[3]];
        } else {
            return null;
        }

        if (! checkdate($month, $day, $year)) {
            return null;
        }

        $date = sprintf('%04d-%02d-%02d', $year, $month, $day);

        return $date > '1900-01-01' && $date < now()->toDateString() ? $date : null;
    }

    /**
     * @param  array<string, mixed>  $responses
     */
    private function pauseIfRejected(array $responses): void
    {
        foreach ($responses as $response) {
            if (! $response instanceof Response) {
                Log::warning('EcuadorAPI: fallo de conexion', ['exception' => is_object($response) ? $response::class : null]);

                continue;
            }

            if (in_array($response->status(), self::PAUSE_STATUSES, true)) {
                $retryAfter = (int) $response->header('Retry-After');
                $seconds = $retryAfter > 0 ? min($retryAfter, self::PAUSE_MAX_SECONDS) : self::PAUSE_DEFAULT_SECONDS;

                Cache::put(self::CACHE_PAUSED, true, $seconds);
                Log::warning('EcuadorAPI: consultas en pausa', [
                    'status' => $response->status(),
                    'code' => is_string($response->json('code')) ? $response->json('code') : null,
                    'seconds' => $seconds,
                ]);

                return;
            }

            // 404 es una cedula que la API no conoce: no es un fallo.
            if ($response->serverError()) {
                Log::warning('EcuadorAPI: respondio con error', ['status' => $response->status()]);
            }
        }
    }
}
