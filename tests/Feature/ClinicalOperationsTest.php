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

class ClinicalOperationsTest extends TestCase
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

    /**
     * El formulario nace con dos diagnosticos y una recomendacion vacios.
     * Con `required_with` fijo, guardar un borrador intacto — o el
     * autoguardado de 30 s — respondia 422 por filas que nadie lleno.
     */
    public function test_draft_consultation_saves_with_empty_diagnosis_rows(): void
    {
        $this->actingWith(Permission::CONSULTATIONS_CREATE->value);

        $patient = Patient::create(['nombre' => 'Ana', 'apellido' => 'Pérez', 'cedula' => '1710000001', 'fecha_nacimiento' => '1990-01-01']);

        $this->postJson('/api/consultations', [
            'patient_id' => $patient->id,
            'fecha_consulta' => now()->toDateString(),
            'estado' => 'borrador',
            'diagnoses' => [
                ['eye' => 'od', 'catalog_item_id' => '', 'code' => '', 'description' => '', 'notes' => ''],
                ['eye' => 'oi', 'catalog_item_id' => '', 'code' => '', 'description' => '', 'notes' => ''],
            ],
            'recommendations_list' => [
                ['catalog_item_id' => '', 'text' => ''],
            ],
        ])->assertCreated();

        $this->assertDatabaseHas('consultations', [
            'patient_id' => $patient->id,
            'estado' => 'borrador',
        ]);
    }

    /** Las filas vacias se descartan: no deben persistirse como diagnosticos. */
    public function test_empty_rows_are_not_persisted(): void
    {
        $this->actingWith(Permission::CONSULTATIONS_CREATE->value);

        $patient = Patient::create(['nombre' => 'Luis', 'apellido' => 'Gómez', 'cedula' => '1710000002', 'fecha_nacimiento' => '1985-06-15']);

        $id = $this->postJson('/api/consultations', [
            'patient_id' => $patient->id,
            'fecha_consulta' => now()->toDateString(),
            'estado' => 'borrador',
            'diagnoses' => [
                ['eye' => 'od', 'description' => 'Miopía'],
                ['eye' => 'oi', 'description' => ''],
            ],
            'recommendations_list' => [
                ['text' => ''],
            ],
        ])->assertCreated()->json('id');

        $this->assertDatabaseHas('consultation_diagnoses', [
            'consultation_id' => $id,
            'description' => 'Miopía',
        ]);
        $this->assertDatabaseCount('consultation_diagnoses', 1);
    }

    /**
     * Una consulta finalizada sigue exigiendo la descripcion: relajar la
     * validacion es solo para el borrador en curso.
     */
    public function test_completed_consultation_still_requires_a_description(): void
    {
        $this->actingWith(Permission::CONSULTATIONS_CREATE->value);

        $patient = Patient::create(['nombre' => 'Rosa', 'apellido' => 'Díaz', 'cedula' => '1710000003', 'fecha_nacimiento' => '1978-11-30']);

        $this->postJson('/api/consultations', [
            'patient_id' => $patient->id,
            'fecha_consulta' => now()->toDateString(),
            'estado' => 'completada',
            'diagnoses' => [
                ['eye' => 'od', 'code' => 'H52.1', 'description' => ''],
            ],
        ])->assertStatus(422)
            ->assertJsonValidationErrors('diagnoses.0.description');
    }

    /**
     * El withCount('history') resolvia a `lab_order_histories`, pero la
     * migracion crea `lab_order_history`: el kanban de /laboratorio quedaba
     * vacio porque el endpoint entero respondia 500.
     */
    public function test_lab_orders_index_responds_ok(): void
    {
        $this->actingWith(Permission::LAB_ORDERS_VIEW->value);

        $this->getJson('/api/lab-orders')->assertOk();
    }

    /**
     * La pantalla /ordenes-trabajo ahora persiste via POST /api/lab-orders.
     * La validacion permitia valores mas largos que las columnas (y un
     * priority 'express' que el enum no acepta), asi que en MariaDB strict el
     * guardado habria fallado con truncamiento apenas se conectara la pantalla.
     */
    public function test_work_order_can_be_saved_as_a_lab_order(): void
    {
        $this->actingWith(Permission::LAB_ORDERS_CREATE->value, Permission::LAB_ORDERS_VIEW->value);

        $patient = Patient::create([
            'nombre' => 'Marta', 'apellido' => 'Ruiz',
            'cedula' => '1710000004', 'fecha_nacimiento' => '1992-04-04',
        ]);

        $this->postJson('/api/lab-orders', [
            'patient_id' => $patient->id,
            'priority' => 'urgent',
            'od_sphere' => -1.25,
            'od_cylinder' => -0.5,
            'od_axis' => 90,
            'frame_description' => 'Armazón metálico negro',
            'lens_type' => 'Progresivo',
            'lens_material' => 'CR-39',
            'lens_treatment' => 'Antirreflejo + UV',
            'technical_notes' => 'Entrega: Martes URG.',
        ])->assertCreated();

        $this->assertDatabaseHas('lab_orders', [
            'patient_id' => $patient->id,
            'priority' => 'urgent',
            'lens_material' => 'CR-39',
            'status' => 'draft',
        ]);

        // Y la orden recien creada aparece en el listado que alimenta el kanban.
        $this->getJson('/api/lab-orders')->assertOk()->assertJsonPath('data.total', 1);
    }

    /**
     * El priority 'express' que aceptaba la validacion no existe en el enum de
     * la columna: en strict mode habria abortado el insert.
     */
    public function test_lab_order_rejects_a_priority_outside_the_column_enum(): void
    {
        $this->actingWith(Permission::LAB_ORDERS_CREATE->value);

        $patient = Patient::create([
            'nombre' => 'Iván', 'apellido' => 'Mora',
            'cedula' => '1710000005', 'fecha_nacimiento' => '1988-02-02',
        ]);

        $this->postJson('/api/lab-orders', [
            'patient_id' => $patient->id,
            'priority' => 'express',
        ])->assertStatus(422)->assertJsonValidationErrors('priority');
    }

    /**
     * Sin fallback, un /api/* mal escrito caia en el catch-all de la SPA y
     * devolvia 200 con el HTML del index, lo que enmascaraba el error.
     */
    public function test_unknown_api_route_returns_json_404(): void
    {
        $this->getJson('/api/ruta-que-no-existe')
            ->assertStatus(404)
            ->assertJsonPath('message', 'Endpoint no encontrado.');
    }
}
