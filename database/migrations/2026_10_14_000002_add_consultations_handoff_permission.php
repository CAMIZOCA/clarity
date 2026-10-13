<?php

use App\Enums\Role;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role as SpatieRole;
use Spatie\Permission\PermissionRegistrar;

/**
 * `consultations.handoff`: ver el resumen de las consultas recien terminadas
 * en el dashboard (RX, lente recomendado, diagnostico), sin abrir la historia
 * ni recibir `patients.view_clinical`.
 *
 * El entrypoint solo siembra una base vacia, asi que un permiso nuevo llega a
 * las bases existentes por migracion. Es idempotente y solo toca los roles
 * que existen.
 */
return new class extends Migration
{
    private const PERMISSION = 'consultations.handoff';

    private const ROLES = [
        Role::ADMIN,
        Role::OPTOMETRA,
        Role::RECEPCIONISTA,
        Role::VENDEDOR,
        Role::ENCARGADO_LAB,
    ];

    public function up(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $permission = Permission::firstOrCreate(['name' => self::PERMISSION, 'guard_name' => 'web']);

        foreach (self::ROLES as $role) {
            SpatieRole::where('name', $role->value)->where('guard_name', 'web')->first()
                ?->givePermissionTo($permission);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        Permission::where('name', self::PERMISSION)->where('guard_name', 'web')->delete();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
