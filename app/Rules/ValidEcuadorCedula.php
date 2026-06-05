<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Valida cédulas ecuatorianas usando el algoritmo oficial del Registro Civil.
 * También acepta RUC (13 dígitos) y pasaportes.
 */
class ValidEcuadorCedula implements ValidationRule
{
    public function __construct(
        private bool $allowRuc = true,
        private bool $allowPassport = true
    ) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (empty($value)) return; // El campo requerido lo maneja otra regla

        $value = trim($value);

        // Pasaporte: letras y números, 5-15 caracteres
        if ($this->allowPassport && preg_match('/^[A-Z0-9]{5,15}$/i', $value)) {
            if (!is_numeric($value)) {
                return; // Es un pasaporte, aceptar
            }
        }

        // Solo dígitos para cédula/RUC
        if (!preg_match('/^\d+$/', $value)) {
            $fail('El :attribute no tiene un formato válido.');
            return;
        }

        $length = strlen($value);

        // RUC: 13 dígitos
        if ($length === 13 && $this->allowRuc) {
            if (!$this->validateRuc($value)) {
                $fail('El RUC ingresado no es válido.');
            }
            return;
        }

        // Cédula: 10 dígitos
        if ($length === 10) {
            if (!$this->validateCedula($value)) {
                $fail('La cédula ingresada no es válida.');
            }
            return;
        }

        $fail('El :attribute debe tener 10 dígitos (cédula) o 13 dígitos (RUC).');
    }

    private function validateCedula(string $cedula): bool
    {
        // Verificar provincia (primeros 2 dígitos: 01-24 o 30)
        $province = (int) substr($cedula, 0, 2);
        if (($province < 1 || $province > 24) && $province !== 30) {
            return false;
        }

        // Tercer dígito debe ser < 6
        $third = (int) $cedula[2];
        if ($third >= 6) {
            return false;
        }

        // Algoritmo de módulo 10
        $coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2];
        $sum = 0;

        for ($i = 0; $i < 9; $i++) {
            $product = (int) $cedula[$i] * $coefficients[$i];
            $sum += $product >= 10 ? $product - 9 : $product;
        }

        $verifier = $sum % 10 === 0 ? 0 : 10 - ($sum % 10);

        return $verifier === (int) $cedula[9];
    }

    private function validateRuc(string $ruc): bool
    {
        // Un RUC válido es una cédula válida (primeros 10) + establecimiento
        $cedula = substr($ruc, 0, 10);
        $suffix = substr($ruc, 10, 3);

        // El establecimiento debe ser 001 o mayor
        if ((int) $suffix < 1) {
            return false;
        }

        return $this->validateCedula($cedula);
    }
}
