<!DOCTYPE html>
@php
    // Plantilla de pantalla resuelta en el servidor para pintar el primer cuadro
    // sin parpadeo (UiTemplateContext la mantiene al dia despues de /me).
    $uiTemplate = auth()->user()?->ui_template
        ?? rescue(fn () => \App\Models\Setting::get('ui_template_default', 'clasico'), 'clasico', false);
    $uiTemplate = in_array($uiTemplate, \App\Models\User::UI_TEMPLATES, true) ? $uiTemplate : 'clasico';
@endphp
<html lang="es" data-ui="{{ $uiTemplate }}" data-ui-source="{{ auth()->check() ? 'server' : 'guest' }}">
<head>
    <script>
        // Sin sesion (login, PWA sin red) se usa la ultima plantilla vista en este equipo.
        (function () {
            var root = document.documentElement;
            if (root.getAttribute('data-ui-source') !== 'guest') return;
            try {
                var saved = localStorage.getItem('clarity.ui.template.v1');
                if (saved === 'clasico' || saved === 'compacto') root.setAttribute('data-ui', saved);
            } catch (e) {}
        })();
    </script>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="app-build" content="{{ \App\Services\AppVersion::current() }}">
    <title>Clarity | Sistema de gestion para opticas</title>
    <meta name="description" content="Clarity centraliza pacientes, consultas, recetas, ventas, inventario, laboratorio, caja, CRM, sucursales y reportes para opticas.">
    <meta name="theme-color" content="#05070f">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="apple-mobile-web-app-title" content="Clarity">
    <link rel="manifest" href="/manifest.webmanifest">
    <link rel="apple-touch-icon" href="/pwa/apple-touch-icon.png">
    <link rel="icon" type="image/png" href="/pwa/icon-192.png">
    <meta property="og:title" content="Clarity | Sistema de gestion para opticas">
    <meta property="og:description" content="Gestiona la operacion diaria de tu optica desde una plataforma moderna y especializada.">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary_large_image">
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.jsx'])
</head>
<body class="bg-gray-50 font-sans antialiased">
    <div id="app"></div>
</body>
</html>
