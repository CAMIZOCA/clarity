<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('maintenance_operations', function (Blueprint $table) {
            $table->id();
            $table->string('type', 50);
            $table->string('status', 50)->default('pending');
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('backup_operation_id')->nullable()->constrained('maintenance_operations')->nullOnDelete();
            $table->string('disk', 50)->default('local');
            $table->string('path')->nullable();
            $table->string('original_filename')->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->string('sha256', 64)->nullable();
            $table->string('mode', 50)->nullable();
            $table->json('options')->nullable();
            $table->json('summary')->nullable();
            $table->longText('log')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['type', 'status']);
            $table->index('expires_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('maintenance_operations');
    }
};
