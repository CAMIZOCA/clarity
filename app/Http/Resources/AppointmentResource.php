<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AppointmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                => $this->id,
            'titulo'            => $this->titulo,
            'estado'            => $this->estado,
            'notas'             => $this->notas,
            'fecha_hora_inicio' => $this->fecha_hora_inicio->toISOString(),
            'fecha_hora_fin'    => $this->fecha_hora_fin->toISOString(),
            'duracion_minutos'  => $this->fecha_hora_inicio->diffInMinutes($this->fecha_hora_fin),
            'confirmed_at'      => $this->when(
                isset($this->confirmed_at),
                fn () => $this->confirmed_at?->toISOString()
            ),
            // Relaciones
            'patient'           => $this->whenLoaded('patient', fn () => [
                'id'      => $this->patient->id,
                'nombre'  => $this->patient->nombre,
                'cedula'  => $this->patient->cedula,
                'telefono' => $this->patient->telefono,
            ]),
            'optometrista'      => $this->whenLoaded('optometrista', fn () => [
                'id'   => $this->optometrista->id,
                'name' => $this->optometrista->name,
            ]),
            'created_at'        => $this->created_at->toISOString(),
        ];
    }
}
