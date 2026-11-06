CERTIFICADO VISUAL

Estimado(a){{ $patientName ? ' '.$patientName : '' }},

Adjuntamos su Certificado Visual emitido por {{ $brand['name'] }} tras su consulta ({{ $filename }}).

Si tiene alguna duda sobre el resultado de su examen, no dude en contactarnos.

Gracias por su confianza.
{{ $brand['name'] }}
@include('emails.partials.footer-text')
