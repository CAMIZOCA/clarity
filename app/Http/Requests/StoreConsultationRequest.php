<?php

namespace App\Http\Requests;

use App\Rules\ValidOpticalPrescription;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreConsultationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('consultations.create') ?? false;
    }

    public function rules(): array
    {
        return [
            // Campos principales
            'patient_id'            => ['required', 'integer', 'exists:patients,id'],
            'optometrista_id'       => ['nullable', 'integer', 'exists:users,id'],
            'fecha_consulta'        => ['required', 'date', 'before_or_equal:today'],
            'ultimo_control'        => ['nullable', 'date', 'before_or_equal:today'],
            'estado'                => ['nullable', Rule::in(['borrador', 'completada'])],
            'estado_lentes'         => ['nullable', 'string', 'max:100'],
            'motivo_consulta'       => ['nullable', 'string', 'max:1000'],
            'doctor_license'        => ['nullable', 'string', 'max:100'],
            'print_template_key'    => ['nullable', 'string', 'max:100'],

            // Agudeza visual (texto libre como 20/20, 0.5, etc.)
            'av_lectura_od'         => ['nullable', 'string', 'max:20'],
            'av_lectura_oi'         => ['nullable', 'string', 'max:20'],
            'avsc_od'               => ['nullable', 'string', 'max:20'],
            'avsc_oi'               => ['nullable', 'string', 'max:20'],
            'avsc_cerca_od'         => ['nullable', 'string', 'max:20'],
            'avsc_cerca_oi'         => ['nullable', 'string', 'max:20'],
            'retinoscopia_od'       => ['nullable', 'string', 'max:100'],
            'retinoscopia_oi'       => ['nullable', 'string', 'max:100'],
            'avcc_od'               => ['nullable', 'string', 'max:20'],
            'avcc_oi'               => ['nullable', 'string', 'max:20'],
            'avcc_cerca_od'         => ['nullable', 'string', 'max:20'],
            'avcc_cerca_oi'         => ['nullable', 'string', 'max:20'],

            // Retinoscopia por componentes
            'retinoscopia_esfera_od'   => ['nullable', 'numeric', new ValidOpticalPrescription('sphere')],
            'retinoscopia_esfera_oi'   => ['nullable', 'numeric', new ValidOpticalPrescription('sphere')],
            'retinoscopia_cilindro_od' => ['nullable', 'numeric', new ValidOpticalPrescription('cylinder')],
            'retinoscopia_cilindro_oi' => ['nullable', 'numeric', new ValidOpticalPrescription('cylinder')],
            'retinoscopia_eje_od'      => ['nullable', 'numeric', new ValidOpticalPrescription('axis')],
            'retinoscopia_eje_oi'      => ['nullable', 'numeric', new ValidOpticalPrescription('axis')],
            'retinoscopia_ppc'         => ['nullable', 'string', 'max:50'],

            // RX en uso
            'rx_uso_esfera_od'      => ['nullable', 'numeric', new ValidOpticalPrescription('sphere')],
            'rx_uso_cilindro_od'    => ['nullable', 'numeric', new ValidOpticalPrescription('cylinder')],
            'rx_uso_eje_od'         => ['nullable', 'numeric', new ValidOpticalPrescription('axis')],
            'rx_uso_add_od'         => ['nullable', 'numeric', new ValidOpticalPrescription('add')],
            'rx_uso_avcc_od'        => ['nullable', 'string', 'max:20'],
            'rx_uso_esfera_oi'      => ['nullable', 'numeric', new ValidOpticalPrescription('sphere')],
            'rx_uso_cilindro_oi'    => ['nullable', 'numeric', new ValidOpticalPrescription('cylinder')],
            'rx_uso_eje_oi'         => ['nullable', 'numeric', new ValidOpticalPrescription('axis')],
            'rx_uso_add_oi'         => ['nullable', 'numeric', new ValidOpticalPrescription('add')],
            'rx_uso_avcc_oi'        => ['nullable', 'string', 'max:20'],

            // Subjetivo
            'subj_esfera_od'        => ['nullable', 'numeric', new ValidOpticalPrescription('sphere')],
            'subj_cilindro_od'      => ['nullable', 'numeric', new ValidOpticalPrescription('cylinder')],
            'subj_eje_od'           => ['nullable', 'numeric', new ValidOpticalPrescription('axis')],
            'subj_avl_od'           => ['nullable', 'string', 'max:20'],
            'subj_tipo_od'          => ['nullable', 'string', 'max:50'],
            'subj_esfera_oi'        => ['nullable', 'numeric', new ValidOpticalPrescription('sphere')],
            'subj_cilindro_oi'      => ['nullable', 'numeric', new ValidOpticalPrescription('cylinder')],
            'subj_eje_oi'           => ['nullable', 'numeric', new ValidOpticalPrescription('axis')],
            'subj_avl_oi'           => ['nullable', 'string', 'max:20'],
            'subj_tipo_oi'          => ['nullable', 'string', 'max:50'],
            'subj_add_od'           => ['nullable', 'numeric', new ValidOpticalPrescription('add')],
            'subj_add_oi'           => ['nullable', 'numeric', new ValidOpticalPrescription('add')],
            'subj_avc_od'           => ['nullable', 'string', 'max:20'],
            'subj_avc_oi'           => ['nullable', 'string', 'max:20'],
            'subj_dp'               => ['nullable', 'numeric', 'min:40', 'max:80'],

            // RX final
            'rx_final_esfera_od'    => ['nullable', 'numeric', new ValidOpticalPrescription('sphere')],
            'rx_final_cilindro_od'  => ['nullable', 'numeric', new ValidOpticalPrescription('cylinder')],
            'rx_final_eje_od'       => ['nullable', 'numeric', new ValidOpticalPrescription('axis')],
            'rx_final_add_od'       => ['nullable', 'numeric', new ValidOpticalPrescription('add')],
            'rx_final_avl_od'       => ['nullable', 'string', 'max:20'],
            'rx_final_prisma_od'    => ['nullable', 'numeric', new ValidOpticalPrescription('prism')],
            'rx_final_base_od'      => ['nullable', 'string', 'max:20'],
            'rx_final_dnp_od'       => ['nullable', 'numeric', 'min:20', 'max:40'],
            'rx_final_esfera_oi'    => ['nullable', 'numeric', new ValidOpticalPrescription('sphere')],
            'rx_final_cilindro_oi'  => ['nullable', 'numeric', new ValidOpticalPrescription('cylinder')],
            'rx_final_eje_oi'       => ['nullable', 'numeric', new ValidOpticalPrescription('axis')],
            'rx_final_add_oi'       => ['nullable', 'numeric', new ValidOpticalPrescription('add')],
            'rx_final_avl_oi'       => ['nullable', 'string', 'max:20'],
            'rx_final_prisma_oi'    => ['nullable', 'numeric', new ValidOpticalPrescription('prism')],
            'rx_final_base_oi'      => ['nullable', 'string', 'max:20'],
            'rx_final_dnp_oi'       => ['nullable', 'numeric', 'min:20', 'max:40'],

            // Visión de cerca
            'vc_esfera_od'          => ['nullable', 'numeric', new ValidOpticalPrescription('sphere')],
            'vc_cilindro_od'        => ['nullable', 'numeric', new ValidOpticalPrescription('cylinder')],
            'vc_eje_od'             => ['nullable', 'numeric', new ValidOpticalPrescription('axis')],
            'vc_av_od'              => ['nullable', 'string', 'max:20'],
            'vc_dnp_od'             => ['nullable', 'numeric', 'min:20', 'max:40'],
            'vc_avcc_od'            => ['nullable', 'string', 'max:20'],
            'vc_esfera_oi'          => ['nullable', 'numeric', new ValidOpticalPrescription('sphere')],
            'vc_cilindro_oi'        => ['nullable', 'numeric', new ValidOpticalPrescription('cylinder')],
            'vc_eje_oi'             => ['nullable', 'numeric', new ValidOpticalPrescription('axis')],
            'vc_av_oi'              => ['nullable', 'string', 'max:20'],
            'vc_dnp_oi'             => ['nullable', 'numeric', 'min:20', 'max:40'],
            'vc_avcc_oi'            => ['nullable', 'string', 'max:20'],
            'near_vision_data'      => ['nullable', 'array'],

            // Queratometría
            'queratometria_od'              => ['nullable', 'string', 'max:100'],
            'queratometria_oi'              => ['nullable', 'string', 'max:100'],
            'queratometria_horizontal_od'   => ['nullable', 'numeric'],
            'queratometria_horizontal_oi'   => ['nullable', 'numeric'],
            'queratometria_vertical_od'     => ['nullable', 'numeric'],
            'queratometria_vertical_oi'     => ['nullable', 'numeric'],
            'queratometria_eje_od'          => ['nullable', 'numeric', 'min:0', 'max:180'],
            'queratometria_eje_oi'          => ['nullable', 'numeric', 'min:0', 'max:180'],
            'queratometria_miras_od'        => ['nullable', 'string', 'max:100'],
            'queratometria_miras_oi'        => ['nullable', 'string', 'max:100'],
            'queratometria_calificacion'    => ['nullable', 'string', 'max:50'],

            // ARK
            'ark_od'                => ['nullable', 'string', 'max:100'],
            'ark_oi'                => ['nullable', 'string', 'max:100'],

            // Morfoscópica
            'morfoscopica_lejos_od' => ['nullable', 'string', 'max:100'],
            'morfoscopica_lejos_oi' => ['nullable', 'string', 'max:100'],
            'morfoscopica_cerca_od' => ['nullable', 'string', 'max:100'],
            'morfoscopica_cerca_oi' => ['nullable', 'string', 'max:100'],

            // PH
            'ph_od'                 => ['nullable', 'string', 'max:20'],
            'ph_oi'                 => ['nullable', 'string', 'max:20'],

            // Examen externo
            'examen_externo_od'     => ['nullable', 'string'],
            'examen_externo_oi'     => ['nullable', 'string'],
            'vision_colores'        => ['nullable', 'string', 'max:50'],
            'lente_anterior'        => ['nullable', 'string'],

            // Pruebas binoculares
            'ducciones_od'          => ['nullable', 'string', 'max:100'],
            'ducciones_oi'          => ['nullable', 'string', 'max:100'],
            'versiones'             => ['nullable', 'string', 'max:100'],
            'ppc'                   => ['nullable', 'string', 'max:100'],
            'cover_test'            => ['nullable', 'string', 'max:100'],
            'reflejos_pupilares'    => ['nullable', 'string', 'max:100'],
            'test_hirschberg'       => ['nullable', 'string', 'max:100'],
            'motor_binocular_data'  => ['nullable', 'array'],

            // Certificado
            'certificado_diagnostico_od' => ['nullable', 'string'],
            'certificado_diagnostico_oi' => ['nullable', 'string'],
            'certificado_nota'           => ['nullable', 'string'],

            // Lunas / lente recetada
            'luna_material'         => ['nullable', 'string', 'max:100'],
            'luna_espesor'          => ['nullable', 'string', 'max:100'],
            'luna_proteccion'       => ['nullable', 'string', 'max:100'],
            'luna_observacion'      => ['nullable', 'string'],

            // Diagnóstico
            'diagnostico_cie10'         => ['nullable', 'string', 'max:20'],
            'diagnostico_descripcion'   => ['nullable', 'string', 'max:500'],
            'diagnostico_adicional'     => ['nullable', 'string'],

            // Datos comerciales
            'costo_total'               => ['nullable', 'numeric', 'min:0'],
            'abono'                     => ['nullable', 'numeric', 'min:0'],
            'estado_cancelado'          => ['nullable', 'boolean'],
            'tipo_lentes'               => ['nullable', 'string', 'max:100'],
            'color_lentes'              => ['nullable', 'string', 'max:100'],
            'bifocal'                   => ['nullable', 'string', 'max:100'],
            'espesor'                   => ['nullable', 'string', 'max:100'],
            'laboratorio_pedido'        => ['nullable', 'string', 'max:150'],
            'pedido_armazon'            => ['nullable', 'string', 'max:150'],
            'fecha_entrega'             => ['nullable', 'date', 'after_or_equal:today'],
            'observacion_pedidos'       => ['nullable', 'string'],

            // Texto libre
            'recomendaciones'           => ['nullable', 'string'],
            'observaciones'             => ['nullable', 'string'],

            // Módulos relacionales
            'diagnoses'                                 => ['nullable', 'array'],
            'diagnoses.*.eye'                           => ['nullable', Rule::in(['od', 'oi', 'general'])],
            'diagnoses.*.catalog_item_id'               => ['nullable', 'integer', 'exists:clinical_catalog_items,id'],
            'diagnoses.*.code'                          => ['nullable', 'string', 'max:50'],
            'diagnoses.*.description'                   => ['required_with:diagnoses', 'string', 'max:255'],
            'diagnoses.*.notes'                         => ['nullable', 'string'],

            'recommendations_list'                      => ['nullable', 'array'],
            'recommendations_list.*.catalog_item_id'    => ['nullable', 'integer', 'exists:clinical_catalog_items,id'],
            'recommendations_list.*.text'               => ['required_with:recommendations_list', 'string'],

            'lens_recommendation'                       => ['nullable', 'array'],
            'lens_recommendation.material_item_id'      => ['nullable', 'integer', 'exists:clinical_catalog_items,id'],
            'lens_recommendation.thickness_item_id'     => ['nullable', 'integer', 'exists:clinical_catalog_items,id'],
            'lens_recommendation.protection_item_id'    => ['nullable', 'integer', 'exists:clinical_catalog_items,id'],
            'lens_recommendation.observation'           => ['nullable', 'string'],

            'contact_lens_module'                       => ['nullable', 'array'],
            'contact_lens_module.ojo_dominante'         => ['nullable', Rule::in(['OD', 'OI'])],
            'contact_lens_module.test_lens'             => ['nullable', 'array'],
            'contact_lens_module.final_lens'            => ['nullable', 'array'],

            'ophthalmoscopy_module'                     => ['nullable', 'array'],
            'ophthalmoscopy_module.results'             => ['nullable', 'array'],

            'treatment_module'                          => ['nullable', 'array'],
        ];
    }

    public function messages(): array
    {
        return [
            'patient_id.required'               => 'Debe seleccionar un paciente para la consulta.',
            'patient_id.exists'                 => 'El paciente seleccionado no existe en el sistema.',
            'optometrista_id.exists'             => 'El optómetra seleccionado no existe.',
            'fecha_consulta.required'            => 'La fecha de la consulta es obligatoria.',
            'fecha_consulta.before_or_equal'     => 'La fecha de consulta no puede ser futura.',
            'ultimo_control.before_or_equal'     => 'La fecha del último control no puede ser futura.',
            'estado.in'                          => 'El estado debe ser "borrador" o "completada".',
            'fecha_entrega.after_or_equal'       => 'La fecha de entrega debe ser hoy o posterior.',
            'costo_total.min'                    => 'El costo total no puede ser negativo.',
            'abono.min'                          => 'El abono no puede ser negativo.',
            'diagnoses.*.description.required_with' => 'Cada diagnóstico debe incluir una descripción.',
            'recommendations_list.*.text.required_with' => 'Cada recomendación debe incluir un texto.',
            'subj_dp.min'                        => 'La distancia pupilar debe ser de al menos 40 mm.',
            'subj_dp.max'                        => 'La distancia pupilar no puede ser mayor a 80 mm.',
        ];
    }

    protected function prepareForValidation(): void
    {
        // Convertir comas a puntos en campos numéricos de receta
        $numericFields = [
            'retinoscopia_esfera_od', 'retinoscopia_esfera_oi',
            'retinoscopia_cilindro_od', 'retinoscopia_cilindro_oi',
            'retinoscopia_eje_od', 'retinoscopia_eje_oi',
            'rx_uso_esfera_od', 'rx_uso_cilindro_od', 'rx_uso_eje_od', 'rx_uso_add_od',
            'rx_uso_esfera_oi', 'rx_uso_cilindro_oi', 'rx_uso_eje_oi', 'rx_uso_add_oi',
            'subj_esfera_od', 'subj_cilindro_od', 'subj_eje_od',
            'subj_esfera_oi', 'subj_cilindro_oi', 'subj_eje_oi',
            'subj_add_od', 'subj_add_oi', 'subj_dp',
            'rx_final_esfera_od', 'rx_final_cilindro_od', 'rx_final_eje_od', 'rx_final_add_od',
            'rx_final_prisma_od', 'rx_final_dnp_od',
            'rx_final_esfera_oi', 'rx_final_cilindro_oi', 'rx_final_eje_oi', 'rx_final_add_oi',
            'rx_final_prisma_oi', 'rx_final_dnp_oi',
            'vc_esfera_od', 'vc_cilindro_od', 'vc_eje_od', 'vc_dnp_od',
            'vc_esfera_oi', 'vc_cilindro_oi', 'vc_eje_oi', 'vc_dnp_oi',
            'costo_total', 'abono',
        ];

        $normalized = [];
        foreach ($numericFields as $field) {
            $val = $this->input($field);
            if ($val !== null && $val !== '') {
                $normalized[$field] = str_replace(',', '.', (string) $val);
            }
        }

        if (!empty($normalized)) {
            $this->merge($normalized);
        }
    }
}
