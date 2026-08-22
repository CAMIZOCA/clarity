<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Columnas nuevas de "RX - Vision de Lejos" (antes "RX final"):
 *  - `distancia`: distancia de trabajo de la receta, ej. "a 50cm".
 *  - `av`: agudeza visual, separada de la ya existente AVL (ahora rotulada AV. CC).
 *  - `observaciones`: texto unico aplicable a ambos ojos, bajo la tabla.
 *
 * IMPORTANTE: `consultations` tiene ~139 columnas y esta cerca del limite de fila
 * de 8126 bytes de InnoDB (ver 2026_05_27_900000_reduce_consultations_row_size y
 * 2026_08_08_000001_add_missing_consultation_order_columns, que reparo columnas
 * que un ALTER anterior no pudo crear). Por eso todas estas columnas son TEXT:
 * en la fila solo ocupan un puntero a la pagina de overflow.
 */
return new class extends Migration
{
    private const COLUMNS = [
        'rx_final_distancia_od',
        'rx_final_distancia_oi',
        'rx_final_av_od',
        'rx_final_av_oi',
        'rx_final_observaciones',
    ];

    public function up(): void
    {
        Schema::table('consultations', function (Blueprint $table) {
            foreach (self::COLUMNS as $column) {
                if (! Schema::hasColumn('consultations', $column)) {
                    $table->text($column)->nullable();
                }
            }
        });
    }

    public function down(): void
    {
        Schema::table('consultations', function (Blueprint $table) {
            foreach (self::COLUMNS as $column) {
                $table->dropColumnIfExists($column);
            }
        });
    }
};
