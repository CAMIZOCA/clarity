<?php

namespace App\Services\LegacyReview;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * AV.SC lejos guardada como AV.CC de la RX en uso.
 *
 * En el Access la casilla "AV.SC lejos" es `RX_EN USO_ESFERA_*`. La importacion
 * (regla `rx_uso_origen`, antes de que el parser conociera `avsc`) la copio a la
 * AV.CC de "RX en uso 1": la entrada `orden = 0` y la columna plana
 * `rx_uso_avcc_*`. La regla `avsc_origen` la devuelve a su sitio, pero necesita
 * el `.sqlite` del Access; este caso hace lo mismo con lo que ya esta en la BD.
 *
 * Por ojo:
 * - `mover`: AV.SC vacia y AV.CC llena. La AV pasa a AV.SC y la AV.CC queda vacia.
 * - `duplicado`: AV.SC igual a la AV.CC. Solo se vacia la AV.CC.
 * - `conflicto`: AV.SC con otro valor. No se toca.
 *
 * La observacion de la RX en uso no se toca nunca, aunque traiga la AV real con
 * los lentes ("OD: 20/20 CC"): se marca para que la optica la vea.
 */
class AvscFromRxUsoCase extends BaseLegacyReviewCase
{
    public const KEY = 'avsc-rx-uso';

    public const RULE = 'revision_avsc';

    private const EYES = ['od', 'oi'];

    /** Mismo largo que `consultations.avsc_*` (VARCHAR 20). */
    private const AVSC_LENGTH = 20;

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
        return 'AV.SC lejos guardada como AV.CC de la RX en uso';
    }

    public function description(): string
    {
        return 'En el sistema anterior la casilla "AV.SC lejos" (visión sin lentes) estaba junto a la RX en uso. '
            .'La importación la dejó como AV.CC de "RX en uso 1" (visión con los lentes que usa). '
            .'Corregir lleva ese valor a "AV.SC lejos" y deja vacía la AV.CC. '
            .'La observación de la RX en uso no se modifica.';
    }

    public function columns(): array
    {
        return [
            ['key' => 'avsc', 'label' => 'AV.SC lejos'],
            ['key' => 'avcc', 'label' => 'AV.CC (RX en uso 1)'],
        ];
    }

    public function rowColumns(): array
    {
        return [['key' => 'observacion', 'label' => 'Observación RX en uso']];
    }

    public function statuses(): array
    {
        return [
            'mover' => ['label' => 'Mover', 'tone' => 'ok'],
            'duplicado' => ['label' => 'Duplicado', 'tone' => 'muted'],
            'conflicto' => ['label' => 'Conflicto', 'tone' => 'danger'],
            'sin_dato' => ['label' => 'Sin dato', 'tone' => 'muted'],
        ];
    }

    public function flags(): array
    {
        return [
            'importacion' => ['label' => 'Escrita por la importación', 'tone' => 'ok', 'title' => 'La bitácora de la importación muestra que este valor lo puso ella.'],
            'sin_bitacora' => ['label' => 'Sin bitácora', 'tone' => 'muted', 'title' => 'No hay registro de quién escribió el valor; revisar antes de mover.'],
            ...parent::flags(),
            'nota_con_av' => ['label' => 'Observación con AV', 'tone' => 'warn', 'title' => 'La observación de la RX en uso trae una agudeza (posible AV con lentes). No se modifica.'],
            'varias_rx' => ['label' => 'Varias RX en uso', 'tone' => 'muted', 'title' => 'Solo se toca la RX en uso 1.'],
            'recorte' => ['label' => 'Se recorta a 20 caracteres', 'tone' => 'danger', 'title' => 'El valor es más largo que la columna de destino.'],
        ];
    }

    public function filters(): array
    {
        return [
            ...parent::filters(),
            ['value' => 'mover', 'label' => 'Para mover', 'match' => ['status', 'mover']],
            ['value' => 'nota_con_av', 'label' => 'Observación con AV', 'match' => ['flag', 'nota_con_av']],
            ['value' => 'duplicado', 'label' => 'Duplicadas', 'match' => ['status', 'duplicado']],
            ['value' => 'conflicto', 'label' => 'Con conflicto', 'match' => ['status', 'conflicto']],
        ];
    }

    public function cards(): array
    {
        return [
            ['label' => 'Candidatas', 'match' => ['all']],
            ['label' => 'Preseleccionadas', 'match' => ['preselected'], 'tone' => 'ok'],
            ['label' => 'Editadas en el sistema', 'match' => ['flag', 'editada'], 'tone' => 'warn'],
            ['label' => 'Observación con AV', 'match' => ['flag', 'nota_con_av'], 'tone' => 'warn'],
            ['label' => 'Con conflicto', 'match' => ['status', 'conflicto'], 'tone' => 'danger'],
            ['label' => 'Ya corregidas', 'match' => ['applied'], 'tone' => 'muted'],
        ];
    }

    public function candidates(Builder $query): Builder
    {
        $filled = fn (string $prefix) => fn ($q) => $q->where("{$prefix}avcc_od", '<>', '')->orWhere("{$prefix}avcc_oi", '<>', '');

        return $query->where(function ($q) use ($filled) {
            $q->whereExists(fn ($s) => $s->select(DB::raw(1))
                ->from('consultation_rx_uso_entries as e')
                ->whereColumn('e.consultation_id', 'c.id')
                ->where('e.orden', 0)
                ->where($filled('e.')))
                // Sin entradas, el formulario muestra la columna plana.
                ->orWhere(fn ($q) => $q
                    ->whereNotExists(fn ($s) => $s->select(DB::raw(1))
                        ->from('consultation_rx_uso_entries as e')
                        ->whereColumn('e.consultation_id', 'c.id'))
                    ->where($filled('c.rx_uso_')));
        });
    }

    public function evaluate(array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        $consultations = DB::table('consultations as c')
            ->join('patients as p', 'p.id', '=', 'c.patient_id')
            ->whereIn('c.id', $ids)
            ->get([
                'c.id', 'c.legacy_id', 'c.fecha_consulta', 'c.estado', 'c.patient_id',
                'c.avsc_od', 'c.avsc_oi', 'c.rx_uso_avcc_od', 'c.rx_uso_avcc_oi',
                'p.nombre', 'p.apellido', 'p.cedula', 'p.codigo_interno',
            ])
            ->keyBy('id');

        $entries = DB::table('consultation_rx_uso_entries')
            ->whereIn('consultation_id', $ids)
            ->orderBy('orden')
            ->orderBy('id')
            ->get(['id', 'consultation_id', 'orden', 'avcc_od', 'avcc_oi', 'observacion'])
            ->groupBy('consultation_id');

        // Lo que `rx_uso_origen` escribio en la AV.CC: si sigue igual, es la AV.SC del Access.
        $imported = [];
        DB::table('consultation_legacy_repairs')
            ->where('rule', 'rx_uso_origen')
            ->where('target_table', 'consultations')
            ->whereIn('column_name', ['rx_uso_avcc_od', 'rx_uso_avcc_oi'])
            ->whereIn('target_id', $ids)
            ->get(['target_id', 'column_name', 'new_value'])
            ->each(function ($log) use (&$imported) {
                $imported[$log->target_id][$log->column_name] = trim((string) $log->new_value);
            });

        $edited = $this->editedIds($ids);

        $rows = [];
        foreach ($ids as $id) {
            $consultation = $consultations->get($id);
            if ($consultation !== null) {
                $rows[$id] = $this->row(
                    $consultation,
                    $entries->get($id, collect())->values()->all(),
                    $imported[$id] ?? [],
                    isset($edited[$id]),
                );
            }
        }

        return $rows;
    }

    /**
     * @param  list<object>  $entries
     * @param  array<string, string>  $imported
     */
    private function row(object $c, array $entries, array $imported, bool $edited): array
    {
        $first = collect($entries)->firstWhere('orden', 0);
        $observacion = $first?->observacion !== null ? trim((string) $first->observacion) : null;

        $eyes = [];
        $changes = [];
        $fromImport = false;

        foreach (self::EYES as $eye) {
            $avsc = $this->clean($c->{"avsc_{$eye}"});
            $flat = $this->clean($c->{"rx_uso_avcc_{$eye}"});
            // El formulario muestra la entrada; sin entradas, la columna plana.
            $avcc = $entries === [] ? $flat : $this->clean($first?->{"avcc_{$eye}"});

            $status = match (true) {
                $avcc === null => 'sin_dato',
                $avsc === null => 'mover',
                $avsc === $avcc => 'duplicado',
                default => 'conflicto',
            };

            if (($imported["rx_uso_avcc_{$eye}"] ?? null) === $avcc && $avcc !== null) {
                $fromImport = true;
            }

            $proposed = ['avsc' => $avsc, 'avcc' => $avcc];

            if ($status === 'mover' || $status === 'duplicado') {
                $proposed = ['avsc' => $avsc ?? mb_substr($avcc, 0, self::AVSC_LENGTH), 'avcc' => null];

                if ($status === 'mover') {
                    $changes[] = $this->change('consultations', $c->id, "avsc_{$eye}", $c->{"avsc_{$eye}"}, $proposed['avsc'], $eye);
                }
                // Solo se vacia donde esta ese mismo texto: una columna plana distinta se respeta.
                if ($flat === $avcc) {
                    $changes[] = $this->change('consultations', $c->id, "rx_uso_avcc_{$eye}", $c->{"rx_uso_avcc_{$eye}"}, null, $eye);
                }
                if ($first !== null && $this->clean($first->{"avcc_{$eye}"}) === $avcc) {
                    $changes[] = $this->change('consultation_rx_uso_entries', $first->id, "avcc_{$eye}", $first->{"avcc_{$eye}"}, null, $eye);
                }
            }

            $eyes[$eye] = [
                'status' => $status,
                'current' => ['avsc' => $avsc, 'avcc' => $avcc],
                'proposed' => $proposed,
                'truncated' => $avcc !== null && $status === 'mover' && mb_strlen($avcc) > self::AVSC_LENGTH,
            ];
        }

        $statuses = array_column($eyes, 'status');
        $status = match (true) {
            in_array('conflicto', $statuses, true) => 'conflicto',
            in_array('mover', $statuses, true) => 'mover',
            in_array('duplicado', $statuses, true) => 'duplicado',
            default => 'sin_dato',
        };

        $flags = [];
        $flags[] = $fromImport ? 'importacion' : 'sin_bitacora';
        if ($edited) {
            $flags[] = 'editada';
        }
        if ($observacion !== null && preg_match('/\d+\s*\/\s*\d+/', $observacion) === 1) {
            $flags[] = 'nota_con_av';
        }
        if (count($entries) > 1) {
            $flags[] = 'varias_rx';
        }
        if (in_array(true, array_column($eyes, 'truncated'), true)) {
            $flags[] = 'recorte';
        }

        $selectable = $changes !== [];

        return [
            'id' => (int) $c->id,
            'legacy_id' => $c->legacy_id,
            'fecha_consulta' => $c->fecha_consulta,
            'estado' => $c->estado,
            'patient' => $this->patient($c),
            'status' => $status,
            'selectable' => $selectable,
            'preselected' => $selectable
                && in_array('mover', $statuses, true)
                && ! in_array('conflicto', $statuses, true)
                && ! $edited,
            'flags' => $flags,
            'observacion' => $observacion,
            'fields' => ['observacion' => ['current' => $observacion, 'proposed' => $observacion]],
            'eyes' => $eyes,
            'changes' => $changes,
        ];
    }
}
