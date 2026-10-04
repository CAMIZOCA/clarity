<?php

namespace App\Http\Controllers\Api;

use App\Enums\Permission;
use App\Exceptions\ContificoTemporaryException;
use App\Http\Controllers\Api\Concerns\ApiResponses;
use App\Http\Controllers\Controller;
use App\Models\ContificoSyncLog;
use App\Models\Patient;
use App\Services\ContificoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContificoController extends Controller
{
    use ApiResponses;

    /** Filas del historial que muestra Ajustes. */
    private const LOG_LIMIT = 10;

    public function __construct(private ContificoService $contifico) {}

    /**
     * Estado de la integracion (sin credenciales).
     * GET /api/contifico/status
     */
    public function status(Request $request): JsonResponse
    {
        $this->authorizeSettings($request);

        return $this->ok($this->contifico->status());
    }

    /**
     * Guarda credenciales y/o enciende la integracion.
     * PUT /api/contifico/config
     *
     * Encenderla exige ambas credenciales y una prueba de conexion exitosa.
     */
    public function updateConfig(Request $request): JsonResponse
    {
        $this->authorizeSettings($request);

        $data = $request->validate([
            'enabled' => 'sometimes|boolean',
            'api_key' => 'sometimes|nullable|string|max:255',
            'api_token' => 'sometimes|nullable|string|max:255',
            'clear_credentials' => 'sometimes|boolean',
        ]);

        $wasEnabled = $this->contifico->isEnabled();

        if ($data['clear_credentials'] ?? false) {
            $this->contifico->clearCredentials();
            $this->audit($request, ['credentials_cleared' => true, 'enabled' => false]);

            return $this->ok($this->contifico->status(), 'Credenciales de Contífico eliminadas.');
        }

        // Vacio significa "conservar la guardada": el frontend nunca recibe el valor real.
        $keyChanged = filled($data['api_key'] ?? null);
        $tokenChanged = filled($data['api_token'] ?? null);

        if ($keyChanged) {
            $this->contifico->storeApiKey($data['api_key']);
        }
        if ($tokenChanged) {
            $this->contifico->storeApiToken($data['api_token']);
        }

        $wantsEnabled = (bool) ($data['enabled'] ?? $wasEnabled);
        $error = null;

        if (! $wantsEnabled) {
            $this->contifico->setEnabled(false);
        } elseif (! $this->contifico->isConfigured()) {
            $this->contifico->setEnabled(false);
            $error = 'Ingrese la API key y el API token antes de activar la conexión.';
        } elseif (! $wasEnabled || $keyChanged || $tokenChanged) {
            $test = $this->contifico->testConnection($request->user()->id);
            $this->contifico->setEnabled($test['ok']);
            $error = $test['ok'] ? null : $test['message'].' La conexión quedó desactivada.';
        }

        $this->audit($request, [
            'enabled' => $this->contifico->isEnabled(),
            'api_key_changed' => $keyChanged,
            'api_token_changed' => $tokenChanged,
        ]);

        if ($error !== null) {
            return response()->json(['message' => $error] + $this->contifico->status(), 422);
        }

        return $this->ok($this->contifico->status(), 'Configuración de Contífico guardada.');
    }

    /**
     * Verifica la API key guardada.
     * POST /api/contifico/test
     */
    public function test(Request $request): JsonResponse
    {
        $this->authorizeSettings($request);

        $result = $this->contifico->testConnection($request->user()->id);

        return response()->json($result, $result['ok'] ? 200 : 422);
    }

    /**
     * Ultimos envios de pacientes a Contifico.
     * GET /api/contifico/logs
     */
    public function logs(Request $request): JsonResponse
    {
        $this->authorizeSettings($request);

        $logs = ContificoSyncLog::query()
            ->with(['patient:id,nombre,apellido,cedula,contifico_id,deleted_at', 'user:id,name'])
            ->where('action', '!=', ContificoSyncLog::ACTION_TEST)
            ->latest('id')
            ->limit(self::LOG_LIMIT)
            ->get()
            ->map(fn (ContificoSyncLog $log) => [
                'id' => $log->id,
                'created_at' => $log->created_at?->toDateTimeString(),
                'action' => $log->action,
                'status' => $log->status,
                'http_status' => $log->http_status,
                'contifico_id' => $log->contifico_id,
                'message' => $log->message,
                'attempt' => $log->attempt,
                'payload' => $log->payload,
                'user' => $log->user?->name,
                'patient' => $log->patient ? [
                    'id' => $log->patient->id,
                    'nombre_completo' => $log->patient->nombre_completo,
                    'cedula' => $log->patient->cedula,
                ] : null,
                'can_retry' => $log->status !== ContificoSyncLog::STATUS_SUCCESS
                    && $log->patient
                    && ! $log->patient->trashed()
                    && blank($log->patient->contifico_id),
            ])
            ->all();

        return response()->json(['data' => $logs]);
    }

    /**
     * Envio manual de un paciente (reintento o paciente anterior a la integracion).
     * POST /api/contifico/patients/{patient}/sync
     *
     * Corre en el request, no en la cola, para responder con el resultado real.
     */
    public function syncPatient(Request $request, Patient $patient): JsonResponse
    {
        abort_unless($request->user()?->can(Permission::PATIENTS_EDIT->value), 403);

        if (! $this->contifico->isEnabled()) {
            return $this->error('La conexión con Contífico no está activa.');
        }

        if (filled($patient->contifico_id)) {
            return $this->ok($this->patientState($patient), 'El paciente ya está en Contífico.');
        }

        try {
            $log = $this->contifico->syncPatient($patient, $request->user()->id);
        } catch (ContificoTemporaryException $e) {
            return $this->error($e->getMessage(), 502);
        }

        if ($log?->status !== ContificoSyncLog::STATUS_SUCCESS) {
            return $this->error($log?->message ?? 'No se pudo enviar el paciente a Contífico.');
        }

        return $this->ok($this->patientState($patient), $log->message);
    }

    /**
     * @return array<string, mixed>
     */
    private function patientState(Patient $patient): array
    {
        return [
            'contifico_id' => $patient->contifico_id,
            'contifico_synced_at' => $patient->contifico_synced_at?->toDateTimeString(),
        ];
    }

    private function authorizeSettings(Request $request): void
    {
        abort_unless($request->user()?->can(Permission::SETTINGS_EDIT->value), 403);
    }

    /**
     * Auditoria del cambio de configuracion. Solo banderas: nunca los valores.
     *
     * @param  array<string, bool>  $properties
     */
    private function audit(Request $request, array $properties): void
    {
        activity()
            ->causedBy($request->user())
            ->withProperties($properties)
            ->log('contifico_config_updated');
    }
}
