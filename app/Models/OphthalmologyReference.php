<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class OphthalmologyReference extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'patient_id', 'motivo', 'medico_referido', 'especialidad', 'fecha', 'observaciones', 'created_by',
    ];

    protected function casts(): array
    {
        return ['fecha' => 'date:Y-m-d'];
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
