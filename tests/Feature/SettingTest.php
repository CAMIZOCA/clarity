<?php

namespace Tests\Feature;

use App\Enums\Permission;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission as SpatiePermission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class SettingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function test_authenticated_user_can_read_settings(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/settings')
            ->assertOk()
            ->assertJsonStructure([
                'clinic_name',
                'required_fields',
                'menu_visible_sections',
                'menu_visible_items',
            ])
            ->assertJsonPath('menu_visible_sections', json_encode([
                'atencion_clinica',
                'operacion_diaria',
                'inventario',
            ]))
            ->assertJsonPath('menu_visible_items', json_encode([
                'pacientes',
                'consulta',
                'agenda',
                'ordenes_trabajo',
                'lentes_especiales',
                'referencias',
                'brigadas',
                'pos',
                'ventas',
                'caja',
                'laboratorio',
                'inventario_productos',
                'inventario_stock',
                'inventario_movimientos',
                'crm_campanas',
                'crm_plantillas',
                'crm_recordatorios',
                'reportes_clinicos',
                'reportes_comerciales',
                'dashboard_gerencial',
            ]));
    }

    public function test_user_with_settings_edit_permission_can_update_menu_visibility(): void
    {
        $user = User::factory()->create();
        SpatiePermission::firstOrCreate([
            'name' => Permission::SETTINGS_EDIT->value,
            'guard_name' => 'web',
        ]);
        $user->givePermissionTo(Permission::SETTINGS_EDIT->value);
        Sanctum::actingAs($user);

        $this->postJson('/api/settings', [
            'menu_visible_sections' => [
                'atencion_clinica',
                'reportes',
            ],
            'menu_visible_items' => [
                'pacientes',
                'agenda',
                'reportes_clinicos',
            ],
        ])->assertOk()
            ->assertJsonPath('menu_visible_sections', json_encode([
                'atencion_clinica',
                'reportes',
            ]))
            ->assertJsonPath('menu_visible_items', json_encode([
                'pacientes',
                'agenda',
                'reportes_clinicos',
            ]));

        $this->assertSame(
            ['atencion_clinica', 'reportes'],
            json_decode(Setting::get('menu_visible_sections'), true)
        );
        $this->assertSame(
            ['pacientes', 'agenda', 'reportes_clinicos'],
            json_decode(Setting::get('menu_visible_items'), true)
        );
    }

    public function test_user_without_settings_edit_permission_cannot_update_settings(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/settings', [
            'menu_visible_sections' => ['reportes'],
        ])->assertForbidden();
    }
}
