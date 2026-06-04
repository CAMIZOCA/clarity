<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('consultations', function (Blueprint $table) {
            // Identificación legacy
            $table->string('legacy_id', 50)->nullable()->index()->after('id')
                ->comment('ID del sistema anterior (para importación)');

            // Estado de lentes (no existía en el sistema)
            $table->string('estado_lentes', 50)->nullable()->after('estado');

            // Agudeza visual cercana sin/con corrección (el sistema solo tenía lejos)
            $table->string('avsc_cerca_od', 20)->nullable()->after('avsc_oi');
            $table->string('avsc_cerca_oi', 20)->nullable()->after('avsc_cerca_od');
            $table->string('avcc_cerca_od', 20)->nullable()->after('avcc_oi');
            $table->string('avcc_cerca_oi', 20)->nullable()->after('avcc_cerca_od');

            // Retinoscopia por componentes (antes solo había string combinado)
            $table->string('retinoscopia_esfera_od', 20)->nullable()->after('retinoscopia_oi');
            $table->string('retinoscopia_esfera_oi', 20)->nullable()->after('retinoscopia_esfera_od');
            $table->string('retinoscopia_cilindro_od', 20)->nullable()->after('retinoscopia_esfera_oi');
            $table->string('retinoscopia_cilindro_oi', 20)->nullable()->after('retinoscopia_cilindro_od');
            $table->string('retinoscopia_eje_od', 20)->nullable()->after('retinoscopia_cilindro_oi');
            $table->string('retinoscopia_eje_oi', 20)->nullable()->after('retinoscopia_eje_od');
            $table->string('retinoscopia_ppc', 50)->nullable()->after('retinoscopia_eje_oi');

            // Queratometría por componentes (antes solo había string combinado)
            $table->string('queratometria_horizontal_od', 20)->nullable()->after('queratometria_oi');
            $table->string('queratometria_horizontal_oi', 20)->nullable()->after('queratometria_horizontal_od');
            $table->string('queratometria_vertical_od', 20)->nullable()->after('queratometria_horizontal_oi');
            $table->string('queratometria_vertical_oi', 20)->nullable()->after('queratometria_vertical_od');
            $table->string('queratometria_eje_od', 20)->nullable()->after('queratometria_vertical_oi');
            $table->string('queratometria_eje_oi', 20)->nullable()->after('queratometria_eje_od');
            $table->string('queratometria_miras_od', 50)->nullable()->after('queratometria_eje_oi');
            $table->string('queratometria_miras_oi', 50)->nullable()->after('queratometria_miras_od');
            $table->string('queratometria_calificacion', 50)->nullable()->after('queratometria_miras_oi');

            // Subjetivo/RXPARCIAL — campos adicionales que faltaban
            $table->string('subj_add_od', 20)->nullable()->after('subj_tipo_oi');
            $table->string('subj_add_oi', 20)->nullable()->after('subj_add_od');
            $table->string('subj_avc_od', 20)->nullable()->after('subj_add_oi');
            $table->string('subj_avc_oi', 20)->nullable()->after('subj_avc_od');
            $table->string('subj_dp', 20)->nullable()->after('subj_avc_oi');

            // Campos clínicos adicionales
            $table->string('ark_od', 50)->nullable()->after('queratometria_calificacion')
                ->comment('Auto-refractómetro/Queratómetro automático OD');
            $table->string('ark_oi', 50)->nullable()->after('ark_od');
            $table->string('morfoscopica_lejos_od', 50)->nullable()->after('ark_oi');
            $table->string('morfoscopica_lejos_oi', 50)->nullable()->after('morfoscopica_lejos_od');
            $table->string('morfoscopica_cerca_od', 50)->nullable()->after('morfoscopica_lejos_oi');
            $table->string('morfoscopica_cerca_oi', 50)->nullable()->after('morfoscopica_cerca_od');
            $table->string('ph_od', 20)->nullable()->after('morfoscopica_cerca_oi')
                ->comment('Agujero estenopeico OD');
            $table->string('ph_oi', 20)->nullable()->after('ph_od');
            $table->string('certificado_diagnostico_od', 100)->nullable()->after('ph_oi');
            $table->string('certificado_diagnostico_oi', 100)->nullable()->after('certificado_diagnostico_od');
            $table->text('certificado_nota')->nullable()->after('certificado_diagnostico_oi');

            // Datos comerciales / pedido de lentes
            $table->decimal('costo_total', 10, 2)->nullable()->after('certificado_nota');
            $table->decimal('abono', 10, 2)->nullable()->after('costo_total');
            $table->boolean('estado_cancelado')->nullable()->after('abono');
            $table->string('tipo_lentes', 100)->nullable()->after('estado_cancelado');
            $table->string('color_lentes', 50)->nullable()->after('tipo_lentes');
            $table->string('bifocal', 50)->nullable()->after('color_lentes');
            $table->string('espesor', 100)->nullable()->after('bifocal');
            $table->string('laboratorio_pedido', 100)->nullable()->after('espesor');
            $table->string('pedido_armazon', 100)->nullable()->after('laboratorio_pedido');
            $table->date('fecha_entrega')->nullable()->after('pedido_armazon');
            $table->text('observacion_pedidos')->nullable()->after('fecha_entrega');
        });
    }

    public function down(): void
    {
        Schema::table('consultations', function (Blueprint $table) {
            $table->dropColumn([
                'legacy_id', 'estado_lentes',
                'avsc_cerca_od', 'avsc_cerca_oi', 'avcc_cerca_od', 'avcc_cerca_oi',
                'retinoscopia_esfera_od', 'retinoscopia_esfera_oi',
                'retinoscopia_cilindro_od', 'retinoscopia_cilindro_oi',
                'retinoscopia_eje_od', 'retinoscopia_eje_oi', 'retinoscopia_ppc',
                'queratometria_horizontal_od', 'queratometria_horizontal_oi',
                'queratometria_vertical_od', 'queratometria_vertical_oi',
                'queratometria_eje_od', 'queratometria_eje_oi',
                'queratometria_miras_od', 'queratometria_miras_oi', 'queratometria_calificacion',
                'subj_add_od', 'subj_add_oi', 'subj_avc_od', 'subj_avc_oi', 'subj_dp',
                'ark_od', 'ark_oi',
                'morfoscopica_lejos_od', 'morfoscopica_lejos_oi',
                'morfoscopica_cerca_od', 'morfoscopica_cerca_oi',
                'ph_od', 'ph_oi',
                'certificado_diagnostico_od', 'certificado_diagnostico_oi', 'certificado_nota',
                'costo_total', 'abono', 'estado_cancelado',
                'tipo_lentes', 'color_lentes', 'bifocal', 'espesor',
                'laboratorio_pedido', 'pedido_armazon', 'fecha_entrega', 'observacion_pedidos',
            ]);
        });
    }
};
