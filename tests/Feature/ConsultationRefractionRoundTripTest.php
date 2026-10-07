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
 * Lo que la optometra escribe en el examen visual tiene que volver igual al
 * consultar y sobrevivir a una edicion: retinoscopia, ARK/queratometria y las
 * recetas en uso. Un campo que falte en las reglas, en `$fillable` o en
 * `extraFields()` se descarta en silencio al guardar.
 */
class ConsultationRefractionRoundTripTest extends TestCase
{
    use RefreshDatabase;

    private const REFRACTION = [
        'av_lectura_od' => '+350 -250 x 8',
        'av_lectura_oi' => '+575 -400 x 168',
        'ark_od' => '43.50/44.25@10',
        'ark_oi' => '43.75/44.00@175',
        // Mas de 20 caracteres: la columna era VARCHAR(20) en MariaDB.
        'retinoscopia_od' => '+3.00 -2.25 x 15 cc 20/20',
        'retinoscopia_oi' => '+4.50 -3.75 x 170 cc 20/20',
        'queratometria_od' => '43.50 / 44.25 @ 10',
        'queratometria_oi' => '43.75 / 44.00 @ 175',
        'cover_test' => 'ORTHO',
    ];

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
    }

    private function payload(array $overrides = []): array
    {
        $patient = Patient::firstOrCreate(
            ['cedula' => '1710000401'],
            ['nombre' => 'Luberth', 'apellido' => 'Sabando', 'fecha_nacimiento' => '1975-03-10'],
        );

        return [
            'patient_id' => $patient->id,
            'fecha_consulta' => now()->toDateString(),
            'estado' => 'borrador',
            ...self::REFRACTION,
            'rx_final_esfera_od' => '+0.75',
            'rx_final_cilindro_od' => '-0.25',
            'rx_final_eje_od' => '90',
            'rx_uso_entries' => [
                [
                    'esfera_od' => '+1.25', 'cilindro_od' => '-0.25', 'eje_od' => '154', 'add_od' => '+2.00', 'avcc_od' => '20/20',
                    'esfera_oi' => '+1.25', 'cilindro_oi' => '-0.25', 'eje_oi' => '154', 'add_oi' => '+2.00', 'avcc_oi' => '20/25',
                    'observacion' => 'RX final de la consulta #1 (10/01/2025)',
                ],
                ['esfera_od' => '-0.50', 'esfera_oi' => '-0.50', 'observacion' => 'Lentes de sol'],
            ],
            ...$overrides,
        ];
    }

    public function test_refraction_fields_are_stored_and_read_back(): void
    {
        $id = $this->postJson('/api/consultations', $this->payload())->assertCreated()->json('id');

        $response = $this->getJson("/api/consultations/{$id}")->assertOk();

        foreach (self::REFRACTION as $field => $value) {
            $this->assertSame($value, $response->json($field), "Se perdio {$field}");
        }

        $this->assertEqualsWithDelta(0.75, (float) $response->json('rx_final_esfera_od'), 0.001);
        $this->assertEqualsWithDelta(-0.25, (float) $response->json('rx_final_cilindro_od'), 0.001);

        $entries = $response->json('rx_uso_entries');
        $this->assertCount(2, $entries);
        $this->assertEqualsWithDelta(1.25, (float) $entries[0]['esfera_od'], 0.001);
        $this->assertEqualsWithDelta(-0.25, (float) $entries[0]['cilindro_od'], 0.001);
        $this->assertEquals(154, $entries[0]['eje_od']);
        $this->assertEqualsWithDelta(2.00, (float) $entries[0]['add_od'], 0.001);
        $this->assertSame('20/25', $entries[0]['avcc_oi']);
        $this->assertSame('RX final de la consulta #1 (10/01/2025)', $entries[0]['observacion']);
        $this->assertSame('Lentes de sol', $entries[1]['observacion']);
    }

    public function test_editing_another_field_keeps_the_refraction(): void
    {
        $id = $this->postJson('/api/consultations', $this->payload())->assertCreated()->json('id');

        // El formulario reenvia la consulta completa en cada guardado.
        $this->putJson("/api/consultations/{$id}", $this->payload(['motivo_consulta' => 'Control anual']))->assertOk();

        $response = $this->getJson("/api/consultations/{$id}")->assertOk();

        $this->assertSame('Control anual', $response->json('motivo_consulta'));
        foreach (self::REFRACTION as $field => $value) {
            $this->assertSame($value, $response->json($field), "Se perdio {$field} al editar");
        }
        $this->assertCount(2, $response->json('rx_uso_entries'));
    }

    public function test_refraction_can_be_changed_and_cleared(): void
    {
        $id = $this->postJson('/api/consultations', $this->payload())->assertCreated()->json('id');

        $this->putJson("/api/consultations/{$id}", $this->payload([
            'retinoscopia_od' => '-1.00 -0.50 x 90',
            'ark_oi' => null,
        ]))->assertOk();

        $response = $this->getJson("/api/consultations/{$id}")->assertOk();

        $this->assertSame('-1.00 -0.50 x 90', $response->json('retinoscopia_od'));
        $this->assertNull($response->json('ark_oi'));
        $this->assertSame(self::REFRACTION['ark_od'], $response->json('ark_od'));
    }
}
