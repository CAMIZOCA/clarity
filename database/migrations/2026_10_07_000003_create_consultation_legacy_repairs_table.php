<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Bitacora de `consultations:repair-legacy-import`.
 *
 * Cada valor que la reparacion cambia en una consulta importada queda aqui con
 * lo que habia antes. Sirve de respaldo (nada se pierde), permite revertir y
 * marca lo ya reparado para que el comando se pueda correr varias veces.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('consultation_legacy_repairs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('consultation_id')->constrained()->cascadeOnDelete();
            // Tabla y fila tocadas: `consultations` o `consultation_rx_uso_entries`.
            $table->string('target_table', 40);
            $table->unsignedBigInteger('target_id');
            $table->string('column_name', 60);
            $table->string('rule', 20);
            $table->text('old_value')->nullable();
            $table->text('new_value')->nullable();
            $table->timestamps();

            $table->unique(['target_table', 'target_id', 'column_name', 'rule'], 'legacy_repairs_target_unique');
            $table->index('rule');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('consultation_legacy_repairs');
    }
};
