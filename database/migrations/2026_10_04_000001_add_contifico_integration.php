<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Integracion con Contifico: cada paciente nuevo se crea alla como Persona
 * con rol cliente. `patients.contifico_id` evita enviarlo dos veces y
 * `contifico_sync_logs` es el historial que se muestra en Ajustes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->string('contifico_id', 32)->nullable()->index();
            $table->timestamp('contifico_synced_at')->nullable();
        });

        Schema::create('contifico_sync_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action', 20); // create|link|test
            $table->string('status', 20); // success|failed|skipped
            $table->unsignedSmallInteger('http_status')->nullable();
            $table->string('contifico_id', 32)->nullable();
            // Lo enviado a Contifico. Nunca incluye la API key, el token ni la URL.
            $table->json('payload')->nullable();
            $table->string('message', 500)->nullable();
            $table->unsignedTinyInteger('attempt')->default(1);
            $table->timestamps();
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contifico_sync_logs');

        Schema::table('patients', function (Blueprint $table) {
            $table->dropIndex(['contifico_id']);
            $table->dropColumn(['contifico_id', 'contifico_synced_at']);
        });
    }
};
