<?php

namespace App\Http\Requests;

use App\Enums\Role;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('users.edit') ?? false;
    }

    public function rules(): array
    {
        $userId = $this->route('user') ?? $this->route('id');

        return [
            'name'              => ['sometimes', 'string', 'min:2', 'max:100'],
            'email'             => ['sometimes', 'email', 'max:150', Rule::unique('users', 'email')->ignore($userId)],
            'password'          => ['nullable', Password::min(8)->letters()->numbers(), 'confirmed'],
            'role'              => ['sometimes', Rule::in(Role::values())],
            'codigo'            => ['nullable', 'string', 'max:50', Rule::unique('users', 'codigo')->ignore($userId)],
            'registro_senescyt' => ['nullable', 'string', 'max:100'],
            'is_active'         => ['nullable', 'boolean'],
            'branch_id'         => ['nullable', 'integer'],
            'commission_pct'    => ['nullable', 'numeric', 'min:0', 'max:100'],
            'phone'             => ['nullable', 'string', 'max:20'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.min'                => 'El nombre debe tener al menos 2 caracteres.',
            'email.unique'            => 'Ya existe otro usuario con este correo.',
            'password.confirmed'      => 'La confirmación de contraseña no coincide.',
            'role.in'                 => 'El rol seleccionado no es válido.',
            'codigo.unique'           => 'Ya existe otro usuario con este código.',
            'commission_pct.min'      => 'El porcentaje de comisión no puede ser negativo.',
            'commission_pct.max'      => 'El porcentaje de comisión no puede ser mayor a 100.',
        ];
    }
}
