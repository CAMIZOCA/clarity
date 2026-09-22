<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Valida que los valores de una receta óptica estén en rangos clínicamente válidos.
 */
class ValidOpticalPrescription implements ValidationRule
{
    public function __construct(
        private string $fieldType = 'sphere', // sphere|cylinder|axis|add|prism|pd|va
        private bool $allowNeutral = false,
        private bool $enforceRange = true,
    ) {}

    private array $ranges = [
        'sphere' => ['min' => -30.0, 'max' => 30.0,  'step' => 0.25],
        'cylinder' => ['min' => -10.0, 'max' => 10.0,  'step' => 0.25],
        // Rangos clinicos: un eje va de 1 a 180 y una adicion menor a 0.25 no es
        // una adicion. Para "sin valor" el campo se deja vacio, no en cero.
        'axis' => ['min' => 1,     'max' => 180,   'step' => 1],
        'add' => ['min' => 0.25,  'max' => 4.0,   'step' => 0.25],
        'prism' => ['min' => 0.0,   'max' => 20.0,  'step' => 0.25],
        'pd' => ['min' => 20,    'max' => 40,    'step' => 0.5],
        'va' => ['min' => 0.0,   'max' => 2.0,   'step' => 0.01],
    ];

    /**
     * Misma regla sin el chequeo de rango clínico: se usa al guardar un
     * borrador, que nunca debe bloquearse por un valor fuera de rango, pero
     * sigue exigiendo que el valor sea numérico (o "N" si aplica) para no
     * intentar guardar texto arbitrario en una columna decimal.
     */
    public function withoutRange(): self
    {
        return new self($this->fieldType, $this->allowNeutral, enforceRange: false);
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if ($value === null || $value === '') {
            return;
        }

        if ($this->allowNeutral && is_string($value) && strtoupper(trim($value)) === 'N') {
            return;
        }

        if (! is_numeric($value)) {
            $fail('El campo :attribute debe ser un valor numérico.');

            return;
        }

        if (! $this->enforceRange) {
            return;
        }

        $range = $this->ranges[$this->fieldType] ?? null;
        if (! $range) {
            return;
        }

        $numValue = (float) $value;

        if ($numValue < $range['min'] || $numValue > $range['max']) {
            $fail("El campo :attribute debe estar entre {$range['min']} y {$range['max']}.");
        }
    }
}
