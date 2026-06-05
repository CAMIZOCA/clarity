<?php

namespace App\Services;

use App\Models\Reminder;
use Illuminate\Support\Facades\Log;

/**
 * Servicio de envío de WhatsApp.
 * Por defecto usa modo 'log' (sin envío real).
 * Configurar WHATSAPP_PROVIDER=twilio en .env para producción.
 */
class WhatsAppService
{
    private string $provider;

    public function __construct()
    {
        $this->provider = config('services.whatsapp.provider', 'log');
    }

    /**
     * Enviar mensaje de WhatsApp a un número.
     * @throws \Exception si falla el envío
     */
    public function send(string $toPhone, string $message): array
    {
        $phone = $this->normalizePhone($toPhone);

        return match($this->provider) {
            'twilio'    => $this->sendViaTwilio($phone, $message),
            'log'       => $this->sendViaLog($phone, $message),
            default     => $this->sendViaLog($phone, $message),
        };
    }

    /**
     * Enviar a partir de un Reminder guardado.
     * Actualiza el reminder con el resultado.
     */
    public function sendReminder(Reminder $reminder): bool
    {
        try {
            $phone = $reminder->patient->telefono;
            $this->send($phone, $reminder->message);
            $reminder->update(['status' => 'sent', 'sent_at' => now()]);
            return true;
        } catch (\Exception $e) {
            $reminder->update(['status' => 'failed', 'error_message' => $e->getMessage()]);
            Log::error("WhatsApp send failed for reminder {$reminder->id}: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Normaliza número ecuatoriano a formato internacional.
     * 0991234567 → +593991234567
     */
    private function normalizePhone(string $phone): string
    {
        $clean = preg_replace('/[^0-9]/', '', $phone);
        if (str_starts_with($clean, '0')) {
            $clean = '593' . substr($clean, 1);
        }
        return '+' . $clean;
    }

    private function sendViaTwilio(string $phone, string $message): array
    {
        // Requiere: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
        $sid   = config('services.twilio.sid');
        $token = config('services.twilio.token');
        $from  = config('services.twilio.whatsapp_from', 'whatsapp:+14155238886');

        if (!$sid || !$token) {
            throw new \Exception('Twilio no está configurado. Verificar TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN en .env');
        }

        // Implementación real con SDK Twilio (instalar con composer require twilio/sdk)
        // Por ahora solo loga hasta que se instale el SDK
        Log::info("TWILIO_STUB → {$phone}: {$message}");
        return ['status' => 'queued', 'sid' => 'stub-' . uniqid()];
    }

    private function sendViaLog(string $phone, string $message): array
    {
        Log::channel('stack')->info("📱 WHATSAPP [LOG MODE] → {$phone}: {$message}");
        return ['status' => 'logged', 'phone' => $phone, 'preview' => substr($message, 0, 100)];
    }
}
