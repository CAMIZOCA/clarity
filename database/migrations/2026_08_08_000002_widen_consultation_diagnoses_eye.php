<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Amplia `consultation_diagnoses.eye` de VARCHAR(5) a VARCHAR(10).
 *
 * La columna nacio con 5 caracteres, pero tanto la regla de validacion
 * (StoreConsultationRequest: Rule::in(['od', 'oi', 'general'])) como el valor
 * por defecto del servicio (ConsultationService: $diagnosis['eye'] ?? 'general')
 * usan 'general', que son 7. Guardar una consulta con diagnosticos sin indicar
 * el ojo reventaba con:
 *
 *   SQLSTATE[22001]: String data, right truncated: 1406 Data too long for column 'eye'
 *
 * No se detecto antes porque SQLite no aplica los limites de longitud de
 * VARCHAR; MySQL y MariaDB si.
 */
return new class extends Migration
{
    public function up(): void
    {
        // En SQLite la longitud no se aplica y un change() reconstruiria la
        // tabla sin ganar nada.
        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        if (Schema::hasColumn('consultation_diagnoses', 'eye')) {
            DB::statement('alter table `consultation_diagnoses` modify `eye` varchar(10) null');
        }
    }

    public function down(): void
    {
        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        if (Schema::hasColumn('consultation_diagnoses', 'eye')) {
            DB::statement('alter table `consultation_diagnoses` modify `eye` varchar(5) null');
        }
    }
};
