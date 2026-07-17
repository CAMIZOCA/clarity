<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('certificates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('consultation_id')->constrained('consultations')->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained('patients')->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->foreignId('certifying_doctor_id')->nullable()->constrained('certifying_doctors')->nullOnDelete();
            $table->unsignedInteger('numero_consulta')->nullable();
            $table->string('pdf_path');
            $table->string('recipient_email')->nullable();
            $table->string('subject')->nullable();
            $table->string('status', 20)->default('generado'); // generado | enviado | error
            $table->timestamp('sent_at')->nullable();
            $table->text('error_message')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('patient_id');
            $table->index('consultation_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('certificates');
    }
};
