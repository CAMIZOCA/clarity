<?php

namespace App\Mail;

use App\Models\Appointment;
use App\Services\AppointmentCalendarService;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class AppointmentReminderMail extends ClinicMailable
{
    public function __construct(public Appointment $appointment) {}

    public function envelope(): Envelope
    {
        $date = $this->appointment->fecha_hora_inicio;

        return new Envelope(
            subject: 'Recordatorio de su cita - '.self::brand()['name'].' - '.$this->shortDate($date).' '.$date->format('H:i'),
        );
    }

    public function content(): Content
    {
        $this->appointment->loadMissing(['patient:id,nombre,apellido,email', 'optometrista:id,name']);
        $calendar = app(AppointmentCalendarService::class);
        $start = $this->appointment->fecha_hora_inicio;

        return new Content(
            view: 'emails.appointment-reminder',
            text: 'emails.appointment-reminder-text',
            with: [
                'brand' => self::brand(),
                'patientName' => $this->appointment->patient?->nombre_completo,
                'dateLabel' => $this->longDate($start),
                'timeLabel' => $start->format('H:i'),
                'motivo' => trim((string) $this->appointment->titulo) ?: null,
                'doctor' => $this->appointment->optometrista?->name,
                'googleUrl' => $calendar->googleUrl($this->appointment),
                'outlookUrl' => $calendar->outlookUrl($this->appointment),
            ],
        );
    }

    /**
     * @return array<int, Attachment>
     */
    public function attachments(): array
    {
        return [
            Attachment::fromData(
                fn () => app(AppointmentCalendarService::class)->ics($this->appointment),
                'cita.ics',
            )->withMime('text/calendar; charset=UTF-8; method=PUBLISH'),
        ];
    }

    private function longDate($date): string
    {
        return ucfirst($date->copy()->locale('es')->isoFormat('dddd D [de] MMMM [de] YYYY'));
    }

    private function shortDate($date): string
    {
        return $date->format('d/m/Y');
    }
}
