<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'sku',
        'name',
        'brand',
        'category',
        'subcategory',
        'description',
        'supplier_id',
        'requires_prescription',
        'is_active',
        'has_variants',
        'track_inventory',
        'image_path',
        'meta',
    ];

    protected $casts = [
        'requires_prescription' => 'boolean',
        'is_active'             => 'boolean',
        'has_variants'          => 'boolean',
        'track_inventory'       => 'boolean',
        'meta'                  => 'array',
    ];

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class);
    }
}
