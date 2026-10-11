<?php

namespace App\Http\Requests;

use App\Models\Patient;
use App\Rules\ValidEcuadorCedula;
use App\Rules\ValidEcuadorPhone;
use App\Rules\ValidPatientDocument;
use App\Services\PatientService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * A diferencia de la consulta (`UpdateConsultationRequest`), aqui un dato
 * heredado invalido **si** bloquea el guardado aunque no se haya tocado: la
 * optica decidio que cada edicion de un paciente importado sirva para limpiar
 * su ficha. El formulario lo avisa al abrir, no al guardar.
 */
class UpdatePatientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('patients.edit') ?? false;
    }

    public function rules(): array
    {
        $patientId = $this->route('patient') ?? $this->route('id');

        return [
            'nombre' => ['sometimes', 'string', 'min:2', 'max:150'],
            'apellido' => ['nullable', 'string', 'max:150'],
            'como_nos_conocio' => ['nullable', 'string', 'max:500'],
            'fecha_registro' => ['nullable', 'date', 'before_or_equal:today'],
            // No se guarda: solo decide con que regla se valida `cedula`.
            'document_type' => ['nullable', Rule::in(ValidPatientDocument::TYPES)],
            // `cedula` y `fecha_nacimiento` son NOT NULL: con `nullable`, vaciarlas
            // llegaba al UPDATE y respondia 500 en vez de 422.
            // Sin `whereNull('deleted_at')`: el indice unico de la BD tambien cuenta a los eliminados.
            'cedula' => ['sometimes', 'required', 'string', new ValidPatientDocument($this->documentType()), Rule::unique('patients', 'cedula')->ignore($patientId)],
            'codigo_interno' => ['nullable', 'string', 'max:50', Rule::unique('patients', 'codigo_interno')->ignore($patientId)],
            'fecha_nacimiento' => ['sometimes', 'required', 'date', 'before:today', 'after:1900-01-01'],
            // `max` = VARCHAR(20) de la columna: SQLite no lo impone y MariaDB si.
            'telefono' => ['nullable', 'string', 'max:20', new ValidEcuadorPhone],
            // Sin `unique`: en una familia varios pacientes comparten el email.
            'email' => ['nullable', 'email', 'max:150'],
            'ocupacion' => ['nullable', 'string', 'max:100'],
            'direccion' => ['nullable', 'string', 'max:250'],
            'antecedentes' => ['nullable', 'string', 'max:2000'],
            'avatar_path' => ['nullable', 'string', 'max:255'],
            'customer_type' => ['nullable', Rule::in(['particular', 'convenio', 'empresa'])],
            'company_name' => ['nullable', 'string', 'max:150'],
            'company_ruc' => ['nullable', 'string', new ValidEcuadorCedula(allowRuc: true, allowPassport: false)],
            'preferred_contact' => ['nullable', Rule::in(['whatsapp', 'email', 'phone'])],
            'internal_notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * Una cedula nueva no puede ser la de otro paciente escrita de otra forma
     * (RUC, sin cero inicial). Solo se comprueba si cambio: la importacion dejo
     * parejas asi, y una ficha que ya estaba duplicada debe poder editarse.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $patient = $this->route('patient');

            if (! $patient instanceof Patient || blank($this->cedula) || $validator->errors()->has('cedula')) {
                return;
            }

            if ((string) $this->cedula === strtoupper(trim((string) $patient->cedula))) {
                return;
            }

            if ($message = app(PatientService::class)->duplicateDocumentMessage((string) $this->cedula, $patient->id)) {
                $validator->errors()->add('cedula', $message);
            }
        });
    }

    public function messages(): array
    {
        return [
            'nombre.min' => 'El nombre debe tener al menos 2 caracteres.',
            'cedula.required' => 'La cédula o RUC es obligatoria.',
            'cedula.unique' => 'Ya existe otro paciente con esta cédula.',
            'fecha_nacimiento.required' => 'La fecha de nacimiento es obligatoria.',
            'fecha_nacimiento.before' => 'La fecha de nacimiento debe ser anterior a hoy.',
            'fecha_nacimiento.after' => 'La fecha de nacimiento debe ser posterior al año 1900.',
            'fecha_registro.before_or_equal' => 'La fecha de registro no puede ser posterior a hoy.',
            'telefono.max' => 'El teléfono no puede tener más de 20 caracteres.',
            'email.email' => 'El email no tiene un formato válido.',
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

    /** Sin tipo explicito vale el del documento que el paciente ya tenia guardado. */
    private function documentType(): string
    {
        $type = $this->input('document_type');

        if (in_array($type, ValidPatientDocument::TYPES, true)) {
            return $type;
        }

        $patient = $this->route('patient');

        return ValidPatientDocument::typeOf($patient instanceof Patient ? $patient->cedula : null);
    }
}
