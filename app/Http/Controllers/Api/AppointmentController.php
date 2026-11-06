<?php

namespace App\Http\Controllers\Api;

use App\Enums\Permission;
use App\Http\Controllers\Api\Concerns\ApiResponses;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreAppointmentRequest;
use App\Http\Requests\UpdateAppointmentRequest;
use App\Http\Resources\AppointmentResource;
use App\Models\Appointment;
use App\Services\AppointmentReminderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AppointmentController extends Controller
{
    use ApiResponses;

    /** Columnas del paciente que la Agenda necesita (gotcha 9: incluir apellido). */
    private const PATIENT_COLUMNS = 'patient:id,nombre,apellido,cedula,telefono,email';

    public function __construct(private AppointmentReminderService $reminders) {}

    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->can(Permission::APPOINTMENTS_VIEW->value), 403);

        $query = Appointment::with([self::PATIENT_COLUMNS, 'optometrista:id,name']);

        if ($from = $request->input('from')) {
            $query->where('fecha_hora_inicio', '>=', $from);
        }
        if ($to = $request->input('to')) {
            $query->where('fecha_hora_fin', '<=', $to);
        }
        if ($optometristaId = $request->input('optometrista_id')) {
            $query->where('optometrista_id', $optometristaId);
        }

        $appointments = $query->get();
        $lastSent = $this->reminders->lastSentAt($appointments->pluck('id')->all());
        $appointments->each(fn (Appointment $a) => $a->setAttribute('reminder_email_sent_at', $lastSent[$a->id] ?? null));

        return response()->json(AppointmentResource::collection($appointments));
    }

    public function store(StoreAppointmentRequest $request): JsonResponse
    {
        $appointment = Appointment::create($request->validated());
        $appointment->load([self::PATIENT_COLUMNS, 'optometrista:id,name']);

        return (new AppointmentResource($appointment))
            ->response()
            ->setStatusCode(201);
    }

    public function show(Request $request, Appointment $appointment): JsonResponse
    {
        abort_unless($request->user()->can(Permission::APPOINTMENTS_VIEW->value), 403);

        $appointment->load(['patient', 'optometrista']);

        return (new AppointmentResource($appointment))->response();
    }

    public function update(UpdateAppointmentRequest $request, Appointment $appointment): JsonResponse
    {
        $appointment->update($request->validated());
        $appointment->load([self::PATIENT_COLUMNS, 'optometrista:id,name']);
        $appointment->setAttribute('reminder_email_sent_at', $this->reminders->lastSentAt([$appointment->id])[$appointment->id] ?? null);

        return (new AppointmentResource($appointment))->response();
    }

    /**
     * Enviar ahora el recordatorio por correo (con el evento .ics adjunto).
     * POST /api/appointments/{appointment}/send-reminder
     */
    public function sendReminder(Request $request, Appointment $appointment): JsonResponse
    {
        abort_unless($request->user()->can(Permission::APPOINTMENTS_EDIT->value), 403);

        if ($reason = $this->reminders->cannotSendReason($appointment)) {
            return $this->error($reason, 422);
        }

        $reminder = $this->reminders->sendEmail($appointment, $request->user());

        if ($reminder->status !== 'sent') {
            return $this->error('No se pudo enviar el recordatorio: '.$reminder->error_message, 502);
        }

        return $this->ok([
            'sent_at' => $reminder->sent_at->toISOString(),
            'email' => $appointment->patient->email,
        ], 'Recordatorio enviado a '.$appointment->patient->email.'.');
    }

    public function destroy(Request $request, Appointment $appointment): JsonResponse
    {
        abort_unless($request->user()->can(Permission::APPOINTMENTS_DELETE->value), 403);

        $appointment->delete();

        return response()->json(['message' => 'Cita eliminada.']);
    }
}
