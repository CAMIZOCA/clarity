<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Claves de configuración para el pie de página del certificado y el
     * envío de correo (SMTP configurable desde Configuraciones del sistema).
     */
    private array $keys = [
        'clinic_email'       => '',
        'clinic_website'     => '',
        'mail_host'          => '',
        'mail_port'          => '',
        'mail_username'      => '',
        'mail_password'      => '',
        'mail_encryption'    => 'tls',
        'mail_from_address'  => '',
        'mail_from_name'     => '',
    ];

    public function up(): void
    {
        foreach ($this->keys as $key => $value) {
            DB::table('settings')->updateOrInsert(
                ['key' => $key],
                [
                    'value'      => $value,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }

    public function down(): void
    {
        DB::table('settings')->whereIn('key', array_keys($this->keys))->delete();
    }
};
