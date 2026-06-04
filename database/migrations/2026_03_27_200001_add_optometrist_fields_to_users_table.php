<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role')->default('recepcionista')->after('email'); // admin, optometra, recepcionista
            $table->string('codigo', 50)->nullable()->after('role');
            $table->string('registro_senescyt', 100)->nullable()->after('codigo');
            $table->string('firma_digital')->nullable()->after('registro_senescyt');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['role', 'codigo', 'registro_senescyt', 'firma_digital']);
        });
    }
};
