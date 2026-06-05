<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\Concerns\ApiResponses;
use App\Http\Requests\StorePatientRequest;
use App\Http\Requests\UpdatePatientRequest;
use App\Http\Resources\PatientCollection;
use App\Http\Resources\PatientResource;
use App\Models\Patient;
use App\Services\PatientService;
use App\Support\AppConfig;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PatientController extends Controller
{
    use ApiResponses;

    public function __construct(
        protected PatientService $patientService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = [];

        if ($q = trim($request->input('q', ''))) {
            $filters['search'] = $q;
        }

        $patients = $this->patientService->paginate($filters, AppConfig::PATIENTS_PER_PAGE);

        return response()->json(new PatientCollection($patients));
    }

    public function search(Request $request): JsonResponse
    {
        $q = trim($request->input('q', ''));

        if (strlen($q) < 2) {
            return response()->json([]);
        }

        $patients = $this->patientService->search($q, 15);

        $result = $patients->map(fn ($p) => array_merge($p->toArray(), ['edad' => $p->edad]));

        return response()->json($result);
    }

    public function store(StorePatientRequest $request): JsonResponse
    {
        $patient = $this->patientService->create($request->validated(), $request->user()->id);

        return (new PatientResource($patient))
            ->response()
            ->setStatusCode(201);
    }

    public function show(Patient $patient): JsonResponse
    {
        $patient->loadCount('consultations');

        return (new PatientResource($patient))->response();
    }

    public function update(UpdatePatientRequest $request, Patient $patient): JsonResponse
    {
        $patient = $this->patientService->update($patient, $request->validated());

        return (new PatientResource($patient))->response();
    }

    public function destroy(Patient $patient): JsonResponse
    {
        $this->patientService->delete($patient);

        return $this->noContent();
    }

    public function consultations(Patient $patient): JsonResponse
    {
        $consultations = $patient->consultations()
            ->with('optometrista:id,name')
            ->orderByDesc('fecha_consulta')
            ->get();

        return response()->json($consultations);
    }

    public function lastConsultation(Patient $patient): JsonResponse
    {
        $consultation = $patient->consultations()
            ->where('estado', 'completada')
            ->with('optometrista:id,name')
            ->latest('fecha_consulta')
            ->first();

        return response()->json(['data' => $consultation]);
    }
}
