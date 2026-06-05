<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\Concerns\ApiResponses;
use App\Http\Requests\StoreAppointmentRequest;
use App\Http\Requests\UpdateAppointmentRequest;
use App\Http\Resources\AppointmentResource;
use App\Models\Appointment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AppointmentController extends Controller
{
    use ApiResponses;

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

        return response()->json(AppointmentResource::collection($query->get()));
    }

    public function store(StoreAppointmentRequest $request): JsonResponse
    {
        $appointment = Appointment::create($request->validated());
        $appointment->load(['patient:id,nombre,cedula', 'optometrista:id,name']);

        return (new AppointmentResource($appointment))
            ->response()
            ->setStatusCode(201);
    }

    public function show(Appointment $appointment): JsonResponse
    {
        $appointment->load(['patient', 'optometrista']);

        return (new AppointmentResource($appointment))->response();
    }

    public function update(UpdateAppointmentRequest $request, Appointment $appointment): JsonResponse
    {
        $appointment->update($request->validated());
        $appointment->load(['patient:id,nombre,cedula', 'optometrista:id,name']);

        return (new AppointmentResource($appointment))->response();
    }

    public function destroy(Appointment $appointment): JsonResponse
    {
        $appointment->delete();

        return response()->json(['message' => 'Cita eliminada.']);
    }
}
