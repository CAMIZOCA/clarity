<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Un producto o servicio vendido al paciente durante la consulta (armazon,
 * lunas, lentes de contacto...). Informativo: no impacta caja ni inventario.
 * Para eso existe el modulo de ventas (`Sale`/`SaleItem`), que ya acepta un
 * `consultation_id` si en el futuro se necesita esa integracion.
 */
class ConsultationSaleItem extends Model
{
    protected $table = 'consultation_sale_items';

    protected $fillable = [
        'consultation_id', 'orden', 'tipo', 'descripcion',
        'precio', 'descuento_pct', 'total', 'nota',
    ];

    protected function casts(): array
    {
        return [
            'orden' => 'integer',
            'precio' => 'decimal:2',
            'descuento_pct' => 'decimal:2',
            'total' => 'decimal:2',
        ];
    }

    public function consultation(): BelongsTo
    {
        return $this->belongsTo(Consultation::class);
    }
}
