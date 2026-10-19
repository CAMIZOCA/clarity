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
        foreach ([Permission::CONSULTATIONS_CREATE->value, Permission::CONSULTATIONS_EDIT->value] as $permission) {
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

    public function test_an_unknown_estado_is_rejected(): void
    {
        $this->putJson("/api/consultations/{$this->consultation->id}", [
            'estado' => 'borrador',
            'contact_lens_module' => ['estado' => 'cualquiera'],
        ])->assertUnprocessable();
    }
}
