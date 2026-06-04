<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GuaranteeReport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GuaranteeReportController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = GuaranteeReport::with(['patient:id,nombre,cedula', 'optometrista:id,name', 'createdBy:id,name']);

        if ($patientId = $request->input('patient_id')) {
            $query->where('patient_id', $patientId);
        }

        $reports = $query->orderByDesc('fecha_informe')->get();

        return response()->json($reports);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'patient_id'          => 'required|exists:patients,id',
            'optometrista_id'     => 'nullable|exists:users,id',
            'fecha_informe'       => 'required|date',
            'motivo'              => 'required|string',
            'cambios_realizados'  => 'nullable|string',
            'soluciones_indicadas' => 'nullable|string',
            'estado'              => 'in:pendiente,completado',
        ]);

        $data['created_by'] = $request->user()->id;

        $report = GuaranteeReport::create($data);
        $report->load(['patient:id,nombre,cedula', 'optometrista:id,name']);

        return response()->json($report, 201);
    }

    public function show(GuaranteeReport $guaranteeReport): JsonResponse
    {
        $guaranteeReport->load(['patient', 'optometrista', 'createdBy']);
        return response()->json($guaranteeReport);
    }

    public function update(Request $request, GuaranteeReport $guaranteeReport): JsonResponse
    {
        $data = $request->validate([
            'optometrista_id'     => 'nullable|exists:users,id',
            'fecha_informe'       => 'sometimes|date',
            'motivo'              => 'sometimes|string',
            'cambios_realizados'  => 'nullable|string',
            'soluciones_indicadas' => 'nullable|string',
            'estado'              => 'in:pendiente,completado',
        ]);

        $guaranteeReport->update($data);
        $guaranteeReport->load(['patient:id,nombre,cedula', 'optometrista:id,name']);

        return response()->json($guaranteeReport);
    }

    public function destroy(GuaranteeReport $guaranteeReport): JsonResponse
    {
        $guaranteeReport->delete();
        return response()->json(['message' => 'Informe eliminado.']);
    }
}
