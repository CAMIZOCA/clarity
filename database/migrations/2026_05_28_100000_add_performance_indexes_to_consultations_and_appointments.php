<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $safeIndex = function (string $table, \Closure $cb): void {
            try {
                Schema::table($table, $cb);
            } catch (\Exception) {
                // Index already exists — skip
            }
        };

        $safeIndex('consultations', fn($t) => $t->index('fecha_consulta'));
        $safeIndex('consultations', fn($t) => $t->index('estado'));
        $safeIndex('consultations', fn($t) => $t->index(['patient_id', 'fecha_consulta']));
        $safeIndex('appointments',  fn($t) => $t->index(['estado', 'fecha_hora_inicio']));
    }

    public function down(): void
    {
        Schema::table('consultations', function (Blueprint $table) {
            $table->dropIndex(['fecha_consulta']);
            $table->dropIndex(['estado']);
            $table->dropIndex(['patient_id', 'fecha_consulta']);
        });

        Schema::table('appointments', function (Blueprint $table) {
            $table->dropIndex(['estado', 'fecha_hora_inicio']);
        });
    }
};
