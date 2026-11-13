<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Plantilla por defecto para quien no eligio una. Arranca en "clasico": el
     * personal ya conoce ese diseño y el compacto se ofrece como opcion. No pisa
     * un valor que el administrador ya haya cambiado.
     */
    public function up(): void
    {
        if (DB::table('settings')->where('key', 'ui_template_default')->exists()) {
            return;
        }

        DB::table('settings')->insert([
            'key' => 'ui_template_default',
            'value' => 'clasico',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('settings')->where('key', 'ui_template_default')->delete();
    }
};
