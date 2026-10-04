<?php

namespace App\Services;

use App\Exceptions\ContificoTemporaryException;
use App\Models\ContificoSyncLog;
use App\Models\Patient;
use App\Models\Setting;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Integracion con Contifico, configurada desde Ajustes -> Contifico.
 *
 * Cada paciente nuevo se crea alla como Persona con rol cliente, para no
 * digitarlo dos veces al facturar. Solo viajan identificacion y contacto:
 * nunca datos clinicos.
 *
 * Contifico usa dos credenciales: la API key va en el header `Authorization`
 * (sin prefijo Bearer) y el API token va en la query string (`?pos=`) de las
 * escrituras. Como el token queda en la URL, todo mensaje de error pasa por
 * `sanitize()` antes de guardarse o loguearse: las excepciones del cliente
 * HTTP incluyen la URL completa.
 *
 * Ambas se guardan cifradas en `settings` y nunca se devuelven al frontend.
 *
 * Documentacion: https://contifico.github.io/persona/persona/
 */
class ContificoService
{
    public const SETTING_ENABLED = 'contifico_enabled';

    public const SETTING_API_KEY = 'contifico_api_key';

    public const SETTING_API_TOKEN = 'contifico_api_token';

    /** Identificacion inexistente: prueba la API key sin traer datos de nadie. */
    private const PROBE_IDENTIFICATION = '9999999999';

    // ─── Credenciales ────────────────────────────────────────────────────────

    /** Guarda la API key cifrada. Una cadena vacia la borra. */
    public function storeApiKey(?string $apiKey): void
    {
        $this->storeSecret(self::SETTING_API_KEY, $apiKey);
    }

    /** Guarda el API token (`pos`) cifrado. Una cadena vacia lo borra. */
    public function storeApiToken(?string $apiToken): void
    {
        $this->storeSecret(self::SETTING_API_TOKEN, $apiToken);
    }

    public function apiKey(): ?string
    {
        return $this->secret(self::SETTING_API_KEY);
    }

    public function apiToken(): ?string
    {
        return $this->secret(self::SETTING_API_TOKEN);
    }

    /** Borra ambas credenciales y apaga la integracion. */
    public function clearCredentials(): void
    {
        $this->setEnabled(false);
        $this->storeApiKey(null);
        $this->storeApiToken(null);
    }

    public function isConfigured(): bool
    {
        return filled($this->apiKey()) && filled($this->apiToken());
    }

    public function isEnabled(): bool
    {
        return (string) Setting::get(self::SETTING_ENABLED) === '1' && $this->isConfigured();
    }

    public function setEnabled(bool $enabled): void
    {
        Setting::set(self::SETTING_ENABLED, $enabled ? '1' : '0');
    }

    /**
     * Estado para la pestaña de Ajustes. Solo booleanos: nunca el valor de una
     * credencial ni parte de el.
     *
     * @return array<string, mixed>
     */
    public function status(): array
    {
        $lastSuccess = ContificoSyncLog::query()
            ->where('action', '!=', ContificoSyncLog::ACTION_TEST)
            ->where('status', ContificoSyncLog::STATUS_SUCCESS)
            ->latest('id')
            ->first();

        $lastTest = ContificoSyncLog::query()
            ->where('action', ContificoSyncLog::ACTION_TEST)
            ->latest('id')
            ->first();

        return [
            'enabled' => $this->isEnabled(),
            'has_api_key' => filled($this->apiKey()),
            'has_api_token' => filled($this->apiToken()),
            'last_success_at' => $lastSuccess?->created_at?->toDateTimeString(),
            'last_test' => $lastTest ? [
                'ok' => $lastTest->status === ContificoSyncLog::STATUS_SUCCESS,
                'message' => $lastTest->message,
                'at' => $lastTest->created_at?->toDateTimeString(),
            ] : null,
        ];
    }

    // ─── Verificacion ────────────────────────────────────────────────────────

    /**
     * Comprueba la API key con una lectura que no crea ni modifica nada.
     *
     * El API token no se puede verificar sin escribir: Contifico solo lo
     * valida en el primer envio real.
     *
     * @return array{ok: bool, message: string}
     */
    public function testConnection(?int $userId = null): array
    {
        if (! $this->isConfigured()) {
            return ['ok' => false, 'message' => 'Falta la API key o el API token de Contífico.'];
        }

        try {
            $response = $this->request('get', ['identificacion' => self::PROBE_IDENTIFICATION]);
        } catch (ContificoTemporaryException $e) {
            $message = $e->getCode()
                ? "Contífico respondió con un error {$e->getCode()}."
                : 'No se pudo contactar a Contífico. Revise la conexión del servidor.';

            return $this->testResult($userId, false, $message, $e->getCode() ?: null);
        }

        if ($response->successful()) {
            return $this->testResult($userId, true, 'Conexión correcta con Contífico.', $response->status());
        }

        $message = in_array($response->status(), [401, 403], true)
            ? "Contífico rechazó la API key ({$response->status()})."
            : "Contífico respondió con un error {$response->status()}.";

        return $this->testResult($userId, false, $message, $response->status());
    }

    // ─── Envio de pacientes ──────────────────────────────────────────────────

    /**
     * Crea al paciente en Contifico como Persona cliente, o lo enlaza si alla
     * ya existe alguien con la misma identificacion (no genera duplicados).
     *
     * Devuelve la fila del historial, o null si no habia nada que hacer
     * (integracion apagada o paciente ya enviado).
     *
     * @throws ContificoTemporaryException si el fallo amerita reintento (red, 429, 5xx)
     */
    public function syncPatient(Patient $patient, ?int $userId = null, int $attempt = 1): ?ContificoSyncLog
    {
        if (! $this->isEnabled() || filled($patient->contifico_id)) {
            return null;
        }

        $identification = $this->identification($patient);

        if ($identification === null) {
            return $this->record($patient, $userId, $attempt, [
                'action' => ContificoSyncLog::ACTION_CREATE,
                'status' => ContificoSyncLog::STATUS_SKIPPED,
                'message' => 'Sin cédula o RUC válido: no se envía a Contífico.',
            ]);
        }

        $payload = $this->payload($patient, $identification);

        try {
            return $this->push($patient, $identification, $payload, $userId, $attempt);
        } catch (ContificoTemporaryException $e) {
            $this->record($patient, $userId, $attempt, [
                'action' => ContificoSyncLog::ACTION_CREATE,
                'status' => ContificoSyncLog::STATUS_FAILED,
                'http_status' => $e->getCode() ?: null,
                'payload' => $payload,
                'message' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * @param  array{tipo: string, cedula: string, ruc: ?string}  $identification
     * @param  array<string, mixed>  $payload
     */
    private function push(Patient $patient, array $identification, array $payload, ?int $userId, int $attempt): ContificoSyncLog
    {
        $existingId = $this->findPersonaId($identification, $rejected);

        if ($rejected !== null) {
            return $this->record($patient, $userId, $attempt, [
                'action' => ContificoSyncLog::ACTION_CREATE,
                'status' => ContificoSyncLog::STATUS_FAILED,
                'http_status' => $rejected->status(),
                'payload' => $payload,
                'message' => $this->errorMessage($rejected),
            ]);
        }

        if ($existingId !== null) {
            $this->markSynced($patient, $existingId);

            return $this->record($patient, $userId, $attempt, [
                'action' => ContificoSyncLog::ACTION_LINK,
                'status' => ContificoSyncLog::STATUS_SUCCESS,
                'http_status' => 200,
                'contifico_id' => $existingId,
                'payload' => $payload,
                'message' => 'Ya existía en Contífico: se enlazó sin crear un duplicado.',
            ]);
        }

        $response = $this->request('post', ['pos' => $this->apiToken()], $payload);

        if ($response->failed()) {
            return $this->record($patient, $userId, $attempt, [
                'action' => ContificoSyncLog::ACTION_CREATE,
                'status' => ContificoSyncLog::STATUS_FAILED,
                'http_status' => $response->status(),
                'payload' => $payload,
                'message' => $this->errorMessage($response),
            ]);
        }

        $contificoId = $response->json('id');
        $contificoId = is_scalar($contificoId) ? (string) $contificoId : null;

        $this->markSynced($patient, $contificoId);

        return $this->record($patient, $userId, $attempt, [
            'action' => ContificoSyncLog::ACTION_CREATE,
            'status' => ContificoSyncLog::STATUS_SUCCESS,
            'http_status' => $response->status(),
            'contifico_id' => $contificoId,
            'payload' => $payload,
            'message' => 'Cliente creado en Contífico.',
        ]);
    }

    /**
     * Busca en Contifico una persona con la misma identificacion.
     *
     * No confia en que el filtro se aplique: compara cada resultado, porque si
     * la API lo ignorara devolveria personas ajenas.
     *
     * Si Contifico rechaza la busqueda (400, 401...) deja la respuesta en
     * `$rejected`: es un fallo definitivo y no se debe intentar crear.
     *
     * @param  array{tipo: string, cedula: string, ruc: ?string}  $identification
     */
    private function findPersonaId(array $identification, ?Response &$rejected = null): ?string
    {
        $rejected = null;

        $candidates = array_values(array_unique(array_filter([
            $identification['ruc'],
            $identification['cedula'],
        ])));

        foreach ($candidates as $candidate) {
            $response = $this->request('get', ['identificacion' => $candidate]);

            if ($response->failed()) {
                $rejected = $response;

                return null;
            }

            $personas = $response->json();
            $personas = is_array($personas) ? (array_is_list($personas) ? $personas : [$personas]) : [];

            foreach ($personas as $persona) {
                if (! is_array($persona) || blank($persona['id'] ?? null)) {
                    continue;
                }

                $matches = array_intersect(
                    $candidates,
                    array_filter([(string) ($persona['cedula'] ?? ''), (string) ($persona['ruc'] ?? '')])
                );

                if ($matches !== []) {
                    return (string) $persona['id'];
                }
            }
        }

        return null;
    }

    /**
     * Clasifica la identificacion del paciente segun lo que acepta Contifico.
     * Pasaportes y valores legacy no numericos devuelven null (no se envian).
     *
     * @return array{tipo: string, cedula: string, ruc: ?string}|null
     */
    private function identification(Patient $patient): ?array
    {
        $value = preg_replace('/\s+/', '', (string) $patient->cedula);

        if (! preg_match('/^\d+$/', $value)) {
            return null;
        }

        if (strlen($value) === 10) {
            return ['tipo' => 'N', 'cedula' => $value, 'ruc' => null];
        }

        if (strlen($value) === 13) {
            // Tercer digito 6 (entidad publica) o 9 (sociedad): persona juridica, sin cedula.
            if (in_array($value[2], ['6', '9'], true)) {
                return ['tipo' => 'J', 'cedula' => '', 'ruc' => $value];
            }

            return ['tipo' => 'N', 'cedula' => substr($value, 0, 10), 'ruc' => $value];
        }

        return null;
    }

    /**
     * Cuerpo del POST /persona/. Los limites de longitud son los de la
     * documentacion de Contifico.
     *
     * @param  array{tipo: string, cedula: string, ruc: ?string}  $identification
     * @return array<string, mixed>
     */
    private function payload(Patient $patient, array $identification): array
    {
        $email = trim((string) $patient->email);

        return array_filter([
            'tipo' => $identification['tipo'],
            'razon_social' => mb_substr($patient->nombre_completo, 0, 300),
            'cedula' => $identification['cedula'],
            'ruc' => $identification['ruc'],
            'telefonos' => filled($patient->telefono) ? mb_substr(trim($patient->telefono), 0, 50) : null,
            // Contifico admite 50 caracteres: un email mas largo se omite en vez de truncarse.
            'email' => $email !== '' && mb_strlen($email) <= 50 ? $email : null,
            'direccion' => filled($patient->direccion) ? mb_substr(trim($patient->direccion), 0, 300) : null,
            'es_cliente' => true,
            'es_proveedor' => false,
            'es_extranjero' => false,
        ], fn ($value) => $value !== null);
    }

    private function markSynced(Patient $patient, ?string $contificoId): void
    {
        $patient->forceFill([
            'contifico_id' => $contificoId,
            'contifico_synced_at' => now(),
        ])->saveQuietly();
    }

    // ─── HTTP ────────────────────────────────────────────────────────────────

    /**
     * Unico punto de salida hacia Contifico (siempre al recurso /persona/).
     *
     * @param  array<string, mixed>  $query
     * @param  array<string, mixed>|null  $json
     *
     * @throws ContificoTemporaryException ante fallo de red, 429 o 5xx
     */
    private function request(string $method, array $query, ?array $json = null): Response
    {
        try {
            $client = $this->client()->withQueryParameters($query);

            $response = $method === 'post'
                ? $client->post('/persona/', $json ?? [])
                : $client->get('/persona/');
        } catch (\Throwable $e) {
            $message = $this->sanitize($e->getMessage());
            Log::warning('Contifico: fallo de conexion', ['error' => $message]);

            throw new ContificoTemporaryException('No se pudo contactar a Contífico: '.$message);
        }

        if ($response->status() === 429 || $response->serverError()) {
            throw new ContificoTemporaryException($this->errorMessage($response), $response->status());
        }

        return $response;
    }

    private function client(): PendingRequest
    {
        // La URL base sale de config, no de Ajustes: que no sea editable desde
        // la UI evita que alguien apunte las credenciales a otro servidor.
        return Http::baseUrl(rtrim((string) config('services.contifico.base_url'), '/'))
            ->withHeaders(['Authorization' => (string) $this->apiKey()])
            ->acceptJson()
            ->asJson()
            ->timeout(15)
            ->connectTimeout(5)
            ->withoutRedirecting();
    }

    private function errorMessage(Response $response): string
    {
        $status = $response->status();

        if (in_array($status, [401, 403], true)) {
            return "Contífico rechazó las credenciales ({$status}). Revise la API key y el API token en Ajustes.";
        }

        $body = $response->json();
        $detail = null;

        if (is_array($body)) {
            $detail = $body['mensaje'] ?? $body['message'] ?? $body['detail'] ?? $body['error'] ?? null;
            $detail = is_string($detail) ? $detail : json_encode($body, JSON_UNESCAPED_UNICODE);
        } elseif (filled($response->body())) {
            $detail = strip_tags($response->body());
        }

        return $this->sanitize("Contífico respondió {$status}".(filled($detail) ? ': '.$detail : '.'));
    }

    /** Quita la API key y el token de un texto antes de guardarlo o loguearlo. */
    private function sanitize(?string $message): string
    {
        $message = (string) $message;

        foreach ([$this->apiKey(), $this->apiToken()] as $secret) {
            if (filled($secret)) {
                $message = str_replace([$secret, rawurlencode($secret), urlencode($secret)], '***', $message);
            }
        }

        $message = preg_replace('/([?&]pos=)[^&\s"\']*/i', '$1***', $message) ?? '';

        return Str::limit(trim($message), 480);
    }

    // ─── Historial ───────────────────────────────────────────────────────────

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function record(Patient $patient, ?int $userId, int $attempt, array $attributes): ContificoSyncLog
    {
        $attributes += ['patient_id' => $patient->id, 'user_id' => $userId, 'attempt' => $attempt];

        // Un reintento de la cola reescribe la fila del intento fallido en vez
        // de sumar otra: el historial muestra envios, no intentos.
        if ($attempt > 1) {
            $previous = ContificoSyncLog::query()
                ->where('patient_id', $patient->id)
                ->where('status', ContificoSyncLog::STATUS_FAILED)
                ->latest('id')
                ->first();

            if ($previous) {
                $previous->fill($attributes + ['http_status' => null, 'contifico_id' => null])->save();

                return $previous;
            }
        }

        return ContificoSyncLog::create($attributes);
    }

    /**
     * @return array{ok: bool, message: string}
     */
    private function testResult(?int $userId, bool $ok, string $message, ?int $httpStatus = null): array
    {
        ContificoSyncLog::create([
            'user_id' => $userId,
            'action' => ContificoSyncLog::ACTION_TEST,
            'status' => $ok ? ContificoSyncLog::STATUS_SUCCESS : ContificoSyncLog::STATUS_FAILED,
            'http_status' => $httpStatus,
            'message' => $message,
        ]);

        return ['ok' => $ok, 'message' => $message];
    }

    // ─── Almacenamiento cifrado ──────────────────────────────────────────────

    private function storeSecret(string $key, ?string $value): void
    {
        Setting::set($key, blank($value) ? null : Crypt::encryptString(trim($value)));
    }

    /**
     * A diferencia de OpenAiService, no tolera un valor sin cifrar: si no se
     * puede descifrar (APP_KEY rotada, valor cargado a mano) cuenta como no
     * configurada y hay que reingresarla.
     */
    private function secret(string $key): ?string
    {
        $stored = Setting::get($key);

        if (blank($stored)) {
            return null;
        }

        try {
            return Crypt::decryptString($stored);
        } catch (\Throwable) {
            return null;
        }
    }
}
