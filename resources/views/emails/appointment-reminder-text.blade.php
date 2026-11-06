RECORDATORIO DE SU CITA

Estimado(a){{ $patientName ? ' '.$patientName : '' }},

Le recordamos que tiene una cita en {{ $brand['name'] }}:

  Fecha: {{ $dateLabel }}
  Hora: {{ $timeLabel }}
@if ($motivo)
  Motivo: {{ $motivo }}
@endif
@if ($doctor)
  Profesional: {{ $doctor }}
@endif
@if (! empty($brand['address']))
  Lugar: {{ $brand['address'] }}
@endif

Agregar a Google Calendar: {!! $googleUrl !!}
En el teléfono, abra el archivo adjunto cita.ics para guardarla en su calendario.

Si no puede asistir, por favor avísenos{{ ! empty($brand['phone']) ? ' al '.$brand['phone'] : '' }} para reprogramar.

¡Le esperamos!
@include('emails.partials.footer-text')
