<?php

use App\Services\LegacyConsultationRepairService;
use Illuminate\Database\Migrations\Migration;

/**
 * Lleva los lentes de contacto blandos de las consultas importadas a la
 * casilla "Poder" del lente definitivo.
 *
 * En el Access el bloque "LENTES DE CONTACTO BLANDOS" (esfera, cilindro, eje)
 * se guarda en RETINOSCOPIA_ESFERA/CILINDRO/EJE. La importacion lo copio a
 * `consultations.retinoscopia_esfera/cilindro/eje_*`, que ninguna pantalla
 * muestra: la optica no encontraba la medida del lente que el paciente pedia
 * repetir. No necesita el respaldo: los datos ya estan en la base.
 *
 * Solo llena un "Poder" vacio y anota el `final_lens` anterior en
 * `consultation_legacy_repairs`, asi que repetirla no duplica y `down()`
 * lo devuelve a como estaba.
 */
return new class extends Migration
{
    private const RULES = [LegacyConsultationRepairService::RULE_SOFT_CONTACT_LENS];

    public function up(): void
    {
        app(LegacyConsultationRepairService::class)->repair(self::RULES, examples: 0);
    }

    public function down(): void
    {
        app(LegacyConsultationRepairService::class)->revert(self::RULES);
    }
};
