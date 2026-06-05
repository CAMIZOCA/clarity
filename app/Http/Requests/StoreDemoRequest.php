<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreDemoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'company' => ['required', 'string', 'min:2', 'max:160'],
            'email' => ['required', 'email:rfc', 'max:160'],
            'phone' => ['required', 'string', 'min:7', 'max:40', 'regex:/^[0-9+().\-\s]+$/'],
            'city' => ['nullable', 'string', 'max:120'],
            'branches_count' => ['nullable', Rule::in(['1', '2-3', '4-9', '10+'])],
            'message' => ['nullable', 'string', 'max:1500'],
            'interests' => ['nullable', 'array', 'max:8'],
            'interests.*' => ['string', 'max:80'],
            'privacy_accepted' => ['accepted'],
            'website' => ['prohibited'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'El nombre es obligatorio.',
            'company.required' => 'El nombre de la optica es obligatorio.',
            'email.required' => 'El correo es obligatorio.',
            'email.email' => 'Ingresa un correo valido.',
            'phone.required' => 'El telefono es obligatorio.',
            'phone.regex' => 'Ingresa un telefono valido.',
            'privacy_accepted.accepted' => 'Debes aceptar el uso de datos para ser contactado.',
            'website.prohibited' => 'La solicitud no pudo ser procesada.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'name' => trim((string) $this->input('name')),
            'company' => trim((string) $this->input('company')),
            'email' => strtolower(trim((string) $this->input('email'))),
            'phone' => trim((string) $this->input('phone')),
            'city' => trim((string) $this->input('city')),
            'message' => trim((string) $this->input('message')),
        ]);
    }
}
