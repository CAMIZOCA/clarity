<x-mail::message>
# Certificado Visual

Estimado(a){{ $patientName ? ' ' . $patientName : '' }},

Adjuntamos su **Certificado Visual** emitido por {{ $clinicName }} tras su consulta.

Si tiene alguna duda sobre el resultado de su examen, no dude en contactarnos.

Gracias por su confianza.

<x-mail::subcopy>
{{ $clinicName }}
</x-mail::subcopy>
</x-mail::message>
