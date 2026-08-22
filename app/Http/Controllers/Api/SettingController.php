<?php

namespace App\Http\Controllers\Api;

use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Services\OpenAiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class SettingController extends Controller
{
    /**
     * Claves sensibles que no deben exponerse en texto plano en la respuesta.
     */
    private const MASKED_KEYS = ['mail_password', OpenAiService::SETTING_KEY];

    public function __construct(private OpenAiService $openAi) {}

    public function index(): JsonResponse
    {
        $settings = Setting::all_map();

        foreach (self::MASKED_KEYS as $key) {
            if (! empty($settings[$key] ?? null)) {
                // Marcador: indica que hay una contraseña guardada sin revelarla.
                $settings[$key] = '__stored__';
            }
        }

        return response()->json($settings);
    }

    public function update(Request $request): JsonResponse
    {
        abort_unless($request->user()?->can(Permission::SETTINGS_EDIT->value), 403);

        $data = $request->validate([
            'clinic_name' => 'sometimes|string|max:255',
            'clinic_tagline' => 'sometimes|nullable|string|max:255',
            'clinic_address' => 'sometimes|nullable|string|max:500',
            'clinic_phone' => 'sometimes|nullable|string|max:100',
            'clinic_email' => 'sometimes|nullable|email|max:150',
            'clinic_website' => 'sometimes|nullable|string|max:150',
            // Configuración SMTP (correo del certificado)
            'mail_host' => 'sometimes|nullable|string|max:150',
            'mail_port' => 'sometimes|nullable|integer|min:1|max:65535',
            'mail_username' => 'sometimes|nullable|string|max:150',
            'mail_password' => 'sometimes|nullable|string|max:255',
            'mail_encryption' => ['sometimes', 'nullable', Rule::in(['tls', 'ssl', ''])],
            'mail_from_address' => 'sometimes|nullable|email|max:150',
            'mail_from_name' => 'sometimes|nullable|string|max:150',
            // Se guarda cifrada; ver OpenAiService::storeApiKey().
            'openai_api_key' => 'sometimes|nullable|string|max:255',
            'required_fields' => 'sometimes|array',
            'advanced_form_fields' => 'sometimes|array',
            'advanced_form_fields.*' => 'string|max:120',
            'menu_visible_sections' => 'sometimes|array|min:1',
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
            'menu_visible_items' => 'sometimes|array|min:1',
            'menu_visible_items.*' => [
                'string',
                Rule::in([
                    'pacientes',
                    'consulta',
                    'agenda',
                    'ordenes_trabajo',
                    'lentes_especiales',
                    'referencias',
                    'brigadas',
                    'pos',
                    'ventas',
                    'caja',
                    'laboratorio',
                    'inventario_productos',
                    'inventario_stock',
                    'inventario_movimientos',
                    'crm_campanas',
                    'crm_plantillas',
                    'crm_recordatorios',
                    'reportes_clinicos',
                    'reportes_comerciales',
                    'dashboard_gerencial',
                ]),
            ],
        ]);

        foreach ($data as $key => $value) {
            // Los secretos no se sobrescriben si llegan vacíos o con el marcador:
            // el frontend nunca recibe el valor real, solo `__stored__`.
            $isSecret = in_array($key, self::MASKED_KEYS, true);
            if ($isSecret && (blank($value) || $value === '__stored__')) {
                continue;
            }

            if ($key === OpenAiService::SETTING_KEY) {
                $this->openAi->storeApiKey($value);
                continue;
            }

            if (in_array($key, ['required_fields', 'advanced_form_fields', 'menu_visible_sections', 'menu_visible_items'], true)) {
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
