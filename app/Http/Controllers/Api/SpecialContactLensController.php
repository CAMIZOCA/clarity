<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SpecialContactLens;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SpecialContactLensController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = SpecialContactLens::with(['patient:id,nombre,cedula', 'optometrista:id,name'])
            ->orderByDesc('fecha_adaptacion');

        if ($patientId = $request->input('patient_id')) {
            $query->where('patient_id', $patientId);
        }

        return response()->json($query->paginate(20));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'patient_id' => 'required|exists:patients,id',
            'tipo' => 'required|in:esclerales,ortoqueratologia,queratocono',
            'fecha_adaptacion' => 'required|date',
            'radio_base_od' => 'nullable|numeric', 'diametro_od' => 'nullable|numeric',
            'potencia_od' => 'nullable|numeric', 'material_od' => 'nullable|string',
            'radio_base_oi' => 'nullable|numeric', 'diametro_oi' => 'nullable|numeric',
            'potencia_oi' => 'nullable|numeric', 'material_oi' => 'nullable|string',
            'seguimiento' => 'nullable|string',
            'proxima_revision' => 'nullable|date',
        ]);

        $data['optometrista_id'] = $request->user()->id;
        $lens = SpecialContactLens::create($data);
        $lens->load(['patient:id,nombre,cedula', 'optometrista:id,name']);

        return response()->json($lens, 201);
    }

    public function show(SpecialContactLens $specialContactLens): JsonResponse
    {
        $specialContactLens->load(['patient', 'optometrista']);
        return response()->json($specialContactLens);
    }

    public function update(Request $request, SpecialContactLens $specialContactLens): JsonResponse
    {
        $specialContactLens->update($request->all());
        return response()->json($specialContactLens->fresh());
    }

    public function destroy(SpecialContactLens $specialContactLens): JsonResponse
    {
        $specialContactLens->delete();
        return response()->json(['message' => 'Registro eliminado.']);
    }
}
