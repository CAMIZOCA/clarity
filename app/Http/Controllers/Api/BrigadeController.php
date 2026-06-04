<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Brigade;
use App\Models\Patient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BrigadeController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(
            Brigade::with('optometrista:id,name')->withCount('patients')->orderByDesc('fecha')->paginate(20)
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nombre' => 'required|string|max:255',
            'lugar' => 'required|string|max:255',
            'fecha' => 'required|date',
            'optometrista_id' => 'nullable|exists:users,id',
            'observaciones' => 'nullable|string',
        ]);

        $brigade = Brigade::create($data);
        return response()->json($brigade, 201);
    }

    public function show(Brigade $brigade): JsonResponse
    {
        $brigade->load(['optometrista:id,name', 'patients:id,nombre,cedula']);
        return response()->json($brigade);
    }

    public function update(Request $request, Brigade $brigade): JsonResponse
    {
        $data = $request->validate([
            'nombre' => 'sometimes|string|max:255',
            'lugar' => 'sometimes|string|max:255',
            'fecha' => 'sometimes|date',
            'optometrista_id' => 'nullable|exists:users,id',
            'observaciones' => 'nullable|string',
        ]);

        $brigade->update($data);
        return response()->json($brigade->fresh());
    }

    public function destroy(Brigade $brigade): JsonResponse
    {
        $brigade->delete();
        return response()->json(['message' => 'Brigada eliminada.']);
    }

    public function attachPatient(Request $request, Brigade $brigade): JsonResponse
    {
        $data = $request->validate(['patient_id' => 'required|exists:patients,id']);
        $brigade->patients()->syncWithoutDetaching([
            $data['patient_id'] => ['notas' => $request->input('notas')],
        ]);
        return response()->json(['message' => 'Paciente agregado a la brigada.']);
    }

    public function detachPatient(Brigade $brigade, Patient $patient): JsonResponse
    {
        $brigade->patients()->detach($patient->id);
        return response()->json(['message' => 'Paciente removido de la brigada.']);
    }
}
