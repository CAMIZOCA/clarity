<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Valida números de teléfono ecuatorianos.
 * Acepta: celulares (09XXXXXXXX), fijos (02-07 XXXXXXX), con/sin código país.
 */
class ValidEcuadorPhone implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (empty($value)) return;

        // Limpiar espacios, guiones, paréntesis
        $clean = preg_replace('/[\s\-\(\)\+]/', '', $value);

        // Con código de país Ecuador: +593 o 593
        if (str_starts_with($clean, '593')) {
            $clean = '0' . substr($clean, 3);
        }

        // Celular Ecuador: 09XXXXXXXX (10 dígitos)
        if (preg_match('/^09[0-9]{8}$/', $clean)) {
            return;
        }

        // Teléfono fijo Ecuador: 0[2-7]XXXXXXX (9 dígitos)
        if (preg_match('/^0[2-7][0-9]{7}$/', $clean)) {
            return;
        }

        $fail('El :attribute no es un número de teléfono ecuatoriano válido (ej: 0991234567 o 022345678).');
    }
}
