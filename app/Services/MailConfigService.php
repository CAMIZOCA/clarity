<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Config;

class MailConfigService
{
    /**
     * Aplicar en runtime la configuración SMTP guardada en Settings.
     * Sobrescribe la config de `mail` para el envío actual (ej. Gmail SMTP).
     *
     * Gmail: host smtp.gmail.com, port 465 (ssl) o 587 (tls),
     * username = correo Gmail, password = App Password de Google.
     */
    public static function apply(): void
    {
        $host = Setting::get('mail_host');

        // Sin host configurado no forzamos SMTP: se respeta el mailer por defecto.
        if (! filled($host)) {
            return;
        }

        $encryption = Setting::get('mail_encryption') ?: null; // 'tls' | 'ssl' | null
        $fromAddress = Setting::get('mail_from_address')
            ?: Setting::get('mail_username')
            ?: config('mail.from.address');
        $fromName = Setting::get('mail_from_name')
            ?: Setting::get('clinic_name')
            ?: config('mail.from.name');

        Config::set('mail.default', 'smtp');
        Config::set('mail.mailers.smtp.host', $host);
        Config::set('mail.mailers.smtp.port', (int) (Setting::get('mail_port') ?: 587));
        Config::set('mail.mailers.smtp.username', Setting::get('mail_username'));
        Config::set('mail.mailers.smtp.password', Setting::get('mail_password'));
        Config::set('mail.mailers.smtp.scheme', $encryption === 'ssl' ? 'smtps' : null);
        Config::set('mail.mailers.smtp.encryption', $encryption);

        Config::set('mail.from.address', $fromAddress);
        Config::set('mail.from.name', $fromName);
    }

    /**
     * ¿Hay una configuración SMTP mínima (host) disponible?
     */
    public static function isConfigured(): bool
    {
        return filled(Setting::get('mail_host'));
    }
}
