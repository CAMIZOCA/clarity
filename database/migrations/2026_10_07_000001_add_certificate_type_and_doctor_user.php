<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Vincula al doctor certificador con el usuario (medico/optometra) de la
        // consulta, para que el certificado proponga a quien atendio.
        Schema::table('certifying_doctors', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->after('id')->constrained('users')->nullOnDelete();
        });

        // general | escolar_vehicular (este ultimo se imprime sin RX final).
        Schema::table('certificates', function (Blueprint $table) {
            $table->string('tipo', 30)->default('general')->after('numero_consulta');
        });
    }

    public function down(): void
    {
        Schema::table('certificates', function (Blueprint $table) {
            $table->dropColumn('tipo');
        });

        Schema::table('certifying_doctors', function (Blueprint $table) {
            $table->dropConstrainedForeignId('user_id');
        });
    }
};
