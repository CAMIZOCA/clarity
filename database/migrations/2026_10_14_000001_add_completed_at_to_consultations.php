<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Momento en que el optometra completo la consulta.
 *
 * `fecha_consulta` solo trae el dia y `updated_at` lo mueve cualquier guardado
 * (autoguardado incluido), asi que ninguno sirve para decir "recien terminada"
 * en la pantalla de recepcion. La asigna `ConsultationService` al pasar a
 * `completada`; nunca viaja desde el formulario.
 *
 * Es TEXT (hora local `Y-m-d H:i:s`, ordena bien como texto) y no DATETIME:
 * `consultations` esta al limite de fila de InnoDB.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('consultations', function (Blueprint $table) {
            $table->text('completed_at')->nullable();
        });

        // Las completadas de los ultimos dias heredan `updated_at`, para que la
        // pantalla de recepcion no arranque vacia el dia del despliegue. Las
        // importadas se dejan fuera: su `updated_at` es la fecha de importacion.
        DB::table('consultations')
            ->where('estado', 'completada')
            ->whereNull('legacy_id')
            ->whereNull('completed_at')
            ->where('updated_at', '>=', now()->subDays(3)->startOfDay()->toDateTimeString())
            ->update(['completed_at' => DB::raw('updated_at')]);
    }

    public function down(): void
    {
        Schema::table('consultations', function (Blueprint $table) {
            $table->dropColumn('completed_at');
        });
    }
};
