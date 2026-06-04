<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('consultations', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('numero_consulta')->default(1);
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->foreignId('optometrista_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('fecha_consulta');
            $table->string('estado', 20)->default('borrador'); // borrador, completada

            // === AGUDEZA VISUAL ===
            $table->string('av_lectura_od', 20)->nullable();
            $table->string('av_lectura_oi', 20)->nullable();
            $table->string('avsc_od', 20)->nullable(); // Sin corrección lejos
            $table->string('avsc_oi', 20)->nullable();
            $table->string('retinoscopia_od', 20)->nullable();
            $table->string('retinoscopia_oi', 20)->nullable();
            $table->string('avcc_od', 20)->nullable(); // Con corrección lejos
            $table->string('avcc_oi', 20)->nullable();

            // === RX EN USO ===
            $table->decimal('rx_uso_esfera_od', 5, 2)->nullable();
            $table->decimal('rx_uso_cilindro_od', 5, 2)->nullable();
            $table->integer('rx_uso_eje_od')->nullable();
            $table->decimal('rx_uso_add_od', 5, 2)->nullable();
            $table->string('rx_uso_avcc_od', 20)->nullable();
            $table->decimal('rx_uso_esfera_oi', 5, 2)->nullable();
            $table->decimal('rx_uso_cilindro_oi', 5, 2)->nullable();
            $table->integer('rx_uso_eje_oi')->nullable();
            $table->decimal('rx_uso_add_oi', 5, 2)->nullable();
            $table->string('rx_uso_avcc_oi', 20)->nullable();

            // === SUBJETIVO / LENTES DE CONTACTO ===
            $table->decimal('subj_esfera_od', 5, 2)->nullable();
            $table->decimal('subj_cilindro_od', 5, 2)->nullable();
            $table->integer('subj_eje_od')->nullable();
            $table->string('subj_avl_od', 20)->nullable();
            $table->string('subj_tipo_od', 50)->nullable(); // LC blanda, LC rígida, LC especial
            $table->decimal('subj_esfera_oi', 5, 2)->nullable();
            $table->decimal('subj_cilindro_oi', 5, 2)->nullable();
            $table->integer('subj_eje_oi')->nullable();
            $table->string('subj_avl_oi', 20)->nullable();
            $table->string('subj_tipo_oi', 50)->nullable();

            // === RX FINAL ===
            $table->decimal('rx_final_esfera_od', 5, 2)->nullable();
            $table->decimal('rx_final_cilindro_od', 5, 2)->nullable();
            $table->integer('rx_final_eje_od')->nullable();
            $table->decimal('rx_final_add_od', 5, 2)->nullable();
            $table->string('rx_final_avl_od', 20)->nullable();
            $table->string('rx_final_prisma_od', 20)->nullable();
            $table->string('rx_final_base_od', 20)->nullable();
            $table->string('rx_final_dnp_od', 20)->nullable();
            $table->decimal('rx_final_esfera_oi', 5, 2)->nullable();
            $table->decimal('rx_final_cilindro_oi', 5, 2)->nullable();
            $table->integer('rx_final_eje_oi')->nullable();
            $table->decimal('rx_final_add_oi', 5, 2)->nullable();
            $table->string('rx_final_avl_oi', 20)->nullable();
            $table->string('rx_final_prisma_oi', 20)->nullable();
            $table->string('rx_final_base_oi', 20)->nullable();
            $table->string('rx_final_dnp_oi', 20)->nullable();

            // === VISIÓN DE CERCA ===
            $table->decimal('vc_esfera_od', 5, 2)->nullable();
            $table->decimal('vc_cilindro_od', 5, 2)->nullable();
            $table->integer('vc_eje_od')->nullable();
            $table->string('vc_av_od', 20)->nullable();
            $table->string('vc_dnp_od', 20)->nullable();
            $table->string('vc_avcc_od', 20)->nullable();
            $table->decimal('vc_esfera_oi', 5, 2)->nullable();
            $table->decimal('vc_cilindro_oi', 5, 2)->nullable();
            $table->integer('vc_eje_oi')->nullable();
            $table->string('vc_av_oi', 20)->nullable();
            $table->string('vc_dnp_oi', 20)->nullable();
            $table->string('vc_avcc_oi', 20)->nullable();

            // === LENTE ANTERIOR ===
            $table->text('lente_anterior')->nullable();

            // === QUERATOMETRÍA ===
            $table->string('queratometria_od', 100)->nullable();
            $table->string('queratometria_oi', 100)->nullable();

            // === EXAMEN EXTERNO ===
            $table->text('examen_externo_od')->nullable();
            $table->text('examen_externo_oi')->nullable();

            // === VISIÓN DE COLORES ===
            $table->string('vision_colores', 30)->nullable(); // e.g. 14/14

            // === PRUEBAS BINOCULARES ===
            $table->string('ducciones_od', 100)->nullable();
            $table->string('ducciones_oi', 100)->nullable();
            $table->string('versiones', 100)->nullable();
            $table->string('ppc', 100)->nullable();
            $table->string('cover_test', 100)->nullable();
            $table->string('reflejos_pupilares', 100)->nullable();
            $table->string('test_hirschberg', 100)->nullable();

            // === RECOMENDACIÓN DE LUNAS ===
            $table->string('luna_material', 100)->nullable(); // CR-39, policarbonato, trivex, etc.
            $table->string('luna_espesor', 100)->nullable();  // monofocal, bifocal, progresivo, ocupacional
            $table->string('luna_proteccion', 100)->nullable(); // antirreflejo, UV, fotocromático, etc.
            $table->text('luna_observacion')->nullable();

            // === DIAGNÓSTICO ===
            $table->string('diagnostico_cie10', 20)->nullable();
            $table->string('diagnostico_descripcion', 255)->nullable();
            $table->text('diagnostico_adicional')->nullable();

            // === TEXTO LIBRE ===
            $table->text('recomendaciones')->nullable();
            $table->text('observaciones')->nullable();

            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('consultations');
    }
};
