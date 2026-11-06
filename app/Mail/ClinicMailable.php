<?php

namespace App\Mail;

use App\Models\Setting;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

/**
 * Base de los correos de la clinica: todos usan el layout
 * `emails.layouts.clinic` y reciben `$brand` con los datos de Configuracion.
 */
abstract class ClinicMailable extends Mailable
{
    use Queueable, SerializesModels;

    /** Colores del certificado (CertificateDocxService::NAVY / BLUE). */
    public const NAVY = '#1A2A4A';

    public const BLUE = '#2F6DB5';

    public static function brand(): array
    {
        $logo = Setting::get('clinic_logo');
        $logoPath = null;
        if ($logo) {
            try {
                $disk = Storage::disk('public');
                $logoPath = $disk->exists($logo) ? $disk->path($logo) : null;
            } catch (\Throwable) {
                $logoPath = null;
            }
        }

        $website = Setting::get('clinic_website');
        $websiteUrl = $website && ! preg_match('#^https?://#i', $website) ? 'https://'.$website : $website;

        return [
            'name' => Setting::get('clinic_name') ?: 'Óptica',
            'tagline' => Setting::get('clinic_tagline'),
            'address' => Setting::get('clinic_address'),
            'phone' => Setting::get('clinic_phone'),
            'email' => Setting::get('clinic_email'),
            'website' => $website,
            'website_url' => $websiteUrl,
            'logo_path' => $logoPath,
            'navy' => self::NAVY,
            'blue' => self::BLUE,
        ];
    }
}
