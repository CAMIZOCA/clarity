<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Columnas de `consultations` mas cortas que lo que la validacion deja pasar.
 *
 * `retinoscopia_od/oi` son VARCHAR(20) pero `StoreConsultationRequest` admite
 * 100 caracteres, y `vision_colores` es VARCHAR(30) con 50 permitidos. En
 * SQLite no pasa nada (no impone la longitud); en MariaDB con modo estricto una
 * retinoscopia como "+3.00 -2.25 x 15 cc 20/20" (24 caracteres) abortaba el
 * guardado de la consulta entera con "Data too long".
 *
 * Pasan a TEXT, que en la fila solo ocupa un puntero: de paso se libera espacio
 * en una tabla que esta al limite de InnoDB. Mismo criterio que
 * `2026_05_27_900000_reduce_consultations_row_size`.
 */
return new class extends Migration
{
    private const COLUMNS = ['retinoscopia_od', 'retinoscopia_oi', 'vision_colores'];

    public function up(): void
    {
        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        foreach (self::COLUMNS as $column) {
            if (Schema::hasColumn('consultations', $column)) {
                DB::statement("alter table `consultations` modify `{$column}` text null");
            }
        }
    }

    public function down(): void
    {
        // Volver a VARCHAR truncaria lo ya guardado y acercaria la fila al
        // limite de InnoDB, asi que no se intenta.
    }
};
