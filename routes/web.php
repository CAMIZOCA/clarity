<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\DemoRequestController;
use App\Services\AppVersion;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login'])->middleware('guest');
Route::post('/demo-request', [DemoRequestController::class, 'store'])
    ->middleware('throttle:3,1');

Route::middleware('auth')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
});

// Version del build en servicio: el SPA la compara con la que cargo para ofrecer actualizar.
Route::get('/app-version.json', fn () => response()
    ->json(['version' => AppVersion::current()])
    ->header('Cache-Control', 'no-store, max-age=0'));

// SPA catch-all: todas las rutas las maneja React Router
Route::get('/{any}', fn () => view('app'))->where('any', '.*');
