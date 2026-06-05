<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProductVariant extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'product_id',
        'sku',
        'barcode',
        'color',
        'size',
        'material',
        'gender',
        'frame_shape',
        'frame_color_code',
        'lens_type',
        'lens_material',
        'lens_index',
        'lens_treatment',
        'lens_design',
        'base_curve',
        'lens_diameter',
        'lens_power',
        'lens_duration',
        'lens_water_content',
        'cost_price',
        'sale_price',
        'wholesale_price',
        'supplier_ref',
        'is_active',
        'image_path',
        'attributes',
    ];

    protected $casts = [
        'lens_index'       => 'decimal:2',
        'cost_price'       => 'decimal:2',
        'sale_price'       => 'decimal:2',
        'wholesale_price'  => 'decimal:2',
        'is_active'        => 'boolean',
        'attributes'       => 'array',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function inventory(): HasMany
    {
        return $this->hasMany(Inventory::class);
    }

    public function inventoryMovements(): HasMany
    {
        return $this->hasMany(InventoryMovement::class);
    }

    /**
     * Display name: "{brand} {product name} - {color} {size}"
     */
    protected function displayName(): Attribute
    {
        return Attribute::make(
            get: function () {
                $product = $this->product;
                $parts = [];

                if ($product) {
                    if ($product->brand) {
                        $parts[] = $product->brand;
                    }
                    $parts[] = $product->name;
                }

                $suffix = trim(($this->color ?? '') . ' ' . ($this->size ?? ''));
                if ($suffix !== '') {
                    $parts[] = '- ' . $suffix;
                }

                return implode(' ', $parts);
            }
        );
    }
}
