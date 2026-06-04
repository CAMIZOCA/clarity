<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class SpecialContactLens extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'patient_id', 'optometrista_id', 'tipo',
        'radio_base_od', 'diametro_od', 'potencia_od', 'material_od',
        'radio_base_oi', 'diametro_oi', 'potencia_oi', 'material_oi',
        'fecha_adaptacion', 'seguimiento', 'proxima_revision',
    ];

    protected function casts(): array
    {
        return [
            'fecha_adaptacion' => 'date:Y-m-d',
            'proxima_revision' => 'date:Y-m-d',
        ];
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function optometrista(): BelongsTo
    {
        return $this->belongsTo(User::class, 'optometrista_id');
    }
}
