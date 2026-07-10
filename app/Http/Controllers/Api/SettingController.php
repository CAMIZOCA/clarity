<?php

namespace App\Http\Controllers\Api;

use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class SettingController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Setting::all_map());
    }

    public function update(Request $request): JsonResponse
    {
        abort_unless($request->user()?->can(Permission::SETTINGS_EDIT->value), 403);

        $data = $request->validate([
            'clinic_name' => 'sometimes|string|max:255',
            'clinic_tagline' => 'sometimes|nullable|string|max:255',
            'clinic_address' => 'sometimes|nullable|string|max:500',
            'clinic_phone' => 'sometimes|nullable|string|max:100',
            'required_fields' => 'sometimes|array',
            'menu_visible_sections' => 'sometimes|array',
            'menu_visible_sections.*' => [
                'string',
                Rule::in([
                    'atencion_clinica',
                    'operacion_diaria',
                    'inventario',
                    'comercial',
                    'reportes',
                ]),
            ],
        ]);

        foreach ($data as $key => $value) {
            if (in_array($key, ['required_fields', 'menu_visible_sections'], true)) {
                Setting::set($key, json_encode($value));
            } else {
                Setting::set($key, $value);
            }
        }

        return response()->json(Setting::all_map());
    }

    public function uploadLogo(Request $request): JsonResponse
    {
        abort_unless($request->user()?->can(Permission::SETTINGS_EDIT->value), 403);

        $request->validate(['logo' => 'required|image|max:2048']);

        $old = Setting::get('clinic_logo');
        if ($old) {
            Storage::disk('public')->delete($old);
        }

        $path = $request->file('logo')->store('clinic', 'public');
        Setting::set('clinic_logo', $path);

        return response()->json([
            'clinic_logo' => $path,
            'clinic_logo_url' => Storage::disk('public')->url($path),
        ]);
    }
}
