{{--
    Layout comun de los correos de la clinica.
    HTML de tablas con estilos en linea: es lo unico que Gmail, Outlook y los
    clientes moviles respetan por igual. Variables: $brand, $preheader (opcional).
--}}
<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>{{ $brand['name'] }}</title>
    <style>
        @media only screen and (max-width: 620px) {
            .container { width: 100% !important; }
            .px { padding-left: 20px !important; padding-right: 20px !important; }
            .btn-cell { display: block !important; width: 100% !important; padding: 0 0 10px 0 !important; }
            .btn-cell a { display: block !important; }
        }
    </style>
</head>
<body style="margin:0; padding:0; background-color:#eef2f7; -webkit-text-size-adjust:100%;">
@if (! empty($preheader))
    <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#eef2f7;">{{ $preheader }}</div>
@endif
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef2f7;">
    <tr>
        <td align="center" style="padding:28px 12px;">
            <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 2px 10px rgba(26,42,74,0.08);">
                {{-- Cabecera --}}
                <tr>
                    <td align="center" class="px" style="padding:26px 40px 18px 40px; background-color:#ffffff;">
                        @if (! empty($brand['logo_path']) && isset($message))
                            <img src="{{ $message->embed($brand['logo_path']) }}" alt="{{ $brand['name'] }}" height="64" style="display:block; height:64px; width:auto; max-width:260px; border:0;">
                        @else
                            <div style="font-family:Georgia, 'Times New Roman', serif; font-size:26px; font-weight:bold; color:{{ $brand['navy'] }};">{{ $brand['name'] }}</div>
                        @endif
                        @if (! empty($brand['tagline']))
                            <div style="font-family:Arial, Helvetica, sans-serif; font-size:12px; letter-spacing:1px; text-transform:uppercase; color:#7a8699; padding-top:8px;">{{ $brand['tagline'] }}</div>
                        @endif
                    </td>
                </tr>
                <tr>
                    <td style="height:4px; line-height:4px; font-size:0; background-color:{{ $brand['navy'] }}; background-image:linear-gradient(90deg, {{ $brand['navy'] }}, {{ $brand['blue'] }});">&nbsp;</td>
                </tr>

                {{-- Contenido --}}
                <tr>
                    <td class="px" style="padding:34px 40px 30px 40px; font-family:Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#2d3748;">
                        @yield('content')
                    </td>
                </tr>

                {{-- Pie --}}
                <tr>
                    <td class="px" style="padding:22px 40px 26px 40px; background-color:#f6f8fb; border-top:1px solid #e3e8ef; font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:1.6; color:#6b7686; text-align:center;">
                        <div style="font-weight:bold; color:{{ $brand['navy'] }}; font-size:13px;">{{ $brand['name'] }}</div>
                        @if (! empty($brand['address']))
                            <div>{{ $brand['address'] }}</div>
                        @endif
                        @if (! empty($brand['phone']) || ! empty($brand['email']))
                            <div>
                                @if (! empty($brand['phone']))Tel. {{ $brand['phone'] }}@endif
                                @if (! empty($brand['phone']) && ! empty($brand['email'])) &nbsp;·&nbsp; @endif
                                @if (! empty($brand['email']))<a href="mailto:{{ $brand['email'] }}" style="color:{{ $brand['blue'] }}; text-decoration:none;">{{ $brand['email'] }}</a>@endif
                            </div>
                        @endif
                        @if (! empty($brand['website_url']))
                            <div><a href="{{ $brand['website_url'] }}" style="color:{{ $brand['blue'] }}; text-decoration:none;">{{ $brand['website'] }}</a></div>
                        @endif
                        <div style="padding-top:12px; color:#9aa4b2; font-size:11px;">Este correo se envió desde el sistema de {{ $brand['name'] }}.</div>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
</body>
</html>
