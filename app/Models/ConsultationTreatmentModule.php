<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConsultationTreatmentModule extends Model
{
    protected $fillable = [
        'consultation_id',
        'plan',
        'horas_uso',
        'metodo_limpieza',
        'modalidad_uso',
    ];

    public function consultation(): BelongsTo
    {
        return $this->belongsTo(Consultation::class);
    }
}
