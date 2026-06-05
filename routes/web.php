<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\DemoRequestController;

Route::post('/login', [AuthController::class, 'login'])->middleware('guest');
Route::post('/demo-request', [DemoRequestController::class, 'store'])
    ->middleware('throttle:3,1');

Route::middleware('auth')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
});

// SPA catch-all: todas las rutas las maneja React Router
Route::get('/{any}', fn() => view('app'))->where('any', '.*');
