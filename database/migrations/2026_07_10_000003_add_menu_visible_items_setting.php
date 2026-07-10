<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('settings')->updateOrInsert(
            ['key' => 'menu_visible_items'],
            [
                'value' => json_encode([
                    'pacientes',
                    'consulta',
                    'agenda',
                    'ordenes_trabajo',
                    'lentes_especiales',
                    'referencias',
                    'brigadas',
                    'pos',
                    'ventas',
                    'caja',
                    'laboratorio',
                    'inventario_productos',
                    'inventario_stock',
                    'inventario_movimientos',
                    'crm_campanas',
                    'crm_plantillas',
                    'crm_recordatorios',
                    'reportes_clinicos',
                    'reportes_comerciales',
                    'dashboard_gerencial',
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
    }

    public function down(): void
    {
        DB::table('settings')->where('key', 'menu_visible_items')->delete();
    }
};
