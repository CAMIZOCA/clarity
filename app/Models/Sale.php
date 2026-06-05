<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\Support\LogOptions;
use Spatie\Activitylog\Models\Concerns\LogsActivity;

class Sale extends Model
{
    use SoftDeletes, LogsActivity;

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['status', 'total', 'paid_amount', 'balance', 'invoice_number', 'cancelled_at'])
            ->logOnlyDirty()
            ->dontLogEmptyChanges()
            ->setDescriptionForEvent(fn (string $event) => "Venta {$event}");
    }

    protected $fillable = [
        'sale_number',
        'patient_id',
        'consultation_id',
        'branch_id',
        'warehouse_id',
        'user_id',
        'approved_by',
        'status',
        'subtotal',
        'discount_total',
        'taxable_base',
        'tax_exempt_base',
        'tax_amount',
        'total',
        'paid_amount',
        'balance',
        'cost_total',
        'requires_lab_order',
        'has_prescription',
        'invoice_number',
        'notes',
        'cancellation_reason',
        'cancelled_by',
        'cancelled_at',
        'paid_at',
        'delivered_at',
    ];

    protected function casts(): array
    {
        return [
            'subtotal'         => 'decimal:2',
            'discount_total'   => 'decimal:2',
            'taxable_base'     => 'decimal:2',
            'tax_exempt_base'  => 'decimal:2',
            'tax_amount'       => 'decimal:2',
            'total'            => 'decimal:2',
            'paid_amount'      => 'decimal:2',
            'balance'          => 'decimal:2',
            'cost_total'       => 'decimal:2',
            'requires_lab_order' => 'boolean',
            'has_prescription'   => 'boolean',
            'cancelled_at'     => 'datetime',
            'paid_at'          => 'datetime',
            'delivered_at'     => 'datetime',
        ];
    }

    /**
     * Auto-generate sale_number on creating.
     */
    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (Sale $sale) {
            if (empty($sale->sale_number)) {
                $year = now()->year;
                $last = static::whereYear('created_at', $year)
                    ->orderByDesc('id')
                    ->lockForUpdate()
                    ->first();
                $sequence = $last ? ((int) substr($last->sale_number, -5)) + 1 : 1;
                $sale->sale_number = 'V-' . $year . '-' . str_pad($sequence, 5, '0', STR_PAD_LEFT);
            }
        });
    }

    // ─── Relationships ───────────────────────────────────────────────────────

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function consultation(): BelongsTo
    {
        return $this->belongsTo(Consultation::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function cancelledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(SaleItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function labOrders(): HasMany
    {
        return $this->hasMany(LabOrder::class);
    }

    public function refunds(): HasMany
    {
        return $this->hasMany(Refund::class);
    }

    // ─── Scopes ──────────────────────────────────────────────────────────────

    /**
     * Ventas pendientes de completar (borrador o pago parcial).
     */
    public function scopePending($query)
    {
        return $query->whereIn('status', ['draft', 'partial']);
    }

    /**
     * Ventas filtradas por sucursal.
     */
    public function scopeForBranch($query, int $branchId)
    {
        return $query->where('branch_id', $branchId);
    }

    // ─── Methods ─────────────────────────────────────────────────────────────

    /**
     * Recalcula totales a partir de los SaleItems asociados.
     * Aplica IVA del 15% sobre los ítems gravados.
     */
    public function recalculateTotals(): void
    {
        $this->loadMissing('items');

        $subtotal      = 0;
        $discountTotal = 0;
        $taxableBase   = 0;
        $exemptBase    = 0;
        $costTotal     = 0;

        foreach ($this->items as $item) {
            $lineSubtotal    = $item->subtotal;
            $lineDiscount    = $item->discount_amount;
            $lineCost        = $item->cost_price * $item->quantity;

            $subtotal      += ($item->unit_price * $item->quantity);
            $discountTotal += $lineDiscount;
            $costTotal     += $lineCost;

            if ($item->taxable) {
                $taxableBase += $lineSubtotal;
            } else {
                $exemptBase  += $lineSubtotal;
            }
        }

        $taxAmount = round($taxableBase * 0.15, 2);
        $total     = $taxableBase + $exemptBase + $taxAmount;
        $balance   = max(0, $total - $this->paid_amount);

        $this->subtotal       = $subtotal;
        $this->discount_total = $discountTotal;
        $this->taxable_base   = $taxableBase;
        $this->tax_exempt_base = $exemptBase;
        $this->tax_amount     = $taxAmount;
        $this->total          = $total;
        $this->balance        = $balance;
        $this->cost_total     = $costTotal;
        $this->save();
    }
}
