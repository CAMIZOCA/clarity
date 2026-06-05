<?php

namespace App\Http\Controllers\Api;

use App\Enums\Permission;
use App\Events\LabOrderReady;
use App\Http\Controllers\Api\Concerns\ApiResponses;
use App\Http\Controllers\Controller;
use App\Models\LabSupplier;
use App\Models\LabOrder;
use App\Models\LabOrderHistory;
use App\Support\AppConfig;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LabOrderController extends Controller
{
    use ApiResponses;

    public function suppliers(Request $request): JsonResponse
    {
        if (!$request->user()->can(Permission::LAB_ORDERS_VIEW->value)) {
            return $this->forbidden();
        }

        $suppliers = LabSupplier::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        return $this->ok($suppliers);
    }

    /**
     * Transiciones de estado permitidas en el flujo de laboratorio.
     */
    private const STATUS_TRANSITIONS = [
        'draft'      => ['pending', 'cancelled'],
        'pending'    => ['sent', 'cancelled'],
        'sent'       => ['processing', 'cancelled'],
        'processing' => ['received', 'reprocess', 'cancelled'],
        'received'   => ['qc', 'reprocess'],
        'qc'         => ['ready', 'reprocess'],
        'ready'      => ['delivered'],
        'delivered'  => [],
        'reprocess'  => ['pending', 'cancelled'],
        'cancelled'  => [],
    ];

    /**
     * Listar órdenes de laboratorio con filtros.
     * GET /api/lab-orders
     */
    public function index(Request $request): JsonResponse
    {
        if (!$request->user()->can(Permission::LAB_ORDERS_VIEW->value)) {
            return $this->forbidden();
        }

        $query = LabOrder::with(['patient', 'sale', 'branch', 'labSupplier', 'createdBy', 'assignedTo'])
            ->withCount('history');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('branch_id')) {
            $query->where('branch_id', $request->branch_id);
        }
        if ($request->filled('lab_supplier_id')) {
            $query->where('lab_supplier_id', $request->lab_supplier_id);
        }
        if ($request->filled('patient_id')) {
            $query->where('patient_id', $request->patient_id);
        }
        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }
        if ($request->boolean('overdue')) {
            $query->overdue();
        }

        $orders = $query->latest()->paginate($request->get('per_page', 20));

        return $this->ok($orders);
    }

    /**
     * Crear orden de laboratorio.
     * POST /api/lab-orders
     */
    public function store(Request $request): JsonResponse
    {
        if (!$request->user()->can(Permission::LAB_ORDERS_CREATE->value)) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'sale_id'                  => ['nullable', 'integer', 'exists:sales,id'],
            'patient_id'               => ['nullable', 'integer', 'exists:patients,id'],
            'consultation_id'          => ['nullable', 'integer', 'exists:consultations,id'],
            'lab_supplier_id'          => ['nullable', 'integer', 'exists:lab_suppliers,id'],
            'branch_id'                => ['nullable', 'integer', 'exists:branches,id'],
            'assigned_to'              => ['nullable', 'integer', 'exists:users,id'],
            'priority'                 => ['nullable', 'in:normal,urgent,express'],
            'od_sphere'                => ['nullable', 'numeric'],
            'od_cylinder'              => ['nullable', 'numeric'],
            'od_axis'                  => ['nullable', 'numeric', 'min:0', 'max:180'],
            'od_add'                   => ['nullable', 'numeric'],
            'od_prism'                 => ['nullable', 'numeric'],
            'oi_sphere'                => ['nullable', 'numeric'],
            'oi_cylinder'              => ['nullable', 'numeric'],
            'oi_axis'                  => ['nullable', 'numeric', 'min:0', 'max:180'],
            'oi_add'                   => ['nullable', 'numeric'],
            'oi_prism'                 => ['nullable', 'numeric'],
            'pd_far'                   => ['nullable', 'numeric'],
            'pd_near'                  => ['nullable', 'numeric'],
            'height_od'                => ['nullable', 'numeric'],
            'height_oi'                => ['nullable', 'numeric'],
            'frame_description'        => ['nullable', 'string', 'max:500'],
            'lens_type'                => ['nullable', 'string', 'max:100'],
            'lens_material'            => ['nullable', 'string', 'max:100'],
            'lens_treatment'           => ['nullable', 'string', 'max:100'],
            'lens_design'              => ['nullable', 'string', 'max:100'],
            'estimated_delivery_date'  => ['nullable', 'date'],
            'lab_cost'                 => ['nullable', 'numeric', 'min:0'],
            'technical_notes'          => ['nullable', 'string'],
            'internal_notes'           => ['nullable', 'string'],
        ]);

        $validated['created_by'] = $request->user()->id;
        $validated['status']     = 'draft';

        // Si viene de una venta, intentar pre-llenar datos de la consulta asociada
        if (!empty($validated['sale_id'])) {
            $sale = \App\Models\Sale::with('consultation')->find($validated['sale_id']);

            if ($sale) {
                if (empty($validated['patient_id']) && $sale->patient_id) {
                    $validated['patient_id'] = $sale->patient_id;
                }
                if (empty($validated['branch_id']) && $sale->branch_id) {
                    $validated['branch_id'] = $sale->branch_id;
                }
                if (empty($validated['consultation_id']) && $sale->consultation_id) {
                    $validated['consultation_id'] = $sale->consultation_id;
                }

                // Pre-llenar receta desde la consulta si existe y no se enviaron datos
                $consultation = $sale->consultation;
                if ($consultation && !isset($validated['od_sphere'])) {
                    $validated = array_merge([
                        'od_sphere'   => $consultation->od_esfera ?? null,
                        'od_cylinder' => $consultation->od_cilindro ?? null,
                        'od_axis'     => $consultation->od_eje ?? null,
                        'od_add'      => $consultation->od_adicion ?? null,
                        'oi_sphere'   => $consultation->oi_esfera ?? null,
                        'oi_cylinder' => $consultation->oi_cilindro ?? null,
                        'oi_axis'     => $consultation->oi_eje ?? null,
                        'oi_add'      => $consultation->oi_adicion ?? null,
                        'pd_far'      => $consultation->dp_lejos ?? null,
                        'pd_near'     => $consultation->dp_cerca ?? null,
                    ], $validated);
                }
            }
        }

        $order = LabOrder::create($validated);

        // Registrar en historial
        LabOrderHistory::create([
            'lab_order_id' => $order->id,
            'user_id'      => $request->user()->id,
            'old_status'   => null,
            'new_status'   => 'draft',
            'notes'        => 'Orden creada.',
            'created_at'   => now(),
        ]);

        return $this->created(
            $order->load(['patient', 'sale', 'branch', 'labSupplier', 'createdBy']),
            'Orden de laboratorio creada.'
        );
    }

    /**
     * Ver orden de laboratorio con historial.
     * GET /api/lab-orders/{labOrder}
     */
    public function show(Request $request, LabOrder $labOrder): JsonResponse
    {
        if (!$request->user()->can(Permission::LAB_ORDERS_VIEW->value)) {
            return $this->forbidden();
        }

        $labOrder->load([
            'patient',
            'sale',
            'consultation',
            'branch',
            'labSupplier',
            'createdBy',
            'assignedTo',
            'history.user',
        ]);

        return $this->ok($labOrder);
    }

    /**
     * Cambiar el estado de la orden de laboratorio.
     * POST /api/lab-orders/{labOrder}/status
     */
    public function updateStatus(Request $request, LabOrder $labOrder): JsonResponse
    {
        if (!$request->user()->can(Permission::LAB_ORDERS_MANAGE->value)) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'status'            => ['required', 'string', 'in:' . implode(',', array_keys(AppConfig::LAB_ORDER_STATUSES))],
            'notes'             => ['nullable', 'string', 'max:500'],
            'actual_delivery_date' => ['nullable', 'date'],
        ]);

        $currentStatus = $labOrder->status;
        $newStatus     = $validated['status'];

        // Validar transición permitida
        $allowed = self::STATUS_TRANSITIONS[$currentStatus] ?? [];
        if (!in_array($newStatus, $allowed)) {
            return response()->json([
                'message' => "No se puede pasar del estado '{$currentStatus}' al estado '{$newStatus}'. "
                    . "Transiciones permitidas: " . (empty($allowed) ? 'ninguna' : implode(', ', $allowed)) . ".",
            ], 422);
        }

        $updateData = ['status' => $newStatus];

        if ($newStatus === 'delivered' && !empty($validated['actual_delivery_date'])) {
            $updateData['actual_delivery_date'] = $validated['actual_delivery_date'];
        } elseif ($newStatus === 'delivered') {
            $updateData['actual_delivery_date'] = now()->toDateString();
        }

        $labOrder->update($updateData);

        // Registrar en historial
        LabOrderHistory::create([
            'lab_order_id' => $labOrder->id,
            'user_id'      => $request->user()->id,
            'old_status'   => $currentStatus,
            'new_status'   => $newStatus,
            'notes'        => $validated['notes'] ?? null,
            'created_at'   => now(),
        ]);

        // Emitir evento si está lista para entrega
        if ($newStatus === 'ready') {
            LabOrderReady::dispatch($labOrder);
        }

        return $this->ok(
            $labOrder->fresh()->load(['history.user']),
            "Estado actualizado a: " . AppConfig::LAB_ORDER_STATUSES[$newStatus] . "."
        );
    }

    /**
     * Actualizar campos básicos de la orden.
     * PUT /api/lab-orders/{labOrder}
     */
    public function update(Request $request, LabOrder $labOrder): JsonResponse
    {
        if (!$request->user()->can(Permission::LAB_ORDERS_EDIT->value)) {
            return $this->forbidden();
        }

        if (in_array($labOrder->status, ['delivered', 'cancelled'])) {
            return response()->json([
                'message' => 'No se puede editar una orden entregada o cancelada.',
            ], 422);
        }

        $validated = $request->validate([
            'lab_supplier_id'         => ['nullable', 'integer', 'exists:lab_suppliers,id'],
            'assigned_to'             => ['nullable', 'integer', 'exists:users,id'],
            'priority'                => ['nullable', 'in:normal,urgent,express'],
            'od_sphere'               => ['nullable', 'numeric'],
            'od_cylinder'             => ['nullable', 'numeric'],
            'od_axis'                 => ['nullable', 'numeric', 'min:0', 'max:180'],
            'od_add'                  => ['nullable', 'numeric'],
            'od_prism'                => ['nullable', 'numeric'],
            'oi_sphere'               => ['nullable', 'numeric'],
            'oi_cylinder'             => ['nullable', 'numeric'],
            'oi_axis'                 => ['nullable', 'numeric', 'min:0', 'max:180'],
            'oi_add'                  => ['nullable', 'numeric'],
            'oi_prism'                => ['nullable', 'numeric'],
            'pd_far'                  => ['nullable', 'numeric'],
            'pd_near'                 => ['nullable', 'numeric'],
            'height_od'               => ['nullable', 'numeric'],
            'height_oi'               => ['nullable', 'numeric'],
            'frame_description'       => ['nullable', 'string', 'max:500'],
            'lens_type'               => ['nullable', 'string', 'max:100'],
            'lens_material'           => ['nullable', 'string', 'max:100'],
            'lens_treatment'          => ['nullable', 'string', 'max:100'],
            'lens_design'             => ['nullable', 'string', 'max:100'],
            'estimated_delivery_date' => ['nullable', 'date'],
            'lab_cost'                => ['nullable', 'numeric', 'min:0'],
            'technical_notes'         => ['nullable', 'string'],
            'internal_notes'          => ['nullable', 'string'],
        ]);

        $labOrder->update($validated);

        return $this->ok($labOrder->fresh(), 'Orden de laboratorio actualizada.');
    }

    /**
     * Eliminar (soft delete) una orden en estado borrador o cancelado.
     * DELETE /api/lab-orders/{labOrder}
     */
    public function destroy(Request $request, LabOrder $labOrder): JsonResponse
    {
        if (!$request->user()->can(Permission::LAB_ORDERS_DELETE->value)) {
            return $this->forbidden();
        }

        if (!in_array($labOrder->status, ['draft', 'cancelled'])) {
            return response()->json([
                'message' => "Solo se pueden eliminar órdenes en estado 'borrador' o 'cancelado'. "
                    . "Estado actual: {$labOrder->status}.",
            ], 422);
        }

        $labOrder->delete();

        return $this->noContent();
    }
}
