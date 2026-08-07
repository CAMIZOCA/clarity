<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Detras de Traefik y el tunel de Cloudflare: sin esto Laravel ve http,
        // genera URLs incorrectas y registra la IP del proxy en vez de la del cliente.
        $middleware->trustProxies(at: '*');
        $middleware->statefulApi();
        $middleware->validateCsrfTokens(except: [
            'login',
            'api/*',
        ]);
        $middleware->appendToGroup('api', \App\Http\Middleware\SetActiveBranch::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
