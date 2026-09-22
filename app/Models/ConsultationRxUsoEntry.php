<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Una receta "en uso" registrada en la consulta.
 *
 * La primera entrada (orden 0) se refleja ademas en las columnas planas
 * `rx_uso_*` de `consultations`, que siguen alimentando el PDF y los reportes.
 */
class ConsultationRxUsoEntry extends Model
{
    protected $table = 'consultation_rx_uso_entries';

    protected $fillable = [
        'consultation_id', 'orden',
        'esfera_od', 'cilindro_od', 'eje_od', 'add_od', 'avcc_od',
        'esfera_oi', 'cilindro_oi', 'eje_oi', 'add_oi', 'avcc_oi',
        'observacion', 'esfera_od_neutral', 'esfera_oi_neutral',
    ];

    protected function casts(): array
    {
        return [
            'orden' => 'integer',
            'esfera_od' => 'decimal:2',
            'cilindro_od' => 'decimal:2',
            'add_od' => 'decimal:2',
            'eje_od' => 'integer',
            'esfera_oi' => 'decimal:2',
            'cilindro_oi' => 'decimal:2',
            'add_oi' => 'decimal:2',
            'eje_oi' => 'integer',
            'esfera_od_neutral' => 'boolean',
            'esfera_oi_neutral' => 'boolean',
        ];
    }

    public function consultation(): BelongsTo
    {
        return $this->belongsTo(Consultation::class);
    }
}
