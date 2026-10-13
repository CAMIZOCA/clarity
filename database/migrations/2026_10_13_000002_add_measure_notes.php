<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Letras que acompanan a una medida ("20 CC": el eje se comprobo con una prueba).
 *
 * Esfera, cilindro y eje siguen en sus columnas numericas, de las que dependen
 * el PDF, los avisos y el historial; la nota va aparte, como un mapa
 * campo => texto (`{"subj_eje_od": "CC"}`). Es TEXT y no JSON ni VARCHAR:
 * `consultations` esta al limite de fila de InnoDB.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('consultations', function (Blueprint $table) {
            $table->text('medidas_notas')->nullable();
        });

        Schema::table('consultation_rx_uso_entries', function (Blueprint $table) {
            $table->text('notas')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('consultation_rx_uso_entries', function (Blueprint $table) {
            $table->dropColumn('notas');
        });

        Schema::table('consultations', function (Blueprint $table) {
            $table->dropColumn('medidas_notas');
        });
    }
};
