<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConsultationContactLensModule extends Model
{
    protected $fillable = [
        'consultation_id',
        'diametro_pupilar',
        'diametro_corneal',
        'apertura_palpebral',
        'tension_palpebral',
        'ojo_dominante',
        'but_value',
        'shirmer_test',
        'frecuencia_parpadeo',
        'observaciones',
        'test_lens',
        'final_lens',
    ];

    protected function casts(): array
    {
        return [
            'test_lens' => 'array',
            'final_lens' => 'array',
        ];
    }

    public function consultation(): BelongsTo
    {
        return $this->belongsTo(Consultation::class);
    }
}
