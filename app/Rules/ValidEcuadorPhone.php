<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Valida números de teléfono de un paciente.
 * Acepta: celulares (09XXXXXXXX), fijos con o sin código de provincia
 * (022345678 o 2345678), con/sin código país, y números extranjeros con "+".
 *
 * `resources/js/utils/patientValidation.js` repite este criterio para avisar
 * al salir del campo: los dos deben coincidir.
 */
class ValidEcuadorPhone implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (empty($value)) {
            return;
        }

        $international = str_starts_with(trim((string) $value), '+');

        // Limpiar espacios, guiones, paréntesis
        $digits = preg_replace('/[\s\-\(\)\+]/', '', $value);
        $clean = $digits;

        // Con código de país Ecuador: +593 o 593
        if (str_starts_with($clean, '593')) {
            $clean = '0'.substr($clean, 3);
        }

        // Celular Ecuador: 09XXXXXXXX (10 dígitos)
        if (preg_match('/^09[0-9]{8}$/', $clean)) {
            return;
        }

        // Teléfono fijo Ecuador: 0[2-7]XXXXXXX (9 dígitos)
        if (preg_match('/^0[2-7][0-9]{7}$/', $clean)) {
            return;
        }

        // Fijo local sin código de provincia (7 dígitos): así los anota recepción.
        if (preg_match('/^[2-7][0-9]{6}$/', $clean)) {
            return;
        }

        // Número extranjero: "+" y el código de país (E.164: hasta 15 dígitos).
        if ($international && ! str_starts_with($digits, '593') && preg_match('/^[0-9]{8,15}$/', $digits)) {
            return;
        }

        $fail('El :attribute no es un número de teléfono válido (ej: 0991234567, 022345678, 2345678 o +57 300 1234567).');
    }
}
