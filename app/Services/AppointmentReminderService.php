<?php

namespace App\Services;

use App\Mail\AppointmentReminderMail;
use App\Models\Appointment;
use App\Models\Reminder;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

/**
 * Recordatorio de cita por correo: boton "Enviar recordatorio" de la Agenda y
 * envio automatico N horas antes (`appointments:send-email-reminders`).
 *
 * Cada envio queda en `reminders` (type=appointment, channel=email, referencia
 * a la cita). Ese registro es lo que impide que el automatico repita el correo.
 */
class AppointmentReminderService
{
    public const SETTING_ENABLED = 'appointment_email_reminders_enabled';

    public const SETTING_HOURS = 'appointment_reminder_hours';

    public const DEFAULT_HOURS = 24;

    /**
     * Motivo por el que la cita no puede recibir el recordatorio, o null si puede.
     */
    public function cannotSendReason(Appointment $appointment): ?string
    {
        $appointment->loadMissing('patient:id,nombre,apellido,email');

        if ($appointment->estado === 'cancelado') {
            return 'La cita está cancelada.';
        }
        if (! $appointment->patient) {
            return 'La cita no tiene un paciente asignado.';
        }
        if (! filter_var(trim((string) $appointment->patient->email), FILTER_VALIDATE_EMAIL)) {
            return 'El paciente no tiene un correo electrónico válido. Agréguelo en su ficha.';
        }
        if (! MailConfigService::isConfigured()) {
            return 'El correo SMTP no está configurado. Revise Configuración → Correo.';
        }

        return null;
    }

    /**
     * Envia el recordatorio y lo registra. Devuelve el registro (sent o failed).
     *
     * @throws \InvalidArgumentException si la cita no puede recibirlo
     */
    public function sendEmail(Appointment $appointment, ?User $by = null): Reminder
    {
        if ($reason = $this->cannotSendReason($appointment)) {
            throw new \InvalidArgumentException($reason);
        }

        $email = trim($appointment->patient->email);
        $mail = new AppointmentReminderMail($appointment);

        $reminder = new Reminder([
            'patient_id' => $appointment->patient_id,
            'created_by' => $by?->id ?? $appointment->optometrista_id ?? User::query()->min('id'),
            'type' => 'appointment',
            'channel' => 'email',
            'message' => "Recordatorio por correo a {$email} de la cita del "
                .$appointment->fecha_hora_inicio->format('d/m/Y H:i'),
            'scheduled_at' => now(),
            'reference_type' => Appointment::class,
            'reference_id' => $appointment->id,
        ]);

        try {
            MailConfigService::send($email, $mail);
            $reminder->status = 'sent';
            $reminder->sent_at = now();
        } catch (\Throwable $e) {
            $reminder->status = 'failed';
            $reminder->error_message = MailConfigService::sanitize($e);
            Log::warning('No se pudo enviar el recordatorio de cita', [
                'appointment_id' => $appointment->id,
                'error' => $reminder->error_message,
            ]);
        }

        $reminder->save();

        return $reminder;
    }

    public function automaticEnabled(): bool
    {
        return filter_var(Setting::get(self::SETTING_ENABLED, '0'), FILTER_VALIDATE_BOOLEAN);
    }

    public function hoursBefore(): int
    {
        $hours = (int) Setting::get(self::SETTING_HOURS, self::DEFAULT_HOURS);

        return $hours >= 1 && $hours <= 168 ? $hours : self::DEFAULT_HOURS;
    }

    /**
     * Citas pendientes que empiezan dentro de las proximas N horas y aun no
     * recibieron recordatorio por correo. Una cita agendada con menos de N horas
     * de anticipacion tambien entra (recibe el suyo en la siguiente pasada).
     *
     * @return Collection<int, Appointment>
     */
    public function dueForAutomatic(): Collection
    {
        $now = now();

        return Appointment::query()
            ->with(['patient:id,nombre,apellido,email', 'optometrista:id,name'])
            ->where('estado', 'pendiente')
            ->whereNotNull('patient_id')
            ->where('fecha_hora_inicio', '>', $now)
            ->where('fecha_hora_inicio', '<=', $now->copy()->addHours($this->hoursBefore()))
            ->whereNotExists(function ($q) {
                $q->selectRaw('1')
                    ->from('reminders')
                    ->whereColumn('reminders.reference_id', 'appointments.id')
                    ->where('reminders.reference_type', Appointment::class)
                    ->where('reminders.channel', 'email')
                    ->where('reminders.type', 'appointment')
                    // Un fallo definitivo tampoco se reintenta en bucle cada 15 min:
                    // queda para el boton manual.
                    ->whereIn('reminders.status', ['sent', 'failed']);
            })
            ->orderBy('fecha_hora_inicio')
            ->get();
    }

    /**
     * Ultimo recordatorio por correo enviado de cada cita (id => fecha).
     *
     * @param  array<int>  $appointmentIds
     * @return array<int, string>
     */
    public function lastSentAt(array $appointmentIds): array
    {
        if ($appointmentIds === []) {
            return [];
        }

        return Reminder::query()
            ->where('reference_type', Appointment::class)
            ->whereIn('reference_id', $appointmentIds)
            ->where('channel', 'email')
            ->where('type', 'appointment')
            ->where('status', 'sent')
            ->selectRaw('reference_id, MAX(sent_at) as last_sent')
            ->groupBy('reference_id')
            ->pluck('last_sent', 'reference_id')
            ->map(fn ($v) => (string) $v)
            ->all();
    }
}
