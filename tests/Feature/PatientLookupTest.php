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

/**
 * Verificacion de cedula y de nombres parecidos con la que empieza el alta de
 * un paciente, para no registrar dos veces a la misma persona.
 */
class PatientLookupTest extends TestCase
{
    use RefreshDatabase;

    // Cedulas con digito verificador correcto.
    private const CEDULA = '1710034065';

    private const CEDULA_CON_CERO = '0926687856';

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

    private function makePatient(string $cedula, string $nombre = 'Ana', ?string $apellido = 'Pérez'): Patient
    {
        return Patient::create([
            'nombre' => $nombre, 'apellido' => $apellido,
            'cedula' => $cedula, 'fecha_nacimiento' => '1990-01-01', 'telefono' => '0991234567',
        ]);
    }

    private function lookup(array $query)
    {
        return $this->getJson('/api/patients/lookup?'.http_build_query($query))->assertOk();
    }

    public function test_an_unknown_valid_document_is_reported_as_new(): void
    {
        $this->actingWith();

        $this->lookup(['cedula' => self::CEDULA])
            ->assertJsonPath('data.estado', 'nuevo')
            ->assertJsonPath('data.paciente', null)
            ->assertJsonPath('data.relacionados', [])
            ->assertJsonPath('data.similares', []);
    }

    public function test_an_existing_document_returns_who_the_patient_is(): void
    {
        $this->actingWith();
        $patient = $this->makePatient(self::CEDULA);
        Consultation::create(['patient_id' => $patient->id, 'fecha_consulta' => '2026-02-20', 'estado' => 'completada']);

        $this->lookup(['cedula' => ' '.self::CEDULA.' '])
            ->assertJsonPath('data.estado', 'existe')
            ->assertJsonPath('data.paciente.id', $patient->id)
            ->assertJsonPath('data.paciente.nombre_completo', 'Ana Pérez')
            ->assertJsonPath('data.paciente.telefono', '0991234567')
            ->assertJsonPath('data.paciente.consultations_count', 1)
            ->assertJsonPath('data.paciente.ultima_consulta', '2026-02-20');
    }

    /** La importacion guardo cedulas sin el cero inicial. */
    public function test_a_document_stored_without_its_leading_zero_is_found(): void
    {
        $this->actingWith();
        $patient = $this->makePatient(substr(self::CEDULA_CON_CERO, 1));

        $this->lookup(['cedula' => self::CEDULA_CON_CERO])
            ->assertJsonPath('data.estado', 'existe')
            ->assertJsonPath('data.paciente.id', $patient->id);
    }

    public function test_a_document_typed_without_its_leading_zero_is_found(): void
    {
        $this->actingWith();
        $patient = $this->makePatient(self::CEDULA_CON_CERO);

        $this->lookup(['cedula' => substr(self::CEDULA_CON_CERO, 1)])
            ->assertJsonPath('data.estado', 'existe')
            ->assertJsonPath('data.paciente.id', $patient->id);
    }

    public function test_a_ruc_and_its_cedula_are_the_same_patient(): void
    {
        $this->actingWith();
        $byRuc = $this->makePatient(self::CEDULA.'001');
        $byCedula = $this->makePatient(self::CEDULA_CON_CERO, 'Luis', 'Gómez');

        $this->lookup(['cedula' => self::CEDULA])
            ->assertJsonPath('data.estado', 'existe')
            ->assertJsonPath('data.paciente.id', $byRuc->id);

        $this->lookup(['cedula' => self::CEDULA_CON_CERO.'001'])
            ->assertJsonPath('data.estado', 'existe')
            ->assertJsonPath('data.paciente.id', $byCedula->id);
    }

    public function test_spaces_and_hyphens_are_ignored(): void
    {
        $this->actingWith();
        $patient = $this->makePatient(self::CEDULA);

        $this->lookup(['cedula' => '171003406-5'])
            ->assertJsonPath('data.estado', 'existe')
            ->assertJsonPath('data.paciente.id', $patient->id);
    }

    /** El sistema anterior uso "1712345678A" para familiares: no bloquea el alta. */
    public function test_documents_with_a_suffix_are_listed_as_related_without_blocking(): void
    {
        $this->actingWith();
        $related = $this->makePatient(self::CEDULA.'A', 'Hijo', 'Pérez');
        $this->makePatient(self::CEDULA_CON_CERO, 'Otro', 'Paciente');

        $this->lookup(['cedula' => self::CEDULA])
            ->assertJsonPath('data.estado', 'nuevo')
            ->assertJsonCount(1, 'data.relacionados')
            ->assertJsonPath('data.relacionados.0.id', $related->id);
    }

    /** Hay importadas de 9 digitos que perdieron el ultimo, no el cero inicial. */
    public function test_a_document_stored_without_its_last_digit_is_listed_as_related(): void
    {
        $this->actingWith();
        $truncated = $this->makePatient(substr(self::CEDULA, 0, 9));

        $this->lookup(['cedula' => self::CEDULA])
            ->assertJsonPath('data.estado', 'nuevo')
            ->assertJsonCount(1, 'data.relacionados')
            ->assertJsonPath('data.relacionados.0.id', $truncated->id);
    }

    public function test_a_provisional_code_is_found_as_typed(): void
    {
        $this->actingWith();
        $patient = $this->makePatient('HIST-00123');

        $this->lookup(['cedula' => 'hist-00123'])
            ->assertJsonPath('data.estado', 'existe')
            ->assertJsonPath('data.paciente.id', $patient->id);
    }

    public function test_an_invalid_document_is_rejected_with_the_rule_message(): void
    {
        $this->actingWith();

        // Digito verificador incorrecto.
        $this->lookup(['cedula' => '1710034066'])
            ->assertJsonPath('data.estado', 'invalida')
            ->assertJsonPath('data.mensaje', 'La cédula ingresada no es válida.');

        $this->lookup(['cedula' => '12345'])
            ->assertJsonPath('data.estado', 'invalida');
    }

    /** Un dato heredado invalido sigue encontrando a su paciente. */
    public function test_an_invalid_but_registered_document_is_reported_as_existing(): void
    {
        $this->actingWith();
        $patient = $this->makePatient('1710034066');

        $this->lookup(['cedula' => '1710034066'])
            ->assertJsonPath('data.estado', 'existe')
            ->assertJsonPath('data.paciente.id', $patient->id);
    }

    public function test_exclude_ignores_the_patient_being_edited(): void
    {
        $this->actingWith();
        $patient = $this->makePatient(self::CEDULA);

        $this->lookup(['cedula' => self::CEDULA, 'exclude' => $patient->id])
            ->assertJsonPath('data.estado', 'nuevo')
            ->assertJsonPath('data.paciente', null);
    }

    public function test_a_deleted_patient_is_reported_and_cannot_be_registered_again(): void
    {
        $this->actingWith(Permission::PATIENTS_CREATE->value);
        $patient = $this->makePatient(self::CEDULA);
        $patient->delete();

        $this->lookup(['cedula' => self::CEDULA])
            ->assertJsonPath('data.estado', 'eliminado')
            ->assertJsonPath('data.paciente.id', $patient->id);

        // El indice unico de la BD cubre a los eliminados: antes esto era un 500.
        $this->postJson('/api/patients', ['nombre' => 'Ana', 'cedula' => self::CEDULA, 'fecha_nacimiento' => '1990-01-01'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('cedula');
    }

    public function test_an_active_patient_wins_over_a_deleted_variant(): void
    {
        $this->actingWith();
        $this->makePatient(substr(self::CEDULA_CON_CERO, 1), 'Viejo', 'Registro')->delete();
        $active = $this->makePatient(self::CEDULA_CON_CERO);

        $this->lookup(['cedula' => self::CEDULA_CON_CERO])
            ->assertJsonPath('data.estado', 'existe')
            ->assertJsonPath('data.paciente.id', $active->id);
    }

    public function test_restoring_a_deleted_patient_needs_the_delete_permission(): void
    {
        $patient = $this->makePatient(self::CEDULA);
        $patient->delete();

        $this->actingWith(Permission::PATIENTS_CREATE->value);
        $this->postJson("/api/patients/{$patient->id}/restore")->assertForbidden();
        $this->assertSoftDeleted($patient);

        $this->actingWith(Permission::PATIENTS_DELETE->value);
        $this->postJson("/api/patients/{$patient->id}/restore")
            ->assertOk()
            ->assertJsonPath('data.id', $patient->id);
        $this->assertNotSoftDeleted($patient);

        // Un paciente que no esta eliminado no se "restaura".
        $this->postJson("/api/patients/{$patient->id}/restore")->assertNotFound();
    }

    /** Los historicos guardan "APELLIDOS NOMBRES" completo en `nombre`. */
    public function test_similar_names_match_in_any_order(): void
    {
        $this->actingWith();
        $legacy = $this->makePatient('HIST-00123', 'SABANDO LOOR LUBERTH', null);
        $this->makePatient(self::CEDULA, 'Luberth', 'Zambrano');

        $this->lookup(['nombre' => 'Luberth', 'apellido' => 'Sabando'])
            ->assertJsonPath('data.estado', null)
            ->assertJsonCount(1, 'data.similares')
            ->assertJsonPath('data.similares.0.id', $legacy->id)
            ->assertJsonPath('data.similares.0.cedula', 'HIST-00123');
    }

    public function test_a_single_word_is_not_enough_to_suggest_similar_names(): void
    {
        $this->actingWith();
        $this->makePatient(self::CEDULA, 'María', 'Loor');

        $this->lookup(['nombre' => 'María'])->assertJsonPath('data.similares', []);
        $this->lookup(['nombre' => 'María', 'apellido' => 'de'])->assertJsonPath('data.similares', []);
    }

    public function test_like_wildcards_in_a_name_do_not_match_everything(): void
    {
        $this->actingWith();
        $this->makePatient(self::CEDULA, 'María', 'Loor');

        $this->lookup(['nombre' => '%%%', 'apellido' => '___'])->assertJsonPath('data.similares', []);
    }

    public function test_registering_without_document_or_birth_date_is_a_validation_error(): void
    {
        $this->actingWith(Permission::PATIENTS_CREATE->value);

        $this->postJson('/api/patients', ['nombre' => 'Sin Cedula'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['cedula', 'fecha_nacimiento']);
    }

    public function test_lookup_requires_authentication(): void
    {
        $this->getJson('/api/patients/lookup?cedula='.self::CEDULA)->assertUnauthorized();
    }
}
