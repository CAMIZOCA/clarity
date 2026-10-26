<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Consultation;
use App\Models\Patient;
use App\Models\User;
use Database\Seeders\RolesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Recepcion ve e imprime las historias clinicas, pero solo edita los datos
 * generales del paciente.
 */
class ReceptionConsultationPermissionsTest extends TestCase
{
    use RefreshDatabase;

    private Patient $patient;

    private Consultation $consultation;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesSeeder::class);

        $this->patient = Patient::create([
            'nombre' => 'Elena', 'apellido' => 'Tapia', 'cedula' => '1710000603', 'fecha_nacimiento' => '1958-06-02',
        ]);
        $this->consultation = Consultation::create([
            'patient_id' => $this->patient->id, 'fecha_consulta' => '2026-10-19', 'estado' => 'completada',
            'motivo_consulta' => 'Control',
        ]);
    }

    private function actingAsRole(Role $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role->value);
        Sanctum::actingAs($user);

        return $user;
    }

    public function test_reception_can_view_and_print_a_consultation(): void
    {
        $this->actingAsRole(Role::RECEPCIONISTA);

        $this->getJson("/api/consultations/{$this->consultation->id}")
            ->assertOk()
            ->assertJsonPath('motivo_consulta', 'Control');
        $this->getJson("/api/consultations/{$this->consultation->id}/pdf-data")->assertOk();
        $this->getJson("/api/patients/{$this->patient->id}/consultations")->assertOk();
    }

    public function test_reception_cannot_create_edit_or_delete_a_consultation(): void
    {
        $this->actingAsRole(Role::RECEPCIONISTA);

        $this->postJson('/api/consultations', [
            'patient_id' => $this->patient->id, 'fecha_consulta' => '2026-10-20', 'estado' => 'borrador',
        ])->assertForbidden();

        $this->putJson("/api/consultations/{$this->consultation->id}", [
            'estado' => 'completada', 'motivo_consulta' => 'Cambiado',
        ])->assertForbidden();

        $this->deleteJson("/api/consultations/{$this->consultation->id}")->assertForbidden();

        $this->assertDatabaseHas('consultations', [
            'id' => $this->consultation->id, 'motivo_consulta' => 'Control', 'deleted_at' => null,
        ]);
    }

    public function test_reception_can_still_edit_the_patient_general_data(): void
    {
        $this->actingAsRole(Role::RECEPCIONISTA);

        $this->putJson("/api/patients/{$this->patient->id}", [
            'nombre' => 'Elena', 'apellido' => 'Tapia', 'cedula' => '1710000603', 'document_type' => 'cedula',
            'fecha_nacimiento' => '1958-06-02', 'ocupacion' => 'Docente',
        ])->assertOk();

        $this->assertDatabaseHas('patients', ['id' => $this->patient->id, 'ocupacion' => 'Docente']);
    }

    public function test_a_role_without_consultations_view_cannot_read_one(): void
    {
        $this->actingAsRole(Role::CAJERO);

        $this->getJson("/api/consultations/{$this->consultation->id}")->assertForbidden();
        $this->getJson("/api/consultations/{$this->consultation->id}/pdf-data")->assertForbidden();
        $this->getJson('/api/consultations')->assertForbidden();
    }

    public function test_deleting_requires_the_delete_permission(): void
    {
        $this->actingAsRole(Role::OPTOMETRA);
        $this->deleteJson("/api/consultations/{$this->consultation->id}")->assertForbidden();

        $this->actingAsRole(Role::ADMIN);
        $this->deleteJson("/api/consultations/{$this->consultation->id}")->assertOk();
    }
}
