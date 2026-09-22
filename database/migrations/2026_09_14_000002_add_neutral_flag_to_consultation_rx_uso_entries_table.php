<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('consultation_rx_uso_entries', function (Blueprint $table) {
            $table->boolean('esfera_od_neutral')->default(false);
            $table->boolean('esfera_oi_neutral')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('consultation_rx_uso_entries', function (Blueprint $table) {
            $table->dropColumn(['esfera_od_neutral', 'esfera_oi_neutral']);
        });
    }
};
