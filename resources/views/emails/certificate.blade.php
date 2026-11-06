@extends('emails.layouts.clinic', ['preheader' => 'Adjuntamos su Certificado Visual de '.$brand['name'].'.'])

@section('content')
    <h1 style="margin:0 0 18px 0; font-family:Georgia, 'Times New Roman', serif; font-size:24px; font-weight:bold; color:{{ $brand['navy'] }};">Certificado Visual</h1>

    <p style="margin:0 0 14px 0;">Estimado(a){{ $patientName ? ' '.$patientName : '' }},</p>

    <p style="margin:0 0 14px 0;">Adjuntamos su <strong>Certificado Visual</strong> emitido por {{ $brand['name'] }} tras su consulta.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;">
        <tr>
            <td style="background-color:#f1f5fb; border-left:4px solid {{ $brand['blue'] }}; border-radius:8px; padding:16px 18px; font-size:14px; color:#2d3748;">
                <strong style="color:{{ $brand['navy'] }};">Documento adjunto:</strong> {{ $filename }}<br>
                Ábralo desde este correo para verlo, imprimirlo o guardarlo.
            </td>
        </tr>
    </table>

    <p style="margin:0 0 14px 0;">Si tiene alguna duda sobre el resultado de su examen, no dude en contactarnos.</p>

    <p style="margin:0;">Gracias por su confianza.<br><strong style="color:{{ $brand['navy'] }};">{{ $brand['name'] }}</strong></p>
@endsection
