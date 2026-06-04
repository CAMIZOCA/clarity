<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('brigade_patient', function (Blueprint $table) {
            $table->id();
            $table->foreignId('brigade_id')->constrained()->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->text('notas')->nullable();
            $table->timestamps();
            $table->unique(['brigade_id', 'patient_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('brigade_patient');
    }
};
