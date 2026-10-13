<?php

use App\Services\LegacyConsultationRepairService;
use Illuminate\Database\Migrations\Migration;

/**
 * Aplica por fin la reparacion de las consultas importadas de Optica Andina.
 *
 * El sistema anterior escribia las dioptrias sin punto ("+050" es +0.50) y la
 * importacion las copio literales: RX final, subjetivo y vision de cerca se
 * veian como +50.00 y -125.00. El comando `consultations:repair-legacy-import`
 * lo corregia, pero habia que correrlo a mano en cada instancia y nunca se hizo.
 *
 * Solo corren las dos reglas que no dependen del respaldo original: el punto
 * decimal y la RX en uso con la esfera en la columna del eje. Cada valor queda
 * anotado en `consultation_legacy_repairs`, asi que repetirla no divide dos
 * veces y `down()` devuelve todo a como estaba. El subjetivo y la RX en uso
 * completos se recuperan aparte, al importar el respaldo (`repairFromSource`).
 */
return new class extends Migration
{
    private const RULES = [
        LegacyConsultationRepairService::RULE_DECIMALS,
        LegacyConsultationRepairService::RULE_RX_USO,
    ];

    public function up(): void
    {
        app(LegacyConsultationRepairService::class)->repair(self::RULES, examples: 0);
    }

    public function down(): void
    {
        app(LegacyConsultationRepairService::class)->revert(self::RULES);
    }
};
