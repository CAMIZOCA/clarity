<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Libera espacio de fila en `consultations` convirtiendo a TEXT los VARCHAR mas
 * anchos.
 *
 * InnoDB limita la fila a 8126 bytes. Con 139 columnas en utf8mb4 (4 bytes por
 * caracter) la tabla suma unos 15 KB solo en VARCHAR, asi que ya no cabe: en
 * MariaDB ni siquiera puede recrearse con CREATE TABLE ... LIKE. Un VARCHAR
 * cuenta su longitud maxima dentro de la fila; un TEXT cuenta solo el puntero
 * de 20 bytes porque se guarda fuera de pagina.
 *
 * La marca de tiempo es anterior a 2026_05_28_000002_add_import_fields_to_consultations
 * a proposito: en una instalacion nueva esta migracion tiene que correr antes,
 * o aquella vuelve a quedarse sin espacio a mitad de camino. En una base ya
 * existente Laravel la ejecuta igual, porque solo omite las migraciones que ya
 * estan registradas.
 *
 * Los limites de longitud se siguen aplicando en las reglas de validacion. No
 * se toca `legacy_id` (lleva indice y lo usa el importador) ni
 * `print_template_key` (se busca por valor exacto).
 */
return new class extends Migration
{
    /** Columnas VARCHAR(>=50) que pasan a TEXT. */
    public const WIDE_COLUMNS = [
        'ark_od',
        'ark_oi',
        'bifocal',
        'certificado_diagnostico_od',
        'certificado_diagnostico_oi',
        'color_lentes',
        'cover_test',
        'diagnostico_descripcion',
        'doctor_license',
        'ducciones_od',
        'ducciones_oi',
        'estado_lentes',
        'luna_espesor',
        'luna_material',
        'luna_proteccion',
        'morfoscopica_cerca_od',
        'morfoscopica_cerca_oi',
        'morfoscopica_lejos_od',
        'morfoscopica_lejos_oi',
        'ppc',
        'queratometria_calificacion',
        'queratometria_miras_od',
        'queratometria_miras_oi',
        'queratometria_od',
        'queratometria_oi',
        'reflejos_pupilares',
        'retinoscopia_ppc',
        'subj_tipo_od',
        'subj_tipo_oi',
        'test_hirschberg',
        'tipo_lentes',
        'versiones',
    ];

    public function up(): void
    {
        // SQLite no impone limite de tamano de fila ni de longitud de VARCHAR,
        // asi que ahi no hay nada que liberar.
        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        foreach (self::WIDE_COLUMNS as $column) {
            if (Schema::hasColumn('consultations', $column)) {
                DB::statement("alter table `consultations` modify `{$column}` text null");
            }
        }
    }

    public function down(): void
    {
        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        // Revertir dejaria la fila por encima del limite de InnoDB y el ALTER
        // fallaria, asi que no se intenta.
    }
};
