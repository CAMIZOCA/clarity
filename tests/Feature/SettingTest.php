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

    public function test_advanced_form_fields_can_be_updated(): void
    {
        $user = User::factory()->create();
        SpatiePermission::firstOrCreate([
            'name' => Permission::SETTINGS_EDIT->value,
            'guard_name' => 'web',
        ]);
        $user->givePermissionTo(Permission::SETTINGS_EDIT->value);
        Sanctum::actingAs($user);

        $this->postJson('/api/settings', [
            'advanced_form_fields' => [
                'consulta:sec_tratamiento',
                'paciente:antecedentes',
            ],
        ])->assertOk()
            ->assertJsonPath('advanced_form_fields', json_encode([
                'consulta:sec_tratamiento',
                'paciente:antecedentes',
            ]));

        $this->assertSame(
            ['consulta:sec_tratamiento', 'paciente:antecedentes'],
            json_decode(Setting::get('advanced_form_fields'), true)
        );
    }

    public function test_mail_password_is_masked_when_reading_settings(): void
    {
        Setting::set('mail_password', 'super-secreta');
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/settings')
            ->assertOk()
            ->assertJsonPath('mail_password', '__stored__');
    }

    public function test_empty_mail_password_does_not_overwrite_stored_one(): void
    {
        Setting::set('mail_password', 'super-secreta');

        $user = User::factory()->create();
        SpatiePermission::firstOrCreate([
            'name' => Permission::SETTINGS_EDIT->value,
            'guard_name' => 'web',
        ]);
        $user->givePermissionTo(Permission::SETTINGS_EDIT->value);
        Sanctum::actingAs($user);

        // El frontend envía la contraseña vacía cuando el usuario no la cambia.
        $this->postJson('/api/settings', [
            'mail_host' => 'smtp.gmail.com',
            'mail_password' => '',
        ])->assertOk();

        $this->assertSame('super-secreta', Setting::get('mail_password'));
        $this->assertSame('smtp.gmail.com', Setting::get('mail_host'));
    }

    public function test_advanced_form_fields_can_be_emptied(): void
    {
        $user = User::factory()->create();
        SpatiePermission::firstOrCreate([
            'name' => Permission::SETTINGS_EDIT->value,
            'guard_name' => 'web',
        ]);
        $user->givePermissionTo(Permission::SETTINGS_EDIT->value);
        Sanctum::actingAs($user);

        $this->postJson('/api/settings', [
            'advanced_form_fields' => [],
        ])->assertOk();

        $this->assertSame([], json_decode(Setting::get('advanced_form_fields'), true));
    }
}
