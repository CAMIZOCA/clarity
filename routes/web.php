<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\DemoRequestController;
use App\Services\AppVersion;
use App\Services\SessionCheckService;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Route;
use Illuminate\View\Middleware\ShareErrorsFromSession;

Route::post('/login', [AuthController::class, 'login'])->middleware('guest');
Route::post('/demo-request', [DemoRequestController::class, 'store'])
    ->middleware('throttle:3,1');

Route::middleware('auth')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
});

// Version del build en servicio: el SPA la compara con la que cargo para ofrecer actualizar.
// Sin sesion a proposito: el SPA la pide al recuperar el foco, a veces justo mientras se
// inicia sesion, y su respuesta tardia reenviaba la cookie de sesion anterior y dejaba al
// usuario logueado en pantalla pero con 401 en todo /api.
Route::get('/app-version.json', fn () => response()
    ->json(['version' => AppVersion::current()])
    ->header('Cache-Control', 'no-store, max-age=0'))
    ->withoutMiddleware([StartSession::class, ShareErrorsFromSession::class, PreventRequestForgery::class]);

// Diagnostico de "Revisar conexion": servidor, base de datos, sesion y version, sin datos del usuario.
Route::get('/session-check', fn (SessionCheckService $service) => response()
    ->json($service->check())
    ->header('Cache-Control', 'no-store, max-age=0'))
    ->middleware('throttle:30,1');

// SPA catch-all: todas las rutas las maneja React Router
Route::get('/{any}', fn () => view('app'))->where('any', '.*');
