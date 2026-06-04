<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('consultation_diagnoses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('consultation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('catalog_item_id')->nullable()->constrained('clinical_catalog_items')->nullOnDelete();
            $table->string('eye', 5)->nullable();
            $table->string('code', 50)->nullable();
            $table->string('description');
            $table->text('notes')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('consultation_recommendations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('consultation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('catalog_item_id')->nullable()->constrained('clinical_catalog_items')->nullOnDelete();
            $table->text('text');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('consultation_lens_recommendations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('consultation_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('material_item_id')->nullable()->constrained('clinical_catalog_items')->nullOnDelete();
            $table->foreignId('thickness_item_id')->nullable()->constrained('clinical_catalog_items')->nullOnDelete();
            $table->foreignId('protection_item_id')->nullable()->constrained('clinical_catalog_items')->nullOnDelete();
            $table->text('observation')->nullable();
            $table->timestamps();
        });

        Schema::create('consultation_contact_lens_modules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('consultation_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('diametro_pupilar', 50)->nullable();
            $table->string('diametro_corneal', 50)->nullable();
            $table->string('apertura_palpebral', 50)->nullable();
            $table->string('tension_palpebral', 50)->nullable();
            $table->string('ojo_dominante', 10)->nullable();
            $table->string('but_value', 50)->nullable();
            $table->string('shirmer_test', 50)->nullable();
            $table->string('frecuencia_parpadeo', 50)->nullable();
            $table->text('observaciones')->nullable();
            $table->json('test_lens')->nullable();
            $table->json('final_lens')->nullable();
            $table->timestamps();
        });

        Schema::create('consultation_ophthalmoscopy_modules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('consultation_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('fijacion_od', 100)->nullable();
            $table->string('fijacion_oi', 100)->nullable();
            $table->string('valoracion_motora', 100)->nullable();
            $table->string('ppc_obj', 100)->nullable();
            $table->string('luz', 100)->nullable();
            $table->string('fr', 100)->nullable();
            $table->json('results')->nullable();
            $table->timestamps();
        });

        Schema::create('consultation_treatment_modules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('consultation_id')->unique()->constrained()->cascadeOnDelete();
            $table->text('plan')->nullable();
            $table->string('horas_uso', 100)->nullable();
            $table->string('metodo_limpieza', 100)->nullable();
            $table->string('modalidad_uso', 100)->nullable();
            $table->timestamps();
        });

        Schema::create('print_templates', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->json('sections')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('print_templates');
        Schema::dropIfExists('consultation_treatment_modules');
        Schema::dropIfExists('consultation_ophthalmoscopy_modules');
        Schema::dropIfExists('consultation_contact_lens_modules');
        Schema::dropIfExists('consultation_lens_recommendations');
        Schema::dropIfExists('consultation_recommendations');
        Schema::dropIfExists('consultation_diagnoses');
    }
};
