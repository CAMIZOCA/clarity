<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class InventoryMovement extends Model
{
    // Movimientos son inmutables — solo created_at, sin updated_at
    public $timestamps = false;

    protected $fillable = [
        'product_variant_id',
        'warehouse_id',
        'user_id',
        'type',
        'quantity',
        'quantity_before',
        'quantity_after',
        'unit_cost',
        'total_cost',
        'reference_type',
        'reference_id',
        'destination_warehouse_id',
        'notes',
    ];

    protected $casts = [
        'unit_cost'  => 'decimal:2',
        'total_cost' => 'decimal:2',
        'created_at' => 'datetime',
    ];

    public function productVariant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class);
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function destinationWarehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'destination_warehouse_id');
    }

    /**
     * Polymorphic relation — el documento que originó este movimiento
     * (Sale, Purchase, etc.)
     */
    public function reference(): MorphTo
    {
        return $this->morphTo();
    }
}
