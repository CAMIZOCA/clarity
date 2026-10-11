<?php

namespace App\Http\Requests;

use App\Models\Consultation;
use App\Rules\ValidOpticalPrescription;

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

        $rules['patient_id'] = ['sometimes', 'integer', 'exists:patients,id'];
        $rules['fecha_consulta'] = ['sometimes', 'date', 'before_or_equal:today'];

        return $this->relaxRangesForUnchangedValues($rules);
    }

    /** Una consulta que ya estaba completada no vuelve a pasar por sus obligatorios. */
    protected function isCompleting(): bool
    {
        $consultation = $this->route('consultation');

        return parent::isCompleting()
            && ! ($consultation instanceof Consultation && $consultation->estado === 'completada');
    }

    /** En una edicion parcial, un dato que no viaja puede estar ya guardado. */
    protected function hasStoredValue(string $field): bool
    {
        $consultation = $this->route('consultation');

        if (! $consultation instanceof Consultation || $this->has($field)) {
            return false;
        }

        return $field === 'diagnoses'
            ? $consultation->diagnoses()->exists()
            : filled($consultation->getAttribute($field));
    }

    /**
     * No revalidar los rangos clinicos de un valor que el usuario no toco.
     *
     * El formulario reenvia la consulta completa en cada guardado. La importacion
     * legacy de Optica Andina dejo miles de registros con valores fuera de rango
     * (ejes > 180, esferas > 30), asi que al editar cualquier campo la consulta
     * entera era rechazada con un 422 y resultaba imposible de guardar.
     *
     * Aqui se retira la regla de rango unicamente cuando el valor enviado es
     * identico al almacenado: lo que el usuario escribe se sigue validando con
     * el mismo rigor, pero un dato heredado deja de bloquear la edicion.
     *
     * Al completar un borrador solo se perdona la receta en uso, que suele
     * venir copiada del historial. El resto lo escribio el usuario en esta
     * consulta: como el autoguardado ya lo habia persistido, llegaba "sin
     * cambios" y la consulta se completaba con un valor fuera de rango.
     */
    private function relaxRangesForUnchangedValues(array $rules): array
    {
        $consultation = $this->route('consultation');

        if (! $consultation instanceof Consultation) {
            return $rules;
        }

        $completingDraft = $this->isCompleting();

        foreach ($rules as $field => $fieldRules) {
            if (! is_array($fieldRules) || str_contains($field, '*')) {
                continue;
            }

            if ($completingDraft && ! str_starts_with($field, 'rx_uso_')) {
                continue;
            }

            $hasRangeRule = collect($fieldRules)->contains(
                fn ($rule) => $rule instanceof ValidOpticalPrescription
            );

            if (! $hasRangeRule || ! $this->has($field)) {
                continue;
            }

            if ($this->isUnchanged($this->input($field), $consultation->getAttribute($field))) {
                $rules[$field] = collect($fieldRules)
                    ->reject(fn ($rule) => $rule instanceof ValidOpticalPrescription)
                    ->values()
                    ->all();
            }
        }

        $rules = $this->relaxAxisRequirementForUnchangedCylinder($rules, $consultation);

        return $this->relaxRxUsoEntryRanges($rules, $consultation);
    }

    /**
     * El eje obligatorio de un cilindro tampoco se le exige a un dato heredado:
     * solo aplica si el cilindro o el eje cambiaron respecto de lo guardado.
     */
    private function relaxAxisRequirementForUnchangedCylinder(array $rules, Consultation $consultation): array
    {
        // Un borrador que se completa no trae datos heredados en la RX Final.
        if ($this->isCompleting()) {
            return $rules;
        }

        foreach (['od', 'oi'] as $eye) {
            $axis = "rx_final_eje_{$eye}";
            $cylinder = "rx_final_cilindro_{$eye}";

            if (! in_array('required', $rules[$axis] ?? [], true)) {
                continue;
            }

            $unchanged = $this->isUnchanged($this->input($cylinder), $consultation->getAttribute($cylinder))
                && $this->isUnchanged($this->input($axis), $consultation->getAttribute($axis));

            if ($unchanged) {
                $rules[$axis] = ['nullable', 'numeric'];
            }
        }

        return $rules;
    }

    /**
     * Mismo criterio para las recetas en uso, que viven en una tabla hija.
     *
     * Las entradas se comparan por posicion, que es como las ordena y las
     * reescribe `ConsultationService::syncModules()`.
     */
    private function relaxRxUsoEntryRanges(array $rules, Consultation $consultation): array
    {
        $submitted = $this->input('rx_uso_entries');

        if (! is_array($submitted) || $submitted === []) {
            return $rules;
        }

        $stored = $consultation->rxUsoEntries()->orderBy('orden')->get()->values();

        foreach ($submitted as $index => $entry) {
            if (! is_array($entry)) {
                continue;
            }

            $storedEntry = $stored->get($index);
            if (! $storedEntry) {
                continue;
            }

            foreach ($entry as $column => $value) {
                $key = "rx_uso_entries.*.{$column}";

                if (! isset($rules[$key]) || ! is_array($rules[$key])) {
                    continue;
                }

                if (! $this->isUnchanged($value, $storedEntry->getAttribute($column))) {
                    continue;
                }

                // La regla indexada tiene prioridad sobre la comodin `*`.
                $rules["rx_uso_entries.{$index}.{$column}"] = collect($rules[$key])
                    ->reject(fn ($rule) => $rule instanceof ValidOpticalPrescription)
                    ->values()
                    ->all();
            }
        }

        return $rules;
    }

    /** Compara numericamente cuando se puede; si no, como texto. */
    private function isUnchanged(mixed $submitted, mixed $stored): bool
    {
        if (blank($submitted) && blank($stored)) {
            return true;
        }

        if (blank($submitted) || blank($stored)) {
            return false;
        }

        if (is_numeric($submitted) && is_numeric($stored)) {
            return abs((float) $submitted - (float) $stored) < 0.001;
        }

        return (string) $submitted === (string) $stored;
    }
}
