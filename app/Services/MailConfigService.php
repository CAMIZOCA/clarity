<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Contracts\Mail\Mailable;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Mail;

class MailConfigService
{
    /**
     * Aplicar en runtime la configuración SMTP guardada en Settings.
     * Sobrescribe la config de `mail` para el envío actual.
     *
     * cPanel (opticaandina.com.ec): host mail.<dominio>, port 465 (ssl),
     * username = la cuenta completa (notificaciones@...).
     * Gmail: host smtp.gmail.com, port 465 (ssl) o 587 (tls), password = App Password.
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

        // El MailManager guarda el mailer ya resuelto: sin esto, un proceso largo
        // (cola, scheduler) seguiria con la configuracion anterior.
        Mail::purge('smtp');
    }

    /**
     * ¿Hay una configuración SMTP mínima (host) disponible?
     */
    public static function isConfigured(): bool
    {
        return filled(Setting::get('mail_host'));
    }

    /**
     * Unico punto de envio de correo del sistema: aplica el SMTP guardado y envia
     * en el momento (sin cola), para que quien pulsa el boton vea el resultado.
     *
     * @throws \Throwable si el servidor SMTP rechaza el envio
     */
    public static function send(string $to, Mailable $mailable): void
    {
        self::apply();
        Mail::to($to)->send($mailable);
    }

    /**
     * Mensaje de error apto para mostrar y guardar: nunca incluye la contraseña.
     */
    public static function sanitize(\Throwable|string $error): string
    {
        $message = $error instanceof \Throwable ? $error->getMessage() : $error;

        $password = Setting::get('mail_password');
        if (filled($password)) {
            $message = str_replace($password, '***', $message);
        }

        return mb_substr(trim($message), 0, 480);
    }
}
