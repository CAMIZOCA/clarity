<?php

namespace Tests\Feature;

use App\Enums\Permission;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission as SpatiePermission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Feedback de Pamela López (14-sep-2026): escribir medidas sin punto decimal
 * (`025`, `-050`) o "N" (esfera neutra) nunca debe bloquear "Guardar borrador"
 * con un 422, y el valor debe llegar normalizado a la base de datos.
 */
class ConsultationDraftValidationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    private function actingWith(string ...$permissions): User
    {
        $user = User::factory()->create();

        foreach ($permissions as $permission) {
            SpatiePermission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
            $user->givePermissionTo($permission);
        }

        Sanctum::actingAs($user);

        return $user;
    }

    private function makePatient(string $cedula): Patient
    {
        return Patient::create([
            'nombre' => 'Arturo', 'apellido' => 'Palaguachí',
            'cedula' => $cedula, 'fecha_nacimiento' => '1961-01-01',
        ]);
    }

    public function test_draft_normalizes_measurements_written_without_a_decimal_point(): void
    {
        $this->actingWith(Permission::CONSULTATIONS_CREATE->value);
        $patient = $this->makePatient('1710000101');

        $id = $this->postJson('/api/consultations', [
            'patient_id' => $patient->id,
            'fecha_consulta' => now()->toDateString(),
            'estado' => 'borrador',
            'rx_final_esfera_od' => '+025',
            'rx_final_add_od' => '250',
        ])->assertCreated()->json('id');

        $this->assertDatabaseHas('consultations', [
            'id' => $id,
            'rx_final_esfera_od' => 0.25,
            'rx_final_add_od' => 2.50,
        ]);
    }

    public function test_draft_accepts_neutral_sphere_and_stores_the_flag(): void
    {
        $this->actingWith(Permission::CONSULTATIONS_CREATE->value);
        $patient = $this->makePatient('1710000102');

        $id = $this->postJson('/api/consultations', [
            'patient_id' => $patient->id,
            'fecha_consulta' => now()->toDateString(),
            'estado' => 'borrador',
            'rx_uso_esfera_od' => 'N',
            'rx_uso_cilindro_od' => '-050',
            'rx_uso_eje_od' => '5',
        ])->assertCreated()->json('id');

        $this->assertDatabaseHas('consultations', [
            'id' => $id,
            'rx_uso_esfera_od' => null,
            'rx_uso_esfera_od_neutral' => 1,
            'rx_uso_cilindro_od' => -0.50,
        ]);
    }

    public function test_draft_does_not_fail_on_a_sphere_value_outside_the_clinical_range(): void
    {
        $this->actingWith(Permission::CONSULTATIONS_CREATE->value);
        $patient = $this->makePatient('1710000103');

        // "99.99" ya trae punto decimal explicito: el normalizador no le
        // corre el decimal, asi que sigue siendo un valor fuera del rango
        // clinico de esfera (-30..30) despues de normalizar.
        $this->postJson('/api/consultations', [
            'patient_id' => $patient->id,
            'fecha_consulta' => now()->toDateString(),
            'estado' => 'borrador',
            'rx_final_esfera_od' => '99.99',
        ])->assertCreated();
    }

    /**
     * La relajacion de rango es solo para el borrador: completar la consulta
     * con un valor realmente distinto y fuera de rango si debe fallar.
     */
    public function test_completing_the_consultation_still_enforces_the_clinical_range_for_a_changed_value(): void
    {
        $this->actingWith(Permission::CONSULTATIONS_CREATE->value, Permission::CONSULTATIONS_EDIT->value);
        $patient = $this->makePatient('1710000104');

        $id = $this->postJson('/api/consultations', [
            'patient_id' => $patient->id,
            'fecha_consulta' => now()->toDateString(),
            'estado' => 'borrador',
            'rx_final_esfera_od' => '1.00',
        ])->assertCreated()->json('id');

        $this->putJson("/api/consultations/{$id}", [
            'estado' => 'completada',
            'rx_final_esfera_od' => '99.99',
            'diagnoses' => [
                ['eye' => 'od', 'description' => 'Hipermetropía'],
            ],
        ])->assertStatus(422)->assertJsonValidationErrors('rx_final_esfera_od');
    }

    public function test_draft_saves_a_sale_item_row(): void
    {
        $this->actingWith(Permission::CONSULTATIONS_CREATE->value);
        $patient = $this->makePatient('1710000105');

        $id = $this->postJson('/api/consultations', [
            'patient_id' => $patient->id,
            'fecha_consulta' => now()->toDateString(),
            'estado' => 'borrador',
            'sale_items' => [
                ['tipo' => 'lunas', 'descripcion' => 'Lunas EV Gold', 'precio' => 200, 'descuento_pct' => 16, 'total' => 168],
            ],
        ])->assertCreated()->json('id');

        $this->assertDatabaseHas('consultation_sale_items', [
            'consultation_id' => $id,
            'descripcion' => 'Lunas EV Gold',
            'total' => 168,
        ]);
    }
}
