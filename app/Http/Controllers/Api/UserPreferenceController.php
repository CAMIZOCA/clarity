<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\UserPreferenceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserPreferenceController extends Controller
{
    public function __construct(private readonly UserPreferenceService $preferences) {}

    /**
     * Cambia las preferencias del usuario que hace la peticion. No pide
     * `users.edit`: cada uno elige su propia plantilla de pantalla.
     */
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ui_template' => ['sometimes', 'nullable', 'string', Rule::in(User::UI_TEMPLATES)],
        ]);

        $user = $this->preferences->update($request->user(), $data);

        return (new UserResource($user))->response();
    }
}
