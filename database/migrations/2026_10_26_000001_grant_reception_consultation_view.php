<?php

use App\Enums\Role;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role as SpatieRole;
use Spatie\Permission\PermissionRegistrar;

/**
 * Recepcion ve e imprime las historias clinicas, pero no las crea, edita ni
 * borra: el formulario de consulta se le abre en solo lectura.
 *
 * Los seeders no corren en bases existentes, asi que el cambio llega por
 * migracion. Es idempotente y tambien retira los permisos de escritura por si
 * se le asignaron a mano.
 */
return new class extends Migration
{
    private const GRANT = [
        'consultations.view',
        'consultations.generate_pdf',
    ];

    private const REVOKE = [
        'consultations.create',
        'consultations.edit',
        'consultations.delete',
    ];

    public function up(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $role = SpatieRole::where('name', Role::RECEPCIONISTA->value)->where('guard_name', 'web')->first();

        if ($role) {
            foreach (self::GRANT as $name) {
                $role->givePermissionTo(Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']));
            }

            $revoke = $role->permissions()->whereIn('name', self::REVOKE)->get();
            if ($revoke->isNotEmpty()) {
                $role->revokePermissionTo($revoke);
            }
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        SpatieRole::where('name', Role::RECEPCIONISTA->value)->where('guard_name', 'web')->first()
            ?->revokePermissionTo(self::GRANT);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
