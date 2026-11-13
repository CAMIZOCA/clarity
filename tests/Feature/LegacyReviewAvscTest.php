<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\MaintenanceOperation;
use App\Models\Patient;
use App\Models\User;
use App\Services\DatabaseBackupService;
use Database\Seeders\RolesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Pantalla "Revision de datos heredados", caso AV.SC lejos guardada como AV.CC
 * de la RX en uso (consulta legacy 71521: el Access tiene AV.SC 20/30 y la
 * importacion la dejo como AV.CC de "RX en uso 1").
 */
class LegacyReviewAvscTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/admin/legacy-review/avsc-rx-uso';

    private int $patientId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesSeeder::class);

        $this->patientId = Patient::create([
            'nombre' => 'Bustamante Calle Amy Pamela', 'cedula' => '1710000301', 'fecha_nacimiento' => '1990-01-01',
        ])->id;

        // La suite usa SQLite en memoria: el backup real no aplica aqui.
        $this->mock(DatabaseBackupService::class, function ($mock) {
            $mock->shouldReceive('generate')->andReturnUsing(function (MaintenanceOperation $operation) {
                $operation->update(['status' => 'completed', 'finished_at' => now()]);

                return $operation;
            });
        });
    }

    private function actingAsAdmin(): User
    {
        $user = User::factory()->create();
        $user->assignRole(Role::ADMIN->value);
        Sanctum::actingAs($user);

        return $user;
    }

    /** Consulta importada como la dejo `rx_uso_origen`: la AV.SC en la AV.CC (entrada y columna plana). */
    private function importedConsultation(array $attributes = [], array $entry = [], ?string $legacyId = '71521', bool $withEntry = true): int
    {
        $id = DB::table('consultations')->insertGetId([
            'patient_id' => $this->patientId,
            'numero_consulta' => 1,
            'fecha_consulta' => '2026-08-14',
            'estado' => 'completada',
            'legacy_id' => $legacyId,
            'rx_uso_avcc_od' => '20/30',
            'rx_uso_avcc_oi' => '20/30',
            'created_at' => '2026-10-09 21:56:42',
            'updated_at' => '2026-10-09 21:56:42',
            ...$attributes,
        ]);

        if ($withEntry) {
            DB::table('consultation_rx_uso_entries')->insert([
                'consultation_id' => $id,
                'orden' => 0,
                'avcc_od' => '20/30',
                'avcc_oi' => '20/30',
                'observacion' => 'OD: No',
                ...$entry,
            ]);
        }

        return $id;
    }

    private function row(array $response, int $id): ?array
    {
        return collect($response['data'])->firstWhere('id', $id);
    }

    private function entry(int $consultationId): object
    {
        return DB::table('consultation_rx_uso_entries')->where('consultation_id', $consultationId)->where('orden', 0)->first();
    }

    public function test_requires_the_legacy_review_permission(): void
    {
        $user = User::factory()->create();
        $user->assignRole(Role::OPTOMETRA->value);
        Sanctum::actingAs($user);

        $this->getJson('/api/admin/legacy-review/cases')->assertForbidden();
        $this->getJson(self::URL)->assertForbidden();
        $this->postJson(self::URL.'/apply', ['all' => true, 'confirm' => true])->assertForbidden();
    }

    public function test_admin_role_is_allowed_even_without_the_permission_row(): void
    {
        // Una BD donde el rol admin todavia no recibio `legacy.review` (migracion sin correr).
        $user = $this->actingAsAdmin();
        $user->roles->first()->revokePermissionTo('legacy.review');
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $this->assertFalse($user->fresh()->can('legacy.review'));
        $this->getJson('/api/admin/legacy-review/cases')->assertOk();
    }

    public function test_an_unknown_case_is_404(): void
    {
        $this->actingAsAdmin();

        $this->getJson('/api/admin/legacy-review/no-existe')->assertNotFound();
    }

    public function test_lists_the_imported_acuity_as_a_preselected_move(): void
    {
        $this->actingAsAdmin();
        $id = $this->importedConsultation();
        DB::table('consultation_legacy_repairs')->insert([
            'consultation_id' => $id, 'target_table' => 'consultations', 'target_id' => $id,
            'column_name' => 'rx_uso_avcc_od', 'rule' => 'rx_uso_origen', 'old_value' => null, 'new_value' => '20/30',
        ]);

        $response = $this->getJson(self::URL)->assertOk()->json();

        $row = $this->row($response, $id);
        $this->assertSame('mover', $row['status']);
        $this->assertTrue($row['preselected']);
        $this->assertSame(['avsc' => null, 'avcc' => '20/30'], $row['eyes']['od']['current']);
        $this->assertSame(['avsc' => '20/30', 'avcc' => null], $row['eyes']['od']['proposed']);
        $this->assertContains('importacion', $row['flags']);
        $this->assertSame('Bustamante Calle Amy Pamela', $row['patient']['nombre_completo']);
        $this->assertSame('OD: No', $row['observacion']);
        $this->assertArrayNotHasKey('changes', $row);
        $this->assertSame(1, $response['summary']['preselected']);
        $this->assertSame(1, $response['total']);
        $this->assertSame('avsc-rx-uso', $response['case']['key']);
    }

    public function test_new_system_consultations_and_rows_without_avcc_are_not_listed(): void
    {
        $this->actingAsAdmin();
        $this->importedConsultation(legacyId: null);
        $this->importedConsultation(['rx_uso_avcc_od' => null, 'rx_uso_avcc_oi' => null], ['avcc_od' => null, 'avcc_oi' => null]);

        $response = $this->getJson(self::URL)->assertOk()->json();

        $this->assertSame(0, $response['total']);
    }

    public function test_without_entries_the_flat_column_is_read(): void
    {
        $this->actingAsAdmin();
        $id = $this->importedConsultation(withEntry: false);

        $row = $this->row($this->getJson(self::URL)->json(), $id);

        $this->assertSame('mover', $row['status']);
        $this->assertContains('sin_bitacora', $row['flags']);
    }

    public function test_a_consultation_edited_in_the_system_is_not_preselected(): void
    {
        $this->actingAsAdmin();
        $id = $this->importedConsultation();
        DB::table('activity_log')->insert([
            'description' => 'consultation_updated', 'subject_type' => 'App\\Models\\Consultation', 'subject_id' => $id,
        ]);

        $row = $this->row($this->getJson(self::URL)->json(), $id);

        $this->assertSame('mover', $row['status']);
        $this->assertTrue($row['selectable']);
        $this->assertFalse($row['preselected']);
        $this->assertContains('editada', $row['flags']);
    }

    public function test_a_different_avsc_is_a_conflict_and_is_never_written(): void
    {
        $this->actingAsAdmin();
        $id = $this->importedConsultation(['avsc_od' => '20/100', 'avsc_oi' => '20/40']);

        $row = $this->row($this->getJson(self::URL)->json(), $id);
        $this->assertSame('conflicto', $row['status']);
        $this->assertFalse($row['selectable']);

        $this->postJson(self::URL.'/apply', ['ids' => [$id], 'confirm' => true])->assertStatus(422);

        $this->assertSame('20/100', DB::table('consultations')->find($id)->avsc_od);
        $this->assertSame('20/30', $this->entry($id)->avcc_od);
    }

    public function test_apply_moves_the_acuity_and_keeps_the_note(): void
    {
        $this->actingAsAdmin();
        $id = $this->importedConsultation([], ['observacion' => 'OD: 20/20 CC / OI: 20/20 CC']);

        $row = $this->row($this->getJson(self::URL)->json(), $id);
        $this->assertContains('nota_con_av', $row['flags']);

        $this->postJson(self::URL.'/apply', [
            'ids' => [$id],
            'confirm' => true,
            // Lo que mande el navegador no se escribe: el servidor vuelve a evaluar.
            'eyes' => ['od' => ['proposed' => ['avsc' => 'INYECTADO']]],
        ])->assertCreated()->assertJsonPath('data.consultations', 1)->assertJsonPath('data.changes', 6);

        $consultation = DB::table('consultations')->find($id);
        $this->assertSame('20/30', $consultation->avsc_od);
        $this->assertSame('20/30', $consultation->avsc_oi);
        $this->assertNull($consultation->rx_uso_avcc_od);
        $this->assertNull($consultation->rx_uso_avcc_oi);
        $this->assertSame('2026-10-09 21:56:42', $consultation->updated_at);
        $entry = $this->entry($id);
        $this->assertNull($entry->avcc_od);
        $this->assertNull($entry->avcc_oi);
        $this->assertSame('OD: 20/20 CC / OI: 20/20 CC', $entry->observacion);

        $batchId = DB::table('legacy_review_batches')->value('id');
        $this->assertNotNull(DB::table('legacy_review_batches')->value('backup_operation_id'));
        $this->assertSame(6, DB::table('consultation_legacy_repairs')->where('batch_id', $batchId)->where('rule', 'revision_avsc')->count());

        // Ya corregida: deja de ser candidata.
        $this->assertNull($this->row($this->getJson(self::URL)->json(), $id));
    }

    public function test_apply_all_respects_the_filters_and_exclusions(): void
    {
        $this->actingAsAdmin();
        $first = $this->importedConsultation();
        $second = $this->importedConsultation(['legacy_id' => '71522']);
        $excluded = $this->importedConsultation(['legacy_id' => '71523']);
        $edited = $this->importedConsultation(['legacy_id' => '71524']);
        DB::table('activity_log')->insert([
            'description' => 'consultation_updated', 'subject_type' => 'App\\Models\\Consultation', 'subject_id' => $edited,
        ]);

        $preview = $this->postJson(self::URL.'/preview', ['all' => true, 'except' => [$excluded]])->assertOk()->json('data');
        $this->assertSame(2, $preview['consultations']);

        $this->postJson(self::URL.'/apply', ['all' => true, 'except' => [$excluded], 'confirm' => true])
            ->assertCreated()
            ->assertJsonPath('data.consultations', 2);

        $this->assertSame('20/30', DB::table('consultations')->find($first)->avsc_od);
        $this->assertSame('20/30', DB::table('consultations')->find($second)->avsc_od);
        $this->assertNull(DB::table('consultations')->find($excluded)->avsc_od);
        // La editada a mano no entra en "todas": hay que elegirla.
        $this->assertNull(DB::table('consultations')->find($edited)->avsc_od);

        $this->postJson(self::URL.'/apply', ['all' => true, 'include' => [$edited], 'except' => [$excluded], 'confirm' => true])
            ->assertCreated()
            ->assertJsonPath('data.consultations', 1);
        $this->assertSame('20/30', DB::table('consultations')->find($edited)->avsc_od);
        $this->assertNull(DB::table('consultations')->find($excluded)->avsc_od);
    }

    public function test_apply_requires_confirmation(): void
    {
        $this->actingAsAdmin();
        $id = $this->importedConsultation();

        $this->postJson(self::URL.'/apply', ['ids' => [$id]])->assertStatus(422);
        $this->assertNull(DB::table('consultations')->find($id)->avsc_od);
    }

    public function test_revert_restores_and_skips_an_eye_edited_afterwards(): void
    {
        $this->actingAsAdmin();
        $id = $this->importedConsultation();
        $this->postJson(self::URL.'/apply', ['ids' => [$id], 'confirm' => true])->assertCreated();
        $batchId = DB::table('legacy_review_batches')->value('id');

        // Despues del lote: se guarda la consulta (la entrada se recrea con otro id)
        // y alguien cambia la AV.SC del OI a mano.
        $entry = $this->entry($id);
        DB::table('consultation_rx_uso_entries')->where('id', $entry->id)->delete();
        DB::table('consultation_rx_uso_entries')->insert([
            'consultation_id' => $id, 'orden' => 0, 'avcc_od' => null, 'avcc_oi' => null, 'observacion' => 'OD: No',
        ]);
        DB::table('consultations')->where('id', $id)->update(['avsc_oi' => '20/25']);

        $this->getJson('/api/admin/legacy-review/batches')->assertOk()->assertJsonPath('data.0.id', $batchId);

        $this->postJson("/api/admin/legacy-review/batches/{$batchId}/revert")
            ->assertOk()
            ->assertJsonPath('data.revert_summary.skipped_consultations', 1);

        $consultation = DB::table('consultations')->find($id);
        $this->assertNull($consultation->avsc_od);
        $this->assertSame('20/30', $consultation->rx_uso_avcc_od);
        $this->assertSame('20/30', $this->entry($id)->avcc_od);
        // El OI editado despues se deja entero.
        $this->assertSame('20/25', $consultation->avsc_oi);
        $this->assertNull($consultation->rx_uso_avcc_oi);
        $this->assertNull($this->entry($id)->avcc_oi);

        $this->assertNotNull(DB::table('legacy_review_batches')->find($batchId)->reverted_at);
        $this->assertSame(0, DB::table('consultation_legacy_repairs')->where('batch_id', $batchId)->count());

        $this->postJson("/api/admin/legacy-review/batches/{$batchId}/revert")->assertStatus(422);
    }

    public function test_a_duplicated_value_only_clears_the_avcc_and_is_not_preselected(): void
    {
        $this->actingAsAdmin();
        $id = $this->importedConsultation(['avsc_od' => '20/30', 'avsc_oi' => '20/30']);

        $row = $this->row($this->getJson(self::URL)->json(), $id);
        $this->assertSame('duplicado', $row['status']);
        $this->assertFalse($row['preselected']);

        $this->postJson(self::URL.'/apply', ['ids' => [$id], 'confirm' => true])->assertCreated()->assertJsonPath('data.changes', 4);

        $this->assertSame('20/30', DB::table('consultations')->find($id)->avsc_od);
        $this->assertNull($this->entry($id)->avcc_od);
    }
}
