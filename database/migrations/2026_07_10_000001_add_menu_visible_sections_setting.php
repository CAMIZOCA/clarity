<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('settings')->updateOrInsert(
            ['key' => 'menu_visible_sections'],
            [
                'value' => json_encode([
                    'atencion_clinica',
                    'operacion_diaria',
                    'inventario',
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
    }

    public function down(): void
    {
        DB::table('settings')->where('key', 'menu_visible_sections')->delete();
    }
};
