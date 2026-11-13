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
use Tests\TestCase;

/**
 * Revision de datos heredados, casos de lentes de contacto. Los valores son de
 * historias reales: 71277 (Karen, LC blandos y "Biofinity" en Material) y
 * 66746 (lente de prueba completo guardado con claves planas).
 */
class LegacyReviewContactLensTest extends TestCase
{
    use RefreshDatabase;

    private const API = '/api/admin/legacy-review/';

    private int $patientId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesSeeder::class);

        $this->patientId = Patient::create([
            'nombre' => 'Garcia Rodriguez Karen Daniela', 'cedula' => '1313992073', 'fecha_nacimiento' => '1995-01-01',
        ])->id;

        $this->mock(DatabaseBackupService::class, function ($mock) {
            $mock->shouldReceive('generate')->andReturnUsing(function (MaintenanceOperation $operation) {
                $operation->update(['status' => 'completed', 'finished_at' => now()]);

                return $operation;
            });
        });

        $user = User::factory()->create();
        $user->assignRole(Role::ADMIN->value);
        Sanctum::actingAs($user);
    }

    private function consultation(array $attributes = [], ?string $legacyId = '71277'): int
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

    private function module(int $consultationId, array $attributes): int
    {
        return DB::table('consultation_contact_lens_modules')->insertGetId([
            'consultation_id' => $consultationId,
            'created_at' => now(),
            'updated_at' => now(),
            ...array_map(fn ($value) => is_array($value) ? json_encode($value) : $value, $attributes),
        ]);
    }

    private function moduleOf(int $consultationId): ?object
    {
        return DB::table('consultation_contact_lens_modules')->where('consultation_id', $consultationId)->first();
    }

    private function row(string $case, int $id, array $query = []): ?array
    {
        return collect($this->getJson(self::API.$case.'?'.http_build_query($query))->assertOk()->json('data'))->firstWhere('id', $id);
    }

    private function softLens(array $attributes = []): array
    {
        return [
            'retinoscopia_esfera_od' => '-4.25', 'retinoscopia_cilindro_od' => '-0.75', 'retinoscopia_eje_od' => '0',
            'retinoscopia_esfera_oi' => '-2.75', 'retinoscopia_cilindro_oi' => '-0.75', 'retinoscopia_eje_oi' => '180',
            ...$attributes,
        ];
    }

    public function test_the_cases_are_listed_with_their_presentation(): void
    {
        $cases = collect($this->getJson(self::API.'cases')->assertOk()->json('data'))->keyBy('key');

        $this->assertSame(['avsc-rx-uso', 'lc-blandos-poder', 'lc-lente-prueba', 'lc-marca-material'], $cases->keys()->all());
        $this->assertSame('Poder del lente definitivo', $cases['lc-blandos-poder']['columns'][1]['label']);
        $this->assertArrayHasKey('formato', $cases['lc-blandos-poder']['statuses']);
        $this->assertContains('formato', array_column($cases['lc-blandos-poder']['filters'], 'value'));
        $this->assertArrayNotHasKey('match', $cases['lc-blandos-poder']['filters'][0]);
    }

    public function test_an_empty_power_is_filled_from_the_access(): void
    {
        $id = $this->consultation($this->softLens());
        $this->module($id, ['final_lens' => ['od' => ['curva_base' => '8,6', 'poder' => null]]]);

        $row = $this->row('lc-blandos-poder', $id);
        $this->assertSame('llenar', $row['status']);
        $this->assertTrue($row['preselected']);
        $this->assertSame('-4.25 -0.75 x 0', $row['eyes']['od']['proposed']['poder']);
        $this->assertSame('Esf -4.25 · Cil -0.75 · Eje 0', $row['eyes']['od']['current']['access']);

        $this->postJson(self::API.'lc-blandos-poder/apply', ['all' => true, 'confirm' => true])->assertCreated();

        $lens = json_decode($this->moduleOf($id)->final_lens, true);
        $this->assertSame('-4.25 -0.75 x 0', $lens['od']['poder']);
        $this->assertSame('8,6', $lens['od']['curva_base']);
        $this->assertSame('-2.75 -0.75 x 180', $lens['oi']['poder']);

        // Visible por la API que lee el formulario.
        $this->getJson("/api/consultations/{$id}")
            ->assertOk()
            ->assertJsonPath('contact_lens_module.final_lens.od.poder', '-4.25 -0.75 x 0');
    }

    public function test_the_same_power_written_differently_is_proposed_unmarked(): void
    {
        // Lo que escribio la optica a mano en 71277.
        $id = $this->consultation($this->softLens());
        $this->module($id, ['final_lens' => [
            'od' => ['poder' => '-425-075x0', 'material' => 'Biofinity'],
            'oi' => ['poder' => '-275-075x0', 'material' => 'Biofinity'],
        ]]);

        $row = $this->row('lc-blandos-poder', $id);
        $this->assertSame('formato', $row['status']);
        $this->assertSame('formato', $row['eyes']['oi']['status']);
        $this->assertSame('-2.75 -0.75 x 180', $row['eyes']['oi']['proposed']['poder']);
        $this->assertFalse($row['preselected']);
        $this->assertTrue($row['selectable']);

        // "Todas" no lo toca; elegido a mano, si.
        $this->postJson(self::API.'lc-blandos-poder/apply', ['all' => true, 'confirm' => true])->assertStatus(422);
        $this->postJson(self::API.'lc-blandos-poder/apply', ['ids' => [$id], 'confirm' => true])->assertCreated();

        $lens = json_decode($this->moduleOf($id)->final_lens, true);
        $this->assertSame('-4.25 -0.75 x 0', $lens['od']['poder']);
        $this->assertSame('Biofinity', $lens['od']['material']);
    }

    public function test_a_different_power_is_never_written(): void
    {
        $id = $this->consultation($this->softLens());
        $this->module($id, ['final_lens' => ['od' => ['poder' => '-3.00'], 'oi' => ['poder' => '-2.75 -0.75 x 180']]]);

        $row = $this->row('lc-blandos-poder', $id);
        $this->assertSame('distinto', $row['status']);
        $this->assertFalse($row['selectable']);

        $this->postJson(self::API.'lc-blandos-poder/apply', ['ids' => [$id], 'confirm' => true])->assertStatus(422);
        $this->assertSame('-3.00', json_decode($this->moduleOf($id)->final_lens, true)['od']['poder']);
    }

    public function test_notes_that_are_not_a_measure_go_to_the_observations_creating_the_module(): void
    {
        $id = $this->consultation([
            'retinoscopia_esfera_od' => 'AE 20/30', 'retinoscopia_esfera_oi' => 'Test de H +',
        ], '67250');

        $row = $this->row('lc-blandos-poder', $id);
        $this->assertSame('nota', $row['status']);
        $this->assertTrue($row['preselected']);
        $this->assertContains('sin_modulo', $row['flags']);
        $this->assertSame('LC blandos (sistema anterior) OD: AE 20/30 / OI: Test de H +', $row['fields']['observaciones']['proposed']);

        $this->postJson(self::API.'lc-blandos-poder/apply', ['all' => true, 'confirm' => true])->assertCreated();

        $this->assertSame('LC blandos (sistema anterior) OD: AE 20/30 / OI: Test de H +', $this->moduleOf($id)->observaciones);
        // Ya esta: deja de ser candidata.
        $this->assertNull($this->row('lc-blandos-poder', $id));

        $batch = DB::table('legacy_review_batches')->value('id');
        $this->postJson(self::API."batches/{$batch}/revert")->assertOk();
        $this->assertNull($this->moduleOf($id)->observaciones);
    }

    public function test_a_flat_trial_lens_is_moved_into_the_table(): void
    {
        $id = $this->consultation([], '66746');
        $this->module($id, [
            'test_lens' => [
                'bc_od' => '8,3', 'poder_od' => '-2 -2 x 180', 'sobreref_od' => '-050 -075x10', 'av_od' => '20/20-',
                'av_oi' => '20/20', 'calificacion' => 'Buena',
            ],
            'observaciones' => 'Primero le probé en CB 8,6',
        ]);

        $row = $this->row('lc-lente-prueba', $id);
        $this->assertSame('mover', $row['status']);
        $this->assertTrue($row['preselected']);
        $this->assertContains('con_notas', $row['flags']);
        $this->assertNull($row['eyes']['od']['current']['lente']);
        $this->assertStringContainsString('Curva base 8,3', $row['eyes']['od']['proposed']['lente']);

        $this->postJson(self::API.'lc-lente-prueba/apply', ['all' => true, 'confirm' => true])->assertCreated();

        $this->getJson("/api/consultations/{$id}")
            ->assertOk()
            ->assertJsonPath('contact_lens_module.test_lens.od.curva_base', '8,3')
            ->assertJsonPath('contact_lens_module.test_lens.od.sobre_refraccion', '-050 -075x10')
            ->assertJsonPath('contact_lens_module.test_lens.oi.agudeza_visual', '20/20')
            ->assertJsonPath('contact_lens_module.observaciones', 'Primero le probé en CB 8,6 / Lente de prueba (sistema anterior): Calificación: Buena');
        $this->assertNull($this->row('lc-lente-prueba', $id));
    }

    public function test_a_brand_in_material_moves_to_the_final_lens_observation_only_when_chosen(): void
    {
        // La marca tambien se escribio en consultas nuevas.
        $id = $this->consultation([], null);
        $this->module($id, ['final_lens' => [
            'od' => ['poder' => '-4.25 -0.75 x 0', 'material' => 'Biofinity'],
            'oi' => ['poder' => '-2.75 -0.75 x 180', 'material' => 'biofinity'],
        ]]);
        $other = $this->consultation([], '66788');
        $this->module($other, ['final_lens' => ['od' => ['material' => 'Hidrogel de Sil']]]);

        $row = $this->row('lc-marca-material', $id);
        $this->assertFalse($row['preselected']);
        $this->assertSame('Marca: Biofinity', $row['fields']['observacion']['proposed']);
        $this->assertContains('parece_material', $this->row('lc-marca-material', $other)['flags']);

        $this->postJson(self::API.'lc-marca-material/apply', ['all' => true, 'confirm' => true])->assertStatus(422);
        $this->postJson(self::API.'lc-marca-material/apply', ['ids' => [$id], 'confirm' => true])->assertCreated();

        $lens = json_decode($this->moduleOf($id)->final_lens, true);
        $this->assertNull($lens['od']['material']);
        $this->assertSame('-4.25 -0.75 x 0', $lens['od']['poder']);
        $this->assertSame('Marca: Biofinity', $lens['observacion']);
        $this->assertSame('Hidrogel de Sil', json_decode($this->moduleOf($other)->final_lens, true)['od']['material']);
    }

    public function test_revert_skips_a_lens_saved_again_afterwards(): void
    {
        $id = $this->consultation([], '66746');
        $this->module($id, ['test_lens' => ['bc_od' => '8,3']]);
        $this->postJson(self::API.'lc-lente-prueba/apply', ['all' => true, 'confirm' => true])->assertCreated();

        DB::table('consultation_contact_lens_modules')->where('consultation_id', $id)
            ->update(['test_lens' => json_encode(['od' => ['curva_base' => '8,6']])]);

        $batch = DB::table('legacy_review_batches')->value('id');
        $this->postJson(self::API."batches/{$batch}/revert")
            ->assertOk()
            ->assertJsonPath('data.revert_summary.skipped_consultations', 1);
        $this->assertSame('8,6', json_decode($this->moduleOf($id)->test_lens, true)['od']['curva_base']);
    }
}
