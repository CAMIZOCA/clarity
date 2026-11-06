@extends('emails.layouts.clinic', ['preheader' => 'Su cita es el '.$dateLabel.' a las '.$timeLabel.'.'])

@section('content')
    <h1 style="margin:0 0 18px 0; font-family:Georgia, 'Times New Roman', serif; font-size:24px; font-weight:bold; color:{{ $brand['navy'] }};">Recordatorio de su cita</h1>

    <p style="margin:0 0 14px 0;">Estimado(a){{ $patientName ? ' '.$patientName : '' }},</p>

    <p style="margin:0 0 6px 0;">Le recordamos que tiene una cita en <strong>{{ $brand['name'] }}</strong>:</p>

    {{-- Tarjeta de la cita --}}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 24px 0; border:1px solid #dbe4f0; border-radius:12px; border-collapse:separate;">
        <tr>
            <td width="96" align="center" valign="middle" style="background-color:{{ $brand['navy'] }}; border-radius:11px 0 0 11px; padding:18px 10px; font-family:Arial, Helvetica, sans-serif; color:#ffffff;">
                <div style="font-size:30px; font-weight:bold; line-height:1;">{{ $timeLabel }}</div>
                <div style="font-size:11px; letter-spacing:1px; text-transform:uppercase; padding-top:6px; color:#c8d4e6;">hora</div>
            </td>
            <td valign="middle" style="padding:16px 20px; font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:1.7; color:#2d3748;">
                <div style="font-size:16px; font-weight:bold; color:{{ $brand['navy'] }};">{{ $dateLabel }}</div>
                @if ($motivo)
                    <div><span style="color:#7a8699;">Motivo:</span> {{ $motivo }}</div>
                @endif
                @if ($doctor)
                    <div><span style="color:#7a8699;">Profesional:</span> {{ $doctor }}</div>
                @endif
                @if (! empty($brand['address']))
                    <div><span style="color:#7a8699;">Lugar:</span> {{ $brand['address'] }}</div>
                @endif
            </td>
        </tr>
    </table>

    {{-- Agregar al calendario --}}
    <p style="margin:0 0 12px 0; font-weight:bold; color:{{ $brand['navy'] }};">Agréguela a su calendario</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px 0;">
        <tr>
            <td class="btn-cell" style="padding:0 10px 0 0;">
                <a href="{{ $googleUrl }}" target="_blank" style="display:inline-block; background-color:{{ $brand['blue'] }}; color:#ffffff; font-family:Arial, Helvetica, sans-serif; font-size:14px; font-weight:bold; text-decoration:none; padding:12px 20px; border-radius:8px; text-align:center;">Google Calendar</a>
            </td>
            <td class="btn-cell" style="padding:0;">
                <a href="{{ $outlookUrl }}" target="_blank" style="display:inline-block; background-color:#ffffff; color:{{ $brand['blue'] }}; border:2px solid {{ $brand['blue'] }}; font-family:Arial, Helvetica, sans-serif; font-size:14px; font-weight:bold; text-decoration:none; padding:10px 20px; border-radius:8px; text-align:center;">Outlook</a>
            </td>
        </tr>
    </table>
    <p style="margin:0 0 22px 0; font-size:13px; color:#7a8699;">En iPhone, Android o Apple Mail abra el archivo adjunto <strong>cita.ics</strong> para guardarla en el calendario del teléfono.</p>

    <p style="margin:0 0 14px 0;">Le pedimos llegar unos minutos antes. Si no puede asistir, por favor avísenos{{ ! empty($brand['phone']) ? ' al '.$brand['phone'] : '' }} para reprogramar.</p>

    <p style="margin:0;">¡Le esperamos!<br><strong style="color:{{ $brand['navy'] }};">{{ $brand['name'] }}</strong></p>
@endsection
