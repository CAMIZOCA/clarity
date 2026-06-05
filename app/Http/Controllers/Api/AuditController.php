<?php

namespace App\Http\Controllers\Api;

use App\Enums\Permission;
use App\Http\Controllers\Api\Concerns\ApiResponses;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditController extends Controller
{
    use ApiResponses;

    /**
     * Listar el log de actividad del sistema.
     * GET /api/audit/activity
     *
     * Parámetros opcionales:
     *   - subject_type: clase del modelo (ej: App\Models\Sale)
     *   - causer_id: ID del usuario que realizó la acción
     *   - date_from: fecha inicio (Y-m-d)
     *   - date_to: fecha fin (Y-m-d)
     *   - description: buscar por descripción de la acción
     */
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->can(Permission::AUDIT_VIEW->value)) {
            return $this->forbidden();
        }

        // Verificar que el paquete spatie/laravel-activitylog esté disponible
        if (! class_exists(\Spatie\Activitylog\Models\Activity::class)) {
            return response()->json([
                'message' => 'El módulo de auditoría no está disponible. Ejecute: composer require spatie/laravel-activitylog',
            ], 503);
        }

        $query = \Spatie\Activitylog\Models\Activity::with(['causer', 'subject'])
            ->orderByDesc('created_at');

        if ($request->filled('subject_type')) {
            // Aceptar clase corta o completa, ej: "Sale" o "App\Models\Sale"
            $type = $request->subject_type;
            if (! str_contains($type, '\\')) {
                $type = 'App\\Models\\' . ucfirst($type);
            }
            $query->where('subject_type', $type);
        }

        if ($request->filled('causer_id')) {
            $query->where('causer_id', $request->causer_id)
                  ->where('causer_type', 'App\\Models\\User');
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        if ($request->filled('description')) {
            $query->where('description', 'LIKE', '%' . $request->description . '%');
        }

        if ($request->filled('log_name')) {
            $query->where('log_name', $request->log_name);
        }

        $activities = $query->paginate(25);

        // Transformar para incluir información útil
        $transformed = $activities->getCollection()->map(function ($activity) {
            $properties = $activity->properties->toArray();
            return [
                'id'           => $activity->id,
                'action'       => $activity->description,
                'log_name'     => $activity->log_name,
                'subject_type' => $activity->subject_type ? class_basename($activity->subject_type) : null,
                'subject_id'   => $activity->subject_id,
                'causer'       => $activity->causer ? [
                    'id'    => $activity->causer->id,
                    'name'  => $activity->causer->name ?? $activity->causer->email ?? 'Sistema',
                    'email' => $activity->causer->email ?? null,
                ] : ['id' => null, 'name' => 'Sistema', 'email' => null],
                'changes' => [
                    'before' => $properties['old'] ?? null,
                    'after'  => $properties['attributes'] ?? null,
                ],
                'extra'      => collect($properties)->except(['old', 'attributes'])->toArray(),
                'ip_address' => $properties['ip'] ?? null,
                'created_at' => $activity->created_at?->toIso8601String(),
            ];
        });

        return response()->json([
            'data' => $transformed,
            'meta' => [
                'current_page' => $activities->currentPage(),
                'last_page'    => $activities->lastPage(),
                'per_page'     => $activities->perPage(),
                'total'        => $activities->total(),
            ],
        ]);
    }
}
