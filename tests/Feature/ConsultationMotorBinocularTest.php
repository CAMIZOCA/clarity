<?php

namespace Tests\Feature;

use App\Enums\Permission;
use App\Models\Consultation;
use App\Models\ConsultationOphthalmoscopyModule;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission as SpatiePermission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * El modulo motor/binocular vive en la columna JSON `motor_binocular_data`.
 * v2 es `{ bloque: { prueba: { campo: texto } } }`; una pestana abierta antes
 * del deploy puede seguir mandando la v1 (`{ prueba: { od, oi, observacion } }`)
 * y no debe perder datos. Guardar el modulo tampoco toca las columnas planas
 * heredadas ni el PPC de Oftalmoscopia.
 */
class ConsultationMotorBinocularTest extends TestCase
{
    use RefreshDatabase;

    private const V2 = [
        'motilidad' => [
            'ducciones' => ['od' => 'completas', 'oi' => '', 'observacion' => ''],
            'versiones' => ['horizontales' => 'normales', 'verticales' => '', 'observacion' => 'sin diplopía'],
        ],
        'binocularidad' => [
            'ppc' => ['objeto_real' => '5/7 cm', 'luz' => '', 'filtro_rojo' => '', 'observacion' => ''],
        ],
        'acomodacion' => [
            'amplitud' => ['od' => '12 D', 'oi' => '', 'ao' => '', 'observacion' => ''],
        ],
        'reflejos' => [
            'pupilares' => ['od' => 'normales', 'oi' => '', 'observacion' => ''],
        ],
    ];

    private const V1 = [
        'ducciones' => ['od' => 'completas', 'oi' => 'limitada', 'observacion' => 'dolor'],
        'cover_test' => ['od' => 'ORTHO', 'oi' => 'X', 'observacion' => ''],
    ];

    private const LEGACY_FLAT = [
        'ducciones_od' => 'Normal OD',
        'ducciones_oi' => 'Normal OI',
        'versiones' => 'Suaves',
        'ppc' => '6 cm',
        'cover_test' => 'ORTHO',
        'reflejos_pupilares' => 'Isocoricas',
        'test_hirschberg' => 'Simetrico',
    ];

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $user = User::factory()->create();
        foreach ([Permission::CONSULTATIONS_VIEW->value, Permission::CONSULTATIONS_CREATE->value, Permission::CONSULTATIONS_EDIT->value] as $permission) {
            SpatiePermission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
            $user->givePermissionTo($permission);
        }
        Sanctum::actingAs($user);
    }

    /**
     * El middleware de Laravel convierte '' en null antes de validar, asi que un
     * campo vacio se guarda como null (el formulario lo lee con `text()`).
     */
    private function asStored(array $data): array
    {
        return array_map(
            fn ($value) => is_array($value) ? $this->asStored($value) : ($value === '' ? null : $value),
            $data,
        );
    }

    private function consultation(array $attributes = []): Consultation
    {
        $patient = Patient::firstOrCreate(
            ['cedula' => '1710000701'],
            ['nombre' => 'Marta', 'apellido' => 'Vera', 'fecha_nacimiento' => '1990-04-12'],
        );

        return Consultation::create([
            'patient_id' => $patient->id,
            'fecha_consulta' => '2026-10-01',
            'estado' => 'borrador',
            ...$attributes,
        ]);
    }

    public function test_v2_payload_round_trips_through_put_and_get(): void
    {
        $consultation = $this->consultation();

        $this->putJson("/api/consultations/{$consultation->id}", ['motor_binocular_data' => self::V2])->assertOk();

        $this->assertSame($this->asStored(self::V2), $consultation->fresh()->motor_binocular_data);

        $response = $this->getJson("/api/consultations/{$consultation->id}")->assertOk();
        $this->assertSame($this->asStored(self::V2), $response->json('motor_binocular_data'));
        $this->assertSame('5/7 cm', $response->json('motor_binocular_data.binocularidad.ppc.objeto_real'));
        $this->assertSame('12 D', $response->json('motor_binocular_data.acomodacion.amplitud.od'));
    }

    public function test_a_value_longer_than_255_characters_is_rejected_on_its_field(): void
    {
        $consultation = $this->consultation();
        $payload = self::V2;
        $payload['motilidad']['ducciones']['observacion'] = str_repeat('a', 256);

        $this->putJson("/api/consultations/{$consultation->id}", ['motor_binocular_data' => $payload])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['motor_binocular_data.motilidad.ducciones.observacion']);

        $this->assertNull($consultation->fresh()->motor_binocular_data);

        // 255 exactos si pasan.
        $payload['motilidad']['ducciones']['observacion'] = str_repeat('a', 255);
        $this->putJson("/api/consultations/{$consultation->id}", ['motor_binocular_data' => $payload])->assertOk();
    }

    public function test_a_v1_payload_from_an_old_tab_is_stored_intact(): void
    {
        $consultation = $this->consultation();

        $this->putJson("/api/consultations/{$consultation->id}", ['motor_binocular_data' => self::V1])->assertOk();

        $this->assertSame($this->asStored(self::V1), $consultation->fresh()->motor_binocular_data);
        $this->assertSame(
            $this->asStored(self::V1),
            $this->getJson("/api/consultations/{$consultation->id}")->assertOk()->json('motor_binocular_data'),
        );
    }

    public function test_saving_the_module_leaves_the_flat_columns_and_ophthalmoscopy_ppc_untouched(): void
    {
        $consultation = $this->consultation(self::LEGACY_FLAT);
        ConsultationOphthalmoscopyModule::create([
            'consultation_id' => $consultation->id,
            'ppc_obj' => '5 cm', 'luz' => '7 cm', 'fr' => '9 cm',
        ]);

        // Sin enviar las columnas planas.
        $this->putJson("/api/consultations/{$consultation->id}", ['motor_binocular_data' => self::V2])->assertOk();

        // Reenviandolas sin cambios, como hace el formulario.
        $this->putJson("/api/consultations/{$consultation->id}", [
            ...self::LEGACY_FLAT,
            'motor_binocular_data' => self::V2,
            'ophthalmoscopy_module' => ['ppc_obj' => '5 cm', 'luz' => '7 cm', 'fr' => '9 cm'],
        ])->assertOk();

        $fresh = $consultation->fresh();
        foreach (self::LEGACY_FLAT as $column => $value) {
            $this->assertSame($value, $fresh->{$column}, "Cambio {$column}");
        }
        $this->assertSame($this->asStored(self::V2), $fresh->motor_binocular_data);

        $this->assertDatabaseHas('consultation_ophthalmoscopy_modules', [
            'consultation_id' => $consultation->id,
            'ppc_obj' => '5 cm', 'luz' => '7 cm', 'fr' => '9 cm',
        ]);
    }

    public function test_a_null_module_stays_null_when_the_key_is_not_sent(): void
    {
        $consultation = $this->consultation();
        $this->assertNull($consultation->motor_binocular_data);

        $this->putJson("/api/consultations/{$consultation->id}", ['observaciones' => 'Control'])->assertOk();

        $fresh = $consultation->fresh();
        $this->assertNull($fresh->motor_binocular_data);
        $this->assertSame('Control', $fresh->observaciones);
    }
}
