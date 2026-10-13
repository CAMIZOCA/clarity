<?php

namespace Tests\Feature;

use App\Models\Patient;
use App\Services\LegacyConsultationRepairService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PDO;
use Tests\TestCase;

/**
 * Reparacion de las consultas importadas de Optica Andina. Los valores de
 * partida son los que dejo la importacion real (consulta legacy 71348).
 */
class LegacyConsultationRepairTest extends TestCase
{
    use RefreshDatabase;

    private int $patientId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->patientId = Patient::create([
            'nombre' => 'Paciente importado', 'cedula' => '1710000301', 'fecha_nacimiento' => '1970-01-01',
        ])->id;
    }

    /** Inserta la consulta sin pasar por el modelo, como lo hizo la importacion. */
    private function insertConsultation(array $attributes, ?string $legacyId = '71348'): int
    {
        return DB::table('consultations')->insertGetId([
            'patient_id' => $this->patientId,
            'numero_consulta' => 1,
            'fecha_consulta' => '2026-07-05',
            'estado' => 'completada',
            'legacy_id' => $legacyId,
            'created_at' => now(),
            'updated_at' => now(),
            ...$attributes,
        ]);
    }

    private function consultation(int $id): object
    {
        return DB::table('consultations')->find($id);
    }

    private function service(): LegacyConsultationRepairService
    {
        return app(LegacyConsultationRepairService::class);
    }

    public function test_diopters_written_without_a_decimal_point_are_divided_by_100(): void
    {
        $id = $this->insertConsultation([
            'rx_final_esfera_od' => 300, 'rx_final_cilindro_od' => -225, 'rx_final_eje_od' => 15,
            'rx_final_add_od' => 250, 'rx_final_esfera_oi' => -50, 'vc_esfera_od' => 175,
        ]);

        $this->service()->repair([LegacyConsultationRepairService::RULE_DECIMALS]);

        $row = $this->consultation($id);
        $this->assertEqualsWithDelta(3.00, $row->rx_final_esfera_od, 0.001);
        $this->assertEqualsWithDelta(-2.25, $row->rx_final_cilindro_od, 0.001);
        $this->assertEqualsWithDelta(2.50, $row->rx_final_add_od, 0.001);
        $this->assertEqualsWithDelta(-0.50, $row->rx_final_esfera_oi, 0.001);
        $this->assertEqualsWithDelta(1.75, $row->vc_esfera_od, 0.001);
        // El eje nunca es una dioptria.
        $this->assertEquals(15, $row->rx_final_eje_od);
    }

    public function test_values_already_in_diopters_are_left_alone(): void
    {
        $id = $this->insertConsultation(['rx_final_esfera_od' => -1.25, 'rx_final_cilindro_od' => -0.5, 'rx_final_esfera_oi' => 3]);

        $report = $this->service()->repair([LegacyConsultationRepairService::RULE_DECIMALS]);

        $row = $this->consultation($id);
        $this->assertEqualsWithDelta(-1.25, $row->rx_final_esfera_od, 0.001);
        $this->assertEqualsWithDelta(-0.5, $row->rx_final_cilindro_od, 0.001);
        $this->assertEqualsWithDelta(3.0, $row->rx_final_esfera_oi, 0.001);
        $this->assertSame(0, $report['rules'][LegacyConsultationRepairService::RULE_DECIMALS]['changes']);
    }

    public function test_impossible_values_are_reported_and_not_touched(): void
    {
        $id = $this->insertConsultation(['rx_final_cilindro_od' => -75170]);

        $report = $this->service()->repair([LegacyConsultationRepairService::RULE_DECIMALS]);

        $this->assertEqualsWithDelta(-75170, $this->consultation($id)->rx_final_cilindro_od, 0.001);
        $this->assertCount(1, $report['anomalies']);
        $this->assertSame('rx_final_cilindro_od', $report['anomalies'][0]['column']);
    }

    public function test_rx_en_uso_takes_the_sphere_from_the_axis_column(): void
    {
        $id = $this->insertConsultation([
            'rx_uso_esfera_od' => 20, 'rx_uso_eje_od' => 300, 'rx_uso_add_od' => 250,
            'rx_uso_esfera_oi' => 20, 'rx_uso_eje_oi' => -50,
        ]);
        $entryId = DB::table('consultation_rx_uso_entries')->insertGetId([
            'consultation_id' => $id, 'orden' => 0,
            'esfera_od' => 20, 'eje_od' => 300, 'add_od' => 250, 'esfera_oi' => 20, 'eje_oi' => -50,
        ]);

        $this->service()->repair([LegacyConsultationRepairService::RULE_RX_USO]);

        $row = $this->consultation($id);
        $this->assertEqualsWithDelta(3.00, $row->rx_uso_esfera_od, 0.001);
        $this->assertNull($row->rx_uso_eje_od);
        $this->assertEqualsWithDelta(2.50, $row->rx_uso_add_od, 0.001);
        $this->assertEqualsWithDelta(-0.50, $row->rx_uso_esfera_oi, 0.001);

        $entry = DB::table('consultation_rx_uso_entries')->find($entryId);
        $this->assertEqualsWithDelta(3.00, $entry->esfera_od, 0.001);
        $this->assertNull($entry->eje_od);
        $this->assertEqualsWithDelta(-0.50, $entry->esfera_oi, 0.001);
    }

    public function test_residual_20_without_a_sphere_is_cleared_but_kept_in_the_log(): void
    {
        $id = $this->insertConsultation(['rx_uso_esfera_od' => 20]);

        $this->service()->repair([LegacyConsultationRepairService::RULE_RX_USO]);

        $this->assertNull($this->consultation($id)->rx_uso_esfera_od);
        $this->assertDatabaseHas('consultation_legacy_repairs', [
            'consultation_id' => $id, 'column_name' => 'rx_uso_esfera_od', 'old_value' => '20', 'new_value' => null,
        ]);
    }

    public function test_rx_en_uso_corrected_by_hand_is_not_touched(): void
    {
        $id = $this->insertConsultation([
            'rx_uso_esfera_od' => -0.5, 'rx_uso_cilindro_od' => -0.25, 'rx_uso_eje_od' => 90,
            'rx_uso_esfera_oi' => -1.0,
        ]);

        $this->service()->repair([LegacyConsultationRepairService::RULE_RX_USO]);

        $row = $this->consultation($id);
        $this->assertEqualsWithDelta(-0.5, $row->rx_uso_esfera_od, 0.001);
        $this->assertEquals(90, $row->rx_uso_eje_od);
        $this->assertEqualsWithDelta(-1.0, $row->rx_uso_esfera_oi, 0.001);
    }

    public function test_ark_becomes_the_retinoscopy_and_the_old_text_goes_to_cover_test(): void
    {
        $id = $this->insertConsultation([
            'ark_od' => '+300 -225 x 15 cc 20/20', 'ark_oi' => '+450 -375 x170 cc 20/20',
            'retinoscopia_od' => 'ORTHO',
        ]);

        $this->service()->repair([LegacyConsultationRepairService::RULE_ARK]);

        $row = $this->consultation($id);
        $this->assertSame('+300 -225 x 15 cc 20/20', $row->retinoscopia_od);
        $this->assertSame('+450 -375 x170 cc 20/20', $row->retinoscopia_oi);
        $this->assertNull($row->ark_od);
        $this->assertNull($row->ark_oi);
        $this->assertSame('OD: ORTHO', $row->cover_test);
    }

    public function test_an_eye_already_moved_by_hand_is_respected(): void
    {
        // La optica ya paso el OD a Retinoscopia; solo falta el OI.
        $id = $this->insertConsultation([
            'retinoscopia_od' => '+1.25 -0.25 x 154', 'ark_oi' => '+125 -025 X 154',
        ]);

        $this->service()->repair([LegacyConsultationRepairService::RULE_ARK]);

        $row = $this->consultation($id);
        $this->assertSame('+1.25 -0.25 x 154', $row->retinoscopia_od);
        $this->assertSame('+125 -025 X 154', $row->retinoscopia_oi);
        $this->assertNull($row->cover_test);
    }

    public function test_a_real_keratometry_typed_in_ark_stays_in_place(): void
    {
        $id = $this->insertConsultation(['ark_od' => '43.50/44.25@10']);

        $report = $this->service()->repair([LegacyConsultationRepairService::RULE_ARK]);

        $row = $this->consultation($id);
        $this->assertSame('43.50/44.25@10', $row->ark_od);
        $this->assertNull($row->retinoscopia_od);
        $this->assertCount(1, $report['anomalies']);
    }

    public function test_consultations_created_in_this_system_are_never_touched(): void
    {
        $id = $this->insertConsultation(['rx_final_esfera_od' => 300, 'ark_od' => '+300'], legacyId: null);

        $this->service()->repair(LegacyConsultationRepairService::RULES);

        $row = $this->consultation($id);
        $this->assertEqualsWithDelta(300, $row->rx_final_esfera_od, 0.001);
        $this->assertSame('+300', $row->ark_od);
        $this->assertDatabaseCount('consultation_legacy_repairs', 0);
    }

    public function test_dry_run_reports_without_writing(): void
    {
        $id = $this->insertConsultation(['rx_final_esfera_od' => 300]);

        $report = $this->service()->repair(dryRun: true);

        $this->assertEqualsWithDelta(300, $this->consultation($id)->rx_final_esfera_od, 0.001);
        $this->assertDatabaseCount('consultation_legacy_repairs', 0);
        $this->assertSame(1, $report['rules'][LegacyConsultationRepairService::RULE_DECIMALS]['changes']);
        $this->assertSame('3.00', $report['rules'][LegacyConsultationRepairService::RULE_DECIMALS]['examples'][0]['changes'][0]['new']);
    }

    public function test_running_twice_does_not_repair_twice(): void
    {
        // 2500 -> 25.00: sin la bitacora, la segunda pasada lo dejaria en 0.25.
        $id = $this->insertConsultation(['rx_final_esfera_od' => 2500]);

        $this->service()->repair();
        $second = $this->service()->repair();

        $this->assertEqualsWithDelta(25.00, $this->consultation($id)->rx_final_esfera_od, 0.001);
        $this->assertSame(0, $second['rules'][LegacyConsultationRepairService::RULE_DECIMALS]['changes']);
    }

    public function test_revert_restores_every_original_value(): void
    {
        $id = $this->insertConsultation([
            'rx_final_esfera_od' => 300, 'rx_uso_esfera_od' => 20, 'rx_uso_eje_od' => -50,
            'ark_od' => '+300', 'retinoscopia_od' => 'X',
        ]);

        $this->service()->repair();
        $restored = $this->service()->revert();

        $row = $this->consultation($id);
        $this->assertGreaterThan(0, $restored);
        $this->assertEqualsWithDelta(300, $row->rx_final_esfera_od, 0.001);
        $this->assertEqualsWithDelta(20, $row->rx_uso_esfera_od, 0.001);
        $this->assertEquals(-50, $row->rx_uso_eje_od);
        $this->assertSame('+300', $row->ark_od);
        $this->assertSame('X', $row->retinoscopia_od);
        $this->assertNull($row->cover_test);
        $this->assertDatabaseCount('consultation_legacy_repairs', 0);
    }

    public function test_subjective_shift_only_runs_when_asked(): void
    {
        $id = $this->insertConsultation(['subj_cilindro_od' => 375]);

        $this->service()->repair();
        $this->assertEqualsWithDelta(3.75, $this->consultation($id)->subj_cilindro_od, 0.001);
        $this->assertNull($this->consultation($id)->subj_esfera_od);

        $this->service()->repair([LegacyConsultationRepairService::RULE_SUBJ]);

        $row = $this->consultation($id);
        $this->assertEqualsWithDelta(3.75, $row->subj_esfera_od, 0.001);
        $this->assertNull($row->subj_cilindro_od);
    }

    /**
     * Respaldo del Access con una historia: el subjetivo y la RX en uso vienen
     * como un solo texto por ojo (legacy 71348 = la consulta de `insertConsultation`).
     */
    private function source(array $row): PDO
    {
        $columns = [
            'RXPARCIAL_ESFERA_OD', 'RXPARCIAL_CILINDRO_OD', 'RXPARCIAL_EJE_OD', 'RXPARCIAL_AVL_OD',
            'RXPARCIAL_ESFERA_OI', 'RXPARCIAL_CILINDRO_OI', 'RXPARCIAL_EJE_OI', 'RXPARCIAL_AVL_OI',
            'RX_EN USO_ESFERA_OD', 'RX_EN USO_CILINDRO_OD', 'RX_EN USO_EJE_OD', 'RX_EN USO_AVCC_OD',
            'RX_EN USO_ESFERA_OI', 'RX_EN USO_CILINDRO_OI', 'RX_EN USO_EJE_OI', 'RX_EN USO_AVCC_OI',
        ];

        $pdo = new PDO('sqlite::memory:');
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->exec('create table "HISTORIAL OPTAMOLOGIA" (Id text, '.implode(', ', array_map(fn ($column) => "\"{$column}\" text", $columns)).')');

        $row = ['Id' => '71348', ...$row];
        $pdo->prepare(
            'insert into "HISTORIAL OPTAMOLOGIA" ('.implode(', ', array_map(fn ($column) => "\"{$column}\"", array_keys($row))).') values ('
            .implode(', ', array_fill(0, count($row), '?')).')'
        )->execute(array_values($row));

        return $pdo;
    }

    public function test_the_subjective_is_recovered_whole_from_the_backup(): void
    {
        // OD como lo dejo la primera importacion; OI ya pasado por `decimales`.
        $id = $this->insertConsultation(['subj_cilindro_od' => 50, 'subj_cilindro_oi' => -1.25]);
        $source = $this->source([
            'RXPARCIAL_CILINDRO_OD' => '+050-100x 80 20/40-',
            'RXPARCIAL_CILINDRO_OI' => '-125 Esf.',
        ]);

        $this->service()->repairFromSource($source);

        $row = $this->consultation($id);
        $this->assertEqualsWithDelta(0.50, $row->subj_esfera_od, 0.001);
        $this->assertEqualsWithDelta(-1.00, $row->subj_cilindro_od, 0.001);
        $this->assertEquals(80, $row->subj_eje_od);
        $this->assertSame('20/40-', $row->subj_avl_od);
        // Un numero solo es la esfera.
        $this->assertEqualsWithDelta(-1.25, $row->subj_esfera_oi, 0.001);
        $this->assertNull($row->subj_cilindro_oi);
    }

    public function test_a_neutral_sphere_in_the_backup_turns_on_the_flag(): void
    {
        $id = $this->insertConsultation(['subj_cilindro_od' => -25]);

        $this->service()->repairFromSource($this->source(['RXPARCIAL_CILINDRO_OD' => 'N -025 X 15 20/20']));

        $row = $this->consultation($id);
        $this->assertNull($row->subj_esfera_od);
        $this->assertEquals(1, $row->subj_esfera_od_neutral);
        $this->assertEqualsWithDelta(-0.25, $row->subj_cilindro_od, 0.001);
        $this->assertEquals(15, $row->subj_eje_od);
    }

    public function test_a_subjective_edited_by_hand_is_not_recovered(): void
    {
        // El OD se corrigio en este sistema; el OI trae otro numero que el respaldo.
        $id = $this->insertConsultation([
            'subj_esfera_od' => 0.75, 'subj_cilindro_od' => 0.5, 'subj_eje_od' => 90, 'subj_cilindro_oi' => -2.00,
        ]);
        $source = $this->source([
            'RXPARCIAL_CILINDRO_OD' => '+050-100x 80', 'RXPARCIAL_CILINDRO_OI' => '+050-100x 80',
        ]);

        $report = $this->service()->repairFromSource($source);

        $row = $this->consultation($id);
        $this->assertEqualsWithDelta(0.75, $row->subj_esfera_od, 0.001);
        $this->assertEquals(90, $row->subj_eje_od);
        $this->assertEqualsWithDelta(-2.00, $row->subj_cilindro_oi, 0.001);
        $this->assertSame(0, $report['rules'][LegacyConsultationRepairService::RULE_SUBJ_SOURCE]['changes']);
    }

    public function test_a_subjective_that_is_not_a_refraction_is_reported_and_left_alone(): void
    {
        $id = $this->insertConsultation(['subj_cilindro_od' => 225]);

        $report = $this->service()->repairFromSource($this->source(['RXPARCIAL_CILINDRO_OD' => '+225-100x c65']));

        $this->assertEqualsWithDelta(225, $this->consultation($id)->subj_cilindro_od, 0.001);
        $this->assertCount(1, $report['anomalies']);
    }

    public function test_rx_en_uso_is_recovered_whole_from_the_backup(): void
    {
        // OD como lo dejo la importacion; OI despues de la regla `rx_uso`.
        $flat = [
            'rx_uso_esfera_od' => 20, 'rx_uso_eje_od' => 125,
            'rx_uso_esfera_oi' => -1.00,
        ];
        $id = $this->insertConsultation($flat);
        $entryId = DB::table('consultation_rx_uso_entries')->insertGetId([
            'consultation_id' => $id, 'orden' => 0, 'esfera_od' => 20, 'eje_od' => 125, 'esfera_oi' => -1.00,
        ]);
        $source = $this->source([
            'RX_EN USO_ESFERA_OD' => '20/40', 'RX_EN USO_EJE_OD' => '+125-075x 90 20/20 prog ev gold',
            'RX_EN USO_ESFERA_OI' => '20/200', 'RX_EN USO_EJE_OI' => '-1,25-1,00*20',
        ]);

        $this->service()->repairFromSource($source);

        $row = $this->consultation($id);
        $this->assertEqualsWithDelta(1.25, $row->rx_uso_esfera_od, 0.001);
        $this->assertEqualsWithDelta(-0.75, $row->rx_uso_cilindro_od, 0.001);
        $this->assertEquals(90, $row->rx_uso_eje_od);
        $this->assertSame('20/40', $row->rx_uso_avcc_od);
        $this->assertEqualsWithDelta(-1.25, $row->rx_uso_esfera_oi, 0.001);
        $this->assertEqualsWithDelta(-1.00, $row->rx_uso_cilindro_oi, 0.001);
        $this->assertEquals(20, $row->rx_uso_eje_oi);

        $entry = DB::table('consultation_rx_uso_entries')->find($entryId);
        $this->assertEqualsWithDelta(1.25, $entry->esfera_od, 0.001);
        $this->assertEqualsWithDelta(-0.75, $entry->cilindro_od, 0.001);
        $this->assertEquals(90, $entry->eje_od);
        $this->assertSame('20/200', $entry->avcc_oi);
        $this->assertSame('OD: 20/20 prog ev gold', $entry->observacion);
    }

    public function test_rx_en_uso_edited_by_hand_is_not_recovered(): void
    {
        $id = $this->insertConsultation(['rx_uso_esfera_od' => -0.50, 'rx_uso_cilindro_od' => -0.25, 'rx_uso_eje_od' => 90]);

        $this->service()->repairFromSource($this->source([
            'RX_EN USO_ESFERA_OD' => '20/40', 'RX_EN USO_EJE_OD' => '+125-075x 90',
        ]));

        $row = $this->consultation($id);
        $this->assertEqualsWithDelta(-0.50, $row->rx_uso_esfera_od, 0.001);
        $this->assertEqualsWithDelta(-0.25, $row->rx_uso_cilindro_od, 0.001);
        $this->assertNull($row->rx_uso_avcc_od);
    }

    public function test_recovering_from_the_backup_twice_changes_nothing_and_can_be_reverted(): void
    {
        $id = $this->insertConsultation(['subj_cilindro_od' => 50, 'rx_uso_esfera_od' => 20, 'rx_uso_eje_od' => 125]);
        $source = $this->source([
            'RXPARCIAL_CILINDRO_OD' => '+050-100x 80',
            'RX_EN USO_ESFERA_OD' => '20/40', 'RX_EN USO_EJE_OD' => '+125-075x 90',
        ]);

        // Primero el punto decimal, como en un despliegue real; despues el respaldo.
        $this->service()->repair([LegacyConsultationRepairService::RULE_DECIMALS, LegacyConsultationRepairService::RULE_RX_USO]);
        $this->service()->repairFromSource($source);
        $second = $this->service()->repairFromSource($source);

        $this->assertSame(0, $second['rules'][LegacyConsultationRepairService::RULE_SUBJ_SOURCE]['changes']);
        $this->assertSame(0, $second['rules'][LegacyConsultationRepairService::RULE_RX_USO_SOURCE]['changes']);
        $this->assertEqualsWithDelta(-1.00, $this->consultation($id)->subj_cilindro_od, 0.001);
        $this->assertEquals(90, $this->consultation($id)->rx_uso_eje_od);

        $this->service()->revert();

        $row = $this->consultation($id);
        $this->assertEqualsWithDelta(50, $row->subj_cilindro_od, 0.001);
        $this->assertNull($row->subj_esfera_od);
        $this->assertNull($row->subj_eje_od);
        $this->assertEqualsWithDelta(20, $row->rx_uso_esfera_od, 0.001);
        $this->assertEquals(125, $row->rx_uso_eje_od);
        $this->assertNull($row->rx_uso_cilindro_od);
        $this->assertNull($row->rx_uso_avcc_od);
        $this->assertDatabaseCount('consultation_legacy_repairs', 0);
    }

    public function test_source_rules_need_the_backup_file(): void
    {
        $this->artisan('consultations:repair-legacy-import', ['--only' => 'subj_origen'])->assertFailed();
        $this->artisan('consultations:repair-legacy-import', ['--source' => 'no-existe.sqlite'])->assertFailed();
    }

    public function test_command_runs_in_dry_run_mode(): void
    {
        $id = $this->insertConsultation(['rx_final_esfera_od' => 300]);

        $this->artisan('consultations:repair-legacy-import', ['--dry-run' => true])->assertSuccessful();
        $this->assertEqualsWithDelta(300, $this->consultation($id)->rx_final_esfera_od, 0.001);

        $this->artisan('consultations:repair-legacy-import')->assertSuccessful();
        $this->assertEqualsWithDelta(3.00, $this->consultation($id)->rx_final_esfera_od, 0.001);

        $this->artisan('consultations:repair-legacy-import', ['--only' => 'inventada'])->assertFailed();
    }
}
