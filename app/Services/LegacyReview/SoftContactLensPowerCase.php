<?php

namespace App\Services\LegacyReview;

use App\Support\LegacyContactLens;
use App\Support\LegacyOpticalParser;
use Illuminate\Database\Query\Builder;

/**
 * "LENTES DE CONTACTO BLANDOS" del Access frente al Poder del lente definitivo.
 *
 * El Access guarda ese bloque (Esfera, Cilindro, Eje) en
 * `retinoscopia_{esfera,cilindro,eje}_*`, que ninguna pantalla muestra. La regla
 * `lc_blandos` lo copia al Poder si esta vacio; este caso deja verlo y corregir
 * lo que quedo:
 *
 * - `llenar`: Poder vacio. Se escribe "-4.25 -0.75 x 0".
 * - `formato`: el Poder tiene la misma medida escrita de otra forma
 *   ("-425-075x0"). Se propone normalizarla, sin marcar.
 * - `distinto`: el Poder tiene otra medida. No se toca.
 * - `nota`: lo escrito en el Access no es una medida ("AE 20/30", "Test de H +").
 *   Se agrega a las observaciones de lentes de contacto, creando el modulo si falta.
 */
class SoftContactLensPowerCase extends BaseLegacyReviewCase
{
    public const KEY = 'lc-blandos-poder';

    public const RULE = 'revision_lc_poder';

    public const NOTE_PREFIX = 'LC blandos (sistema anterior)';

    private const EYES = ['od', 'oi'];

    private const FINAL_LENS_FIELDS = ['curva_base', 'poder', 'diametro', 'h2o', 'material'];

    public function key(): string
    {
        return self::KEY;
    }

    public function rule(): string
    {
        return self::RULE;
    }

    public function label(): string
    {
        return 'Lentes de contacto blandos del sistema anterior';
    }

    public function description(): string
    {
        return 'En el sistema anterior el bloque "Lentes de contacto blandos" (esfera, cilindro, eje) no tiene casilla '
            .'en el sistema nuevo. Corregir lo lleva al "Poder" del lente definitivo cuando está vacío. '
            .'Lo que no es una medida ("AE 20/30", "Test de H +") se agrega a las observaciones de lentes de contacto. '
            .'Un Poder con otra medida no se modifica.';
    }

    public function columns(): array
    {
        return [
            ['key' => 'access', 'label' => 'LC blandos (Access)'],
            ['key' => 'poder', 'label' => 'Poder del lente definitivo'],
        ];
    }

    public function rowColumns(): array
    {
        return [['key' => 'observaciones', 'label' => 'Observaciones de lentes']];
    }

    public function statuses(): array
    {
        return [
            'llenar' => ['label' => 'Poder vacío', 'tone' => 'ok'],
            'nota' => ['label' => 'No es medida', 'tone' => 'warn'],
            'formato' => ['label' => 'Otro formato', 'tone' => 'muted'],
            'distinto' => ['label' => 'Poder distinto', 'tone' => 'danger'],
            'igual' => ['label' => 'Correcto', 'tone' => 'muted'],
            'sin_dato' => ['label' => 'Sin dato', 'tone' => 'muted'],
        ];
    }

    public function flags(): array
    {
        return [
            ...parent::flags(),
            'sin_modulo' => [
                'label' => 'Sin sección de lentes',
                'tone' => 'muted',
                'title' => 'La consulta no tiene la sección de lentes de contacto: se crea al aplicar.',
            ],
        ];
    }

    public function filters(): array
    {
        return [
            ...parent::filters(),
            ['value' => 'llenar', 'label' => 'Poder vacío', 'match' => ['status', 'llenar']],
            ['value' => 'nota', 'label' => 'No es medida', 'match' => ['status', 'nota']],
            ['value' => 'formato', 'label' => 'Otro formato', 'match' => ['status', 'formato']],
            ['value' => 'distinto', 'label' => 'Poder distinto', 'match' => ['status', 'distinto']],
        ];
    }

    public function cards(): array
    {
        return [
            ['label' => 'Candidatas', 'match' => ['all']],
            ['label' => 'Preseleccionadas', 'match' => ['preselected'], 'tone' => 'ok'],
            ['label' => 'Poder vacío', 'match' => ['status', 'llenar'], 'tone' => 'ok'],
            ['label' => 'No es medida', 'match' => ['status', 'nota'], 'tone' => 'warn'],
            ['label' => 'Otro formato', 'match' => ['status', 'formato']],
            ['label' => 'Poder distinto', 'match' => ['status', 'distinto'], 'tone' => 'danger'],
            ['label' => 'Ya corregidas', 'match' => ['applied'], 'tone' => 'muted'],
        ];
    }

    public function candidates(Builder $query): Builder
    {
        return $query->where(function ($q) {
            foreach (self::EYES as $eye) {
                foreach (['esfera', 'cilindro', 'eje'] as $part) {
                    $q->orWhere("c.retinoscopia_{$part}_{$eye}", '<>', '');
                }
            }
        });
    }

    public function evaluate(array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        $columns = [];
        foreach (self::EYES as $eye) {
            array_push($columns, "retinoscopia_esfera_{$eye}", "retinoscopia_cilindro_{$eye}", "retinoscopia_eje_{$eye}");
        }

        $consultations = $this->consultations($ids, $columns);
        $modules = $this->contactLensModules($ids);
        $edited = $this->editedIds($ids);

        $rows = [];
        foreach ($ids as $id) {
            if ($consultation = $consultations->get($id)) {
                $rows[$id] = $this->row($consultation, $modules->get($id), isset($edited[$id]));
            }
        }

        return $rows;
    }

    private function row(object $c, ?object $module, bool $edited): array
    {
        $lens = $this->decodeJson($module?->final_lens);
        $newLens = $lens;
        $observaciones = $this->clean($module?->observaciones);

        $eyes = [];
        $notes = [];

        foreach (self::EYES as $eye) {
            $parts = [
                $this->clean($c->{"retinoscopia_esfera_{$eye}"}),
                $this->clean($c->{"retinoscopia_cilindro_{$eye}"}),
                $this->clean($c->{"retinoscopia_eje_{$eye}"}),
            ];
            $written = implode(' ', array_filter($parts, fn ($part) => $part !== null));
            // Para la tabla: con rotulo, que "-4.25 -0.75 0" no se lea como una sola medida.
            $shown = implode(' · ', array_filter([
                $parts[0] !== null ? "Esf {$parts[0]}" : null,
                $parts[1] !== null ? "Cil {$parts[1]}" : null,
                $parts[2] !== null ? "Eje {$parts[2]}" : null,
            ]));
            $poder = $this->clean(is_array($lens[$eye] ?? null) ? ($lens[$eye]['poder'] ?? null) : null)
                ?? $this->clean($lens["poder_{$eye}"] ?? null);

            if ($written === '') {
                $eyes[$eye] = $this->eye('sin_dato', null, $poder, $poder);

                continue;
            }

            $power = LegacyOpticalParser::contactLensPower(...$parts);

            $status = match (true) {
                $power === null => 'nota',
                $poder === null => 'llenar',
                $poder === $power => 'igual',
                LegacyContactLens::samePower($poder, $power) => 'formato',
                default => 'distinto',
            };

            if ($status === 'nota') {
                $notes[] = strtoupper($eye).': '.$written;
            }
            if ($status === 'llenar' || $status === 'formato') {
                $newLens[$eye] = [...array_fill_keys(self::FINAL_LENS_FIELDS, null), ...(is_array($newLens[$eye] ?? null) ? $newLens[$eye] : [])];
                $newLens[$eye]['poder'] = $power;
            }

            $eyes[$eye] = $this->eye($status, $shown, $poder, in_array($status, ['llenar', 'formato'], true) ? $power : $poder);
        }

        $newObservaciones = $notes === []
            ? $observaciones
            : LegacyContactLens::appendNote($observaciones, self::NOTE_PREFIX.' '.implode(' / ', $notes));

        // Una nota que ya esta en las observaciones no es un cambio.
        foreach ($eyes as $eye => $data) {
            if ($data['status'] === 'nota' && $newObservaciones === $observaciones) {
                $eyes[$eye]['status'] = 'igual';
            }
        }

        $changes = [];
        $create = $module === null ? ['consultation_id' => (int) $c->id] : null;
        $moduleId = $module === null ? null : (int) $module->id;

        if ($newLens !== $lens) {
            $changes[] = $this->change('consultation_contact_lens_modules', $moduleId, 'final_lens', $module?->final_lens, $this->encodeJson($newLens), 'lentes', $create);
        }
        if ($newObservaciones !== $observaciones) {
            $changes[] = $this->change('consultation_contact_lens_modules', $moduleId, 'observaciones', $module?->observaciones, $newObservaciones, 'lentes', $create);
        }

        $statuses = array_column($eyes, 'status');
        $flags = [];
        if ($edited) {
            $flags[] = 'editada';
        }
        if ($module === null) {
            $flags[] = 'sin_modulo';
        }

        return [
            ...$this->baseRow($c),
            'status' => $this->rowStatus($statuses, ['distinto', 'formato', 'llenar', 'nota']),
            'selectable' => $changes !== [],
            'preselected' => $changes !== []
                && (in_array('llenar', $statuses, true) || in_array('nota', $statuses, true))
                && ! in_array('distinto', $statuses, true)
                && ! in_array('formato', $statuses, true)
                && ! $edited,
            'flags' => $flags,
            'fields' => ['observaciones' => ['current' => $observaciones, 'proposed' => $newObservaciones]],
            'eyes' => $eyes,
            'changes' => $changes,
        ];
    }

    private function eye(string $status, ?string $access, ?string $poder, ?string $proposedPoder): array
    {
        return [
            'status' => $status,
            'current' => ['access' => $access, 'poder' => $poder],
            'proposed' => ['access' => $access, 'poder' => $proposedPoder],
        ];
    }
}
