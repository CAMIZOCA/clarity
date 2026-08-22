<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Permite registrar varios "RX en uso" por consulta, cada uno con observacion.
 *
 * Hasta ahora solo cabia una receta en uso, en columnas planas de `consultations`.
 * Esas columnas se conservan: el servicio sigue escribiendo la primera entrada
 * ahi (misma desnormalizacion que ya hace `syncModules` con diagnosticos y
 * recomendaciones), para no romper PDF, reportes ni la importacion legacy.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('consultation_rx_uso_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('consultation_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('orden')->default(0);

            foreach (['od', 'oi'] as $eye) {
                $table->decimal("esfera_{$eye}", 5, 2)->nullable();
                $table->decimal("cilindro_{$eye}", 5, 2)->nullable();
                $table->integer("eje_{$eye}")->nullable();
                $table->decimal("add_{$eye}", 5, 2)->nullable();
                $table->string("avcc_{$eye}", 20)->nullable();
            }

            $table->text('observacion')->nullable();
            $table->timestamps();

            $table->index(['consultation_id', 'orden']);
        });

        // Sembrar la entrada #1 desde las columnas planas existentes, para que
        // las consultas historicas se sigan viendo completas en el formulario.
        $this->backfillFromLegacyColumns();
    }

    private function backfillFromLegacyColumns(): void
    {
        $legacy = [
            'rx_uso_esfera_od', 'rx_uso_cilindro_od', 'rx_uso_eje_od', 'rx_uso_add_od', 'rx_uso_avcc_od',
            'rx_uso_esfera_oi', 'rx_uso_cilindro_oi', 'rx_uso_eje_oi', 'rx_uso_add_oi', 'rx_uso_avcc_oi',
        ];

        foreach ($legacy as $column) {
            if (! Schema::hasColumn('consultations', $column)) {
                return;
            }
        }

        DB::table('consultations')
            ->select(array_merge(['id'], $legacy))
            ->where(function ($query) use ($legacy) {
                foreach ($legacy as $column) {
                    $query->orWhereNotNull($column);
                }
            })
            ->orderBy('id')
            ->chunk(500, function ($consultations) {
                $rows = [];
                $now = now();

                foreach ($consultations as $consultation) {
                    $rows[] = [
                        'consultation_id' => $consultation->id,
                        'orden' => 0,
                        'esfera_od' => $consultation->rx_uso_esfera_od,
                        'cilindro_od' => $consultation->rx_uso_cilindro_od,
                        'eje_od' => $consultation->rx_uso_eje_od,
                        'add_od' => $consultation->rx_uso_add_od,
                        'avcc_od' => $consultation->rx_uso_avcc_od,
                        'esfera_oi' => $consultation->rx_uso_esfera_oi,
                        'cilindro_oi' => $consultation->rx_uso_cilindro_oi,
                        'eje_oi' => $consultation->rx_uso_eje_oi,
                        'add_oi' => $consultation->rx_uso_add_oi,
                        'avcc_oi' => $consultation->rx_uso_avcc_oi,
                        'observacion' => null,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }

                if ($rows) {
                    DB::table('consultation_rx_uso_entries')->insert($rows);
                }
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('consultation_rx_uso_entries');
    }
};
