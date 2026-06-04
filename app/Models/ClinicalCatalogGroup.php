<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClinicalCatalogGroup extends Model
{
    protected $fillable = [
        'key',
        'name',
        'description',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(ClinicalCatalogItem::class, 'group_id')->orderBy('sort_order');
    }
}
