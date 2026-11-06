<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Recordatorio de cita por correo (AppointmentReminderService). El automatico
     * nace apagado: se enciende en Configuracion → Correo despues de probar el SMTP.
     */
    private array $keys = [
        'appointment_email_reminders_enabled' => '0',
        'appointment_reminder_hours' => '24',
    ];

    public function up(): void
    {
        foreach ($this->keys as $key => $value) {
            // Solo si falta: no pisar un valor ya elegido en Configuracion.
            if (DB::table('settings')->where('key', $key)->exists()) {
                continue;
            }

            DB::table('settings')->insert([
                'key' => $key,
                'value' => $value,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        DB::table('settings')->whereIn('key', array_keys($this->keys))->delete();
    }
};
