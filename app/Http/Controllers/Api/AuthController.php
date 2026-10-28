<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        if (! Auth::attempt($request->only('email', 'password'))) {
            throw ValidationException::withMessages([
                'email' => ['Las credenciales son incorrectas.'],
            ]);
        }

        // `AuthenticateSession` (Sanctum) guarda el hash de la contrasena en la sesion y
        // solo lo revisa mientras hay usuario. Si el anterior ya no existe (borrado), el
        // hash viejo queda ahi: el login respondia 200 pero el siguiente request no
        // coincidia, vaciaba la sesion y todo /api daba 401 con el usuario "dentro".
        $request->session()->forget(
            array_values(array_filter(
                array_keys($request->session()->all()),
                fn (string $key) => str_starts_with($key, 'password_hash_'),
            ))
        );

        $request->session()->regenerate();

        $user = Auth::user()->load('roles');

        return response()->json([
            'user' => UserResource::make($user),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Sesión cerrada correctamente.']);
    }

    public function me(Request $request): JsonResponse
    {
        return UserResource::make($request->user()->load('roles'))->response();
    }
}
