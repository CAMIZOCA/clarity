<?php

namespace App\Http\Requests;

use App\Enums\Role;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('users.create') ?? false;
    }

    public function rules(): array
    {
        return [
            'name'              => ['required', 'string', 'min:2', 'max:100'],
            'email'             => ['required', 'email', 'max:150', 'unique:users,email'],
            'password'          => ['required', Password::min(8)->letters()->numbers(), 'confirmed'],
            'role'              => ['required', Rule::in(Role::values())],
            'codigo'            => ['nullable', 'string', 'max:50', 'unique:users,codigo'],
            'registro_senescyt' => ['nullable', 'string', 'max:100'],
            'branch_id'         => ['nullable', 'integer', 'exists:branches,id'],
            'commission_pct'    => ['nullable', 'numeric', 'min:0', 'max:100'],
            'phone'             => ['nullable', 'string', 'max:20'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required'                => 'El nombre del usuario es obligatorio.',
            'name.min'                     => 'El nombre debe tener al menos 2 caracteres.',
            'email.required'               => 'El correo electrónico es obligatorio.',
            'email.unique'                 => 'Ya existe un usuario con este correo.',
            'password.required'            => 'La contraseña es obligatoria.',
            'password.confirmed'           => 'La confirmación de contraseña no coincide.',
            'role.required'                => 'Debe asignar un rol al usuario.',
            'role.in'                      => 'El rol seleccionado no es válido.',
            'codigo.unique'                => 'Ya existe un usuario con este código.',
            'commission_pct.min'           => 'El porcentaje de comisión no puede ser negativo.',
            'commission_pct.max'           => 'El porcentaje de comisión no puede ser mayor a 100.',
        ];
    }
}
