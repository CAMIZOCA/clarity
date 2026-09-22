<?php

namespace App\Http\Requests;

use App\Rules\ValidOpticalPrescription;
use App\Support\OpticalValueNormalizer;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreConsultationRequest extends FormRequest
{
    /** Sufijo de campo -> tipo de medida óptica, para normalizar y para el mapa de rx_uso_entries. */
    private const OPTICAL_FIELD_TYPES = [
        'retinoscopia_esfera_od' => 'sphere', 'retinoscopia_esfera_oi' => 'sphere',
        'retinoscopia_cilindro_od' => 'cylinder', 'retinoscopia_cilindro_oi' => 'cylinder',
        'retinoscopia_eje_od' => 'axis', 'retinoscopia_eje_oi' => 'axis',
        'rx_uso_esfera_od' => 'sphere', 'rx_uso_cilindro_od' => 'cylinder', 'rx_uso_eje_od' => 'axis', 'rx_uso_add_od' => 'add',
        'rx_uso_esfera_oi' => 'sphere', 'rx_uso_cilindro_oi' => 'cylinder', 'rx_uso_eje_oi' => 'axis', 'rx_uso_add_oi' => 'add',
        'subj_esfera_od' => 'sphere', 'subj_cilindro_od' => 'cylinder', 'subj_eje_od' => 'axis',
        'subj_esfera_oi' => 'sphere', 'subj_cilindro_oi' => 'cylinder', 'subj_eje_oi' => 'axis',
        'subj_add_od' => 'add', 'subj_add_oi' => 'add',
        'rx_final_esfera_od' => 'sphere', 'rx_final_cilindro_od' => 'cylinder', 'rx_final_eje_od' => 'axis', 'rx_final_add_od' => 'add',
        'rx_final_esfera_oi' => 'sphere', 'rx_final_cilindro_oi' => 'cylinder', 'rx_final_eje_oi' => 'axis', 'rx_final_add_oi' => 'add',
        'vc_esfera_od' => 'sphere', 'vc_cilindro_od' => 'cylinder', 'vc_eje_od' => 'axis',
        'vc_esfera_oi' => 'sphere', 'vc_cilindro_oi' => 'cylinder', 'vc_eje_oi' => 'axis',
    ];

    /** Mismo mapa para las columnas de cada fila de `rx_uso_entries`. */
    private const RX_USO_ENTRY_FIELD_TYPES = [
        'esfera_od' => 'sphere', 'cilindro_od' => 'cylinder', 'eje_od' => 'axis', 'add_od' => 'add',
        'esfera_oi' => 'sphere', 'cilindro_oi' => 'cylinder', 'eje_oi' => 'axis', 'add_oi' => 'add',
    ];

    public function authorize(): bool
    {
        return $this->user()?->can('consultations.create') ?? false;
    }

    public function rules(): array
    {
        $rules = [
            // Campos principales
            'patient_id' => ['required', 'integer', 'exists:patients,id'],
            'optometrista_id' => ['nullable', 'integer', 'exists:users,id'],
            'fecha_consulta' => ['required', 'date', 'before_or_equal:today'],
            'ultimo_control' => ['nullable', 'date', 'before_or_equal:today'],
            'estado' => ['nullable', Rule::in(['borrador', 'completada'])],
            'estado_lentes' => ['nullable', 'string', 'max:100'],
            'motivo_consulta' => ['nullable', 'string', 'max:1000'],
            'doctor_license' => ['nullable', 'string', 'max:100'],
            'print_template_key' => ['nullable', 'string', 'max:100'],

            // Agudeza visual (texto libre como 20/20, 0.5, etc.)
            'av_lectura_od' => ['nullable', 'string', 'max:20'],
            'av_lectura_oi' => ['nullable', 'string', 'max:20'],
            'avsc_od' => ['nullable', 'string', 'max:20'],
            'avsc_oi' => ['nullable', 'string', 'max:20'],
            'avsc_cerca_od' => ['nullable', 'string', 'max:20'],
            'avsc_cerca_oi' => ['nullable', 'string', 'max:20'],
            'retinoscopia_od' => ['nullable', 'string', 'max:100'],
            'retinoscopia_oi' => ['nullable', 'string', 'max:100'],
            'avcc_od' => ['nullable', 'string', 'max:20'],
            'avcc_oi' => ['nullable', 'string', 'max:20'],
            'avcc_cerca_od' => ['nullable', 'string', 'max:20'],
            'avcc_cerca_oi' => ['nullable', 'string', 'max:20'],

            // Retinoscopia por componentes
            'retinoscopia_esfera_od' => ['nullable', 'numeric', new ValidOpticalPrescription('sphere')],
            'retinoscopia_esfera_oi' => ['nullable', 'numeric', new ValidOpticalPrescription('sphere')],
            'retinoscopia_cilindro_od' => ['nullable', 'numeric', new ValidOpticalPrescription('cylinder')],
            'retinoscopia_cilindro_oi' => ['nullable', 'numeric', new ValidOpticalPrescription('cylinder')],
            'retinoscopia_eje_od' => ['nullable', 'numeric', new ValidOpticalPrescription('axis')],
            'retinoscopia_eje_oi' => ['nullable', 'numeric', new ValidOpticalPrescription('axis')],
            'retinoscopia_ppc' => ['nullable', 'string', 'max:50'],

            // RX en uso
            'rx_uso_esfera_od' => ['nullable', new ValidOpticalPrescription('sphere', allowNeutral: true)],
            'rx_uso_cilindro_od' => ['nullable', 'numeric', new ValidOpticalPrescription('cylinder')],
            'rx_uso_eje_od' => ['nullable', 'numeric', new ValidOpticalPrescription('axis')],
            'rx_uso_add_od' => ['nullable', 'numeric', new ValidOpticalPrescription('add')],
            'rx_uso_avcc_od' => ['nullable', 'string', 'max:20'],
            'rx_uso_esfera_oi' => ['nullable', new ValidOpticalPrescription('sphere', allowNeutral: true)],
            'rx_uso_cilindro_oi' => ['nullable', 'numeric', new ValidOpticalPrescription('cylinder')],
            'rx_uso_eje_oi' => ['nullable', 'numeric', new ValidOpticalPrescription('axis')],
            'rx_uso_add_oi' => ['nullable', 'numeric', new ValidOpticalPrescription('add')],
            'rx_uso_avcc_oi' => ['nullable', 'string', 'max:20'],

            // RX en uso: 0..N recetas, cada una con observacion
            'rx_uso_entries' => ['nullable', 'array', 'max:10'],
            'rx_uso_entries.*.esfera_od' => ['nullable', new ValidOpticalPrescription('sphere', allowNeutral: true)],
            'rx_uso_entries.*.cilindro_od' => ['nullable', 'numeric', new ValidOpticalPrescription('cylinder')],
            'rx_uso_entries.*.eje_od' => ['nullable', 'numeric', new ValidOpticalPrescription('axis')],
            'rx_uso_entries.*.add_od' => ['nullable', 'numeric', new ValidOpticalPrescription('add')],
            'rx_uso_entries.*.avcc_od' => ['nullable', 'string', 'max:20'],
            'rx_uso_entries.*.esfera_oi' => ['nullable', new ValidOpticalPrescription('sphere', allowNeutral: true)],
            'rx_uso_entries.*.cilindro_oi' => ['nullable', 'numeric', new ValidOpticalPrescription('cylinder')],
            'rx_uso_entries.*.eje_oi' => ['nullable', 'numeric', new ValidOpticalPrescription('axis')],
            'rx_uso_entries.*.add_oi' => ['nullable', 'numeric', new ValidOpticalPrescription('add')],
            'rx_uso_entries.*.avcc_oi' => ['nullable', 'string', 'max:20'],
            'rx_uso_entries.*.observacion' => ['nullable', 'string', 'max:2000'],

            // Subjetivo
            'subj_esfera_od' => ['nullable', new ValidOpticalPrescription('sphere', allowNeutral: true)],
            'subj_cilindro_od' => ['nullable', 'numeric', new ValidOpticalPrescription('cylinder')],
            'subj_eje_od' => ['nullable', 'numeric', new ValidOpticalPrescription('axis')],
            'subj_avl_od' => ['nullable', 'string', 'max:20'],
            'subj_tipo_od' => ['nullable', 'string', 'max:50'],
            'subj_esfera_oi' => ['nullable', new ValidOpticalPrescription('sphere', allowNeutral: true)],
            'subj_cilindro_oi' => ['nullable', 'numeric', new ValidOpticalPrescription('cylinder')],
            'subj_eje_oi' => ['nullable', 'numeric', new ValidOpticalPrescription('axis')],
            'subj_avl_oi' => ['nullable', 'string', 'max:20'],
            'subj_tipo_oi' => ['nullable', 'string', 'max:50'],
            'subj_add_od' => ['nullable', 'numeric', new ValidOpticalPrescription('add')],
            'subj_add_oi' => ['nullable', 'numeric', new ValidOpticalPrescription('add')],
            'subj_avc_od' => ['nullable', 'string', 'max:20'],
            'subj_avc_oi' => ['nullable', 'string', 'max:20'],
            'subj_dp' => ['nullable', 'numeric', 'min:40', 'max:80'],

            // RX final
            'rx_final_esfera_od' => ['nullable', new ValidOpticalPrescription('sphere', allowNeutral: true)],
            'rx_final_cilindro_od' => ['nullable', 'numeric', new ValidOpticalPrescription('cylinder')],
            'rx_final_eje_od' => ['nullable', 'numeric', new ValidOpticalPrescription('axis')],
            'rx_final_add_od' => ['nullable', 'numeric', new ValidOpticalPrescription('add')],
            'rx_final_prisma_od' => ['nullable', 'string', 'max:20'],
            'rx_final_base_od' => ['nullable', 'string', 'max:20'],
            'rx_final_dnp_od' => ['nullable', 'string', 'max:20'],
            'rx_final_esfera_oi' => ['nullable', new ValidOpticalPrescription('sphere', allowNeutral: true)],
            'rx_final_cilindro_oi' => ['nullable', 'numeric', new ValidOpticalPrescription('cylinder')],
            'rx_final_eje_oi' => ['nullable', 'numeric', new ValidOpticalPrescription('axis')],
            'rx_final_add_oi' => ['nullable', 'numeric', new ValidOpticalPrescription('add')],
            'rx_final_prisma_oi' => ['nullable', 'string', 'max:20'],
            'rx_final_base_oi' => ['nullable', 'string', 'max:20'],
            'rx_final_dnp_oi' => ['nullable', 'string', 'max:20'],
            'rx_final_distancia_od' => ['nullable', 'string', 'max:50'],
            'rx_final_distancia_oi' => ['nullable', 'string', 'max:50'],
            'rx_final_av_od' => ['nullable', 'string', 'max:20'],
            'rx_final_av_oi' => ['nullable', 'string', 'max:20'],
            'rx_final_observaciones' => ['nullable', 'string', 'max:2000'],

            // Visión de cerca
            'vc_esfera_od' => ['nullable', new ValidOpticalPrescription('sphere', allowNeutral: true)],
            'vc_cilindro_od' => ['nullable', 'numeric', new ValidOpticalPrescription('cylinder')],
            'vc_eje_od' => ['nullable', 'numeric', new ValidOpticalPrescription('axis')],
            'vc_av_od' => ['nullable', 'string', 'max:20'],
            'vc_dnp_od' => ['nullable', 'string', 'max:20'],
            'vc_avcc_od' => ['nullable', 'string', 'max:20'],
            'vc_esfera_oi' => ['nullable', new ValidOpticalPrescription('sphere', allowNeutral: true)],
            'vc_cilindro_oi' => ['nullable', 'numeric', new ValidOpticalPrescription('cylinder')],
            'vc_eje_oi' => ['nullable', 'numeric', new ValidOpticalPrescription('axis')],
            'vc_av_oi' => ['nullable', 'string', 'max:20'],
            'vc_dnp_oi' => ['nullable', 'string', 'max:20'],
            'vc_avcc_oi' => ['nullable', 'string', 'max:20'],
            'near_vision_data' => ['nullable', 'array'],

            // Queratometría
            'queratometria_od' => ['nullable', 'string', 'max:100'],
            'queratometria_oi' => ['nullable', 'string', 'max:100'],
            'queratometria_horizontal_od' => ['nullable', 'numeric'],
            'queratometria_horizontal_oi' => ['nullable', 'numeric'],
            'queratometria_vertical_od' => ['nullable', 'numeric'],
            'queratometria_vertical_oi' => ['nullable', 'numeric'],
            'queratometria_eje_od' => ['nullable', 'numeric', 'min:0', 'max:180'],
            'queratometria_eje_oi' => ['nullable', 'numeric', 'min:0', 'max:180'],
            'queratometria_miras_od' => ['nullable', 'string', 'max:100'],
            'queratometria_miras_oi' => ['nullable', 'string', 'max:100'],
            'queratometria_calificacion' => ['nullable', 'string', 'max:50'],

            // ARK
            'ark_od' => ['nullable', 'string', 'max:100'],
            'ark_oi' => ['nullable', 'string', 'max:100'],

            // Morfoscópica
            'morfoscopica_lejos_od' => ['nullable', 'string', 'max:100'],
            'morfoscopica_lejos_oi' => ['nullable', 'string', 'max:100'],
            'morfoscopica_cerca_od' => ['nullable', 'string', 'max:100'],
            'morfoscopica_cerca_oi' => ['nullable', 'string', 'max:100'],

            // PH
            'ph_od' => ['nullable', 'string', 'max:20'],
            'ph_oi' => ['nullable', 'string', 'max:20'],

            // Examen externo
            'examen_externo_od' => ['nullable', 'string'],
            'examen_externo_oi' => ['nullable', 'string'],
            'vision_colores' => ['nullable', 'string', 'max:50'],
            'lente_anterior' => ['nullable', 'string'],

            // Pruebas binoculares
            'ducciones_od' => ['nullable', 'string', 'max:100'],
            'ducciones_oi' => ['nullable', 'string', 'max:100'],
            'versiones' => ['nullable', 'string', 'max:100'],
            'ppc' => ['nullable', 'string', 'max:100'],
            'cover_test' => ['nullable', 'string', 'max:100'],
            'reflejos_pupilares' => ['nullable', 'string', 'max:100'],
            'test_hirschberg' => ['nullable', 'string', 'max:100'],
            'motor_binocular_data' => ['nullable', 'array'],

            // Certificado
            'certificado_diagnostico_od' => ['nullable', 'string'],
            'certificado_diagnostico_oi' => ['nullable', 'string'],
            'certificado_nota' => ['nullable', 'string'],

            // Lunas / lente recetada
            'luna_material' => ['nullable', 'string', 'max:100'],
            'luna_espesor' => ['nullable', 'string', 'max:100'],
            'luna_proteccion' => ['nullable', 'string', 'max:100'],
            'luna_observacion' => ['nullable', 'string'],

            // Diagnóstico
            'diagnostico_cie10' => ['nullable', 'string', 'max:20'],
            'diagnostico_descripcion' => ['nullable', 'string', 'max:500'],
            'diagnostico_adicional' => ['nullable', 'string'],

            // Datos comerciales
            'costo_total' => ['nullable', 'numeric', 'min:0'],
            'abono' => ['nullable', 'numeric', 'min:0'],
            'estado_cancelado' => ['nullable', 'boolean'],
            'tipo_lentes' => ['nullable', 'string', 'max:100'],
            'color_lentes' => ['nullable', 'string', 'max:100'],
            'bifocal' => ['nullable', 'string', 'max:100'],
            'espesor' => ['nullable', 'string', 'max:100'],
            'laboratorio_pedido' => ['nullable', 'string', 'max:150'],
            'pedido_armazon' => ['nullable', 'string', 'max:150'],
            'fecha_entrega' => ['nullable', 'date', 'after_or_equal:today'],
            'observacion_pedidos' => ['nullable', 'string'],

            // Texto libre
            'recomendaciones' => ['nullable', 'string'],
            'observaciones' => ['nullable', 'string'],

            // Módulos relacionales
            'diagnoses' => ['nullable', 'array'],
            'diagnoses.*.eye' => ['nullable', Rule::in(['od', 'oi', 'general'])],
            'diagnoses.*.catalog_item_id' => ['nullable', 'integer', 'exists:clinical_catalog_items,id'],
            'diagnoses.*.code' => ['nullable', 'string', 'max:50'],
            'diagnoses.*.description' => ['nullable', 'string', 'max:255'],
            'diagnoses.*.notes' => ['nullable', 'string'],

            'recommendations_list' => ['nullable', 'array'],
            'recommendations_list.*.catalog_item_id' => ['nullable', 'integer', 'exists:clinical_catalog_items,id'],
            'recommendations_list.*.text' => [$this->isDraft() ? 'nullable' : 'required_with:recommendations_list', 'string'],

            'lens_recommendation' => ['nullable', 'array'],
            'lens_recommendation.material_item_id' => ['nullable', 'integer', 'exists:clinical_catalog_items,id'],
            'lens_recommendation.thickness_item_id' => ['nullable', 'integer', 'exists:clinical_catalog_items,id'],
            'lens_recommendation.protection_item_id' => ['nullable', 'integer', 'exists:clinical_catalog_items,id'],
            'lens_recommendation.observation' => ['nullable', 'string'],

            'contact_lens_module' => ['nullable', 'array'],
            'contact_lens_module.ojo_dominante' => ['nullable', Rule::in(['OD', 'OI'])],
            'contact_lens_module.test_lens' => ['nullable', 'array'],
            'contact_lens_module.final_lens' => ['nullable', 'array'],

            'ophthalmoscopy_module' => ['nullable', 'array'],
            'ophthalmoscopy_module.results' => ['nullable', 'array'],

            'treatment_module' => ['nullable', 'array'],

            // Venta / productos vendidos en la consulta (no impacta caja ni inventario)
            'sale_items' => ['nullable', 'array'],
            'sale_items.*.tipo' => ['nullable', 'string', 'max:50'],
            'sale_items.*.descripcion' => ['nullable', 'string'],
            'sale_items.*.precio' => ['nullable', 'numeric', 'min:0'],
            'sale_items.*.descuento_pct' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'sale_items.*.total' => ['nullable', 'numeric', 'min:0'],
            'sale_items.*.nota' => ['nullable', 'string'],
        ];

        $rules = $this->applyDynamicDiagnosisDescriptionRules($rules);

        return $this->relaxOpticalRangesForDraft($rules);
    }

    public function messages(): array
    {
        return [
            'patient_id.required' => 'Debe seleccionar un paciente para la consulta.',
            'patient_id.exists' => 'El paciente seleccionado no existe en el sistema.',
            'optometrista_id.exists' => 'El optómetra seleccionado no existe.',
            'fecha_consulta.required' => 'La fecha de la consulta es obligatoria.',
            'fecha_consulta.before_or_equal' => 'La fecha de consulta no puede ser futura.',
            'ultimo_control.before_or_equal' => 'La fecha del último control no puede ser futura.',
            'estado.in' => 'El estado debe ser "borrador" o "completada".',
            'fecha_entrega.after_or_equal' => 'La fecha de entrega debe ser hoy o posterior.',
            'costo_total.min' => 'El costo total no puede ser negativo.',
            'abono.min' => 'El abono no puede ser negativo.',
            'diagnoses.*.description.required' => 'Cada diagnóstico debe incluir una descripción o un ítem de catálogo.',
            'recommendations_list.*.text.required_with' => 'Cada recomendación debe incluir un texto.',
            'subj_dp.min' => 'La distancia pupilar debe ser de al menos 40 mm.',
            'subj_dp.max' => 'La distancia pupilar no puede ser mayor a 80 mm.',
        ];
    }

    /**
     * Nombres legibles para los mensajes de error, incluyendo las filas
     * indexadas de `rx_uso_entries` (Laravel no interpola el índice real de
     * un atributo definido con comodín `*`).
     */
    public function attributes(): array
    {
        $attributes = [
            'patient_id' => 'Paciente',
            'fecha_consulta' => 'Fecha de consulta',
            'optometrista_id' => 'Médico / Optometrista',
            'rx_uso_esfera_od' => 'RX en uso · Esfera OD',
            'rx_uso_cilindro_od' => 'RX en uso · Cilindro OD',
            'rx_uso_eje_od' => 'RX en uso · Eje OD',
            'rx_uso_add_od' => 'RX en uso · ADD OD',
            'rx_uso_esfera_oi' => 'RX en uso · Esfera OI',
            'rx_uso_cilindro_oi' => 'RX en uso · Cilindro OI',
            'rx_uso_eje_oi' => 'RX en uso · Eje OI',
            'rx_uso_add_oi' => 'RX en uso · ADD OI',
            'subj_esfera_od' => 'Subjetivo · Esfera OD',
            'subj_cilindro_od' => 'Subjetivo · Cilindro OD',
            'subj_eje_od' => 'Subjetivo · Eje OD',
            'subj_esfera_oi' => 'Subjetivo · Esfera OI',
            'subj_cilindro_oi' => 'Subjetivo · Cilindro OI',
            'subj_eje_oi' => 'Subjetivo · Eje OI',
            'subj_add_od' => 'Subjetivo · ADD OD',
            'subj_add_oi' => 'Subjetivo · ADD OI',
            'subj_dp' => 'Subjetivo · Distancia pupilar',
            'rx_final_esfera_od' => 'RX Final · Esfera OD',
            'rx_final_cilindro_od' => 'RX Final · Cilindro OD',
            'rx_final_eje_od' => 'RX Final · Eje OD',
            'rx_final_add_od' => 'RX Final · ADD OD',
            'rx_final_esfera_oi' => 'RX Final · Esfera OI',
            'rx_final_cilindro_oi' => 'RX Final · Cilindro OI',
            'rx_final_eje_oi' => 'RX Final · Eje OI',
            'rx_final_add_oi' => 'RX Final · ADD OI',
            'vc_esfera_od' => 'Visión de cerca · Esfera OD',
            'vc_cilindro_od' => 'Visión de cerca · Cilindro OD',
            'vc_eje_od' => 'Visión de cerca · Eje OD',
            'vc_esfera_oi' => 'Visión de cerca · Esfera OI',
            'vc_cilindro_oi' => 'Visión de cerca · Cilindro OI',
            'vc_eje_oi' => 'Visión de cerca · Eje OI',
            'diagnoses.*.description' => 'Descripción del diagnóstico',
            'recommendations_list.*.text' => 'Texto de la recomendación',
        ];

        foreach ((array) $this->input('rx_uso_entries', []) as $index => $entry) {
            $label = 'RX en uso '.($index + 1);
            foreach (array_keys(self::RX_USO_ENTRY_FIELD_TYPES) as $column) {
                [$field, $eye] = [substr($column, 0, strrpos($column, '_')), strtoupper(substr($column, strrpos($column, '_') + 1))];
                $attributes["rx_uso_entries.{$index}.{$column}"] = "{$label} · ".ucfirst($field)." {$eye}";
            }
        }

        return $attributes;
    }

    protected function prepareForValidation(): void
    {
        // Los mensajes de validacion de este formulario se muestran en espanol,
        // sin afectar el locale del resto de la app.
        app()->setLocale('es');

        $normalized = [];
        foreach (self::OPTICAL_FIELD_TYPES as $field => $type) {
            $val = $this->input($field);
            if ($val !== null && $val !== '') {
                $normalized[$field] = OpticalValueNormalizer::normalize((string) $val, $type);
            }
        }

        // Campos numericos que no son medidas opticas: solo necesitan coma -> punto.
        foreach (['subj_dp', 'costo_total', 'abono'] as $field) {
            $val = $this->input($field);
            if ($val !== null && $val !== '') {
                $normalized[$field] = str_replace(',', '.', (string) $val);
            }
        }

        if (! empty($normalized)) {
            $this->merge($normalized);
        }

        $this->normalizeRxUsoEntries();
        $this->dropEmptyModuleRows();
    }

    /**
     * Un borrador no exige diagnosticos ni recomendaciones completos.
     *
     * El formulario nace con dos filas de diagnostico y una de recomendacion en
     * blanco, y el autoguardado dispara cada 30 s mientras el usuario escribe:
     * con `required_with` fijo, guardar un borrador intacto respondia 422.
     */
    protected function isDraft(): bool
    {
        return $this->input('estado') === 'borrador';
    }

    /**
     * Un borrador nunca debe fallar por rango clinico ni por formato invalido
     * de una medida optica.
     *
     * El normalizador ya corrige el formato (`025` -> `0.25`) antes de llegar
     * aqui, asi que en la practica esto solo cubre un valor realmente fuera de
     * rango (ej. esfera "999") tecleado por error: se sigue exigiendo que sea
     * numerico (o "N" donde aplica) para no intentar guardar texto arbitrario
     * en una columna decimal, pero deja de exigirse el rango clinico.
     */
    protected function relaxOpticalRangesForDraft(array $rules): array
    {
        if (! $this->isDraft()) {
            return $rules;
        }

        foreach ($rules as $field => $fieldRules) {
            if (! is_array($fieldRules)) {
                continue;
            }

            $rules[$field] = collect($fieldRules)
                ->map(fn ($rule) => $rule instanceof ValidOpticalPrescription ? $rule->withoutRange() : $rule)
                ->all();
        }

        return $rules;
    }

    /**
     * La descripcion de un diagnostico no es obligatoria si la fila ya trae
     * un item de catalogo (que aporta su propia etiqueta).
     */
    private function applyDynamicDiagnosisDescriptionRules(array $rules): array
    {
        $diagnoses = $this->input('diagnoses');
        if (! is_array($diagnoses)) {
            return $rules;
        }

        foreach ($diagnoses as $index => $row) {
            if (! is_array($row)) {
                continue;
            }

            $required = ! $this->isDraft() && blank($row['catalog_item_id'] ?? null);
            $rules["diagnoses.{$index}.description"] = [$required ? 'required' : 'nullable', 'string', 'max:255'];
        }

        return $rules;
    }

    /**
     * Descarta las filas de diagnostico y recomendacion totalmente vacias.
     *
     * Se hace antes de validar para que `required_with` solo mire filas en las
     * que el usuario efectivamente escribio algo.
     */
    private function dropEmptyModuleRows(): void
    {
        $isBlank = fn ($value) => $value === null || (is_string($value) && trim($value) === '');

        $diagnoses = $this->input('diagnoses');
        if (is_array($diagnoses)) {
            $this->merge(['diagnoses' => array_values(array_filter(
                $diagnoses,
                fn ($row) => ! is_array($row) || ! (
                    $isBlank($row['description'] ?? null)
                    && $isBlank($row['code'] ?? null)
                    && $isBlank($row['notes'] ?? null)
                    && $isBlank($row['catalog_item_id'] ?? null)
                )
            ))]);
        }

        $recommendations = $this->input('recommendations_list');
        if (is_array($recommendations)) {
            $this->merge(['recommendations_list' => array_values(array_filter(
                $recommendations,
                fn ($row) => ! is_array($row) || ! (
                    $isBlank($row['text'] ?? null)
                    && $isBlank($row['catalog_item_id'] ?? null)
                )
            ))]);
        }

        $saleItems = $this->input('sale_items');
        if (is_array($saleItems)) {
            $this->merge(['sale_items' => array_values(array_filter(
                $saleItems,
                fn ($row) => ! is_array($row) || ! (
                    $isBlank($row['descripcion'] ?? null)
                    && $isBlank($row['precio'] ?? null)
                    && $isBlank($row['total'] ?? null)
                    && $isBlank($row['nota'] ?? null)
                )
            ))]);
        }
    }

    /** Misma normalizacion de medidas opticas para las recetas en uso anidadas. */
    private function normalizeRxUsoEntries(): void
    {
        $entries = $this->input('rx_uso_entries');
        if (! is_array($entries)) {
            return;
        }

        foreach ($entries as $index => $entry) {
            if (! is_array($entry)) {
                continue;
            }

            foreach (self::RX_USO_ENTRY_FIELD_TYPES as $field => $type) {
                $value = $entry[$field] ?? null;
                if ($value !== null && $value !== '') {
                    $entries[$index][$field] = OpticalValueNormalizer::normalize((string) $value, $type);
                }
            }
        }

        $this->merge(['rx_uso_entries' => $entries]);
    }
}
