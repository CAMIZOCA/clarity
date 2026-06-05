<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreDemoRequest;
use App\Models\DemoRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class DemoRequestController extends Controller
{
    public function store(StoreDemoRequest $request): JsonResponse
    {
        $rateKey = 'demo-request:' . sha1($request->ip() . '|' . $request->input('email'));

        if (RateLimiter::tooManyAttempts($rateKey, 3)) {
            return response()->json([
                'message' => 'Has enviado varias solicitudes recientemente. Intenta nuevamente mas tarde.',
            ], 429);
        }

        RateLimiter::hit($rateKey, 3600);

        DemoRequest::create([
            ...$request->safe()->except('website'),
            'status' => 'new',
            'source' => 'landing',
            'ip_hash' => hash('sha256', (string) $request->ip()),
            'user_agent' => Str::limit((string) $request->userAgent(), 500, ''),
            'submitted_at' => now(),
        ]);

        return response()->json([
            'message' => 'Solicitud registrada correctamente.',
        ], 201);
    }
}
