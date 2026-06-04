<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OphthalmologyReference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OphthalmologyReferenceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = OphthalmologyReference::with(['patient:id,nombre,cedula', 'createdBy:id,name'])
            ->orderByDesc('fecha');

        if ($patientId = $request->input('patient_id')) {
            $query->where('patient_id', $patientId);
        }

        return response()->json($query->paginate(20));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'patient_id' => 'required|exists:patients,id',
            'motivo' => 'required|string',
            'medico_referido' => 'required|string|max:255',
            'especialidad' => 'nullable|string|max:255',
            'fecha' => 'required|date',
            'observaciones' => 'nullable|string',
        ]);

        $data['created_by'] = $request->user()->id;
        $ref = OphthalmologyReference::create($data);
        $ref->load(['patient:id,nombre,cedula', 'createdBy:id,name']);

        return response()->json($ref, 201);
    }

    public function show(OphthalmologyReference $ophthalmologyReference): JsonResponse
    {
        $ophthalmologyReference->load(['patient', 'createdBy']);
        return response()->json($ophthalmologyReference);
    }

    public function update(Request $request, OphthalmologyReference $ophthalmologyReference): JsonResponse
    {
        $ophthalmologyReference->update($request->all());
        return response()->json($ophthalmologyReference->fresh());
    }

    public function destroy(OphthalmologyReference $ophthalmologyReference): JsonResponse
    {
        $ophthalmologyReference->delete();
        return response()->json(['message' => 'Referencia eliminada.']);
    }
}
