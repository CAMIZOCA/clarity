<?php

use App\Enums\Role;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role as SpatieRole;
use Spatie\Permission\PermissionRegistrar;

/**
 * Recepcion usa las ordenes de trabajo (sin eliminarlas) y no ve reportes ni
 * la parte comercial: ventas, caja, inventario, productos ni CRM.
 *
 * Los seeders no corren en bases existentes, asi que el cambio llega por
 * migracion. Es idempotente y tambien retira lo que se le hubiera asignado a
 * mano.
 */
return new class extends Migration
{
    private const GRANT = [
        'lab_orders.view',
        'lab_orders.create',
        'lab_orders.edit',
        'lab_orders.manage_status',
    ];

    private const REVOKE_PREFIXES = ['reports.', 'crm.', 'sales.', 'cash.', 'inventory.', 'products.', 'purchases.', 'suppliers.'];

    public function up(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $role = SpatieRole::where('name', Role::RECEPCIONISTA->value)->where('guard_name', 'web')->first();

        if ($role) {
            foreach (self::GRANT as $name) {
                $role->givePermissionTo(Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']));
            }

            $revoke = $role->permissions()->get()->filter(
                fn ($permission) => str_starts_with($permission->name, 'lab_orders.delete')
                    || collect(self::REVOKE_PREFIXES)->contains(fn ($prefix) => str_starts_with($permission->name, $prefix))
            );
            if ($revoke->isNotEmpty()) {
                $role->revokePermissionTo($revoke);
            }
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $role = SpatieRole::where('name', Role::RECEPCIONISTA->value)->where('guard_name', 'web')->first();
        $role?->revokePermissionTo(self::GRANT);
        foreach (['reports.clinical', 'crm.view'] as $name) {
            if ($role && Permission::where('name', $name)->where('guard_name', 'web')->exists()) {
                $role->givePermissionTo($name);
            }
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
