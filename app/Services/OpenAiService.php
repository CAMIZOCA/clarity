<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Acceso a la API de OpenAI, configurada desde Ajustes -> Inteligencia artificial.
 *
 * La clave se guarda cifrada en la tabla `settings` (a diferencia de
 * `mail_password`, que quedo en texto plano) y nunca se devuelve al frontend:
 * `SettingController` la enmascara con el marcador `__stored__`.
 *
 * Por ahora solo expone la verificacion de credenciales. La transcripcion de
 * audio para la consulta se documenta en docs/ai-consulta-por-voz.md.
 */
class OpenAiService
{
    public const SETTING_KEY = 'openai_api_key';

    private const BASE_URL = 'https://api.openai.com/v1';

    /** Guarda la clave cifrada. Una cadena vacia borra la configuracion. */
    public function storeApiKey(?string $apiKey): void
    {
        Setting::set(self::SETTING_KEY, blank($apiKey) ? null : Crypt::encryptString(trim($apiKey)));
    }

    /**
     * Clave en claro, o null si no hay ninguna configurada.
     *
     * Tolera un valor sin cifrar por si alguien lo cargo a mano en la base.
     */
    public function apiKey(): ?string
    {
        $stored = Setting::get(self::SETTING_KEY);

        if (blank($stored)) {
            return null;
        }

        try {
            return Crypt::decryptString($stored);
        } catch (\Throwable) {
            return is_string($stored) ? $stored : null;
        }
    }

    public function isConfigured(): bool
    {
        return filled($this->apiKey());
    }

    /**
     * Comprueba que la clave sea valida pidiendo la lista de modelos.
     *
     * @return array{ok: bool, message: string}
     */
    public function testConnection(): array
    {
        $apiKey = $this->apiKey();

        if (blank($apiKey)) {
            return ['ok' => false, 'message' => 'No hay una API key de OpenAI configurada.'];
        }

        try {
            $response = Http::withToken($apiKey)
                ->timeout(15)
                ->get(self::BASE_URL.'/models');
        } catch (\Throwable $e) {
            Log::warning('OpenAI: fallo la verificacion de conexion', ['error' => $e->getMessage()]);

            return ['ok' => false, 'message' => 'No se pudo contactar a OpenAI. Revise la conexion del servidor.'];
        }

        if ($response->successful()) {
            return ['ok' => true, 'message' => 'Conexion correcta con OpenAI.'];
        }

        if ($response->status() === 401) {
            return ['ok' => false, 'message' => 'La API key fue rechazada por OpenAI (401).'];
        }

        return [
            'ok' => false,
            'message' => "OpenAI respondio con un error {$response->status()}.",
        ];
    }
}
