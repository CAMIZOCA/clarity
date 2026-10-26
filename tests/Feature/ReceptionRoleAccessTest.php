<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Appointment;
use App\Models\Patient;
use App\Models\User;
use Database\Seeders\RolesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Recepcion usa la agenda y las ordenes de trabajo, y no ve reportes ni la
 * parte comercial (ventas, caja, inventario, productos, CRM).
 */
class ReceptionRoleAccessTest extends TestCase
{
    use RefreshDatabase;

    private Patient $patient;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesSeeder::class);

        $this->patient = Patient::create([
            'nombre' => 'Elena', 'apellido' => 'Tapia', 'cedula' => '1710000603', 'fecha_nacimiento' => '1958-06-02',
        ]);
    }

    private function actingAsRole(Role $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role->value);
        Sanctum::actingAs($user);

        return $user;
    }

    public function test_reception_can_create_edit_and_delete_appointments(): void
    {
        $this->actingAsRole(Role::RECEPCIONISTA);

        $id = $this->postJson('/api/appointments', [
            'patient_id' => $this->patient->id,
            'titulo' => 'Control',
            'fecha_hora_inicio' => '2026-10-27 09:00',
            'fecha_hora_fin' => '2026-10-27 09:30',
        ])->assertCreated()->json('data.id') ?? Appointment::query()->value('id');

        $this->getJson('/api/appointments?from=2026-10-26&to=2026-10-28')->assertOk();

        $this->putJson("/api/appointments/{$id}", [
            'titulo' => 'Control anual',
            'fecha_hora_inicio' => '2026-10-27 10:00',
            'fecha_hora_fin' => '2026-10-27 10:30',
            'estado' => 'atendido',
        ])->assertOk();
        $this->assertDatabaseHas('appointments', ['id' => $id, 'titulo' => 'Control anual', 'estado' => 'atendido']);

        $this->deleteJson("/api/appointments/{$id}")->assertOk();
        $this->assertSoftDeletedOrMissing($id);
    }

    /**
     * La agenda reenvia `patient_id` y `titulo` en null cuando la cita no los
     * tiene. Crear la aceptaba, pero editarla respondia 422.
     */
    public function test_an_appointment_without_patient_or_title_can_be_edited(): void
    {
        $this->actingAsRole(Role::RECEPCIONISTA);

        $appointment = Appointment::create([
            'titulo' => 'Sin paciente',
            'fecha_hora_inicio' => '2026-10-27 09:00',
            'fecha_hora_fin' => '2026-10-27 09:30',
            'estado' => 'pendiente',
        ]);

        $this->putJson("/api/appointments/{$appointment->id}", [
            'patient_id' => null,
            'titulo' => null,
            'fecha_hora_inicio' => '2026-10-27T09:00',
            'fecha_hora_fin' => '2026-10-27T09:30',
            'notas' => null,
            'estado' => 'atendido',
        ])->assertOk();

        $this->assertDatabaseHas('appointments', ['id' => $appointment->id, 'estado' => 'atendido']);
    }

    public function test_deleting_an_appointment_requires_the_delete_permission(): void
    {
        $appointment = Appointment::create([
            'patient_id' => $this->patient->id,
            'fecha_hora_inicio' => '2026-10-27 09:00',
            'fecha_hora_fin' => '2026-10-27 09:30',
            'estado' => 'pendiente',
        ]);

        $this->actingAsRole(Role::VENDEDOR);
        $this->deleteJson("/api/appointments/{$appointment->id}")->assertForbidden();

        $this->actingAsRole(Role::CAJERO);
        $this->getJson('/api/appointments')->assertForbidden();
    }

    public function test_reception_can_work_with_lab_orders_but_not_delete_them(): void
    {
        $this->actingAsRole(Role::RECEPCIONISTA);

        $id = $this->postJson('/api/lab-orders', [
            'patient_id' => $this->patient->id,
            'od_sphere' => -1.25,
            // La pantalla junta varios tratamientos y corta en 150, como la columna.
            'lens_treatment' => str_repeat('Antirreflejo + ', 10),
        ])->assertCreated()->json('data.id');

        $this->assertNotNull($id);
        $this->getJson('/api/lab-orders')->assertOk();
        $this->getJson("/api/lab-orders/{$id}")->assertOk();
        $this->putJson("/api/lab-orders/{$id}", ['frame_description' => 'Armazón negro'])->assertOk();
        $this->postJson("/api/lab-orders/{$id}/status", ['status' => 'pending'])->assertOk();
        $this->deleteJson("/api/lab-orders/{$id}")->assertForbidden();
    }

    public static function forbiddenForReception(): array
    {
        return [
            'reporte clinico' => ['/api/reports/consultations'],
            'reporte diagnosticos' => ['/api/reports/diagnoses'],
            'reporte pacientes' => ['/api/reports/patients'],
            'reporte ventas' => ['/api/reports/sales'],
            'reporte inventario' => ['/api/reports/inventory'],
            'reporte laboratorio' => ['/api/reports/lab'],
            'reporte caja' => ['/api/reports/cash'],
            'dashboard comercial' => ['/api/reports/dashboard-commercial'],
            'ventas' => ['/api/sales'],
            'productos' => ['/api/products'],
            'caja' => ['/api/cash-registers/sessions'],
            'crm' => ['/api/crm/campaigns'],
        ];
    }

    #[DataProvider('forbiddenForReception')]
    public function test_reception_has_no_reports_or_commercial_access(string $url): void
    {
        $this->actingAsRole(Role::RECEPCIONISTA);

        $this->getJson($url)->assertForbidden();
    }

    public function test_reception_keeps_the_dashboard_data(): void
    {
        $this->actingAsRole(Role::RECEPCIONISTA);

        $this->getJson('/api/reports/dashboard')->assertOk();
        $this->getJson('/api/reports/consultations-forecast?days=7')->assertOk();
        $this->getJson('/api/reception/consultations')->assertOk();
    }

    /**
     * El menu y las rutas se filtran por permiso. Sin ellos en la respuesta del
     * login, un usuario no admin veia el menu vacio hasta recargar.
     */
    public function test_login_response_includes_permissions(): void
    {
        $user = User::factory()->create(['password' => bcrypt('secreto-de-prueba')]);
        $user->assignRole(Role::RECEPCIONISTA->value);

        $this->postJson('/login', ['email' => $user->email, 'password' => 'secreto-de-prueba'])
            ->assertOk()
            ->assertJsonFragment(['lab_orders.create']);
    }

    public function test_other_roles_keep_their_reports(): void
    {
        $this->actingAsRole(Role::OPTOMETRA);
        $this->getJson('/api/reports/consultations')->assertOk();

        $this->actingAsRole(Role::CAJERO);
        $this->getJson('/api/reports/sales')->assertOk();
    }

    private function assertSoftDeletedOrMissing(int $id): void
    {
        $this->assertNull(Appointment::find($id));
    }
}
