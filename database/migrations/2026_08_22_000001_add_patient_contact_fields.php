<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Campos nuevos de la ficha de paciente:
 *  - `apellido`: separa el nombre completo en nombre + apellido.
 *  - `como_nos_conocio`: origen del paciente (referido, redes, paso por el local...).
 *  - `fecha_registro`: fecha de alta visible y editable (antes solo estaba created_at).
 *
 * No se hace backfill de `apellido`: partir los nombres existentes por el primer
 * espacio corrompe los nombres compuestos ("Juan Carlos Perez Gomez"). Los
 * registros historicos conservan el nombre completo en `nombre` y el accessor
 * `nombre_completo` los sigue mostrando bien.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            if (! Schema::hasColumn('patients', 'apellido')) {
                $table->string('apellido', 150)->nullable()->after('nombre');
            }
            if (! Schema::hasColumn('patients', 'como_nos_conocio')) {
                $table->text('como_nos_conocio')->nullable()->after('antecedentes');
            }
            if (! Schema::hasColumn('patients', 'fecha_registro')) {
                $table->date('fecha_registro')->nullable()->after('fecha_nacimiento');
            }
        });

        // Los registros existentes toman su fecha de alta de created_at.
        DB::table('patients')
            ->whereNull('fecha_registro')
            ->update(['fecha_registro' => DB::raw('DATE(created_at)')]);

        // Reconstruir el indice FULLTEXT incluyendo `apellido`, para que la
        // busqueda encuentre pacientes nuevos por su apellido.
        if (DB::getDriverName() === 'mysql') {
            try {
                DB::statement('ALTER TABLE patients DROP INDEX patients_fulltext_search');
            } catch (Exception $e) {
                // El indice puede no existir todavia.
            }

            try {
                DB::statement('ALTER TABLE patients ADD FULLTEXT INDEX patients_fulltext_search (nombre, apellido, cedula, telefono, email, codigo_interno)');
            } catch (Exception $e) {
                // Ya existe con la definicion correcta.
            }
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            try {
                DB::statement('ALTER TABLE patients DROP INDEX patients_fulltext_search');
                DB::statement('ALTER TABLE patients ADD FULLTEXT INDEX patients_fulltext_search (nombre, cedula, telefono, email, codigo_interno)');
            } catch (Exception $e) {
            }
        }

        Schema::table('patients', function (Blueprint $table) {
            $table->dropColumnIfExists('apellido');
            $table->dropColumnIfExists('como_nos_conocio');
            $table->dropColumnIfExists('fecha_registro');
        });
    }
};
