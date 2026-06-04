<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConsultationOphthalmoscopyModule extends Model
{
    protected $fillable = [
        'consultation_id',
        'fijacion_od',
        'fijacion_oi',
        'valoracion_motora',
        'ppc_obj',
        'luz',
        'fr',
        'results',
    ];

    protected function casts(): array
    {
        return [
            'results' => 'array',
        ];
    }

    public function consultation(): BelongsTo
    {
        return $this->belongsTo(Consultation::class);
    }
}
