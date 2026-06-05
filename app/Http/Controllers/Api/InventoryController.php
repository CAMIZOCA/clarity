<?php

namespace App\Http\Controllers\Api;

use App\Enums\Permission;
use App\Http\Controllers\Api\Concerns\ApiResponses;
use App\Http\Controllers\Controller;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Services\InventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryController extends Controller
{
    use ApiResponses;

    public function __construct(private InventoryService $inventoryService) {}

    /**
     * Ver stock por bodega.
     * GET /api/inventory?warehouse_id=X&low_stock=1
     */
    public function index(Request $request): JsonResponse
    {
        if (!$request->user()->can(Permission::INVENTORY_VIEW->value)) {
            return $this->forbidden();
        }

        $query = Inventory::with(['productVariant.product', 'warehouse'])
            ->whereHas('productVariant', fn($q) => $q->where('is_active', true));

        if ($request->filled('warehouse_id')) {
            $query->where('warehouse_id', $request->warehouse_id);
        }

        if ($request->boolean('low_stock')) {
            $query->whereColumn('quantity', '<=', 'min_stock')->where('min_stock', '>', 0);
        }

        if ($request->filled('category')) {
            $query->whereHas('productVariant.product', fn($q) => $q->where('category', $request->category));
        }

        if ($request->filled('search')) {
            $query->whereHas('productVariant.product', function ($q) use ($request) {
                $q->where('name', 'LIKE', "%{$request->search}%")
                  ->orWhere('brand', 'LIKE', "%{$request->search}%");
            })->orWhereHas('productVariant', function ($q) use ($request) {
                $q->where('barcode', $request->search)
                  ->orWhere('sku', 'LIKE', "%{$request->search}%");
            });
        }

        $inventory = $query->paginate($request->get('per_page', 30));

        return $this->ok($inventory);
    }

    /**
     * Ver movimientos de un producto o bodega.
     * GET /api/inventory/movements
     */
    public function movements(Request $request): JsonResponse
    {
        if (!$request->user()->can(Permission::INVENTORY_VIEW->value)) {
            return $this->forbidden();
        }

        $query = InventoryMovement::with(['productVariant.product', 'warehouse', 'user'])
            ->latest('created_at');

        if ($request->filled('product_variant_id')) {
            $query->where('product_variant_id', $request->product_variant_id);
        }

        if ($request->filled('warehouse_id')) {
            $query->where('warehouse_id', $request->warehouse_id);
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        return $this->ok($query->paginate(50));
    }

    /**
     * Ajuste manual de stock.
     * POST /api/inventory/adjust
     */
    public function adjust(Request $request): JsonResponse
    {
        if (!$request->user()->can(Permission::INVENTORY_ADJUST->value)) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'product_variant_id' => ['required', 'integer', 'exists:product_variants,id'],
            'warehouse_id'       => ['required', 'integer', 'exists:warehouses,id'],
            'new_quantity'       => ['required', 'integer', 'min:0'],
            'notes'              => ['required', 'string', 'min:5', 'max:500'],
        ]);

        try {
            $movement = $this->inventoryService->adjustStock(
                $validated['product_variant_id'],
                $validated['warehouse_id'],
                $validated['new_quantity'],
                $request->user()->id,
                $validated['notes']
            );

            return $this->created($movement, 'Ajuste de inventario registrado.');
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /**
     * Transferencia entre bodegas.
     * POST /api/inventory/transfer
     */
    public function transfer(Request $request): JsonResponse
    {
        if (!$request->user()->can(Permission::INVENTORY_TRANSFER->value)) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'product_variant_id' => ['required', 'integer', 'exists:product_variants,id'],
            'from_warehouse_id'  => ['required', 'integer', 'exists:warehouses,id'],
            'to_warehouse_id'    => ['required', 'integer', 'exists:warehouses,id', 'different:from_warehouse_id'],
            'quantity'           => ['required', 'integer', 'min:1'],
            'notes'              => ['nullable', 'string', 'max:500'],
        ]);

        try {
            $movements = $this->inventoryService->transferStock(
                $validated['product_variant_id'],
                $validated['from_warehouse_id'],
                $validated['to_warehouse_id'],
                $validated['quantity'],
                $request->user()->id,
                $validated['notes'] ?? null
            );

            return $this->created($movements, 'Transferencia realizada exitosamente.');
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /**
     * Valorización del inventario.
     * GET /api/inventory/valuation
     */
    public function valuation(Request $request): JsonResponse
    {
        if (!$request->user()->can(Permission::REPORTS_INVENTORY->value)) {
            return $this->forbidden();
        }

        $warehouseId = $request->get('warehouse_id') ? (int) $request->get('warehouse_id') : null;
        $valuation = $this->inventoryService->getValuation($warehouseId);

        return $this->ok($valuation);
    }

    /**
     * Productos con stock bajo.
     * GET /api/inventory/low-stock
     */
    public function lowStock(Request $request): JsonResponse
    {
        if (!$request->user()->can(Permission::INVENTORY_VIEW->value)) {
            return $this->forbidden();
        }

        $warehouseId = $request->get('warehouse_id') ? (int) $request->get('warehouse_id') : null;
        $items = $this->inventoryService->getLowStockItems($warehouseId);

        return $this->ok($items);
    }
}
