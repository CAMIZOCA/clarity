<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConsultationLensRecommendation extends Model
{
    protected $fillable = [
        'consultation_id',
        'material_item_id',
        'thickness_item_id',
        'protection_item_id',
        'observation',
    ];

    public function consultation(): BelongsTo
    {
        return $this->belongsTo(Consultation::class);
    }

    public function material(): BelongsTo
    {
        return $this->belongsTo(ClinicalCatalogItem::class, 'material_item_id');
    }

    public function thickness(): BelongsTo
    {
        return $this->belongsTo(ClinicalCatalogItem::class, 'thickness_item_id');
    }

    public function protection(): BelongsTo
    {
        return $this->belongsTo(ClinicalCatalogItem::class, 'protection_item_id');
    }
}
