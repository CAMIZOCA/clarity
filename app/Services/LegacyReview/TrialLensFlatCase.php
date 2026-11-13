<?php

namespace App\Services\LegacyReview;

use App\Support\LegacyContactLens;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Lente de prueba importado con claves planas.
 *
 * La importacion guardo `test_lens` como `{bc_od, poder_od, sobreref_od, av_od, ...}`
 * y el formulario lee `test_lens.od.curva_base`: la tabla "Lente de prueba" sale
 * vacia aunque el dato este guardado. Corregir lo pasa a la forma del
 * formulario (solo casillas vacias). Lo que no tiene casilla (calificacion, tipo
 * de lente) o choca con una casilla ya llena va a las observaciones de lentes.
 */
class TrialLensFlatCase extends BaseLegacyReviewCase
{
    public const KEY = 'lc-lente-prueba';

    public const RULE = 'revision_lc_prueba';

    public const NOTE_PREFIX = 'Lente de prueba (sistema anterior)';

    private const EYES = ['od', 'oi'];

    /** Claves que delatan un lente de prueba plano. */
    private const FLAT_MARKERS = ['bc_', 'poder_', 'diametro_', 'material_', 'h2o_', 'sobreref_', 'av_', 'calificacion', 'gas_permeable', 'tipo_lente', 'blando'];

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
        return 'Lente de prueba importado que no se ve en la consulta';
    }

    public function description(): string
    {
        return 'La importación guardó el lente de prueba (curva base, poder, diámetro, sobre-refracción, AV) en un formato '
            .'que la tabla "Lente de prueba" no lee: el dato está, pero la tabla sale vacía. Corregir lo pasa a la tabla, '
            .'sin pisar casillas ya escritas. Lo que no tiene casilla (calificación, tipo de lente) se agrega a las '
            .'observaciones de lentes de contacto.';
    }

    public function columns(): array
    {
        return [['key' => 'lente', 'label' => 'Lente de prueba']];
    }

    public function rowColumns(): array
    {
        return [['key' => 'observaciones', 'label' => 'Observaciones de lentes']];
    }

    public function statuses(): array
    {
        return [
            'mover' => ['label' => 'Pasar a la tabla', 'tone' => 'ok'],
            'igual' => ['label' => 'Correcto', 'tone' => 'muted'],
            'sin_dato' => ['label' => 'Sin dato', 'tone' => 'muted'],
        ];
    }

    public function flags(): array
    {
        return [
            ...parent::flags(),
            'con_notas' => [
                'label' => 'Datos a observaciones',
                'tone' => 'warn',
                'title' => 'Hay datos sin casilla en la tabla (calificación, tipo de lente) o que chocan con una casilla escrita: van a las observaciones.',
            ],
        ];
    }

    public function filters(): array
    {
        return [
            ...parent::filters(),
            ['value' => 'con_notas', 'label' => 'Con datos a observaciones', 'match' => ['flag', 'con_notas']],
        ];
    }

    public function cards(): array
    {
        return [
            ['label' => 'Candidatas', 'match' => ['all']],
            ['label' => 'Preseleccionadas', 'match' => ['preselected'], 'tone' => 'ok'],
            ['label' => 'Editadas en el sistema', 'match' => ['flag', 'editada'], 'tone' => 'warn'],
            ['label' => 'Con datos a observaciones', 'match' => ['flag', 'con_notas'], 'tone' => 'warn'],
            ['label' => 'Ya corregidas', 'match' => ['applied'], 'tone' => 'muted'],
        ];
    }

    public function candidates(Builder $query): Builder
    {
        return $query->whereExists(fn ($s) => $s->select(DB::raw(1))
            ->from('consultation_contact_lens_modules as m')
            ->whereColumn('m.consultation_id', 'c.id')
            ->where(function ($q) {
                // `_` es comodin en LIKE: se escapa con `!`. Se confirma en PHP.
                foreach (self::FLAT_MARKERS as $marker) {
                    $q->orWhereRaw("m.test_lens like ? escape '!'", ['%"'.str_replace('_', '!_', $marker).'%']);
                }
            }));
    }

    public function evaluate(array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        $consultations = $this->consultations($ids);
        $modules = $this->contactLensModules($ids);
        $edited = $this->editedIds($ids);

        $rows = [];
        foreach ($ids as $id) {
            $consultation = $consultations->get($id);
            $module = $modules->get($id);
            if ($consultation !== null && $module !== null) {
                $rows[$id] = $this->row($consultation, $module, isset($edited[$id]));
            }
        }

        return $rows;
    }

    private function row(object $c, object $module, bool $edited): array
    {
        $current = $this->decodeJson($module->test_lens);
        $observaciones = $this->clean($module->observaciones);

        if (! LegacyContactLens::hasFlatTestLens($current)) {
            return [...$this->baseRow($c), 'status' => LegacyReviewService::STATUS_OK, 'selectable' => false,
                'preselected' => false, 'flags' => [], 'fields' => [], 'eyes' => [], 'changes' => []];
        }

        $nested = LegacyContactLens::nestTestLens($current);
        $newObservaciones = $nested['notes'] === []
            ? $observaciones
            : LegacyContactLens::appendNote($observaciones, self::NOTE_PREFIX.': '.implode(' / ', $nested['notes']));

        $eyes = [];
        foreach (self::EYES as $eye) {
            $before = LegacyContactLens::summary($current, $eye);
            $after = LegacyContactLens::summary($nested['lens'], $eye);
            $eyes[$eye] = [
                'status' => $before === $after ? 'sin_dato' : 'mover',
                'current' => ['lente' => $before],
                'proposed' => ['lente' => $after],
            ];
        }

        $changes = [
            $this->change('consultation_contact_lens_modules', (int) $module->id, 'test_lens', $module->test_lens, $this->encodeJson($nested['lens']), 'lentes'),
        ];
        if ($newObservaciones !== $observaciones) {
            $changes[] = $this->change('consultation_contact_lens_modules', (int) $module->id, 'observaciones', $module->observaciones, $newObservaciones, 'lentes');
        }

        $flags = [];
        if ($edited) {
            $flags[] = 'editada';
        }
        if ($nested['notes'] !== []) {
            $flags[] = 'con_notas';
        }

        return [
            ...$this->baseRow($c),
            'status' => 'mover',
            'selectable' => true,
            'preselected' => ! $edited,
            'flags' => $flags,
            'fields' => ['observaciones' => ['current' => $observaciones, 'proposed' => $newObservaciones]],
            'eyes' => $eyes,
            'changes' => $changes,
        ];
    }
}
