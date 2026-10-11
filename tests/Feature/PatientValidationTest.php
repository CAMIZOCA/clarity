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
 * Lo que el servidor acepta o rechaza al registrar y editar un paciente, sin
 * depender de las comprobaciones previas del formulario.
 */
class PatientValidationTest extends TestCase
{
    use RefreshDatabase;

    // Cedulas con digito verificador correcto.
    private const CEDULA = '1710034065';

    private const CEDULA_CON_CERO = '0926687856';

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $user = User::factory()->create();

        foreach ([Permission::PATIENTS_CREATE, Permission::PATIENTS_EDIT] as $permission) {
            SpatiePermission::firstOrCreate(['name' => $permission->value, 'guard_name' => 'web']);
            $user->givePermissionTo($permission->value);
        }

        Sanctum::actingAs($user);
    }

    private function payload(array $overrides = []): array
    {
        return array_merge(['nombre' => 'Ana', 'apellido' => 'Pérez', 'cedula' => self::CEDULA, 'fecha_nacimiento' => '1990-01-01'], $overrides);
    }

    /** Fila tal como la dejo la importacion: sin pasar por la validacion. */
    private function legacyPatient(array $attributes = []): Patient
    {
        return Patient::create(array_merge([
            'nombre' => 'LOOR ANA', 'cedula' => self::CEDULA, 'fecha_nacimiento' => '1990-01-01',
        ], $attributes));
    }

    /**
     * La comparacion por variantes vivia solo en el formulario: con "No se pudo
     * verificar. Puede continuar" se registraba dos veces a la misma persona.
     */
    public function test_a_variant_of_a_registered_document_cannot_be_registered(): void
    {
        $this->legacyPatient(['cedula' => self::CEDULA.'001']);
        $this->legacyPatient(['cedula' => substr(self::CEDULA_CON_CERO, 1)]);

        $this->postJson('/api/patients', $this->payload())
            ->assertStatus(422)
            ->assertJsonPath('errors.cedula.0', 'Ya existe un paciente con este documento, registrado como '.self::CEDULA.'001.');

        $this->postJson('/api/patients', $this->payload(['cedula' => self::CEDULA_CON_CERO]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('cedula');

        $this->assertSame(2, Patient::count());
    }

    public function test_separators_in_a_cedula_are_not_stored(): void
    {
        $this->postJson('/api/patients', $this->payload(['cedula' => ' 171003406-5 ']))->assertCreated();

        $this->assertDatabaseHas('patients', ['cedula' => self::CEDULA]);
    }

    /** Antes "17100340Q5" se guardaba como pasaporte, sin digito verificador. */
    public function test_a_cedula_with_a_letter_is_rejected_unless_declared_as_other_document(): void
    {
        $this->postJson('/api/patients', $this->payload(['cedula' => '17100340Q5']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('cedula');

        $this->postJson('/api/patients', $this->payload(['cedula' => 'ab123456', 'document_type' => 'otro']))
            ->assertCreated()
            ->assertJsonPath('data.cedula', 'AB123456');

        // Documento extranjero numerico, que no cumple el verificador ecuatoriano.
        $this->postJson('/api/patients', $this->payload(['cedula' => '1012345678']))
            ->assertStatus(422);
        $this->postJson('/api/patients', $this->payload(['cedula' => '1012345678', 'document_type' => 'otro']))
            ->assertCreated();

        $this->postJson('/api/patients', $this->payload(['cedula' => 'HIST-00123', 'document_type' => 'otro']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('cedula');
    }

    public function test_phone_accepts_what_reception_writes_and_respects_the_column_size(): void
    {
        $this->postJson('/api/patients', $this->payload(['telefono' => '2345678']))->assertCreated();
        $this->postJson('/api/patients', $this->payload(['cedula' => self::CEDULA_CON_CERO, 'telefono' => '+57 300 1234567']))
            ->assertCreated();

        // Valido para la regla, pero no cabe en VARCHAR(20): en MariaDB era un 500.
        $this->postJson('/api/patients', $this->payload(['cedula' => 'AB123456', 'document_type' => 'otro', 'telefono' => '+593 9 9 1 2 3 4 5 6 7']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('telefono');
    }

    /** La optica decidio que editar un importado obligue a limpiar sus datos. */
    public function test_editing_keeps_rejecting_inherited_invalid_data(): void
    {
        $patient = $this->legacyPatient(['cedula' => 'HIST-00123', 'fecha_nacimiento' => '2055-03-12', 'telefono' => 'NO TIENE']);

        $this->putJson("/api/patients/{$patient->id}", [
            'nombre' => 'LOOR ANA', 'cedula' => 'HIST-00123', 'fecha_nacimiento' => '2055-03-12', 'telefono' => 'NO TIENE', 'direccion' => 'Quito',
        ])->assertStatus(422)->assertJsonValidationErrors(['cedula', 'fecha_nacimiento', 'telefono']);

        $this->putJson("/api/patients/{$patient->id}", [
            'nombre' => 'LOOR ANA', 'cedula' => self::CEDULA, 'fecha_nacimiento' => '1955-03-12', 'telefono' => null, 'direccion' => 'Quito',
        ])->assertOk()->assertJsonPath('data.cedula', self::CEDULA);
    }

    public function test_editing_a_patient_that_shares_an_email_is_allowed(): void
    {
        $this->legacyPatient(['email' => 'familia@example.com']);
        $child = $this->legacyPatient(['cedula' => self::CEDULA_CON_CERO, 'email' => 'familia@example.com']);

        $this->putJson("/api/patients/{$child->id}", $this->payload(['cedula' => self::CEDULA_CON_CERO, 'email' => 'familia@example.com', 'ocupacion' => 'Estudiante']))
            ->assertOk()
            ->assertJsonPath('data.ocupacion', 'Estudiante');
    }

    public function test_a_document_cannot_be_changed_to_a_variant_of_another_patient(): void
    {
        $this->legacyPatient(['cedula' => self::CEDULA.'001']);
        $other = $this->legacyPatient(['cedula' => self::CEDULA_CON_CERO]);

        $this->putJson("/api/patients/{$other->id}", $this->payload())
            ->assertStatus(422)
            ->assertJsonValidationErrors('cedula');
    }

    /** La importacion dejo parejas duplicadas: no impiden editar lo demas. */
    public function test_an_unchanged_document_is_not_checked_against_its_variants(): void
    {
        $this->legacyPatient(['cedula' => self::CEDULA.'001']);
        $patient = $this->legacyPatient();

        $this->putJson("/api/patients/{$patient->id}", $this->payload(['telefono' => '0991234567']))
            ->assertOk()
            ->assertJsonPath('data.telefono', '0991234567');
    }

    /** `cedula` y `fecha_nacimiento` son NOT NULL: vaciarlas era un 500. */
    public function test_document_and_birth_date_cannot_be_emptied(): void
    {
        $patient = $this->legacyPatient();

        $this->putJson("/api/patients/{$patient->id}", ['cedula' => '', 'fecha_nacimiento' => ''])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['cedula', 'fecha_nacimiento']);

        // Una edicion parcial que no las envia no las toca.
        $this->putJson("/api/patients/{$patient->id}", ['ocupacion' => 'Docente'])->assertOk();
        $this->assertSame(self::CEDULA, $patient->fresh()->cedula);
    }
}
