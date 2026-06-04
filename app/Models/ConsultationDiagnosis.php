<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConsultationDiagnosis extends Model
{
    protected $fillable = [
        'consultation_id',
        'catalog_item_id',
        'eye',
        'code',
        'description',
        'notes',
        'sort_order',
    ];

    public function consultation(): BelongsTo
    {
        return $this->belongsTo(Consultation::class);
    }

    public function catalogItem(): BelongsTo
    {
        return $this->belongsTo(ClinicalCatalogItem::class, 'catalog_item_id');
    }
}
