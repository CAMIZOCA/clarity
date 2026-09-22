<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * RX Final tenia dos columnas de agudeza visual duplicadas: "AV. CC" (avl) y
 * "AV" (av). Se conserva `av` (la que pide el papel de Optica Andina) y se
 * elimina `avl`, pero primero se copia cualquier valor de `avl` que `av` no
 * tenga, para no perder datos historicos.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['od', 'oi'] as $eye) {
            DB::table('consultations')
                ->whereNotNull("rx_final_avl_{$eye}")
                ->where("rx_final_avl_{$eye}", '!=', '')
                ->where(function ($query) use ($eye) {
                    $query->whereNull("rx_final_av_{$eye}")->orWhere("rx_final_av_{$eye}", '');
                })
                ->update([
                    "rx_final_av_{$eye}" => DB::raw("rx_final_avl_{$eye}"),
                ]);
        }

        Schema::table('consultations', function (Blueprint $table) {
            $table->dropColumn(['rx_final_avl_od', 'rx_final_avl_oi']);
        });
    }

    public function down(): void
    {
        Schema::table('consultations', function (Blueprint $table) {
            $table->text('rx_final_avl_od')->nullable();
            $table->text('rx_final_avl_oi')->nullable();
        });
    }
};
