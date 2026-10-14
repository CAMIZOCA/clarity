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
 * Letras despues del numero en las medidas: la optica anota "CC" junto al
 * valor que comprobo con una prueba. El numero sigue en su columna y las
 * letras van aparte, en `medidas_notas`.
 */
class ConsultationMeasureNotesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $user = User::factory()->create(['role' => 'optometra']);
        foreach ([Permission::CONSULTATIONS_CREATE->value, Permission::CONSULTATIONS_EDIT->value, Permission::CONSULTATIONS_VIEW->value] as $permission) {
            SpatiePermission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
            $user->givePermissionTo($permission);
        }

        Sanctum::actingAs($user);
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
            'estado' => 'borrador',
            'motivo_consulta' => 'Control anual',
        ], $overrides);
    }

    public function test_letters_after_the_number_are_stored_apart_from_the_measure(): void
    {
        $id = $this->postJson('/api/consultations', $this->payload([
            'subj_esfera_od' => '+075',
            'subj_cilindro_od' => '-125',
            'subj_eje_od' => '20cc',
            'subj_eje_oi' => '3 CC',
        ]))->assertCreated()->json('id');

        $consultation = Consultation::findOrFail($id);
        $this->assertSame(20, $consultation->subj_eje_od);
        $this->assertSame(3, $consultation->subj_eje_oi);
        $this->assertEqualsWithDelta(-1.25, $consultation->subj_cilindro_od, 0.001);
        $this->assertSame(['subj_eje_od' => 'CC', 'subj_eje_oi' => 'CC'], $consultation->medidas_notas);

        $this->getJson("/api/consultations/{$id}")
            ->assertOk()
            ->assertJsonPath('medidas_notas.subj_eje_od', 'CC')
            ->assertJsonPath('subj_eje_od', 20);
    }

    public function test_every_measure_table_accepts_a_note_on_sphere_cylinder_and_axis(): void
    {
        $id = $this->postJson('/api/consultations', $this->payload([
            'subj_esfera_od' => '+0.75 cc',
            'rx_final_esfera_od' => 'N cc',
            'rx_final_cilindro_od' => '-125cc',
            'rx_final_eje_od' => '20',
            'vc_eje_oi' => '90 cc',
            'rx_uso_entries' => [
                ['esfera_od' => '-1.00', 'cilindro_od' => '-0.50 cc', 'eje_od' => '10cc'],
            ],
        ]))->assertCreated()->json('id');

        $consultation = Consultation::findOrFail($id);
        $this->assertEqualsWithDelta(0.75, $consultation->subj_esfera_od, 0.001);
        $this->assertTrue($consultation->rx_final_esfera_od_neutral);
        $this->assertEqualsWithDelta(-1.25, $consultation->rx_final_cilindro_od, 0.001);
        $this->assertSame(90, $consultation->vc_eje_oi);
        $this->assertSame(
            ['subj_esfera_od' => 'CC', 'rx_final_esfera_od' => 'CC', 'rx_final_cilindro_od' => 'CC', 'vc_eje_oi' => 'CC'],
            $consultation->medidas_notas,
        );

        $entry = $consultation->rxUsoEntries()->firstOrFail();
        $this->assertEqualsWithDelta(-0.50, $entry->cilindro_od, 0.001);
        $this->assertSame(10, $entry->eje_od);
        $this->assertSame(['cilindro_od' => 'CC', 'eje_od' => 'CC'], $entry->notas);
        // Las columnas planas de la primera receta siguen siendo numeros.
        $this->assertSame(10, $consultation->fresh()->rx_uso_eje_od);
    }

    public function test_removing_the_letters_clears_the_note(): void
    {
        $id = $this->postJson('/api/consultations', $this->payload(['subj_eje_od' => '20cc', 'subj_cilindro_od' => '-125']))
            ->assertCreated()->json('id');

        // El formulario reenvia `medidas_notas` tal como la cargo: no cuenta.
        $this->putJson("/api/consultations/{$id}", $this->payload([
            'subj_eje_od' => '20', 'subj_cilindro_od' => '-1.25', 'medidas_notas' => ['subj_eje_od' => 'CC'],
        ]))->assertOk();

        $consultation = Consultation::findOrFail($id);
        $this->assertSame(20, $consultation->subj_eje_od);
        $this->assertNull($consultation->medidas_notas);
    }

    public function test_an_update_without_measures_keeps_the_notes(): void
    {
        $id = $this->postJson('/api/consultations', $this->payload(['subj_eje_od' => '20cc', 'subj_cilindro_od' => '-125']))
            ->assertCreated()->json('id');

        $this->putJson("/api/consultations/{$id}", $this->payload(['motivo_consulta' => 'Otro motivo']))->assertOk();

        $this->assertSame(['subj_eje_od' => 'CC'], Consultation::findOrFail($id)->medidas_notas);
    }

    /** Produccion: la 9097 traia "N" en la queratometria horizontal y no se podia guardar. */
    public function test_legacy_text_in_keratometry_does_not_block_editing_but_new_text_does(): void
    {
        $consultation = Consultation::create($this->payload([
            'estado' => 'completada',
            'subj_eje_od' => '70',
            'subj_cilindro_od' => '-0.25',
        ]) + ['queratometria_horizontal_od' => 'N', 'queratometria_horizontal_oi' => 'NORMAL']);

        // El formulario reenvia lo heredado tal cual: solo cambia el eje.
        $this->putJson("/api/consultations/{$consultation->id}", $this->payload([
            'estado' => 'completada',
            'subj_eje_od' => '20cc',
            'subj_cilindro_od' => '-0.25',
            'queratometria_horizontal_od' => 'N',
            'queratometria_horizontal_oi' => 'NORMAL',
        ]))->assertOk();

        $this->assertSame(20, $consultation->fresh()->subj_eje_od);
        $this->assertSame('N', $consultation->fresh()->queratometria_horizontal_od);

        // Lo que se escribe de nuevo sigue debiendo ser un numero.
        $this->putJson("/api/consultations/{$consultation->id}", $this->payload([
            'estado' => 'completada', 'queratometria_horizontal_od' => 'abc',
        ]))->assertStatus(422)->assertJsonValidationErrors('queratometria_horizontal_od');
    }

    /** Un ojo sin vision: la optica escribe "COMP" donde iria la medida. */
    public function test_text_instead_of_a_measure_is_kept_as_a_note_in_sphere_and_cylinder(): void
    {
        $id = $this->postJson('/api/consultations', $this->payload([
            'subj_esfera_od' => 'comp',
            'subj_cilindro_od' => '-0.50',
            'rx_final_esfera_od' => 'COMP',
            'rx_final_cilindro_oi' => 'comp',
            'rx_final_esfera_oi' => '-6.00',
        ]))->assertCreated()->json('id');

        $consultation = Consultation::findOrFail($id);
        $this->assertNull($consultation->subj_esfera_od);
        $this->assertNull($consultation->rx_final_esfera_od);
        $this->assertFalse($consultation->rx_final_esfera_od_neutral);
        $this->assertNull($consultation->rx_final_cilindro_oi);
        $this->assertEqualsWithDelta(-6.0, $consultation->rx_final_esfera_oi, 0.001);
        $this->assertSame(
            ['subj_esfera_od' => 'COMP', 'rx_final_esfera_od' => 'COMP', 'rx_final_cilindro_oi' => 'COMP'],
            $consultation->medidas_notas,
        );

        $this->getJson("/api/consultations/{$id}")
            ->assertOk()
            ->assertJsonPath('medidas_notas.rx_final_esfera_od', 'COMP');

        // El formulario reenvia el texto tal cual: sigue ahi. Al borrarlo, se va.
        $this->putJson("/api/consultations/{$id}", $this->payload([
            'subj_esfera_od' => 'COMP', 'rx_final_esfera_od' => '', 'rx_final_cilindro_oi' => 'COMP',
        ]))->assertOk();

        $this->assertSame(
            ['subj_esfera_od' => 'COMP', 'rx_final_cilindro_oi' => 'COMP'],
            Consultation::findOrFail($id)->medidas_notas,
        );
    }

    public function test_text_instead_of_a_measure_fills_a_required_field_on_completion(): void
    {
        Setting::set('required_fields', json_encode(['rx_final_esfera_od']));

        $this->postJson('/api/consultations', $this->payload(['estado' => 'completada']))
            ->assertStatus(422)->assertJsonValidationErrors('rx_final_esfera_od');

        $this->postJson('/api/consultations', $this->payload(['estado' => 'completada', 'rx_final_esfera_od' => 'COMP']))
            ->assertCreated();
    }

    public function test_text_without_a_number_is_only_accepted_in_sphere_and_cylinder_of_subjective_and_final_rx(): void
    {
        foreach (['subj_eje_od', 'rx_final_eje_od', 'rx_final_add_od', 'vc_esfera_od', 'rx_uso_esfera_od'] as $field) {
            $this->postJson('/api/consultations', $this->payload([$field => 'COMP']))
                ->assertStatus(422)->assertJsonValidationErrors($field);
        }

        $this->postJson('/api/consultations', $this->payload([
            'rx_uso_entries' => [['esfera_od' => 'COMP']],
        ]))->assertStatus(422)->assertJsonValidationErrors('rx_uso_entries.0.esfera_od');

        // Un texto largo no es una nota.
        $this->postJson('/api/consultations', $this->payload(['subj_esfera_od' => 'compensatoria porque no ve']))
            ->assertStatus(422)->assertJsonValidationErrors('medidas_notas.subj_esfera_od');
    }

    public function test_a_note_does_not_excuse_an_invalid_measure(): void
    {
        // Letras sin numero siguen sin ser una medida.
        $this->postJson('/api/consultations', $this->payload(['subj_eje_od' => 'abc']))
            ->assertStatus(422)->assertJsonValidationErrors('subj_eje_od');

        // El rango clinico se valida sobre el numero.
        $this->postJson('/api/consultations', $this->payload([
            'estado' => 'completada', 'rx_final_cilindro_od' => '-0.75', 'rx_final_eje_od' => '200 cc',
        ]))->assertStatus(422)->assertJsonValidationErrors('rx_final_eje_od');

        // La ADD no lleva letras.
        $this->postJson('/api/consultations', $this->payload(['rx_final_add_od' => '+2.00 cc']))
            ->assertStatus(422)->assertJsonValidationErrors('rx_final_add_od');

        // Una nota larga no es una nota: es un texto en el campo equivocado.
        $this->postJson('/api/consultations', $this->payload(['subj_eje_od' => '20 comprobado con cilindro cruzado']))
            ->assertStatus(422)->assertJsonValidationErrors('medidas_notas.subj_eje_od');
    }
}
