<?php

use App\Enums\Role;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role as SpatieRole;
use Spatie\Permission\PermissionRegistrar;

/**
 * `legacy.review`: la pantalla "Revision de datos heredados", donde la optica
 * ve los campos que la importacion del sistema anterior dejo en otro sitio y
 * los reubica. Solo admin; se puede dar a otro rol sin abrirle Mantenimiento.
 */
return new class extends Migration
{
    private const PERMISSION = 'legacy.review';

    public function up(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $permission = Permission::firstOrCreate(['name' => self::PERMISSION, 'guard_name' => 'web']);

        SpatieRole::where('name', Role::ADMIN->value)->where('guard_name', 'web')->first()
            ?->givePermissionTo($permission);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        Permission::where('name', self::PERMISSION)->where('guard_name', 'web')->delete();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
