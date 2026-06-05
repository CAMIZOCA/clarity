<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateConsultationRequest extends StoreConsultationRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('consultations.edit') ?? false;
    }

    public function rules(): array
    {
        // Heredar todas las reglas de Store pero hacer patient_id y fecha_consulta opcionales
        $rules = parent::rules();

        $rules['patient_id']      = ['sometimes', 'integer', 'exists:patients,id'];
        $rules['fecha_consulta']  = ['sometimes', 'date', 'before_or_equal:today'];

        return $rules;
    }
}
