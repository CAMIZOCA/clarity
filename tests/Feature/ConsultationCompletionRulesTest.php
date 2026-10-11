<?php

namespace Tests\Feature;

use App\Enums\Permission;
use App\Models\Consultation;
use App\Models\Patient;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission as SpatiePermission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Lo que se exige al dar por completada una consulta, y lo que no se le exige
 * a un borrador ni a un dato heredado de la importacion.
 *
 * El formulario avisa de casi todo esto antes de enviar; estas reglas son las
 * que no dependen de el.
 */
class ConsultationCompletionRulesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    private function actingAsStaff(string $role = 'optometra'): User
    {
        $user = User::factory()->create(['role' => $role]);

        foreach ([Permission::CONSULTATIONS_CREATE->value, Permission::CONSULTATIONS_EDIT->value] as $permission) {
            SpatiePermission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
            $user->givePermissionTo($permission);
        }

        Sanctum::actingAs($user);

        return $user;
    }

    private function requireFields(array $fields): void
    {
        Setting::set('required_fields', json_encode($fields));
    }

    private function payload(array $overrides = []): array
    {
        $patient = Patient::firstOrCreate(
            ['cedula' => '1710000501'],
            ['nombre' => 'Marta', 'apellido' => 'Quishpe', 'fecha_nacimiento' => '1980-04-12'],
        );

        return array_merge([
            'patient_id' => $patient->id,
            'fecha_consulta' => now()->toDateString(),
            'estado' => 'completada',
            'motivo_consulta' => 'Control anual',
        ], $overrides);
    }

    public function test_completing_requires_an_axis_when_rx_final_has_a_cylinder(): void
    {
        $this->actingAsStaff();

        $this->postJson('/api/consultations', $this->payload([
            'rx_final_esfera_od' => '-100',
            'rx_final_cilindro_od' => '-075',
        ]))->assertStatus(422)->assertJsonValidationErrors('rx_final_eje_od');

        // Un cilindro en cero no es un cilindro: no pide eje.
        $this->postJson('/api/consultations', $this->payload([
            'rx_final_esfera_od' => '-100',
            'rx_final_cilindro_od' => '0.00',
        ]))->assertCreated();
    }

    public function test_a_draft_accepts_a_cylinder_without_axis(): void
    {
        $this->actingAsStaff();

        $this->postJson('/api/consultations', $this->payload([
            'estado' => 'borrador',
            'rx_final_cilindro_od' => '-075',
        ]))->assertCreated();
    }

    /** Gotcha 5: un dato heredado no puede impedir editar la consulta. */
    public function test_an_inherited_cylinder_without_axis_does_not_block_editing_a_completed_consultation(): void
    {
        $this->actingAsStaff();

        $legacy = Consultation::create([
            'patient_id' => $this->payload()['patient_id'],
            'fecha_consulta' => '2019-03-14',
            'estado' => 'completada',
            'legacy_id' => '70001',
            'rx_final_esfera_od' => -500,
            'rx_final_cilindro_od' => -250,
        ]);

        $this->putJson("/api/consultations/{$legacy->id}", [
            'estado' => 'completada',
            'rx_final_esfera_od' => '-500.00',
            'rx_final_cilindro_od' => '-250.00',
            'rx_final_eje_od' => '',
            'observaciones' => 'Paciente refiere cefalea.',
        ])->assertOk();

        // Lo que si se toca se valida: cambiar el cilindro obliga a poner el eje.
        $this->putJson("/api/consultations/{$legacy->id}", [
            'estado' => 'completada',
            'rx_final_esfera_od' => '-500.00',
            'rx_final_cilindro_od' => '-2.50',
            'rx_final_eje_od' => '',
        ])->assertStatus(422)->assertJsonValidationErrors('rx_final_eje_od');
    }

    /**
     * El autoguardado persiste el borrador cada 30 s. Al completar, el valor
     * ya guardado llegaba "sin cambios" y se le retiraba la regla de rango: la
     * consulta se completaba con una esfera de 99.99.
     */
    public function test_completing_a_draft_revalidates_what_the_autosave_already_stored(): void
    {
        $this->actingAsStaff();

        $id = $this->postJson('/api/consultations', $this->payload([
            'estado' => 'borrador',
            'rx_final_esfera_od' => '99.99',
            'rx_final_cilindro_oi' => '-075',
        ]))->assertCreated()->json('id');

        $this->putJson("/api/consultations/{$id}", $this->payload([
            'rx_final_esfera_od' => '99.99',
            'rx_final_cilindro_oi' => '-0.75',
            'rx_final_eje_oi' => '',
        ]))->assertStatus(422)->assertJsonValidationErrors(['rx_final_esfera_od', 'rx_final_eje_oi']);
    }

    /** La receta en uso suele copiarse del historial importado: esa si se perdona. */
    public function test_completing_a_draft_keeps_tolerating_the_rx_in_use_it_already_had(): void
    {
        $this->actingAsStaff();

        $entry = ['esfera_od' => '-500.00', 'cilindro_od' => '-50.00', 'eje_od' => '0'];

        $id = $this->postJson('/api/consultations', $this->payload([
            'estado' => 'borrador',
            'rx_uso_entries' => [$entry],
        ]))->assertCreated()->json('id');

        $this->putJson("/api/consultations/{$id}", $this->payload([
            'rx_uso_entries' => [$entry],
            'rx_uso_esfera_od' => '-500.00',
        ]))->assertOk()->assertJsonPath('estado', 'completada');
    }

    public function test_completing_enforces_the_configured_required_fields(): void
    {
        $doctor = $this->actingAsStaff();
        $this->requireFields(['optometrista_id', 'motivo_consulta', 'rx_final_esfera_od', 'diagnostico_descripcion']);

        $this->postJson('/api/consultations', $this->payload(['motivo_consulta' => '']))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['motivo_consulta', 'rx_final_esfera_od', 'diagnoses'])
            // Quien crea la consulta es medico: el medico por defecto cubre ese obligatorio.
            ->assertJsonMissingValidationErrors('optometrista_id');

        $this->postJson('/api/consultations', $this->payload([
            'rx_final_esfera_od' => 'N',
            'diagnoses' => [['eye' => 'od', 'description' => 'Emetropía']],
        ]))->assertCreated()->assertJsonPath('optometrista_id', $doctor->id);
    }

    public function test_a_draft_does_not_enforce_the_required_fields(): void
    {
        $this->actingAsStaff();
        $this->requireFields(['motivo_consulta', 'rx_final_esfera_od', 'diagnostico_descripcion']);

        $this->postJson('/api/consultations', $this->payload(['estado' => 'borrador', 'motivo_consulta' => '']))
            ->assertCreated();
    }

    /** Un obligatorio que ya esta guardado no hace falta reenviarlo para completar. */
    public function test_completing_with_a_partial_update_counts_what_is_already_stored(): void
    {
        $this->actingAsStaff();
        $this->requireFields(['optometrista_id', 'motivo_consulta', 'diagnostico_descripcion']);

        $id = $this->postJson('/api/consultations', $this->payload([
            'estado' => 'borrador',
            'diagnoses' => [['eye' => 'general', 'description' => 'Presbicia']],
        ]))->assertCreated()->json('id');

        $this->putJson("/api/consultations/{$id}", ['estado' => 'completada'])
            ->assertOk()
            ->assertJsonPath('estado', 'completada');

        // Vaciarlo en la misma peticion si cuenta como faltante.
        $other = $this->postJson('/api/consultations', $this->payload(['estado' => 'borrador']))->json('id');
        $this->putJson("/api/consultations/{$other}", ['estado' => 'completada', 'motivo_consulta' => ''])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['motivo_consulta', 'diagnoses']);
    }

    /** Una consulta importada sin motivo debe poder seguir editandose. */
    public function test_required_fields_are_not_asked_again_of_a_consultation_already_completed(): void
    {
        $this->actingAsStaff();
        $this->requireFields(['motivo_consulta', 'diagnostico_descripcion']);

        $completed = Consultation::create([
            'patient_id' => $this->payload()['patient_id'],
            'fecha_consulta' => '2019-03-14',
            'estado' => 'completada',
        ]);

        $this->putJson("/api/consultations/{$completed->id}", [
            'estado' => 'completada',
            'motivo_consulta' => '',
            'diagnoses' => [],
            'observaciones' => 'Se entrega certificado.',
        ])->assertOk();
    }

    /** Antes quedaba a nombre de quien la creara, aunque fuera de recepcion. */
    public function test_a_new_consultation_defaults_to_its_creator_only_if_that_user_is_a_clinician(): void
    {
        $this->requireFields([]);

        $doctor = $this->actingAsStaff('optometra');
        $this->postJson('/api/consultations', $this->payload(['estado' => 'borrador']))
            ->assertCreated()
            ->assertJsonPath('optometrista_id', $doctor->id);

        $this->actingAsStaff('recepcionista');
        $this->postJson('/api/consultations', $this->payload(['estado' => 'borrador']))
            ->assertCreated()
            ->assertJsonPath('optometrista_id', null);
    }

    /** `decimal(5,2)`: mas de 999.99 desborda la columna y MariaDB responde 500. */
    public function test_a_draft_rejects_a_measurement_that_does_not_fit_the_column(): void
    {
        $this->actingAsStaff();

        $this->postJson('/api/consultations', $this->payload([
            'estado' => 'borrador',
            'rx_final_esfera_od' => '123456',
        ]))->assertStatus(422)->assertJsonValidationErrors('rx_final_esfera_od');
    }
}
