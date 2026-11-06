<?php

namespace App\Console\Commands;

use App\Services\AppointmentReminderService;
use Illuminate\Console\Command;

/**
 * Envia por correo el recordatorio de las citas que empiezan en las proximas
 * N horas (Configuracion → Correo). Programado cada 15 minutos.
 */
class SendAppointmentEmailReminders extends Command
{
    protected $signature = 'appointments:send-email-reminders {--force : Ejecutar aunque el envio automatico este desactivado}';

    protected $description = 'Enviar por correo el recordatorio de las citas proximas';

    public function handle(AppointmentReminderService $reminders): int
    {
        if (! $this->option('force') && ! $reminders->automaticEnabled()) {
            $this->info('El recordatorio automatico por correo esta desactivado.');

            return self::SUCCESS;
        }

        $sent = 0;
        $skipped = 0;
        $failed = 0;

        foreach ($reminders->dueForAutomatic() as $appointment) {
            if ($reason = $reminders->cannotSendReason($appointment)) {
                // Sin email o sin SMTP: no se registra nada, por si lo agregan despues.
                $skipped++;
                $this->line("Cita #{$appointment->id}: {$reason}");

                continue;
            }

            $reminder = $reminders->sendEmail($appointment);
            if ($reminder->status === 'sent') {
                $sent++;
            } else {
                $failed++;
                $this->warn("Cita #{$appointment->id}: {$reminder->error_message}");
            }
        }

        $this->info("Recordatorios enviados: {$sent}. Omitidos: {$skipped}. Fallidos: {$failed}.");

        return self::SUCCESS;
    }
}
