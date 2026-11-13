<?php

use App\Enums\Role;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role as SpatieRole;
use Spatie\Permission\PermissionRegistrar;

/**
 * Recepcion manda los recordatorios por WhatsApp desde /crm/recordatorios.
 * `crm.reminders` abre solo esa pantalla (sin Campañas ni Plantillas, que
 * siguen con `crm.view`); `crm.send_messages` registra el envio.
 *
 * Los seeders no corren en bases existentes, asi que llega por migracion.
 * El admin tiene todos los permisos y tambien lo recibe.
 */
return new class extends Migration
{
    private const RECEPTION_GRANT = ['crm.reminders', 'crm.send_messages'];

    public function up(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (self::RECEPTION_GRANT as $name) {
            Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }

        SpatieRole::where('name', Role::ADMIN->value)->where('guard_name', 'web')->first()
            ?->givePermissionTo('crm.reminders');

        SpatieRole::where('name', Role::RECEPCIONISTA->value)->where('guard_name', 'web')->first()
            ?->givePermissionTo(self::RECEPTION_GRANT);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        SpatieRole::where('name', Role::RECEPCIONISTA->value)->where('guard_name', 'web')->first()
            ?->revokePermissionTo(self::RECEPTION_GRANT);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
