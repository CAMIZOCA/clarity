<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClinicalCatalogItem extends Model
{
    protected $fillable = [
        'group_id',
        'key',
        'code',
        'label',
        'description',
        'is_active',
        'sort_order',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'meta' => 'array',
        ];
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(ClinicalCatalogGroup::class, 'group_id');
    }
}
