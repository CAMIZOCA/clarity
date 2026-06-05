<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\Concerns\ApiResponses;
use App\Http\Requests\StoreConsultationRequest;
use App\Http\Requests\UpdateConsultationRequest;
use App\Models\Consultation;
use App\Services\ConsultationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Validation\ValidationException;

class ConsultationController extends Controller
{
    use ApiResponses;

    public function __construct(
        protected ConsultationService $consultationService,
    ) {}

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

    public function store(StoreConsultationRequest $request): JsonResponse
    {
        $data = $request->validated();

        // Validar contenido clínico antes de marcar como completada
        $state = $request->input('estado', 'borrador');
        if ($state === 'completada' && ! $this->hasClinicalContent($request->all())) {
            throw ValidationException::withMessages([
                'estado' => 'Agregue al menos un dato clinico antes de completar la consulta.',
            ]);
        }

        // Incluir campos adicionales no cubiertos por el Form Request base
        $data = $data + Arr::only($request->all(), $this->extraFields());

        $consultation = $this->consultationService->create($data, $request->user()->id);

        return response()->json($this->consultationService->loadConsultation($consultation), 201);
    }

    public function show(Consultation $consultation): JsonResponse
    {
        return response()->json($this->consultationService->loadConsultation($consultation));
    }

    public function update(UpdateConsultationRequest $request, Consultation $consultation): JsonResponse
    {
        $data = $request->validated();

        // Incluir campos adicionales no cubiertos por el Form Request base
        $data = $data + Arr::only($request->all(), $this->extraFields());

        $this->consultationService->update($consultation, $data, $request->user()->id);

        return response()->json($this->consultationService->loadConsultation($consultation));
    }

    public function destroy(Consultation $consultation): JsonResponse
    {
        $this->consultationService->delete($consultation);

        return response()->json(['message' => 'Consulta eliminada.']);
    }

    public function pdfData(Consultation $consultation): JsonResponse
    {
        return response()->json($this->consultationService->generatePdfData($consultation));
    }

    /**
     * Lista de campos adicionales que el Form Request no captura con validated()
     * pero que deben pasarse al servicio.
     */
    private function extraFields(): array
    {
        return [
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
        ];
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
