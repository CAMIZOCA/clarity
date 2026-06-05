<?php

namespace Database\Seeders;

use App\Enums\Permission;
use App\Enums\Role;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission as SpatiePermission;
use Spatie\Permission\Models\Role as SpatieRole;

/**
 * Seeder para sincronizar permisos sin reiniciar datos.
 * Ejecutar cuando se agreguen nuevos permisos al enum Permission.
 *
 * Uso: php artisan db:seed --class=PermissionsSeeder
 */
class PermissionsSeeder extends Seeder
{
    public function run(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $this->command?->info('Sincronizando permisos...');

        $created = 0;
        foreach (Permission::values() as $permissionValue) {
            $perm = SpatiePermission::firstOrCreate(['name' => $permissionValue, 'guard_name' => 'web']);
            if ($perm->wasRecentlyCreated) {
                $created++;
                $this->command?->info("  + Nuevo permiso: {$permissionValue}");
            }
        }

        // Re-sincronizar permisos de cada rol
        foreach (Role::cases() as $roleEnum) {
            $role = SpatieRole::where('name', $roleEnum->value)->first();
            if ($role) {
                $permissions = Permission::forRole($roleEnum);
                $role->syncPermissions($permissions);
            }
        }

        $this->command?->info("✅ Sincronización completada. Nuevos permisos: {$created}");
    }
}
