<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Plantilla de pantalla elegida por el usuario ("clasico" | "compacto").
     * `null` sigue el valor por defecto de la optica (setting `ui_template_default`),
     * asi que cambiar el defecto no pisa a quien ya eligio.
     */
    public function up(): void
    {
        if (Schema::hasColumn('users', 'ui_template')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->string('ui_template', 20)->nullable();
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('users', 'ui_template')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('ui_template');
        });
    }
};
