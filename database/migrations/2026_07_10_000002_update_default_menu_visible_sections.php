<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $oldDefault = json_encode([
            'atencion_clinica',
            'operacion_diaria',
            'inventario',
            'comercial',
            'reportes',
        ]);

        $newDefault = json_encode([
            'atencion_clinica',
            'operacion_diaria',
            'inventario',
        ]);

        DB::table('settings')
            ->where('key', 'menu_visible_sections')
            ->where('value', $oldDefault)
            ->update([
                'value' => $newDefault,
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        $newDefault = json_encode([
            'atencion_clinica',
            'operacion_diaria',
            'inventario',
        ]);

        $oldDefault = json_encode([
            'atencion_clinica',
            'operacion_diaria',
            'inventario',
            'comercial',
            'reportes',
        ]);

        DB::table('settings')
            ->where('key', 'menu_visible_sections')
            ->where('value', $newDefault)
            ->update([
                'value' => $oldDefault,
                'updated_at' => now(),
            ]);
    }
};
