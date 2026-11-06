<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\Setting;
use Carbon\CarbonInterface;

/**
 * Evento de calendario de una cita: el .ics que se adjunta al recordatorio
 * (Gmail, Apple Calendar, Samsung y Outlook lo ofrecen para añadir) y los
 * enlaces de "Agregar a Google Calendar / Outlook".
 *
 * Las horas viajan en UTC: la BD guarda hora local de Guayaquil (APP_TIMEZONE)
 * y cada calendario la muestra en la zona del telefono del paciente.
 */
class AppointmentCalendarService
{
    public function summary(Appointment $appointment): string
    {
        $clinic = Setting::get('clinic_name') ?: 'Óptica';
        $title = trim((string) $appointment->titulo);

        return $title !== '' ? "Cita en {$clinic} – {$title}" : "Cita en {$clinic}";
    }

    public function location(): string
    {
        return trim((string) (Setting::get('clinic_address') ?: Setting::get('clinic_name') ?: ''));
    }

    public function description(Appointment $appointment): string
    {
        $lines = [];
        if ($appointment->optometrista?->name) {
            $lines[] = 'Profesional: '.$appointment->optometrista->name;
        }
        if ($phone = Setting::get('clinic_phone')) {
            $lines[] = 'Teléfono: '.$phone;
        }
        $lines[] = 'Si no puede asistir, por favor avísenos para reprogramar.';

        return implode("\n", $lines);
    }

    public function ics(Appointment $appointment): string
    {
        $appointment->loadMissing('optometrista:id,name');

        $lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Optica Andina//Sistema Clinico//ES',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'BEGIN:VEVENT',
            'UID:'.$this->uid($appointment),
            'DTSTAMP:'.$this->utc(now()),
            'DTSTART:'.$this->utc($appointment->fecha_hora_inicio),
            'DTEND:'.$this->utc($this->end($appointment)),
            'SUMMARY:'.$this->escape($this->summary($appointment)),
            'DESCRIPTION:'.$this->escape($this->description($appointment)),
        ];

        if ($location = $this->location()) {
            $lines[] = 'LOCATION:'.$this->escape($location);
        }

        // SEQUENCE sube con cada edicion: si se reenvia tras mover la cita, el
        // calendario actualiza el evento en vez de duplicarlo.
        $lines[] = 'SEQUENCE:'.max(0, (int) $appointment->updated_at?->timestamp - (int) $appointment->created_at?->timestamp);
        $lines[] = 'STATUS:'.($appointment->estado === 'cancelado' ? 'CANCELLED' : 'CONFIRMED');
        $lines[] = 'BEGIN:VALARM';
        $lines[] = 'ACTION:DISPLAY';
        $lines[] = 'DESCRIPTION:'.$this->escape($this->summary($appointment));
        $lines[] = 'TRIGGER:-PT2H';
        $lines[] = 'END:VALARM';
        $lines[] = 'END:VEVENT';
        $lines[] = 'END:VCALENDAR';

        return implode("\r\n", array_map(fn ($line) => $this->fold($line), $lines))."\r\n";
    }

    public function googleUrl(Appointment $appointment): string
    {
        return 'https://calendar.google.com/calendar/render?'.http_build_query([
            'action' => 'TEMPLATE',
            'text' => $this->summary($appointment),
            'dates' => $this->utc($appointment->fecha_hora_inicio).'/'.$this->utc($this->end($appointment)),
            'details' => $this->description($appointment),
            'location' => $this->location(),
        ], '', '&', PHP_QUERY_RFC3986);
    }

    public function outlookUrl(Appointment $appointment): string
    {
        return 'https://outlook.live.com/calendar/0/deeplink/compose?'.http_build_query([
            'path' => '/calendar/action/compose',
            'rru' => 'addevent',
            'subject' => $this->summary($appointment),
            'startdt' => $appointment->fecha_hora_inicio->copy()->utc()->format('Y-m-d\TH:i:s\Z'),
            'enddt' => $this->end($appointment)->copy()->utc()->format('Y-m-d\TH:i:s\Z'),
            'body' => $this->description($appointment),
            'location' => $this->location(),
        ], '', '&', PHP_QUERY_RFC3986);
    }

    private function uid(Appointment $appointment): string
    {
        $host = parse_url((string) config('app.url'), PHP_URL_HOST) ?: 'sistemaclinico';

        return "appointment-{$appointment->id}@{$host}";
    }

    /** Una cita sin fin valido dura 30 minutos. */
    private function end(Appointment $appointment): CarbonInterface
    {
        $end = $appointment->fecha_hora_fin;

        return $end && $end->greaterThan($appointment->fecha_hora_inicio)
            ? $end
            : $appointment->fecha_hora_inicio->copy()->addMinutes(30);
    }

    private function utc(CarbonInterface $date): string
    {
        return $date->copy()->utc()->format('Ymd\THis\Z');
    }

    /** RFC 5545 §3.3.11: escapar \ ; , y saltos de linea. */
    private function escape(string $text): string
    {
        return str_replace(
            ['\\', ';', ',', "\r\n", "\n"],
            ['\\\\', '\;', '\,', '\n', '\n'],
            $text,
        );
    }

    /** RFC 5545 §3.1: lineas de max. 75 octetos, continuadas con CRLF + espacio. */
    private function fold(string $line): string
    {
        if (strlen($line) <= 75) {
            return $line;
        }

        $out = [];
        $current = '';
        $limit = 75;
        foreach (mb_str_split($line) as $char) {
            if (strlen($current) + strlen($char) > $limit) {
                $out[] = $current;
                $current = '';
                $limit = 74; // la continuacion empieza con un espacio
            }
            $current .= $char;
        }
        $out[] = $current;

        return implode("\r\n ", $out);
    }
}
