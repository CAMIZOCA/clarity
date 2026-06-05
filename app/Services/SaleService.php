<?php

namespace App\Services;

use App\Models\Payment;
use App\Models\Refund;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Support\AppConfig;
use Illuminate\Support\Facades\DB;

class SaleService extends BaseService
{
    public function __construct(private InventoryService $inventoryService) {}

    // ─── createDraft ─────────────────────────────────────────────────────────

    /**
     * Crea una venta en estado 'draft'.
     */
    public function createDraft(array $data, int $userId): Sale
    {
        return $this->transaction(function () use ($data, $userId) {
            $sale = Sale::create([
                'patient_id'      => $data['patient_id'] ?? null,
                'consultation_id' => $data['consultation_id'] ?? null,
                'branch_id'       => $data['branch_id'] ?? null,
                'warehouse_id'    => $data['warehouse_id'] ?? null,
                'user_id'         => $userId,
                'status'          => 'draft',
                'subtotal'        => 0,
                'discount_total'  => 0,
                'taxable_base'    => 0,
                'tax_exempt_base' => 0,
                'tax_amount'      => 0,
                'total'           => 0,
                'paid_amount'     => 0,
                'balance'         => 0,
                'cost_total'      => 0,
                'notes'           => $data['notes'] ?? null,
            ]);

            $this->logActivity('venta_iniciada', $sale, [
                'sale_number' => $sale->sale_number,
                'patient_id'  => $sale->patient_id,
            ]);

            return $sale;
        });
    }

    // ─── addItem ──────────────────────────────────────────────────────────────

    /**
     * Agrega un item a la venta y recalcula los totales.
     */
    public function addItem(Sale $sale, array $itemData): SaleItem
    {
        if (!in_array($sale->status, ['draft', 'confirmed', 'partial'])) {
            throw new \Exception("No se pueden agregar items a una venta en estado: {$sale->status}.");
        }

        return $this->transaction(function () use ($sale, $itemData) {
            $quantity    = (float) $itemData['quantity'];
            $unitPrice   = (float) $itemData['unit_price'];
            $discountPct = (float) ($itemData['discount_pct'] ?? 0);

            $discountAmount = round($unitPrice * $quantity * ($discountPct / 100), 2);
            $subtotal       = round(($unitPrice * $quantity) - $discountAmount, 2);

            // Recuperar costo desde la variante si está disponible
            $costPrice = 0;
            $sku       = null;
            if (!empty($itemData['product_variant_id'])) {
                $variant   = \App\Models\ProductVariant::find($itemData['product_variant_id']);
                $costPrice = $variant ? (float) $variant->cost_price : 0;
                $sku       = $variant?->sku;
            }

            $item = SaleItem::create([
                'sale_id'            => $sale->id,
                'product_variant_id' => $itemData['product_variant_id'] ?? null,
                'description'        => $itemData['description'],
                'sku'                => $sku,
                'quantity'           => $quantity,
                'unit_price'         => $unitPrice,
                'cost_price'         => $costPrice,
                'discount_pct'       => $discountPct,
                'discount_amount'    => $discountAmount,
                'subtotal'           => $subtotal,
                'taxable'            => $itemData['taxable'] ?? true,
                'prescription_eye'   => $itemData['prescription_eye'] ?? null,
                'item_type'          => $itemData['item_type'] ?? null,
                'notes'              => $itemData['notes'] ?? null,
            ]);

            $this->recalculateTotals($sale);

            return $item;
        });
    }

    // ─── removeItem ───────────────────────────────────────────────────────────

    /**
     * Elimina un item de la venta y recalcula los totales.
     */
    public function removeItem(Sale $sale, SaleItem $item): void
    {
        $this->transaction(function () use ($sale, $item) {
            $item->delete();
            $this->recalculateTotals($sale);
        });
    }

    // ─── recalculateTotals ────────────────────────────────────────────────────

    /**
     * Recalcula todos los totales de la venta a partir de sus items.
     */
    public function recalculateTotals(Sale $sale): void
    {
        $sale->refresh();
        $sale->loadMissing('items.productVariant.product');

        $subtotal      = 0;
        $discountTotal = 0;
        $taxableBase   = 0;
        $exemptBase    = 0;
        $costTotal     = 0;
        $requiresLab   = false;

        foreach ($sale->items as $item) {
            $lineGross    = $item->unit_price * $item->quantity;
            $lineDiscount = $item->discount_amount;
            $lineSubtotal = $item->subtotal;
            $lineCost     = (float) $item->cost_price * (float) $item->quantity;

            $subtotal      += $lineGross;
            $discountTotal += $lineDiscount;
            $costTotal     += $lineCost;

            if ($item->taxable) {
                $taxableBase += $lineSubtotal;
            } else {
                $exemptBase += $lineSubtotal;
            }

            // Detectar si requiere orden de laboratorio
            if (!$requiresLab && $item->productVariant?->product) {
                $category = strtolower($item->productVariant->product->category ?? '');
                if (in_array($category, ['luna', 'armazon', 'lente', 'lentes'])) {
                    $requiresLab = true;
                }
            }
        }

        $taxAmount  = round($taxableBase * AppConfig::IVA_RATE, 2);
        $total      = round($taxableBase + $exemptBase + $taxAmount, 2);
        $paidAmount = (float) $sale->paid_amount;
        $balance    = max(0, round($total - $paidAmount, 2));

        // Determinar status
        $status = $sale->status;
        if ($balance <= 0 && $total > 0) {
            $status = 'paid';
        } elseif ($paidAmount > 0) {
            $status = 'partial';
        } elseif (count($sale->items) > 0) {
            $status = 'confirmed';
        } else {
            $status = 'draft';
        }

        $sale->update([
            'subtotal'          => round($subtotal, 2),
            'discount_total'    => round($discountTotal, 2),
            'taxable_base'      => round($taxableBase, 2),
            'tax_exempt_base'   => round($exemptBase, 2),
            'tax_amount'        => $taxAmount,
            'total'             => $total,
            'balance'           => $balance,
            'cost_total'        => round($costTotal, 2),
            'status'            => $status,
            'requires_lab_order' => $requiresLab,
        ]);
    }

    // ─── processPayment ───────────────────────────────────────────────────────

    /**
     * Registra un pago para la venta. Si el balance llega a 0, descuenta inventario.
     *
     * @throws \Exception si el monto supera el balance (sobrepago).
     */
    public function processPayment(Sale $sale, array $paymentData, int $userId): Payment
    {
        return $this->transaction(function () use ($sale, $paymentData, $userId) {
            $amount  = (float) $paymentData['amount'];
            $balance = (float) $sale->balance;

            if ($amount > $balance + 0.01) {
                throw new \Exception(
                    "El monto del pago ($amount) supera el saldo pendiente ($balance). No se permiten sobrepagos."
                );
            }

            // Registrar sesión de caja activa si existe
            $sessionId = $this->getActiveCashSessionId($userId);

            $payment = Payment::create([
                'sale_id'                  => $sale->id,
                'cash_register_session_id' => $sessionId,
                'processed_by'             => $userId,
                'method'                   => $paymentData['method'],
                'amount'                   => $amount,
                'reference'                => $paymentData['reference'] ?? null,
                'bank_name'                => $paymentData['bank_name'] ?? null,
                'card_last_four'           => $paymentData['card_last_four'] ?? null,
                'notes'                    => $paymentData['notes'] ?? null,
                'payment_type'             => 'sale',
                'processed_at'             => now(),
                'created_at'               => now(),
            ]);

            $newPaidAmount = round((float) $sale->paid_amount + $amount, 2);
            $newBalance    = max(0, round((float) $sale->total - $newPaidAmount, 2));

            $updateData = [
                'paid_amount' => $newPaidAmount,
                'balance'     => $newBalance,
            ];

            if ($newBalance <= 0) {
                $updateData['status']  = 'paid';
                $updateData['paid_at'] = now();

                // Descontar inventario al momento del pago completo
                $sale->refresh();
                $this->deductInventoryForSale($sale, $userId);
            } elseif ($newPaidAmount > 0) {
                $updateData['status'] = 'partial';
            }

            $sale->update($updateData);

            $this->logActivity('pago_registrado', $sale, [
                'method'     => $paymentData['method'],
                'amount'     => $amount,
                'new_status' => $updateData['status'] ?? $sale->status,
            ]);

            return $payment;
        });
    }

    // ─── cancelSale ───────────────────────────────────────────────────────────

    /**
     * Cancela una venta. Crea reembolso pendiente si había pagos.
     * Si la venta ya estaba pagada, revierte el stock.
     *
     * @throws \Exception si la venta ya está cancelada o devuelta.
     */
    public function cancelSale(Sale $sale, string $reason, int $cancelledBy): Sale
    {
        if (in_array($sale->status, ['cancelled', 'refunded'])) {
            throw new \Exception("La venta ya se encuentra en estado: {$sale->status}. No se puede cancelar.");
        }

        return $this->transaction(function () use ($sale, $reason, $cancelledBy) {
            $wasPaid = $sale->status === 'paid';

            $sale->update([
                'status'               => 'cancelled',
                'cancellation_reason'  => $reason,
                'cancelled_by'         => $cancelledBy,
                'cancelled_at'         => now(),
            ]);

            // Si había pagos, crear reembolso pendiente
            $totalPaid = (float) $sale->paid_amount;
            if ($totalPaid > 0) {
                Refund::create([
                    'sale_id'        => $sale->id,
                    'processed_by'   => $cancelledBy,
                    'reason'         => 'cancellation',
                    'reason_detail'  => $reason,
                    'refund_amount'  => $totalPaid,
                    'refund_method'  => 'pending',
                    'notes'          => 'Reembolso generado automáticamente por cancelación de venta.',
                ]);
            }

            // Si la venta ya había descontado stock, revertirlo
            if ($wasPaid) {
                $this->revertInventoryForSale($sale, $cancelledBy);
            }

            $this->logActivity('venta_cancelada', $sale, [
                'reason'      => $reason,
                'was_paid'    => $wasPaid,
                'refund_amount' => $totalPaid,
            ]);

            return $sale->fresh();
        });
    }

    // ─── applyDiscount ────────────────────────────────────────────────────────

    /**
     * Aplica un descuento global a todos los items de la venta.
     *
     * @throws \Exception si el descuento supera el límite y no hay aprobador.
     */
    public function applyDiscount(Sale $sale, float $discountPct, ?int $approvedBy = null): void
    {
        if ($discountPct > AppConfig::MAX_DISCOUNT_WITHOUT_APPROVAL && $approvedBy === null) {
            throw new \Exception(
                "El descuento del {$discountPct}% supera el límite de "
                . AppConfig::MAX_DISCOUNT_WITHOUT_APPROVAL
                . "% permitido sin aprobación."
            );
        }

        $this->transaction(function () use ($sale, $discountPct, $approvedBy) {
            $sale->load('items');

            foreach ($sale->items as $item) {
                $lineGross      = (float) $item->unit_price * (float) $item->quantity;
                $discountAmount = round($lineGross * ($discountPct / 100), 2);
                $subtotal       = round($lineGross - $discountAmount, 2);

                $item->update([
                    'discount_pct'    => $discountPct,
                    'discount_amount' => $discountAmount,
                    'subtotal'        => $subtotal,
                ]);
            }

            if ($approvedBy !== null) {
                $sale->update(['approved_by' => $approvedBy]);
            }

            $this->recalculateTotals($sale);

            $this->logActivity('descuento_aplicado', $sale, [
                'discount_pct' => $discountPct,
                'approved_by'  => $approvedBy,
            ]);
        });
    }

    // ─── getPatientSummary ────────────────────────────────────────────────────

    /**
     * Resumen de ventas de un paciente.
     */
    public function getPatientSummary(int $patientId): array
    {
        $sales = Sale::where('patient_id', $patientId)
            ->whereNotIn('status', ['cancelled', 'draft'])
            ->get();

        $totalCount      = $sales->count();
        $totalAmount     = $sales->sum('total');
        $pendingBalance  = Sale::where('patient_id', $patientId)
            ->whereIn('status', ['partial', 'confirmed'])
            ->sum('balance');

        $lastSale = Sale::where('patient_id', $patientId)
            ->whereNotIn('status', ['cancelled', 'draft'])
            ->latest()
            ->first();

        // Top 3 productos más frecuentes
        $topProducts = DB::table('sale_items')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->join('product_variants', 'sale_items.product_variant_id', '=', 'product_variants.id')
            ->where('sales.patient_id', $patientId)
            ->whereNotIn('sales.status', ['cancelled'])
            ->whereNotNull('sale_items.product_variant_id')
            ->select('product_variants.sku', DB::raw('COUNT(*) as times'))
            ->groupBy('product_variants.sku')
            ->orderByDesc('times')
            ->limit(3)
            ->get()
            ->pluck('times', 'sku')
            ->toArray();

        return [
            'ventas_totales'     => $totalCount,
            'monto_total'        => round((float) $totalAmount, 2),
            'saldo_pendiente'    => round((float) $pendingBalance, 2),
            'ultima_venta'       => $lastSale?->created_at?->toDateString(),
            'productos_frecuentes' => $topProducts,
        ];
    }

    // ─── Helpers privados ─────────────────────────────────────────────────────

    /**
     * Descuenta inventario de todos los items de la venta que tienen product_variant_id.
     */
    private function deductInventoryForSale(Sale $sale, int $userId): void
    {
        $sale->loadMissing('items');
        $warehouseId = $sale->warehouse_id;

        if (!$warehouseId) {
            return;
        }

        foreach ($sale->items as $item) {
            if (!$item->product_variant_id) {
                continue;
            }

            $qty = (int) round((float) $item->quantity);
            if ($qty <= 0) {
                continue;
            }

            try {
                $this->inventoryService->removeStock(
                    variantId:     $item->product_variant_id,
                    warehouseId:   $warehouseId,
                    quantity:      $qty,
                    type:          'sale',
                    userId:        $userId,
                    notes:         "Venta #{$sale->sale_number}",
                    referenceType: Sale::class,
                    referenceId:   $sale->id,
                );
            } catch (\Exception $e) {
                // Registrar advertencia pero no bloquear el pago
                \Illuminate\Support\Facades\Log::warning(
                    "No se pudo descontar inventario para variante {$item->product_variant_id} "
                    . "en venta {$sale->sale_number}: " . $e->getMessage()
                );
            }
        }
    }

    /**
     * Revierte el inventario descontado de una venta (al cancelar una venta pagada).
     */
    private function revertInventoryForSale(Sale $sale, int $userId): void
    {
        $sale->loadMissing('items');
        $warehouseId = $sale->warehouse_id;

        if (!$warehouseId) {
            return;
        }

        foreach ($sale->items as $item) {
            if (!$item->product_variant_id) {
                continue;
            }

            $qty = (int) round((float) $item->quantity);
            if ($qty <= 0) {
                continue;
            }

            try {
                $this->inventoryService->addStock(
                    variantId:     $item->product_variant_id,
                    warehouseId:   $warehouseId,
                    quantity:      $qty,
                    type:          'return',
                    userId:        $userId,
                    unitCost:      (float) $item->cost_price,
                    notes:         "Reversión por cancelación de venta #{$sale->sale_number}",
                    referenceType: Sale::class,
                    referenceId:   $sale->id,
                );
            } catch (\Exception $e) {
                \Illuminate\Support\Facades\Log::warning(
                    "No se pudo revertir inventario para variante {$item->product_variant_id} "
                    . "en venta {$sale->sale_number}: " . $e->getMessage()
                );
            }
        }
    }

    /**
     * Obtiene el ID de la sesión de caja activa del usuario, si existe.
     */
    private function getActiveCashSessionId(int $userId): ?int
    {
        return \App\Models\CashRegisterSession::where('opened_by', $userId)
            ->where('status', 'open')
            ->value('id');
    }
}
