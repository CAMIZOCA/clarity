<?php

namespace Database\Seeders;

use App\Enums\Permission;
use App\Enums\Role;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission as SpatiePermission;
use Spatie\Permission\Models\Role as SpatieRole;

class RolesSeeder extends Seeder
{
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // ─── Crear todos los permisos ───────────────────────────────────────
        $this->command?->info('Creando permisos granulares...');

        foreach (Permission::values() as $permissionValue) {
            SpatiePermission::firstOrCreate(
                ['name' => $permissionValue, 'guard_name' => 'web']
            );
        }

        $this->command?->info('Permisos creados: ' . count(Permission::values()));

        // ─── Crear roles y asignar permisos ────────────────────────────────
        foreach (Role::cases() as $roleEnum) {
            $role = SpatieRole::firstOrCreate(
                ['name' => $roleEnum->value, 'guard_name' => 'web']
            );

            $permissions = Permission::forRole($roleEnum);
            $role->syncPermissions($permissions);

            $this->command?->info("Rol '{$roleEnum->label()}': " . count($permissions) . " permisos asignados");
        }

        $this->command?->info('✅ Roles y permisos configurados correctamente.');
    }
}
