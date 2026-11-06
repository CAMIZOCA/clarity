@extends('emails.layouts.clinic', ['preheader' => 'La configuración de correo de '.$brand['name'].' funciona.'])

@section('content')
    <h1 style="margin:0 0 18px 0; font-family:Georgia, 'Times New Roman', serif; font-size:24px; font-weight:bold; color:{{ $brand['navy'] }};">¡El correo funciona!</h1>

    <p style="margin:0 0 14px 0;">Este es un correo de prueba de <strong>{{ $brand['name'] }}</strong>.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;">
        <tr>
            <td style="background-color:#ecf8f1; border-left:4px solid #2f9e62; border-radius:8px; padding:16px 18px; font-size:14px; color:#22543d;">
                Si está leyendo este mensaje, la configuración SMTP está correcta y el sistema ya puede enviar certificados y recordatorios de citas.
            </td>
        </tr>
    </table>

    <p style="margin:0; font-size:13px; color:#7a8699;">Enviado el {{ $sentAt }}.</p>
@endsection
