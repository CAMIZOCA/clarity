<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Siembra el setting `advanced_form_fields` con los campos que, según el
     * llenado histórico (<10%), se ocultan por defecto en una zona "Avanzado".
     * El administrador puede ajustarlos en Ajustes → Campos avanzados. Mantener
     * esta lista alineada con DEFAULT_ADVANCED_FORM_FIELDS de
     * resources/js/data/formFieldsOptions.js.
     */
    public function up(): void
    {
        DB::table('settings')->updateOrInsert(
            ['key' => 'advanced_form_fields'],
            [
                'value' => json_encode([
                    'consulta:sec_motor_binocular',
                    'consulta:sec_lentes_contacto',
                    'consulta:sec_oftalmoscopia',
                    'consulta:sec_tratamiento',
                    'consulta:ultimo_control',
                    'consulta:col_avsc',
                    'consulta:col_avcc',
                    'consulta:rx_uso_cilindro',
                    'consulta:rx_uso_avcc',
                    'consulta:subj_esfera',
                    'consulta:subj_eje',
                    'consulta:subj_avl',
                    'consulta:rx_final_avl',
                    'consulta:rx_final_prisma',
                    'consulta:rx_final_base',
                    'consulta:grp_vision_cerca',
                    'consulta:lente_anterior',
                    'consulta:queratometria',
                    'consulta:examen_externo',
                    'consulta:vision_colores',
                    'consulta:diagnostico_adicional',
                    'paciente:antecedentes',
                    'orden_trabajo:especificaciones',
                    'orden_trabajo:laboratorio_extra',
                    'producto:subcategoria',
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
    }

    public function down(): void
    {
        DB::table('settings')->where('key', 'advanced_form_fields')->delete();
    }
};
