<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Appointment extends Model
{
    protected $fillable = [
        'patient_id', 'optometrista_id', 'titulo',
        'fecha_hora_inicio', 'fecha_hora_fin', 'estado', 'notas',
    ];

    protected function casts(): array
    {
        return [
            'fecha_hora_inicio' => 'datetime',
            'fecha_hora_fin' => 'datetime',
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
