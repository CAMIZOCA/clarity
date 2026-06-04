<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class GuaranteeReport extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'patient_id',
        'optometrista_id',
        'created_by',
        'numero_informe',
        'fecha_informe',
        'motivo',
        'cambios_realizados',
        'soluciones_indicadas',
        'estado',
    ];

    protected $casts = [
        'fecha_informe' => 'date:Y-m-d',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $report) {
            if (empty($report->numero_informe)) {
                $year = now()->year;
                $count = static::whereYear('created_at', $year)->withTrashed()->count() + 1;
                $report->numero_informe = 'IG-' . $year . '-' . str_pad($count, 4, '0', STR_PAD_LEFT);
            }
        });
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function optometrista(): BelongsTo
    {
        return $this->belongsTo(User::class, 'optometrista_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
