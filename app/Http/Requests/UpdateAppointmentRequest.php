<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateAppointmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('appointments.edit') ?? false;
    }

    public function rules(): array
    {
        return [
            'patient_id'        => ['sometimes', 'integer', 'exists:patients,id'],
            'optometrista_id'   => ['sometimes', 'integer', 'exists:users,id'],
            'titulo'            => ['sometimes', 'string', 'min:3', 'max:255'],
            'fecha_hora_inicio' => ['sometimes', 'date'],
            'fecha_hora_fin'    => ['sometimes', 'date', 'after:fecha_hora_inicio'],
            'estado'            => ['sometimes', Rule::in(['pendiente', 'atendido', 'cancelado'])],
            'notas'             => ['nullable', 'string', 'max:500'],
            'confirmed_at'      => ['nullable', 'date'],
        ];
    }

    public function messages(): array
    {
        return [
            'patient_id.exists'     => 'El paciente seleccionado no existe.',
            'optometrista_id.exists' => 'El optómetra seleccionado no existe.',
            'titulo.min'            => 'El título de la cita debe tener al menos 3 caracteres.',
            'fecha_hora_fin.after'  => 'La hora de fin debe ser posterior a la hora de inicio.',
            'estado.in'             => 'El estado seleccionado no es válido.',
        ];
    }
}
