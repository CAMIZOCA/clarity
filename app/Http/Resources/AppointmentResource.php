<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

class AppointmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $lastReminder = $this->getAttribute('reminder_email_sent_at');

        return [
            'id' => $this->id,
            // La Agenda los necesita al editar: sin patient_id, guardar la cita le quitaba el paciente.
            'patient_id' => $this->patient_id,
            'optometrista_id' => $this->optometrista_id,
            'titulo' => $this->titulo,
            'estado' => $this->estado,
            'notas' => $this->notas,
            'fecha_hora_inicio' => $this->fecha_hora_inicio->toISOString(),
            'fecha_hora_fin' => $this->fecha_hora_fin->toISOString(),
            'duracion_minutos' => $this->fecha_hora_inicio->diffInMinutes($this->fecha_hora_fin),
            'confirmed_at' => $this->when(
                isset($this->confirmed_at),
                fn () => $this->confirmed_at?->toISOString()
            ),
            'reminder_email_sent_at' => $lastReminder ? Carbon::parse($lastReminder)->toISOString() : null,
            // Relaciones
            'patient' => $this->whenLoaded('patient', fn () => $this->patient ? [
                'id' => $this->patient->id,
                'nombre' => $this->patient->nombre,
                'apellido' => $this->patient->apellido,
                'nombre_completo' => $this->patient->nombre_completo,
                'cedula' => $this->patient->cedula,
                'telefono' => $this->patient->telefono,
                'email' => $this->patient->email,
            ] : null),
            'optometrista' => $this->whenLoaded('optometrista', fn () => $this->optometrista ? [
                'id' => $this->optometrista->id,
                'name' => $this->optometrista->name,
            ] : null),
            'created_at' => $this->created_at->toISOString(),
        ];
    }
}
