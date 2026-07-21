<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('certifying_doctors', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 150);
            $table->string('titulo', 100)->default('OPTÓMETRA');
            $table->string('registro_senescyt', 100)->nullable();
            $table->string('codigo', 100)->nullable();
            $table->string('firma_path')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('is_default')->default(false);
            $table->timestamps();

            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('certifying_doctors');
    }
};
