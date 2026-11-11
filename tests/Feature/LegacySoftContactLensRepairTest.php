<?php

namespace Tests\Feature;

use App\Models\ConsultationContactLensModule;
use App\Models\Patient;
use App\Services\LegacyConsultationRepairService;
use App\Support\LegacyOpticalParser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * El bloque "LENTES DE CONTACTO BLANDOS" del Access se guarda en
 * RETINOSCOPIA_ESFERA/CILINDRO/EJE. Los valores de partida son los de la
 * consulta legacy 71277 (Access nº 4661), cuya medida la optica no encontraba.
 */
class LegacySoftContactLensRepairTest extends TestCase
{
    use RefreshDatabase;

    private const RULES = [LegacyConsultationRepairService::RULE_SOFT_CONTACT_LENS];

    private int $patientId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->patientId = Patient::create([
            'nombre' => 'Paciente importado', 'cedula' => '1710000302', 'fecha_nacimiento' => '1990-01-01',
        ])->id;
    }

    private function insertConsultation(array $attributes, ?string $legacyId = '71277'): int
    {
        return DB::table('consultations')->insertGetId([
            'patient_id' => $this->patientId,
            'numero_consulta' => 1,
            'fecha_consulta' => '2026-06-01',
            'estado' => 'completada',
            'legacy_id' => $legacyId,
            'created_at' => now(),
            'updated_at' => now(),
            ...$attributes,
        ]);
    }

    private function insertModule(int $consultationId, ?array $finalLens): int
    {
        return DB::table('consultation_contact_lens_modules')->insertGetId([
            'consultation_id' => $consultationId,
            'final_lens' => $finalLens === null ? null : json_encode($finalLens),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function finalLens(int $consultationId): ?array
    {
        $raw = DB::table('consultation_contact_lens_modules')->where('consultation_id', $consultationId)->value('final_lens');

        return $raw === null ? null : json_decode($raw, true);
    }

    private function service(): LegacyConsultationRepairService
    {
        return app(LegacyConsultationRepairService::class);
    }

    private const LEGACY_4661 = [
        'retinoscopia_esfera_od' => '-425', 'retinoscopia_cilindro_od' => '-075', 'retinoscopia_eje_od' => '0',
        'retinoscopia_esfera_oi' => '-275', 'retinoscopia_cilindro_oi' => '-075', 'retinoscopia_eje_oi' => '180',
    ];

    public function test_the_power_is_read_as_the_access_wrote_it(): void
    {
        $this->assertSame('-4.25 -0.75 x 0', LegacyOpticalParser::contactLensPower('-425', '-075', '0'));
        $this->assertSame('+0.25 -1.75 x 10', LegacyOpticalParser::contactLensPower('+025', '-175', '10'));
        $this->assertSame('-9.25', LegacyOpticalParser::contactLensPower('-9,25', null, null));
        $this->assertSame('-0.75 x 170', LegacyOpticalParser::contactLensPower(null, '-075', '170'));
        $this->assertSame('Plano -0.75 x 90', LegacyOpticalParser::contactLensPower('N', '-075', '90'));

        // Las filas viejas usaban estas casillas para otra cosa.
        $this->assertNull(LegacyOpticalParser::contactLensPower('Test de H +', null, null));
        $this->assertNull(LegacyOpticalParser::contactLensPower(' AE 20/30', null, null));
        $this->assertNull(LegacyOpticalParser::contactLensPower('-200', 'EN USO', null));
        $this->assertNull(LegacyOpticalParser::contactLensPower('-150', null, 'Med 200'));
        $this->assertNull(LegacyOpticalParser::contactLensPower('1 caja', null, null));
        $this->assertNull(LegacyOpticalParser::contactLensPower('N', null, null));
    }

    public function test_soft_lenses_go_to_the_final_lens_power_creating_the_module(): void
    {
        $id = $this->insertConsultation(self::LEGACY_4661);

        $report = $this->service()->repair(self::RULES);

        $lens = $this->finalLens($id);
        $this->assertSame('-4.25 -0.75 x 0', $lens['od']['poder']);
        $this->assertSame('-2.75 -0.75 x 180', $lens['oi']['poder']);
        $this->assertArrayHasKey('curva_base', $lens['od']);
        $this->assertSame(1, $report['rules']['lc_blandos']['consultations']);

        // Las columnas de origen quedan como estaban.
        $this->assertSame('-425', DB::table('consultations')->where('id', $id)->value('retinoscopia_esfera_od'));
    }

    public function test_the_lens_is_visible_through_the_api_shape_the_form_reads(): void
    {
        $id = $this->insertConsultation(self::LEGACY_4661);
        $this->service()->repair(self::RULES);

        $module = ConsultationContactLensModule::where('consultation_id', $id)->firstOrFail();
        $this->assertSame('-4.25 -0.75 x 0', $module->final_lens['od']['poder']);
    }

    public function test_a_power_written_by_hand_is_kept(): void
    {
        $id = $this->insertConsultation(self::LEGACY_4661);
        $this->insertModule($id, [
            'od' => ['curva_base' => '8,6', 'poder' => '-425-075x0', 'diametro' => null, 'h2o' => null, 'material' => 'Biofinity'],
        ]);

        $this->service()->repair(self::RULES);

        $lens = $this->finalLens($id);
        $this->assertSame('-425-075x0', $lens['od']['poder']);
        $this->assertSame('Biofinity', $lens['od']['material']);
        $this->assertSame('-2.75 -0.75 x 180', $lens['oi']['poder']);
    }

    public function test_notes_that_are_not_a_measure_stay_and_are_reported(): void
    {
        $id = $this->insertConsultation(['retinoscopia_esfera_od' => 'Test de H +', 'retinoscopia_esfera_oi' => 'Test de H +']);

        $report = $this->service()->repair(self::RULES);

        $this->assertNull($this->finalLens($id));
        $this->assertSame(0, DB::table('consultation_contact_lens_modules')->count());
        $this->assertCount(2, $report['anomalies']);
    }

    public function test_consultations_created_here_are_not_touched(): void
    {
        $id = $this->insertConsultation(self::LEGACY_4661, legacyId: null);

        $this->service()->repair(self::RULES);

        $this->assertSame(0, DB::table('consultation_contact_lens_modules')->where('consultation_id', $id)->count());
    }

    public function test_flat_keys_left_by_the_importer_are_nested(): void
    {
        $id = $this->insertConsultation([]);
        $this->insertModule($id, ['poder_od' => '-200', 'cb_od' => '8,6', 'av_od' => '20/20', 'tipo_lente' => 'Torico']);

        $this->service()->repair(self::RULES);

        $lens = $this->finalLens($id);
        $this->assertSame('-200', $lens['od']['poder']);
        $this->assertSame('8,6', $lens['od']['curva_base']);
        $this->assertArrayNotHasKey('poder_od', $lens);
        $this->assertSame('OD AV: 20/20 / Tipo: Torico', $lens['observacion']);
    }

    public function test_a_second_run_changes_nothing_and_revert_restores(): void
    {
        $id = $this->insertConsultation(self::LEGACY_4661);
        $moduleId = $this->insertModule($id, ['od' => ['poder' => null], 'observacion' => 'Biofinity']);

        $this->service()->repair(self::RULES);
        $this->assertSame('-4.25 -0.75 x 0', $this->finalLens($id)['od']['poder']);

        // Si alguien lo borra a mano despues, no se vuelve a escribir.
        DB::table('consultation_contact_lens_modules')->where('id', $moduleId)->update(['final_lens' => json_encode(['od' => ['poder' => '']])]);
        $again = $this->service()->repair(self::RULES);
        $this->assertSame(0, $again['rules']['lc_blandos']['changes']);

        DB::table('consultation_contact_lens_modules')->where('id', $moduleId)->update(['final_lens' => json_encode(['od' => ['poder' => null], 'observacion' => 'Biofinity'])]);
        $this->assertSame(1, $this->service()->revert(self::RULES));
        $this->assertSame(['od' => ['poder' => null], 'observacion' => 'Biofinity'], $this->finalLens($id));
    }

    public function test_dry_run_writes_nothing(): void
    {
        $id = $this->insertConsultation(self::LEGACY_4661);

        $report = $this->service()->repair(self::RULES, dryRun: true);

        $this->assertSame(1, $report['rules']['lc_blandos']['changes']);
        $this->assertSame(0, DB::table('consultation_contact_lens_modules')->count());
        $this->assertSame(0, DB::table('consultation_legacy_repairs')->count());
    }
}
