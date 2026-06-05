<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Plantillas de mensajes
        Schema::create('message_templates', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->enum('type', ['appointment_reminder', 'lab_ready', 'birthday', 'reorder', 'balance_reminder', 'custom', 'campaign']);
            $table->enum('channel', ['whatsapp', 'email', 'sms'])->default('whatsapp');
            $table->string('subject', 200)->nullable(); // Para email
            $table->text('body'); // Con variables: {nombre}, {fecha}, {monto}, {optica}
            $table->json('variables')->nullable(); // Lista de variables disponibles
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
            $table->index(['type', 'channel']);
        });

        // Recordatorios individuales
        Schema::create('reminders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained('patients')->onDelete('cascade');
            $table->foreignId('template_id')->nullable()->constrained('message_templates')->onDelete('set null');
            $table->foreignId('created_by')->constrained('users')->onDelete('restrict');
            $table->enum('type', ['appointment', 'lab_ready', 'birthday', 'control_visual', 'reorder', 'balance', 'custom']);
            $table->enum('channel', ['whatsapp', 'email', 'sms'])->default('whatsapp');
            $table->text('message'); // Mensaje resuelto (con variables reemplazadas)
            $table->enum('status', ['pending', 'sent', 'failed', 'cancelled'])->default('pending');
            $table->timestamp('scheduled_at');
            $table->timestamp('sent_at')->nullable();
            $table->string('error_message', 500)->nullable();
            $table->string('reference_type')->nullable(); // App\Models\Appointment, etc.
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->timestamps();
            $table->index(['status', 'scheduled_at']);
            $table->index('patient_id');
        });

        // Campañas masivas
        Schema::create('campaigns', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->enum('channel', ['whatsapp', 'email'])->default('whatsapp');
            $table->foreignId('template_id')->nullable()->constrained('message_templates')->onDelete('set null');
            $table->text('message_body'); // Mensaje personalizado o el del template
            $table->json('segment_criteria'); // Criterios de segmentación
            $table->enum('status', ['draft', 'scheduled', 'running', 'completed', 'cancelled'])->default('draft');
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->unsignedInteger('total_recipients')->default(0);
            $table->unsignedInteger('sent_count')->default(0);
            $table->unsignedInteger('failed_count')->default(0);
            $table->foreignId('created_by')->constrained('users')->onDelete('restrict');
            $table->timestamps();
            $table->softDeletes();
            $table->index('status');
        });

        // Log de envíos de campaña por paciente
        Schema::create('campaign_sends', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')->constrained('campaigns')->onDelete('cascade');
            $table->foreignId('patient_id')->constrained('patients')->onDelete('cascade');
            $table->text('message_sent'); // Mensaje final enviado
            $table->enum('status', ['pending', 'sent', 'failed'])->default('pending');
            $table->timestamp('sent_at')->nullable();
            $table->string('error_message', 500)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['campaign_id', 'status']);
            $table->index('patient_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('campaign_sends');
        Schema::dropIfExists('campaigns');
        Schema::dropIfExists('reminders');
        Schema::dropIfExists('message_templates');
    }
};
