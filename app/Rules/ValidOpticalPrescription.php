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
        private string $fieldType = 'sphere' // sphere|cylinder|axis|add|prism|pd|va
    ) {}

    private array $ranges = [
        'sphere'   => ['min' => -30.0, 'max' => 30.0,  'step' => 0.25],
        'cylinder' => ['min' => -10.0, 'max' => 10.0,  'step' => 0.25],
        'axis'     => ['min' => 1,     'max' => 180,   'step' => 1],
        'add'      => ['min' => 0.25,  'max' => 4.0,   'step' => 0.25],
        'prism'    => ['min' => 0.0,   'max' => 20.0,  'step' => 0.25],
        'pd'       => ['min' => 20,    'max' => 40,    'step' => 0.5],
        'va'       => ['min' => 0.0,   'max' => 2.0,   'step' => 0.01],
    ];

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if ($value === null || $value === '') return;

        if (!is_numeric($value)) {
            $fail('El campo :attribute debe ser un valor numérico.');
            return;
        }

        $range = $this->ranges[$this->fieldType] ?? null;
        if (!$range) return;

        $numValue = (float) $value;

        if ($numValue < $range['min'] || $numValue > $range['max']) {
            $fail("El campo :attribute debe estar entre {$range['min']} y {$range['max']}.");
        }
    }
}
