<?php

namespace App\Http\Controllers\Api;

use App\Enums\Permission;
use App\Http\Controllers\Api\Concerns\ApiResponses;
use App\Http\Controllers\Controller;
use App\Models\Sale;
use App\Services\SaleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SaleController extends Controller
{
    use ApiResponses;

    public function __construct(private SaleService $saleService) {}

    /**
     * Listar ventas con filtros.
     * GET /api/sales
     */
    public function index(Request $request): JsonResponse
    {
        if (!$request->user()->can(Permission::SALES_VIEW->value)) {
            return $this->forbidden();
        }

        $query = Sale::with(['patient', 'seller', 'branch'])
            ->withCount('items');

        // Filtros
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('patient_id')) {
            $query->where('patient_id', $request->patient_id);
        }
        if ($request->filled('branch_id')) {
            $query->where('branch_id', $request->branch_id);
        }
        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }
        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }
        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('sale_number', 'LIKE', "%{$s}%")
                  ->orWhereHas('patient', fn ($p) => $p->where('nombre', 'LIKE', "%{$s}%")
                                                        ->orWhere('cedula', 'LIKE', "%{$s}%"));
            });
        }

        // Usuarios no admin solo ven sus propias ventas (a menos que tengan permiso especial)
        if (!$request->user()->hasRole('admin') && !$request->user()->can('reports.sales')) {
            $query->where('user_id', $request->user()->id);
        }

        $sales = $query->latest()->paginate($request->get('per_page', 20));

        return $this->ok($sales);
    }

    /**
     * Crear venta (inicia como borrador).
     * POST /api/sales
     */
    public function store(Request $request): JsonResponse
    {
        if (!$request->user()->can(Permission::SALES_CREATE->value)) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'patient_id'      => ['nullable', 'integer', 'exists:patients,id'],
            'consultation_id' => ['nullable', 'integer', 'exists:consultations,id'],
            'branch_id'       => ['nullable', 'integer', 'exists:branches,id'],
            'warehouse_id'    => ['nullable', 'integer', 'exists:warehouses,id'],
            'notes'           => ['nullable', 'string', 'max:500'],
        ]);

        $validated['user_id'] = $request->user()->id;
        $sale = $this->saleService->createDraft($validated, $request->user()->id);

        return $this->created($sale->load(['patient', 'items']), 'Venta iniciada.');
    }

    /**
     * Ver venta completa.
     * GET /api/sales/{sale}
     */
    public function show(Request $request, Sale $sale): JsonResponse
    {
        if (!$request->user()->can(Permission::SALES_VIEW->value)) {
            return $this->forbidden();
        }

        $sale->load(['patient', 'seller', 'branch', 'items.productVariant.product', 'payments', 'labOrders']);

        // Ocultar costos si no tiene permiso
        if (!$request->user()->can(Permission::SALES_VIEW_COST->value)) {
            $sale->items->each(fn ($i) => $i->makeHidden(['cost_price']));
            $sale->makeHidden(['cost_total']);
        }

        return $this->ok($sale);
    }

    /**
     * Agregar item a la venta.
     * POST /api/sales/{sale}/items
     */
    public function addItem(Request $request, Sale $sale): JsonResponse
    {
        if (!$request->user()->can(Permission::SALES_CREATE->value)) {
            return $this->forbidden();
        }

        if (!in_array($sale->status, ['draft', 'confirmed', 'partial'])) {
            return response()->json([
                'message' => 'No se pueden agregar items a una venta en estado: ' . $sale->status,
            ], 422);
        }

        $validated = $request->validate([
            'product_variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],
            'description'        => ['required', 'string', 'max:250'],
            'quantity'           => ['required', 'numeric', 'min:0.01'],
            'unit_price'         => ['required', 'numeric', 'min:0'],
            'discount_pct'       => ['nullable', 'numeric', 'min:0', 'max:100'],
            'taxable'            => ['nullable', 'boolean'],
            'prescription_eye'   => ['nullable', 'in:OD,OI,ambos,N/A'],
            'item_type'          => ['nullable', 'string'],
            'notes'              => ['nullable', 'string'],
        ]);

        // Verificar límite de descuento
        $discountPct = $validated['discount_pct'] ?? 0;
        if ($discountPct > \App\Support\AppConfig::MAX_DISCOUNT_WITHOUT_APPROVAL) {
            if (!$request->user()->can(Permission::SALES_DISCOUNT_LIMIT->value)) {
                return response()->json([
                    'message' => "El descuento de {$discountPct}% supera el límite permitido de "
                        . \App\Support\AppConfig::MAX_DISCOUNT_WITHOUT_APPROVAL
                        . "% sin aprobación.",
                ], 422);
            }
        }

        $item = $this->saleService->addItem($sale, $validated);

        return $this->created($item, 'Item agregado a la venta.');
    }

    /**
     * Eliminar item de la venta.
     * DELETE /api/sales/{sale}/items/{item}
     */
    public function removeItem(Request $request, Sale $sale, \App\Models\SaleItem $item): JsonResponse
    {
        if ($item->sale_id !== $sale->id) {
            return $this->notFound('El item no pertenece a esta venta.');
        }

        if (!in_array($sale->status, ['draft', 'confirmed'])) {
            return response()->json([
                'message' => 'No se pueden eliminar items de una venta ya procesada.',
            ], 422);
        }

        $this->saleService->removeItem($sale, $item);

        return $this->noContent();
    }

    /**
     * Registrar pago.
     * POST /api/sales/{sale}/payments
     */
    public function processPayment(Request $request, Sale $sale): JsonResponse
    {
        if (!$request->user()->can(Permission::SALES_CREATE->value)) {
            return $this->forbidden();
        }

        if (in_array($sale->status, ['cancelled', 'refunded'])) {
            return response()->json([
                'message' => 'No se puede registrar pago en una venta cancelada o devuelta.',
            ], 422);
        }

        $validated = $request->validate([
            'method'         => ['required', 'in:cash,card,transfer,credit,coupon'],
            'amount'         => ['required', 'numeric', 'min:0.01'],
            'reference'      => ['nullable', 'string', 'max:100'],
            'bank_name'      => ['nullable', 'string', 'max:100'],
            'card_last_four' => ['nullable', 'string', 'size:4', 'regex:/^\d{4}$/'],
            'notes'          => ['nullable', 'string', 'max:500'],
        ]);

        try {
            $payment = $this->saleService->processPayment($sale, $validated, $request->user()->id);
            $sale->refresh();

            return $this->created([
                'payment' => $payment,
                'sale'    => $sale->only(['id', 'status', 'total', 'paid_amount', 'balance']),
            ], 'Pago registrado exitosamente.');
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /**
     * Cancelar venta.
     * POST /api/sales/{sale}/cancel
     */
    public function cancel(Request $request, Sale $sale): JsonResponse
    {
        if (!$request->user()->can(Permission::SALES_CANCEL->value)) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:500'],
        ]);

        try {
            $sale = $this->saleService->cancelSale($sale, $validated['reason'], $request->user()->id);
            return $this->ok($sale, 'Venta cancelada.');
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /**
     * Resumen de ventas de un paciente.
     * GET /api/sales/patient/{patient}
     */
    public function patientSummary(Request $request, \App\Models\Patient $patient): JsonResponse
    {
        if (!$request->user()->can(Permission::SALES_VIEW->value)) {
            return $this->forbidden();
        }

        return $this->ok($this->saleService->getPatientSummary($patient->id));
    }
}
