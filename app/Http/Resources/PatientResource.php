<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PatientResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                => $this->id,
            'nombre'            => $this->nombre,
            'apellido'          => $this->apellido,
            'nombre_completo'   => $this->nombre_completo,
            'cedula'            => $this->cedula,
            'codigo_interno'    => $this->codigo_interno,
            'fecha_nacimiento'  => $this->fecha_nacimiento?->toDateString(),
            'fecha_registro'    => $this->fecha_registro?->toDateString(),
            'edad'              => $this->edad,
            'telefono'          => $this->telefono,
            'email'             => $this->email,
            'direccion'         => $this->direccion,
            'ocupacion'         => $this->ocupacion,
            'antecedentes'      => $this->antecedentes,
            'como_nos_conocio'  => $this->como_nos_conocio,
            'avatar_path'       => $this->avatar_path,
            // CRM fields
            'customer_type'     => $this->when(isset($this->customer_type), $this->customer_type),
            'company_name'      => $this->when(isset($this->company_name), $this->company_name),
            'company_ruc'       => $this->when(isset($this->company_ruc), $this->company_ruc),
            'preferred_contact' => $this->when(isset($this->preferred_contact), $this->preferred_contact),
            'internal_notes'    => $this->when(isset($this->internal_notes), $this->internal_notes),
            'total_spent'       => $this->when(isset($this->total_spent), fn () => (float) $this->total_spent),
            'visit_count'       => $this->when(isset($this->visit_count), $this->visit_count),
            'last_purchase_at'  => $this->when(isset($this->last_purchase_at), fn () => $this->last_purchase_at?->toDateString()),
            'branch_id'         => $this->when(isset($this->branch_id), $this->branch_id),
            // Metadata
            'created_at'        => $this->created_at->toISOString(),
            'updated_at'        => $this->updated_at->toISOString(),
            // Relaciones (solo si están cargadas)
            'consultations_count' => $this->whenCounted('consultations'),
            // Lo aporta `withMax('consultations', 'fecha_consulta')` en el listado.
            'ultima_consulta'     => $this->when(
                isset($this->consultations_max_fecha_consulta),
                fn () => $this->consultations_max_fecha_consulta
            ),
            'last_consultation'   => $this->whenLoaded('consultations', function () {
                $last = $this->consultations->sortByDesc('fecha_consulta')->first();
                return $last ? [
                    'id'              => $last->id,
                    'fecha_consulta'  => $last->fecha_consulta?->toDateString(),
                    'numero_consulta' => $last->numero_consulta,
                ] : null;
            }),
        ];
    }
}
