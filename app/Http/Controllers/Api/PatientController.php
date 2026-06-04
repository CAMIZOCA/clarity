<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Patient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PatientController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Patient::withCount('consultations');

        if ($q = trim($request->input('q', ''))) {
            $ftsQuery = $this->buildFtsQuery($q);
            $query->whereRaw(
                "patients.id IN (SELECT rowid FROM patients_fts WHERE patients_fts MATCH ?)",
                [$ftsQuery]
            );
        }

        $patients = $query->orderBy('nombre')->paginate(25);

        return response()->json($patients);
    }

    public function search(Request $request): JsonResponse
    {
        $q = trim($request->input('q', ''));

        if (strlen($q) < 2) {
            return response()->json([]);
        }

        $ftsQuery = $this->buildFtsQuery($q);
        $patients = Patient::whereRaw(
            "id IN (SELECT rowid FROM patients_fts WHERE patients_fts MATCH ?)",
            [$ftsQuery]
        )
            ->select('id', 'nombre', 'cedula', 'codigo_interno', 'fecha_nacimiento', 'ocupacion', 'direccion', 'antecedentes')
            ->limit(10)
            ->get()
            ->map(fn($p) => array_merge($p->toArray(), ['edad' => $p->edad]));

        return response()->json($patients);
    }

    private function buildFtsQuery(string $q): string
    {
        $clean = preg_replace('/[^a-zA-Z0-9áéíóúÁÉÍÓÚàèìòùäëïöüñÑ\s]/u', ' ', $q);
        $words = array_filter(explode(' ', trim($clean)));

        return empty($words) ? '""' : implode(' ', array_map(fn($w) => $w . '*', $words));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nombre' => 'required|string|max:255',
            'cedula' => 'required|string|max:20|unique:patients',
            'codigo_interno' => 'nullable|string|max:50|unique:patients,codigo_interno',
            'fecha_nacimiento' => 'required|date',
            'ocupacion' => 'nullable|string|max:255',
            'direccion' => 'nullable|string',
            'telefono' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:255',
            'avatar_path' => 'nullable|string|max:255',
            'antecedentes' => 'nullable|string',
        ]);

        $data['created_by'] = $request->user()->id;
        $patient = Patient::create($data);

        return response()->json(
            array_merge($patient->toArray(), ['edad' => $patient->edad]),
            201
        );
    }

    public function show(Patient $patient): JsonResponse
    {
        $patient->loadCount('consultations');

        return response()->json(
            array_merge($patient->toArray(), ['edad' => $patient->edad])
        );
    }

    public function update(Request $request, Patient $patient): JsonResponse
    {
        $data = $request->validate([
            'nombre' => 'sometimes|string|max:255',
            'cedula' => 'sometimes|string|max:20|unique:patients,cedula,' . $patient->id,
            'codigo_interno' => 'nullable|string|max:50|unique:patients,codigo_interno,' . $patient->id,
            'fecha_nacimiento' => 'sometimes|date',
            'ocupacion' => 'nullable|string|max:255',
            'direccion' => 'nullable|string',
            'telefono' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:255',
            'avatar_path' => 'nullable|string|max:255',
            'antecedentes' => 'nullable|string',
        ]);

        $patient->update($data);

        return response()->json(
            array_merge($patient->fresh()->toArray(), ['edad' => $patient->edad])
        );
    }

    public function destroy(Patient $patient): JsonResponse
    {
        $patient->delete();
        return response()->json(['message' => 'Paciente eliminado.']);
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
