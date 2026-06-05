<?php

namespace App\Services;

use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\ProductVariant;
use App\Models\Warehouse;
use App\Support\AppConfig;
use Illuminate\Support\Facades\DB;

class InventoryService extends BaseService
{
    /**
     * Obtener stock de una variante en una bodega específica.
     */
    public function getStock(int $variantId, int $warehouseId): int
    {
        return Inventory::where('product_variant_id', $variantId)
            ->where('warehouse_id', $warehouseId)
            ->value('quantity') ?? 0;
    }

    /**
     * Obtener stock disponible (quantity - reserved).
     */
    public function getAvailableStock(int $variantId, int $warehouseId): int
    {
        $inv = Inventory::where('product_variant_id', $variantId)
            ->where('warehouse_id', $warehouseId)
            ->first();

        if (!$inv) return 0;
        return max(0, $inv->quantity - $inv->reserved);
    }

    /**
     * Agregar stock (compra, ajuste positivo, stock inicial).
     * Actualiza costo promedio ponderado.
     */
    public function addStock(
        int $variantId,
        int $warehouseId,
        int $quantity,
        string $type,
        int $userId,
        float $unitCost = 0,
        ?string $notes = null,
        ?string $referenceType = null,
        ?int $referenceId = null
    ): InventoryMovement {
        return $this->transaction(function () use (
            $variantId, $warehouseId, $quantity, $type, $userId,
            $unitCost, $notes, $referenceType, $referenceId
        ) {
            // Obtener o crear registro de inventario
            $inventory = Inventory::firstOrCreate(
                ['product_variant_id' => $variantId, 'warehouse_id' => $warehouseId],
                ['quantity' => 0, 'reserved' => 0, 'avg_cost' => 0]
            );

            $quantityBefore = $inventory->quantity;
            $quantityAfter  = $quantityBefore + $quantity;

            // Actualizar costo promedio ponderado
            if ($unitCost > 0) {
                $totalValue = ($inventory->quantity * $inventory->avg_cost) + ($quantity * $unitCost);
                $inventory->avg_cost = $quantityAfter > 0 ? $totalValue / $quantityAfter : $unitCost;
            }

            $inventory->quantity = $quantityAfter;
            $inventory->last_movement_at = now();
            $inventory->save();

            // Registrar movimiento
            return InventoryMovement::create([
                'product_variant_id' => $variantId,
                'warehouse_id'       => $warehouseId,
                'user_id'            => $userId,
                'type'               => $type,
                'quantity'           => $quantity,
                'quantity_before'    => $quantityBefore,
                'quantity_after'     => $quantityAfter,
                'unit_cost'          => $unitCost,
                'total_cost'         => $quantity * $unitCost,
                'reference_type'     => $referenceType,
                'reference_id'       => $referenceId,
                'notes'              => $notes,
                'created_at'         => now(),
            ]);
        });
    }

    /**
     * Quitar stock (venta, ajuste negativo).
     * Lanza excepción si no hay stock suficiente.
     */
    public function removeStock(
        int $variantId,
        int $warehouseId,
        int $quantity,
        string $type,
        int $userId,
        ?string $notes = null,
        ?string $referenceType = null,
        ?int $referenceId = null
    ): InventoryMovement {
        return $this->transaction(function () use (
            $variantId, $warehouseId, $quantity, $type, $userId,
            $notes, $referenceType, $referenceId
        ) {
            // Lock para evitar condición de carrera
            $inventory = Inventory::where('product_variant_id', $variantId)
                ->where('warehouse_id', $warehouseId)
                ->lockForUpdate()
                ->first();

            if (!$inventory || $inventory->quantity < $quantity) {
                $available = $inventory ? $inventory->quantity : 0;
                throw new \Exception(
                    "Stock insuficiente. Disponible: {$available}, Solicitado: {$quantity}"
                );
            }

            $quantityBefore = $inventory->quantity;
            $quantityAfter  = $quantityBefore - $quantity;
            $unitCost = $inventory->avg_cost;

            $inventory->quantity = $quantityAfter;
            $inventory->last_movement_at = now();
            $inventory->save();

            return InventoryMovement::create([
                'product_variant_id' => $variantId,
                'warehouse_id'       => $warehouseId,
                'user_id'            => $userId,
                'type'               => $type,
                'quantity'           => $quantity,
                'quantity_before'    => $quantityBefore,
                'quantity_after'     => $quantityAfter,
                'unit_cost'          => $unitCost,
                'total_cost'         => $quantity * $unitCost,
                'reference_type'     => $referenceType,
                'reference_id'       => $referenceId,
                'notes'              => $notes,
                'created_at'         => now(),
            ]);
        });
    }

    /**
     * Transferir stock entre bodegas.
     */
    public function transferStock(
        int $variantId,
        int $fromWarehouseId,
        int $toWarehouseId,
        int $quantity,
        int $userId,
        ?string $notes = null
    ): array {
        return $this->transaction(function () use (
            $variantId, $fromWarehouseId, $toWarehouseId, $quantity, $userId, $notes
        ) {
            $outMovement = $this->removeStock(
                $variantId, $fromWarehouseId, $quantity,
                'transfer_out', $userId, $notes
            );

            $unitCost = $outMovement->unit_cost;

            $inMovement = $this->addStock(
                $variantId, $toWarehouseId, $quantity,
                'transfer_in', $userId, (float) $unitCost, $notes
            );

            // Actualizar destino en el movimiento de salida
            $outMovement->update(['destination_warehouse_id' => $toWarehouseId]);

            return ['out' => $outMovement, 'in' => $inMovement];
        });
    }

    /**
     * Ajuste de inventario (resultado de toma física).
     */
    public function adjustStock(
        int $variantId,
        int $warehouseId,
        int $newQuantity,
        int $userId,
        string $notes = ''
    ): InventoryMovement {
        return $this->transaction(function () use (
            $variantId, $warehouseId, $newQuantity, $userId, $notes
        ) {
            $inventory = Inventory::firstOrCreate(
                ['product_variant_id' => $variantId, 'warehouse_id' => $warehouseId],
                ['quantity' => 0, 'reserved' => 0, 'avg_cost' => 0]
            );

            $currentQty = $inventory->quantity;
            $diff = $newQuantity - $currentQty;

            if ($diff === 0) {
                throw new \Exception('La cantidad nueva es igual al stock actual. No hay ajuste que realizar.');
            }

            $type = $diff > 0 ? 'adjustment_add' : 'adjustment_sub';

            $inventory->quantity = $newQuantity;
            $inventory->last_count_at = now();
            $inventory->last_movement_at = now();
            $inventory->save();

            return InventoryMovement::create([
                'product_variant_id' => $variantId,
                'warehouse_id'       => $warehouseId,
                'user_id'            => $userId,
                'type'               => $type,
                'quantity'           => abs($diff),
                'quantity_before'    => $currentQty,
                'quantity_after'     => $newQuantity,
                'unit_cost'          => $inventory->avg_cost,
                'total_cost'         => abs($diff) * $inventory->avg_cost,
                'notes'              => $notes ?: 'Ajuste por toma física',
                'created_at'         => now(),
            ]);
        });
    }

    /**
     * Reservar stock (cuando se crea una venta pero aún no se procesa).
     */
    public function reserveStock(int $variantId, int $warehouseId, int $quantity): void
    {
        DB::table('inventory')
            ->where('product_variant_id', $variantId)
            ->where('warehouse_id', $warehouseId)
            ->increment('reserved', $quantity);
    }

    /**
     * Liberar reserva de stock.
     */
    public function releaseReservation(int $variantId, int $warehouseId, int $quantity): void
    {
        DB::table('inventory')
            ->where('product_variant_id', $variantId)
            ->where('warehouse_id', $warehouseId)
            ->decrement('reserved', $quantity);
    }

    /**
     * Obtener productos con stock bajo (quantity <= min_stock).
     */
    public function getLowStockItems(?int $warehouseId = null): \Illuminate\Database\Eloquent\Collection
    {
        return Inventory::with(['productVariant.product', 'warehouse'])
            ->whereColumn('quantity', '<=', 'min_stock')
            ->where('min_stock', '>', 0)
            ->when($warehouseId, fn($q) => $q->where('warehouse_id', $warehouseId))
            ->get();
    }

    /**
     * Valorización del inventario por bodega.
     */
    public function getValuation(?int $warehouseId = null): array
    {
        $query = Inventory::with(['productVariant.product'])
            ->when($warehouseId, fn($q) => $q->where('warehouse_id', $warehouseId));

        $items = $query->get();

        $totalCostValue = $items->sum(fn($i) => $i->quantity * $i->avg_cost);
        $totalSaleValue = $items->sum(fn($i) => $i->quantity * $i->productVariant->sale_price);
        $totalItems     = $items->sum('quantity');
        $totalSkus      = $items->count();

        return [
            'total_cost_value' => round($totalCostValue, 2),
            'total_sale_value' => round($totalSaleValue, 2),
            'potential_margin' => round($totalSaleValue - $totalCostValue, 2),
            'total_units'      => $totalItems,
            'total_skus'       => $totalSkus,
        ];
    }
}
