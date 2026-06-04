<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Consultation;
use App\Models\ClinicalCatalogItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ConsultationController extends Controller
{
    protected array $numericFields = [
        'rx_uso_esfera_od', 'rx_uso_cilindro_od', 'rx_uso_eje_od', 'rx_uso_add_od',
        'rx_uso_esfera_oi', 'rx_uso_cilindro_oi', 'rx_uso_eje_oi', 'rx_uso_add_oi',
        'subj_esfera_od', 'subj_cilindro_od', 'subj_eje_od',
        'subj_esfera_oi', 'subj_cilindro_oi', 'subj_eje_oi',
        'rx_final_esfera_od', 'rx_final_cilindro_od', 'rx_final_eje_od', 'rx_final_add_od',
        'rx_final_esfera_oi', 'rx_final_cilindro_oi', 'rx_final_eje_oi', 'rx_final_add_oi',
        'vc_esfera_od', 'vc_cilindro_od', 'vc_eje_od',
        'vc_esfera_oi', 'vc_cilindro_oi', 'vc_eje_oi',
    ];

    public function index(Request $request): JsonResponse
    {
        $query = Consultation::with(['patient:id,nombre,cedula,codigo_interno', 'optometrista:id,name'])
            ->orderByDesc('fecha_consulta');

        if ($patientId = $request->input('patient_id')) {
            $query->where('patient_id', $patientId);
        }
        if ($from = $request->input('from')) {
            $query->whereDate('fecha_consulta', '>=', $from);
        }
        if ($to = $request->input('to')) {
            $query->whereDate('fecha_consulta', '<=', $to);
        }

        return response()->json($query->paginate(20));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validatePayload($request, false);

        $consultation = DB::transaction(function () use ($request, $data) {
            $attributes = $this->extractConsultationAttributes($data);
            $attributes['optometrista_id'] = $attributes['optometrista_id'] ?? $request->user()->id;
            $attributes['created_by'] = $request->user()->id;
            $attributes['updated_by'] = $request->user()->id;

            $consultation = Consultation::create($attributes);
            $this->syncModules($consultation, $data);

            return $consultation;
        });

        return response()->json($this->loadConsultation($consultation), 201);
    }

    public function show(Consultation $consultation): JsonResponse
    {
        return response()->json($this->loadConsultation($consultation));
    }

    public function update(Request $request, Consultation $consultation): JsonResponse
    {
        $data = $this->validatePayload($request, true);

        DB::transaction(function () use ($request, $consultation, $data) {
            $attributes = $this->extractConsultationAttributes($data);
            $attributes['updated_by'] = $request->user()->id;

            $consultation->update($attributes);
            $this->syncModules($consultation, $data);
        });

        return response()->json($this->loadConsultation($consultation));
    }

    public function destroy(Consultation $consultation): JsonResponse
    {
        $consultation->delete();

        return response()->json(['message' => 'Consulta eliminada.']);
    }

    public function pdfData(Consultation $consultation): JsonResponse
    {
        $consultation = $this->loadConsultation($consultation);

        return response()->json([
            'consultation' => $consultation,
            'patient' => $consultation->patient,
            'optometrista' => $consultation->optometrista ? array_merge(
                $consultation->optometrista->toArray(),
                ['firma_digital_url' => $consultation->optometrista->firma_digital_url]
            ) : null,
            'templates' => \App\Models\PrintTemplate::query()
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->get(['id', 'key', 'name', 'description']),
        ]);
    }

    protected function loadConsultation(Consultation $consultation): Consultation
    {
        $consultation->load([
            'patient',
            'optometrista',
            'creator:id,name',
            'updater:id,name',
            'diagnoses.catalogItem:id,label,code',
            'recommendationsList.catalogItem:id,label,code',
            'lensRecommendation.material:id,label',
            'lensRecommendation.thickness:id,label',
            'lensRecommendation.protection:id,label',
            'contactLensModule',
            'ophthalmoscopyModule',
            'treatmentModule',
        ]);

        $consultation->patient?->append('edad');

        $previous = Consultation::query()
            ->where('patient_id', $consultation->patient_id)
            ->where('id', '!=', $consultation->id)
            ->whereDate('fecha_consulta', '<=', $consultation->fecha_consulta)
            ->orderByDesc('fecha_consulta')
            ->orderByDesc('id')
            ->first([
                'id',
                'numero_consulta',
                'fecha_consulta',
                'diagnostico_cie10',
                'diagnostico_descripcion',
                'rx_final_esfera_od',
                'rx_final_cilindro_od',
                'rx_final_eje_od',
                'rx_final_esfera_oi',
                'rx_final_cilindro_oi',
                'rx_final_eje_oi',
                'observaciones',
            ]);

        $consultation->setAttribute('previous_consultation_summary', $previous);

        return $consultation;
    }

    protected function validatePayload(Request $request, bool $updating): array
    {
        $state = $request->input('estado', 'borrador');

        $rules = [
            'patient_id' => [$updating ? 'sometimes' : 'required', 'exists:patients,id'],
            'optometrista_id' => ['nullable', 'exists:users,id'],
            'fecha_consulta' => [$updating ? 'sometimes' : 'required', 'date'],
            'ultimo_control' => ['nullable', 'date'],
            'estado' => ['nullable', Rule::in(['borrador', 'completada'])],
            'motivo_consulta' => ['nullable', 'string'],
            'doctor_license' => ['nullable', 'string', 'max:100'],
            'print_template_key' => ['nullable', 'string', 'max:100'],
            'vision_colores' => ['nullable', 'string', 'max:50'],
            'lente_anterior' => ['nullable', 'string'],
            'queratometria_od' => ['nullable', 'string', 'max:100'],
            'queratometria_oi' => ['nullable', 'string', 'max:100'],
            'examen_externo_od' => ['nullable', 'string'],
            'examen_externo_oi' => ['nullable', 'string'],
            'diagnostico_adicional' => ['nullable', 'string'],
            'recomendaciones' => ['nullable', 'string'],
            'observaciones' => ['nullable', 'string'],
            'motor_binocular_data' => ['nullable', 'array'],
            'near_vision_data' => ['nullable', 'array'],
            'diagnoses' => ['nullable', 'array'],
            'diagnoses.*.eye' => ['nullable', Rule::in(['od', 'oi', 'general'])],
            'diagnoses.*.catalog_item_id' => ['nullable', 'exists:clinical_catalog_items,id'],
            'diagnoses.*.code' => ['nullable', 'string', 'max:50'],
            'diagnoses.*.description' => ['required_with:diagnoses', 'string', 'max:255'],
            'diagnoses.*.notes' => ['nullable', 'string'],
            'recommendations_list' => ['nullable', 'array'],
            'recommendations_list.*.catalog_item_id' => ['nullable', 'exists:clinical_catalog_items,id'],
            'recommendations_list.*.text' => ['required_with:recommendations_list', 'string'],
            'lens_recommendation' => ['nullable', 'array'],
            'lens_recommendation.material_item_id' => ['nullable', 'exists:clinical_catalog_items,id'],
            'lens_recommendation.thickness_item_id' => ['nullable', 'exists:clinical_catalog_items,id'],
            'lens_recommendation.protection_item_id' => ['nullable', 'exists:clinical_catalog_items,id'],
            'lens_recommendation.observation' => ['nullable', 'string'],
            'contact_lens_module' => ['nullable', 'array'],
            'contact_lens_module.ojo_dominante' => ['nullable', Rule::in(['OD', 'OI'])],
            'contact_lens_module.test_lens' => ['nullable', 'array'],
            'contact_lens_module.final_lens' => ['nullable', 'array'],
            'ophthalmoscopy_module' => ['nullable', 'array'],
            'ophthalmoscopy_module.results' => ['nullable', 'array'],
            'treatment_module' => ['nullable', 'array'],
        ];

        foreach ($this->numericFields as $field) {
            $rules[$field] = ['nullable', 'numeric'];
        }

        $data = $request->validate($rules);

        if ($state === 'completada' && ! $this->hasClinicalContent($request->all())) {
            throw ValidationException::withMessages([
                'estado' => 'Agregue al menos un dato clinico antes de completar la consulta.',
            ]);
        }

        return $data + Arr::only($request->all(), [
            'av_lectura_od', 'av_lectura_oi', 'avsc_od', 'avsc_oi',
            'retinoscopia_od', 'retinoscopia_oi', 'avcc_od', 'avcc_oi',
            'rx_uso_avcc_od', 'rx_uso_avcc_oi',
            'subj_avl_od', 'subj_tipo_od', 'subj_avl_oi', 'subj_tipo_oi',
            'rx_final_avl_od', 'rx_final_prisma_od', 'rx_final_base_od', 'rx_final_dnp_od',
            'rx_final_avl_oi', 'rx_final_prisma_oi', 'rx_final_base_oi', 'rx_final_dnp_oi',
            'vc_av_od', 'vc_dnp_od', 'vc_avcc_od', 'vc_av_oi', 'vc_dnp_oi', 'vc_avcc_oi',
            'ducciones_od', 'ducciones_oi', 'versiones', 'ppc', 'cover_test', 'reflejos_pupilares', 'test_hirschberg',
            'luna_material', 'luna_espesor', 'luna_proteccion', 'luna_observacion',
            'diagnostico_cie10', 'diagnostico_descripcion',
        ]);
    }

    protected function extractConsultationAttributes(array $data): array
    {
        return Arr::except($data, [
            'diagnoses',
            'recommendations_list',
            'lens_recommendation',
            'contact_lens_module',
            'ophthalmoscopy_module',
            'treatment_module',
        ]);
    }

    protected function syncModules(Consultation $consultation, array $data): void
    {
        if (array_key_exists('diagnoses', $data)) {
            $consultation->diagnoses()->delete();

            $diagnoses = collect($data['diagnoses'] ?? [])
                ->filter(fn ($item) => filled($item['description'] ?? null))
                ->values();

            foreach ($diagnoses as $index => $diagnosis) {
                $consultation->diagnoses()->create([
                    'catalog_item_id' => $diagnosis['catalog_item_id'] ?? null,
                    'eye' => $diagnosis['eye'] ?? 'general',
                    'code' => $diagnosis['code'] ?? null,
                    'description' => $diagnosis['description'],
                    'notes' => $diagnosis['notes'] ?? null,
                    'sort_order' => $index + 1,
                ]);
            }

            $legacy = $diagnoses->first();
            $consultation->forceFill([
                'diagnostico_cie10' => $legacy['code'] ?? null,
                'diagnostico_descripcion' => $legacy['description'] ?? null,
            ])->save();
        }

        if (array_key_exists('recommendations_list', $data)) {
            $consultation->recommendationsList()->delete();

            $recommendations = collect($data['recommendations_list'] ?? [])
                ->filter(fn ($item) => filled($item['text'] ?? null))
                ->values();

            foreach ($recommendations as $index => $recommendation) {
                $consultation->recommendationsList()->create([
                    'catalog_item_id' => $recommendation['catalog_item_id'] ?? null,
                    'text' => $recommendation['text'],
                    'sort_order' => $index + 1,
                ]);
            }

            $consultation->forceFill([
                'recomendaciones' => $recommendations->pluck('text')->implode("\n"),
            ])->save();
        }

        if (array_key_exists('lens_recommendation', $data)) {
            $payload = Arr::whereNotNull($data['lens_recommendation'] ?? []);
            $consultation->lensRecommendation()->updateOrCreate(
                ['consultation_id' => $consultation->id],
                $payload
            );

            $itemLabels = ClinicalCatalogItem::query()
                ->whereIn('id', array_filter([
                    $payload['material_item_id'] ?? null,
                    $payload['thickness_item_id'] ?? null,
                    $payload['protection_item_id'] ?? null,
                ]))
                ->pluck('label', 'id');

            $consultation->forceFill([
                'luna_material' => $itemLabels[$payload['material_item_id'] ?? 0] ?? null,
                'luna_espesor' => $itemLabels[$payload['thickness_item_id'] ?? 0] ?? null,
                'luna_proteccion' => $itemLabels[$payload['protection_item_id'] ?? 0] ?? null,
                'luna_observacion' => $payload['observation'] ?? null,
            ])->save();
        }

        if (array_key_exists('contact_lens_module', $data)) {
            $consultation->contactLensModule()->updateOrCreate(
                ['consultation_id' => $consultation->id],
                $data['contact_lens_module'] ?? []
            );
        }

        if (array_key_exists('ophthalmoscopy_module', $data)) {
            $consultation->ophthalmoscopyModule()->updateOrCreate(
                ['consultation_id' => $consultation->id],
                $data['ophthalmoscopy_module'] ?? []
            );
        }

        if (array_key_exists('treatment_module', $data)) {
            $consultation->treatmentModule()->updateOrCreate(
                ['consultation_id' => $consultation->id],
                $data['treatment_module'] ?? []
            );
        }
    }

    protected function hasClinicalContent(array $payload): bool
    {
        $ignored = [
            'patient_id', 'optometrista_id', 'fecha_consulta', 'estado', 'doctor_license',
            'print_template_key', 'created_by', 'updated_by',
        ];

        foreach ($payload as $key => $value) {
            if (in_array($key, $ignored, true)) {
                continue;
            }

            if (is_array($value) && ! empty(array_filter(Arr::flatten($value), fn ($item) => filled($item)))) {
                return true;
            }

            if (! is_array($value) && filled($value)) {
                return true;
            }
        }

        return false;
    }
}
