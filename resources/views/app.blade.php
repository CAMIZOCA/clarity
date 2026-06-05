<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Clarity | Sistema de gestion para opticas</title>
    <meta name="description" content="Clarity centraliza pacientes, consultas, recetas, ventas, inventario, laboratorio, caja, CRM, sucursales y reportes para opticas.">
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
