<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class SettingController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Setting::all_map());
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'clinic_name'     => 'sometimes|string|max:255',
            'clinic_tagline'  => 'sometimes|nullable|string|max:255',
            'clinic_address'  => 'sometimes|nullable|string|max:500',
            'clinic_phone'    => 'sometimes|nullable|string|max:100',
            'required_fields' => 'sometimes|array',
        ]);

        foreach ($data as $key => $value) {
            if ($key === 'required_fields') {
                Setting::set($key, json_encode($value));
            } else {
                Setting::set($key, $value);
            }
        }

        return response()->json(Setting::all_map());
    }

    public function uploadLogo(Request $request): JsonResponse
    {
        $request->validate(['logo' => 'required|image|max:2048']);

        $old = Setting::get('clinic_logo');
        if ($old) Storage::disk('public')->delete($old);

        $path = $request->file('logo')->store('clinic', 'public');
        Setting::set('clinic_logo', $path);

        return response()->json([
            'clinic_logo' => $path,
            'clinic_logo_url' => Storage::disk('public')->url($path),
        ]);
    }
}
