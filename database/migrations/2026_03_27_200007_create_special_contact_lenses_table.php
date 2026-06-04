<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('special_contact_lenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->foreignId('optometrista_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('tipo', 50); // esclerales, ortoqueratologia, queratocono
            // OD
            $table->decimal('radio_base_od', 6, 3)->nullable();
            $table->decimal('diametro_od', 6, 2)->nullable();
            $table->decimal('potencia_od', 5, 2)->nullable();
            $table->string('material_od', 100)->nullable();
            // OI
            $table->decimal('radio_base_oi', 6, 3)->nullable();
            $table->decimal('diametro_oi', 6, 2)->nullable();
            $table->decimal('potencia_oi', 5, 2)->nullable();
            $table->string('material_oi', 100)->nullable();
            // Follow-up
            $table->date('fecha_adaptacion');
            $table->text('seguimiento')->nullable();
            $table->date('proxima_revision')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('special_contact_lenses');
    }
};
