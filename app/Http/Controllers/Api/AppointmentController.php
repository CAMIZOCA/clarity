<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AppointmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Appointment::with(['patient:id,nombre,cedula', 'optometrista:id,name']);

        if ($from = $request->input('from')) {
            $query->where('fecha_hora_inicio', '>=', $from);
        }
        if ($to = $request->input('to')) {
            $query->where('fecha_hora_fin', '<=', $to);
        }
        if ($optometristaId = $request->input('optometrista_id')) {
            $query->where('optometrista_id', $optometristaId);
        }

        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'patient_id' => 'nullable|exists:patients,id',
            'optometrista_id' => 'nullable|exists:users,id',
            'titulo' => 'nullable|string|max:255',
            'fecha_hora_inicio' => 'required|date',
            'fecha_hora_fin' => 'required|date|after:fecha_hora_inicio',
            'estado' => 'in:pendiente,atendido,cancelado',
            'notas' => 'nullable|string',
        ]);

        $appointment = Appointment::create($data);
        $appointment->load(['patient:id,nombre,cedula', 'optometrista:id,name']);

        return response()->json($appointment, 201);
    }

    public function show(Appointment $appointment): JsonResponse
    {
        $appointment->load(['patient', 'optometrista']);
        return response()->json($appointment);
    }

    public function update(Request $request, Appointment $appointment): JsonResponse
    {
        $data = $request->validate([
            'patient_id' => 'nullable|exists:patients,id',
            'optometrista_id' => 'nullable|exists:users,id',
            'titulo' => 'nullable|string|max:255',
            'fecha_hora_inicio' => 'sometimes|date',
            'fecha_hora_fin' => 'sometimes|date|after:fecha_hora_inicio',
            'estado' => 'in:pendiente,atendido,cancelado',
            'notas' => 'nullable|string',
        ]);

        $appointment->update($data);
        $appointment->load(['patient:id,nombre,cedula', 'optometrista:id,name']);

        return response()->json($appointment);
    }

    public function destroy(Appointment $appointment): JsonResponse
    {
        $appointment->delete();
        return response()->json(['message' => 'Cita eliminada.']);
    }
}
