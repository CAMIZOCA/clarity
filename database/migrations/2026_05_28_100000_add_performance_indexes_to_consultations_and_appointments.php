<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('consultations', function (Blueprint $table) {
            $table->index('fecha_consulta');
            $table->index('estado');
            $table->index(['patient_id', 'fecha_consulta']);
        });

        Schema::table('appointments', function (Blueprint $table) {
            $table->index(['estado', 'fecha_hora_inicio']);
        });
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
