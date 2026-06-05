<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Inventory extends Model
{
    protected $table = 'inventory';

    protected $fillable = [
        'product_variant_id',
        'warehouse_id',
        'quantity',
        'reserved',
        'min_stock',
        'max_stock',
        'reorder_point',
        'avg_cost',
    ];

    protected $casts = [
        'avg_cost' => 'decimal:2',
    ];

    public function productVariant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class);
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    /**
     * Available stock = quantity - reserved
     */
    protected function availableQuantity(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->quantity - $this->reserved
        );
    }

    /**
     * True when current stock is at or below the minimum threshold
     */
    protected function isLowStock(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->quantity <= $this->min_stock
        );
    }
}
