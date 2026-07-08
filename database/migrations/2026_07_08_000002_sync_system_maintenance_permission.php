<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('permissions') || ! Schema::hasTable('roles') || ! Schema::hasTable('role_has_permissions')) {
            return;
        }

        DB::table('permissions')->updateOrInsert(
            ['name' => 'system.maintenance', 'guard_name' => 'web'],
            ['created_at' => now(), 'updated_at' => now()]
        );

        $permission = DB::table('permissions')
            ->where('name', 'system.maintenance')
            ->where('guard_name', 'web')
            ->first();
        $adminRole = DB::table('roles')
            ->where('name', 'admin')
            ->where('guard_name', 'web')
            ->first();

        if ($permission && $adminRole) {
            DB::table('role_has_permissions')->updateOrInsert([
                'permission_id' => $permission->id,
                'role_id' => $adminRole->id,
            ]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('permissions')) {
            return;
        }

        $permission = DB::table('permissions')
            ->where('name', 'system.maintenance')
            ->where('guard_name', 'web')
            ->first();

        if (! $permission) {
            return;
        }

        if (Schema::hasTable('role_has_permissions')) {
            DB::table('role_has_permissions')->where('permission_id', $permission->id)->delete();
        }

        DB::table('permissions')->where('id', $permission->id)->delete();
    }
};
