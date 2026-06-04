<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clinical_catalog_groups', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('clinical_catalog_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('group_id')->constrained('clinical_catalog_groups')->cascadeOnDelete();
            $table->string('key')->nullable();
            $table->string('code', 50)->nullable();
            $table->string('label');
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['group_id', 'is_active', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clinical_catalog_items');
        Schema::dropIfExists('clinical_catalog_groups');
    }
};
