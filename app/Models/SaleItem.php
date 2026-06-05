<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SaleItem extends Model
{
    protected $fillable = [
        'sale_id',
        'product_variant_id',
        'description',
        'sku',
        'quantity',
        'unit_price',
        'cost_price',
        'discount_pct',
        'discount_amount',
        'subtotal',
        'taxable',
        'prescription_eye',
        'package_id',
        'item_type',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'quantity'        => 'decimal:2',
            'unit_price'      => 'decimal:2',
            'cost_price'      => 'decimal:2',
            'discount_pct'    => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'subtotal'        => 'decimal:2',
            'taxable'         => 'boolean',
        ];
    }

    // ─── Relationships ───────────────────────────────────────────────────────

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function productVariant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class);
    }
}
