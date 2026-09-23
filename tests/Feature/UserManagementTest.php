<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission as SpatiePermission;
use Spatie\Permission\Models\Role as SpatieRole;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (Role::values() as $role) {
            SpatieRole::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        }

        $admin = User::factory()->create();
        foreach (['users.create', 'users.edit'] as $permission) {
            SpatiePermission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
            $admin->givePermissionTo($permission);
        }

        Sanctum::actingAs($admin);
    }

    public function test_create_requires_matching_password_confirmation(): void
    {
        $this->postJson('/api/users', [
            'name' => 'Ana Lopez',
            'email' => 'ana@example.com',
            'password' => 'secreto123',
            'role' => 'optometra',
        ])->assertStatus(422)->assertJsonValidationErrors('password');

        $this->postJson('/api/users', [
            'name' => 'Ana Lopez',
            'email' => 'ana@example.com',
            'password' => 'secreto123',
            'password_confirmation' => 'secreto123',
            'role' => 'optometra',
            'phone' => '0999999999',
        ])->assertCreated()->assertJsonPath('data.roles.0', 'optometra');

        $user = User::where('email', 'ana@example.com')->firstOrFail();
        $this->assertSame('0999999999', $user->phone);
        $this->assertTrue(Hash::check('secreto123', $user->password));
    }

    public function test_update_keeps_existing_data_and_syncs_role_column(): void
    {
        $user = User::factory()->create([
            'name' => 'Carlos Ruiz',
            'role' => 'recepcionista',
            'codigo' => 'CR-01',
            'registro_senescyt' => 'SEN-123',
        ]);
        $user->syncRoles(['recepcionista']);
        $originalHash = $user->password;

        $this->getJson("/api/users/{$user->id}")
            ->assertOk()
            ->assertJsonPath('data.name', 'Carlos Ruiz')
            ->assertJsonPath('data.codigo', 'CR-01');

        // Sin contraseña: la actual se conserva.
        $this->putJson("/api/users/{$user->id}", [
            'name' => 'Carlos Ruiz M.',
            'email' => $user->email,
            'role' => 'vendedor',
            'codigo' => 'CR-01',
            'registro_senescyt' => 'SEN-123',
            'phone' => '022222222',
            'is_active' => false,
        ])->assertOk()->assertJsonPath('data.name', 'Carlos Ruiz M.');

        $user->refresh();
        $this->assertSame('vendedor', $user->role);
        $this->assertTrue($user->hasRole('vendedor'));
        $this->assertFalse($user->hasRole('recepcionista'));
        $this->assertSame('SEN-123', $user->registro_senescyt);
        $this->assertSame('022222222', $user->phone);
        $this->assertFalse((bool) $user->is_active);
        $this->assertSame($originalHash, $user->password);
    }

    public function test_update_password_requires_confirmation(): void
    {
        $user = User::factory()->create();

        $this->putJson("/api/users/{$user->id}", [
            'password' => 'nuevaClave9',
            'password_confirmation' => 'otraClave9',
        ])->assertStatus(422)->assertJsonValidationErrors('password');

        $this->putJson("/api/users/{$user->id}", [
            'password' => 'nuevaClave9',
            'password_confirmation' => 'nuevaClave9',
        ])->assertOk();

        $this->assertTrue(Hash::check('nuevaClave9', $user->fresh()->password));
    }
}
