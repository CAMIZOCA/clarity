<?php

namespace Tests\Feature;

use App\Enums\Permission;
use App\Models\Consultation;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission as SpatiePermission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class ConsultationContactLensModuleTest extends TestCase
{
    use RefreshDatabase;

    private Consultation $consultation;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $user = User::factory()->create();
        foreach ([Permission::CONSULTATIONS_CREATE->value, Permission::CONSULTATIONS_EDIT->value, Permission::CONSULTATIONS_VIEW->value] as $permission) {
            SpatiePermission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
            $user->givePermissionTo($permission);
        }
        Sanctum::actingAs($user);

        $patient = Patient::create([
            'nombre' => 'Elena', 'apellido' => 'Tapia', 'cedula' => '1710000601', 'fecha_nacimiento' => '1958-06-02',
        ]);
        $this->consultation = Consultation::create([
            'patient_id' => $patient->id, 'fecha_consulta' => '2026-10-19', 'estado' => 'borrador',
        ]);
    }

    public function test_dhiv_tincion_and_estado_are_saved(): void
    {
        $this->putJson("/api/consultations/{$this->consultation->id}", [
            'estado' => 'borrador',
            'contact_lens_module' => ['dhiv' => '11.8', 'tincion' => 'Grado 1', 'estado' => 'en_observacion'],
        ])->assertOk();

        $this->assertDatabaseHas('consultation_contact_lens_modules', [
            'consultation_id' => $this->consultation->id,
            'dhiv' => '11.8',
            'tincion' => 'Grado 1',
            'estado' => 'en_observacion',
        ]);
    }

    public function test_final_lens_power_and_observation_are_saved_and_returned(): void
    {
        $this->putJson("/api/consultations/{$this->consultation->id}", [
            'estado' => 'borrador',
            'contact_lens_module' => [
                'final_lens' => [
                    'od' => ['curva_base' => '8,6', 'poder' => '-4.25 -0.75 x 0', 'diametro' => '14,5', 'h2o' => '', 'material' => 'Silicona hidrogel'],
                    'oi' => ['curva_base' => '8,6', 'poder' => '-2.75 -0.75 x 180', 'diametro' => '14,5', 'h2o' => '', 'material' => 'Silicona hidrogel'],
                    'observacion' => 'Biofinity Toric, 2 cajas',
                ],
            ],
        ])->assertOk();

        $module = $this->consultation->fresh()->contactLensModule;
        $this->assertSame('-4.25 -0.75 x 0', $module->final_lens['od']['poder']);
        $this->assertSame('Biofinity Toric, 2 cajas', $module->final_lens['observacion']);

        $this->getJson("/api/consultations/{$this->consultation->id}")
            ->assertOk()
            ->assertJsonPath('contact_lens_module.final_lens.observacion', 'Biofinity Toric, 2 cajas')
            ->assertJsonPath('contact_lens_module.final_lens.oi.poder', '-2.75 -0.75 x 180');
    }

    public function test_an_unknown_estado_is_rejected(): void
    {
        $this->putJson("/api/consultations/{$this->consultation->id}", [
            'estado' => 'borrador',
            'contact_lens_module' => ['estado' => 'cualquiera'],
        ])->assertUnprocessable();
    }
}
