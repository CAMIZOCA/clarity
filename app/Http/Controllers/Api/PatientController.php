<?php

namespace App\Http\Controllers\Api;

use App\Enums\Permission;
use App\Http\Controllers\Api\Concerns\ApiResponses;
use App\Http\Controllers\Controller;
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

        $filters['sort'] = $request->input('sort') === PatientService::SORT_NOMBRE
            ? PatientService::SORT_NOMBRE
            : PatientService::SORT_ULTIMA_CONSULTA;

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

        $result = $patients->map(fn ($p) => array_merge($p->toArray(), [
            'edad' => $p->edad,
            'nombre_completo' => $p->nombre_completo,
        ]));

        return response()->json($result);
    }

    /**
     * Verificacion previa al alta: la cedula ya registrada y los nombres parecidos.
     * GET /api/patients/lookup?cedula=&nombre=&apellido=&exclude={pacienteId}
     */
    public function lookup(Request $request): JsonResponse
    {
        $exclude = $request->integer('exclude') ?: null;
        $cedula = trim((string) $request->input('cedula', ''));
        $nombre = trim((string) $request->input('nombre', ''));
        $apellido = trim((string) $request->input('apellido', ''));

        $data = $cedula !== ''
            ? $this->patientService->lookupByDocument($cedula, $exclude)
            : ['cedula' => '', 'estado' => null, 'mensaje' => null, 'paciente' => null, 'relacionados' => []];

        $data['similares'] = $nombre.$apellido !== ''
            ? $this->patientService->findSimilarByName($nombre, $apellido, $exclude)
            : [];

        return response()->json(['data' => $data]);
    }

    /**
     * Datos del titular de una cedula sin registrar, para llenar el alta.
     * GET /api/patients/identity?cedula=
     *
     * Siempre responde 200: sin datos (API sin saldo, caida, cedula ya
     * registrada) el formulario se llena a mano y no hay error que mostrar.
     */
    public function identity(Request $request): JsonResponse
    {
        abort_unless($request->user()->can(Permission::PATIENTS_CREATE->value), 403);

        $person = $this->patientService->suggestIdentity((string) $request->input('cedula', ''));

        return response()->json(['data' => [
            'encontrado' => $person !== null,
            'nombre' => $person['nombre'] ?? null,
            'apellido' => $person['apellido'] ?? null,
            'fecha_nacimiento' => $person['fecha_nacimiento'] ?? null,
        ]]);
    }

    /**
     * Restaurar un paciente eliminado.
     * POST /api/patients/{id}/restore
     */
    public function restore(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->can(Permission::PATIENTS_DELETE->value), 403);

        $patient = $this->patientService->restore(Patient::onlyTrashed()->findOrFail($id));

        return (new PatientResource($patient))->response();
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

    /**
     * RX final de las ultimas consultas, para copiarla a "RX en uso".
     * GET /api/patients/{patient}/rx-history?exclude={consultaId}&limit=5
     */
    public function rxHistory(Request $request, Patient $patient): JsonResponse
    {
        $history = $this->patientService->rxHistory(
            $patient,
            $request->integer('exclude') ?: null,
            $request->integer('limit') ?: PatientService::RX_HISTORY_LIMIT,
        );

        return response()->json(['data' => $history]);
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
