<?php

namespace App\Http\Requests;

use App\Rules\ValidEcuadorCedula;
use App\Rules\ValidEcuadorPhone;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePatientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('patients.create') ?? false;
    }

    public function rules(): array
    {
        return [
            'nombre'              => ['required', 'string', 'min:2', 'max:150'],
            'cedula'              => ['nullable', 'string', new ValidEcuadorCedula(), Rule::unique('patients', 'cedula')->whereNull('deleted_at')],
            'codigo_interno'      => ['nullable', 'string', 'max:50', Rule::unique('patients', 'codigo_interno')],
            'fecha_nacimiento'    => ['nullable', 'date', 'before:today', 'after:1900-01-01'],
            'telefono'            => ['nullable', 'string', new ValidEcuadorPhone()],
            'email'               => ['nullable', 'email', 'max:150', Rule::unique('patients', 'email')->whereNull('deleted_at')],
            'ocupacion'           => ['nullable', 'string', 'max:100'],
            'direccion'           => ['nullable', 'string', 'max:250'],
            'antecedentes'        => ['nullable', 'string', 'max:2000'],
            'avatar_path'         => ['nullable', 'string', 'max:255'],
            'customer_type'       => ['nullable', Rule::in(['particular', 'convenio', 'empresa'])],
            'company_name'        => ['nullable', 'string', 'max:150', 'required_if:customer_type,empresa'],
            'company_ruc'         => ['nullable', 'string', new ValidEcuadorCedula(allowRuc: true, allowPassport: false)],
            'preferred_contact'   => ['nullable', Rule::in(['whatsapp', 'email', 'phone'])],
            'internal_notes'      => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function messages(): array
    {
        return [
            'nombre.required'             => 'El nombre del paciente es obligatorio.',
            'nombre.min'                  => 'El nombre debe tener al menos 2 caracteres.',
            'cedula.unique'               => 'Ya existe un paciente registrado con esta cédula.',
            'codigo_interno.unique'       => 'Ya existe un paciente con este código interno.',
            'email.unique'                => 'Ya existe un paciente registrado con este email.',
            'fecha_nacimiento.before'     => 'La fecha de nacimiento debe ser anterior a hoy.',
            'fecha_nacimiento.after'      => 'La fecha de nacimiento debe ser posterior al año 1900.',
            'company_name.required_if'    => 'El nombre de empresa es requerido cuando el tipo de cliente es empresa.',
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->cedula) {
            $this->merge(['cedula' => strtoupper(trim($this->cedula))]);
        }
        if ($this->nombre) {
            $this->merge(['nombre' => trim($this->nombre)]);
        }
    }
}
