<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Valida identificaciones ecuatorianas segun su tipo, que lo da el tercer digito:
 *  - 10 digitos: cedula (0-5) o identificacion con 6, con modulo 10. El 6 tambien
 *    es de personas: hay pacientes reales con numeros asi ("1761723178").
 *  - 13 digitos: RUC de persona natural (0-5), de entidad publica (6) o de
 *    sociedad (9). Los dos ultimos usan modulo 11.
 *
 * Tambien acepta pasaportes. Cada rechazo dice el motivo: el formulario lo muestra
 * y quien registra decide si corrige o continua (ver ValidPatientDocument).
 */
class ValidEcuadorCedula implements ValidationRule
{
    private const VERIFIER_PROBLEM = 'El dígito verificador no coincide: suele ser un error de tecleo.';

    private const PUBLIC_RUC_COEFFICIENTS = [3, 2, 7, 6, 5, 4, 3, 2];

    private const COMPANY_RUC_COEFFICIENTS = [4, 3, 2, 7, 6, 5, 4, 3, 2];

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

        $problem = match (true) {
            $length === 10 => $this->cedulaProblem($value),
            $length === 13 && $this->allowRuc => $this->rucProblem($value),
            $this->allowRuc => "Tiene {$length} dígitos; la cédula lleva 10 y el RUC 13.",
            default => "Tiene {$length} dígitos; la cédula lleva 10.",
        };

        if ($problem !== null) {
            $fail($problem);
        }
    }

    private function cedulaProblem(string $cedula): ?string
    {
        if ($problem = $this->provinceProblem($cedula)) {
            return $problem;
        }

        if ((int) $cedula[2] > 6) {
            return "El tercer dígito es {$cedula[2]} y no corresponde a una cédula. Si es un RUC, debe tener 13 dígitos.";
        }

        return $this->matchesModulo10($cedula) ? null : self::VERIFIER_PROBLEM;
    }

    private function rucProblem(string $ruc): ?string
    {
        if ($problem = $this->provinceProblem($ruc)) {
            return $problem;
        }

        $third = (int) $ruc[2];

        if ($third === 9) {
            return $this->companyRucProblem($ruc);
        }

        if ($third === 6 && $this->isPublicRuc($ruc)) {
            return null;
        }

        if ($third > 6) {
            return "El tercer dígito es {$third} y no corresponde a ningún tipo de RUC.";
        }

        // Persona natural: cédula + establecimiento. Incluye a quien tiene una
        // identificación con 6, que no cumple el formato de entidad pública.
        return $this->matchesModulo10($ruc) ? $this->establishmentProblem($ruc) : self::VERIFIER_PROBLEM;
    }

    private function companyRucProblem(string $ruc): ?string
    {
        if (! $this->matchesModulo11($ruc, self::COMPANY_RUC_COEFFICIENTS)) {
            return self::VERIFIER_PROBLEM;
        }

        return $this->establishmentProblem($ruc);
    }

    /** Entidad pública: el verificador va en la posición 9 y siempre termina en 0001. */
    private function isPublicRuc(string $ruc): bool
    {
        return str_ends_with($ruc, '0001') && $this->matchesModulo11($ruc, self::PUBLIC_RUC_COEFFICIENTS);
    }

    private function establishmentProblem(string $ruc): ?string
    {
        // El establecimiento debe ser 001 o mayor
        return (int) substr($ruc, 10, 3) < 1 ? 'Los últimos dígitos del RUC no pueden ser 000.' : null;
    }

    private function provinceProblem(string $document): ?string
    {
        // Verificar provincia (primeros 2 dígitos: 01-24 o 30)
        $code = substr($document, 0, 2);
        $province = (int) $code;

        if (($province < 1 || $province > 24) && $province !== 30) {
            return "Los dos primeros dígitos ({$code}) no corresponden a ninguna provincia.";
        }

        return null;
    }

    private function matchesModulo10(string $document): bool
    {
        $coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2];
        $sum = 0;

        for ($i = 0; $i < 9; $i++) {
            $product = (int) $document[$i] * $coefficients[$i];
            $sum += $product >= 10 ? $product - 9 : $product;
        }

        $verifier = $sum % 10 === 0 ? 0 : 10 - ($sum % 10);

        return $verifier === (int) $document[9];
    }

    /**
     * El verificador es el dígito que sigue a los coeficientes. Un resultado de 10
     * nunca coincide con un dígito: ese número no existe.
     *
     * @param  list<int>  $coefficients
     */
    private function matchesModulo11(string $document, array $coefficients): bool
    {
        $sum = 0;

        foreach ($coefficients as $i => $coefficient) {
            $sum += (int) $document[$i] * $coefficient;
        }

        $remainder = $sum % 11;
        $verifier = $remainder === 0 ? 0 : 11 - $remainder;

        return $verifier === (int) $document[count($coefficients)];
    }
}
