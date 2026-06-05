<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('demo_requests', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('company', 160);
            $table->string('email', 160);
            $table->string('phone', 40);
            $table->string('city', 120)->nullable();
            $table->string('branches_count', 20)->nullable();
            $table->json('interests')->nullable();
            $table->text('message')->nullable();
            $table->boolean('privacy_accepted')->default(false);
            $table->string('status', 30)->default('new');
            $table->string('source', 80)->default('landing');
            $table->string('ip_hash', 128)->nullable();
            $table->string('user_agent', 500)->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();

            $table->index(['email', 'created_at']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('demo_requests');
    }
};
