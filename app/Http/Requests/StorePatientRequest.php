<?php

namespace App\Http\Requests;

use App\Rules\ValidEcuadorCedula;
use App\Rules\ValidEcuadorPhone;
use App\Rules\ValidPatientDocument;
use App\Services\PatientService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StorePatientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('patients.create') ?? false;
    }

    public function rules(): array
    {
        return [
            'nombre' => ['required', 'string', 'min:2', 'max:150'],
            'apellido' => ['nullable', 'string', 'max:150'],
            'como_nos_conocio' => ['nullable', 'string', 'max:500'],
            'fecha_registro' => ['nullable', 'date', 'before_or_equal:today'],
            // No se guarda: solo decide con que regla se valida `cedula`.
            'document_type' => ['nullable', Rule::in(ValidPatientDocument::TYPES)],
            // `cedula` y `fecha_nacimiento` son NOT NULL: sin `required`, un alta
            // sin ellas llegaba al INSERT y respondia 500 en vez de 422. El unique
            // incluye a los eliminados porque el indice de la BD tambien.
            'cedula' => ['required', 'string', new ValidPatientDocument($this->documentType()), Rule::unique('patients', 'cedula')],
            'codigo_interno' => ['nullable', 'string', 'max:50', Rule::unique('patients', 'codigo_interno')],
            'fecha_nacimiento' => ['required', 'date', 'before:today', 'after:1900-01-01'],
            // `max` = VARCHAR(20) de la columna: SQLite no lo impone y MariaDB si.
            'telefono' => ['nullable', 'string', 'max:20', new ValidEcuadorPhone],
            // Sin `unique`: en una familia varios pacientes comparten el email.
            // El formulario avisa con `GET /patients/lookup?email=`, sin bloquear.
            'email' => ['nullable', 'email', 'max:150'],
            'ocupacion' => ['nullable', 'string', 'max:100'],
            'direccion' => ['nullable', 'string', 'max:250'],
            'antecedentes' => ['nullable', 'string', 'max:2000'],
            'avatar_path' => ['nullable', 'string', 'max:255'],
            'customer_type' => ['nullable', Rule::in(['particular', 'convenio', 'empresa'])],
            'company_name' => ['nullable', 'string', 'max:150', 'required_if:customer_type,empresa'],
            'company_ruc' => ['nullable', 'string', new ValidEcuadorCedula(allowRuc: true, allowPassport: false)],
            'preferred_contact' => ['nullable', Rule::in(['whatsapp', 'email', 'phone'])],
            'internal_notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * El `unique` compara la cedula tal cual: no ve que "1710034065001" o la
     * version sin cero inicial son la misma persona. Esa comparacion vivia solo
     * en el formulario, y con "No se pudo verificar. Puede continuar" el alta
     * pasaba igual.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if (blank($this->cedula) || $validator->errors()->has('cedula')) {
                return;
            }

            if ($message = app(PatientService::class)->duplicateDocumentMessage((string) $this->cedula)) {
                $validator->errors()->add('cedula', $message);
            }
        });
    }

    public function messages(): array
    {
        return [
            'nombre.required' => 'El nombre del paciente es obligatorio.',
            'nombre.min' => 'El nombre debe tener al menos 2 caracteres.',
            'cedula.required' => 'La cédula o RUC es obligatoria.',
            'cedula.unique' => 'Ya existe un paciente registrado con esta cédula.',
            'fecha_nacimiento.required' => 'La fecha de nacimiento es obligatoria.',
            'codigo_interno.unique' => 'Ya existe un paciente con este código interno.',
            'fecha_nacimiento.before' => 'La fecha de nacimiento debe ser anterior a hoy.',
            'fecha_nacimiento.after' => 'La fecha de nacimiento debe ser posterior al año 1900.',
            'fecha_registro.before_or_equal' => 'La fecha de registro no puede ser posterior a hoy.',
            'telefono.max' => 'El teléfono no puede tener más de 20 caracteres.',
            'email.email' => 'El email no tiene un formato válido.',
            'company_name.required_if' => 'El nombre de empresa es requerido cuando el tipo de cliente es empresa.',
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->cedula) {
            $this->merge(['cedula' => ValidPatientDocument::normalize((string) $this->cedula, $this->documentType())]);
        }
        if ($this->nombre) {
            $this->merge(['nombre' => trim($this->nombre)]);
        }
        if ($this->apellido) {
            $this->merge(['apellido' => trim($this->apellido)]);
        }
    }

    /** Sin tipo explicito se exige una cedula: el pasaporte se elige a proposito. */
    private function documentType(): string
    {
        $type = $this->input('document_type');

        return in_array($type, ValidPatientDocument::TYPES, true) ? $type : ValidPatientDocument::TYPE_CEDULA;
    }
}
