<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAppointmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('appointments.create') ?? false;
    }

    public function rules(): array
    {
        return [
            'patient_id'        => ['nullable', 'integer', 'exists:patients,id'],
            'optometrista_id'   => ['nullable', 'integer', 'exists:users,id'],
            'titulo'            => ['nullable', 'string', 'min:3', 'max:255'],
            'fecha_hora_inicio' => ['required', 'date'],
            'fecha_hora_fin'    => ['required', 'date', 'after:fecha_hora_inicio'],
            'estado'            => ['nullable', Rule::in(['pendiente', 'atendido', 'cancelado'])],
            'notas'             => ['nullable', 'string', 'max:500'],
            'motivo_consulta'   => ['nullable', 'string', 'max:250'],
        ];
    }

    public function messages(): array
    {
        return [
            'patient_id.exists'          => 'El paciente seleccionado no existe.',
            'optometrista_id.exists'      => 'El optómetra seleccionado no existe.',
            'titulo.min'                  => 'El título de la cita debe tener al menos 3 caracteres.',
            'fecha_hora_inicio.required'  => 'La fecha y hora de inicio son obligatorias.',
            'fecha_hora_fin.required'     => 'La fecha y hora de fin son obligatorias.',
            'fecha_hora_fin.after'        => 'La hora de fin debe ser posterior a la hora de inicio.',
            'estado.in'                   => 'El estado seleccionado no es válido.',
        ];
    }
}
