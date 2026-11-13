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

class UserPreferenceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function test_user_without_admin_permissions_can_choose_own_template(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->patchJson('/api/me/preferences', ['ui_template' => 'compacto'])
            ->assertOk()
            ->assertJsonPath('data.id', $user->id)
            ->assertJsonPath('data.ui_template', 'compacto');

        $this->assertSame('compacto', $user->fresh()->ui_template);
    }

    public function test_null_template_goes_back_to_the_clinic_default(): void
    {
        $user = User::factory()->create(['ui_template' => 'compacto']);
        Sanctum::actingAs($user);

        $this->patchJson('/api/me/preferences', ['ui_template' => null])
            ->assertOk()
            ->assertJsonPath('data.ui_template', null);

        $this->assertNull($user->fresh()->ui_template);
    }

    public function test_unknown_template_is_rejected(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->patchJson('/api/me/preferences', ['ui_template' => 'oscuro'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('ui_template');

        $this->assertNull($user->fresh()->ui_template);
    }

    public function test_preferences_only_change_the_authenticated_user(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        Sanctum::actingAs($user);

        $this->patchJson('/api/me/preferences', ['ui_template' => 'compacto', 'id' => $other->id])
            ->assertOk();

        $this->assertSame('compacto', $user->fresh()->ui_template);
        $this->assertNull($other->fresh()->ui_template);
    }

    public function test_guest_cannot_change_preferences(): void
    {
        $this->patchJson('/api/me/preferences', ['ui_template' => 'compacto'])
            ->assertUnauthorized();
    }

    public function test_me_returns_the_chosen_template(): void
    {
        $user = User::factory()->create(['ui_template' => 'compacto']);

        $this->actingAs($user)
            ->getJson('/me')
            ->assertOk()
            ->assertJsonPath('data.ui_template', 'compacto');
    }

    public function test_default_template_setting_requires_settings_edit(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/settings', ['ui_template_default' => 'compacto'])
            ->assertForbidden();
    }

    public function test_admin_can_change_default_template_and_invalid_values_fail(): void
    {
        $admin = User::factory()->create();
        SpatiePermission::firstOrCreate(['name' => Permission::SETTINGS_EDIT->value, 'guard_name' => 'web']);
        $admin->givePermissionTo(Permission::SETTINGS_EDIT->value);
        Sanctum::actingAs($admin);

        $this->postJson('/api/settings', ['ui_template_default' => 'tema-raro'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('ui_template_default');

        $this->postJson('/api/settings', ['ui_template_default' => 'compacto'])
            ->assertOk();

        $this->assertSame('compacto', Setting::get('ui_template_default'));
    }

    public function test_spa_shell_renders_the_template_server_side(): void
    {
        $this->withoutVite();
        $user = User::factory()->create(['ui_template' => 'compacto']);

        $this->actingAs($user)
            ->get('/pacientes')
            ->assertOk()
            ->assertSee('data-ui="compacto"', false);
    }

    public function test_spa_shell_falls_back_to_the_clinic_default(): void
    {
        $this->withoutVite();
        Setting::set('ui_template_default', 'compacto');
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get('/pacientes')
            ->assertOk()
            ->assertSee('data-ui="compacto"', false);
    }
}
