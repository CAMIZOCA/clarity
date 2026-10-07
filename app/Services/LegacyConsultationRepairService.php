<?php

namespace App\Services;

use App\Support\LegacyOpticalParser;
use Illuminate\Support\Facades\DB;

/**
 * Repara las consultas importadas del sistema anterior de Optica Andina.
 *
 * La importacion leyo las medidas tal cual estaban escritas y en las columnas
 * que decia el sistema viejo (ver `LegacyOpticalParser` para el detalle). Aqui
 * se corrige lo que ya quedo guardado, sin el respaldo original: solo se tocan
 * consultas con `legacy_id` y cada cambio se anota en
 * `consultation_legacy_repairs` con el valor anterior, de modo que nada se
 * pierde, se puede revertir y volver a correr el comando no repite el arreglo.
 */
class LegacyConsultationRepairService
{
    /** Dioptrias sin punto decimal: 300 -> 3.00. */
    public const RULE_DECIMALS = 'decimales';

    /** RX en uso con las columnas corridas: la esfera estaba en "eje". */
    public const RULE_RX_USO = 'rx_uso';

    /** ARK es la retinoscopia; lo que habia en retinoscopia es el cover test. */
    public const RULE_ARK = 'ark';

    /** Subjetivo con la esfera en "cilindro". Sin confirmar: no corre por defecto. */
    public const RULE_SUBJ = 'subj';

    public const DEFAULT_RULES = [self::RULE_DECIMALS, self::RULE_RX_USO, self::RULE_ARK];

    public const RULES = [self::RULE_DECIMALS, self::RULE_RX_USO, self::RULE_ARK, self::RULE_SUBJ];

    private const CONSULTATIONS = 'consultations';

    private const RX_USO_ENTRIES = 'consultation_rx_uso_entries';

    /** Una esfera o cilindro mayor a esto no existe: el dato no se toca y se informa. */
    private const MAX_DIOPTERS = 30.0;

    /** Columnas de dioptrias de la regla `decimales`. */
    private const DECIMAL_COLUMNS = [
        'rx_final_esfera_od', 'rx_final_cilindro_od', 'rx_final_add_od',
        'rx_final_esfera_oi', 'rx_final_cilindro_oi', 'rx_final_add_oi',
        'subj_esfera_od', 'subj_cilindro_od', 'subj_esfera_oi', 'subj_cilindro_oi',
        'vc_esfera_od', 'vc_cilindro_od', 'vc_esfera_oi', 'vc_cilindro_oi',
    ];

    private const TEXT_COLUMNS = ['ark_od', 'ark_oi', 'retinoscopia_od', 'retinoscopia_oi', 'cover_test'];

    /** @var array<string, true> Cambios ya aplicados, como "tabla|id|columna|regla". */
    private array $done = [];

    private array $report = [];

    private int $exampleLimit = 20;

    /**
     * @param  list<string>  $rules
     * @return array{rules: array<string, array{consultations: int, changes: int, examples: list<array>}>, anomalies: list<array>}
     */
    public function repair(array $rules = self::DEFAULT_RULES, bool $dryRun = false, int $examples = 20): array
    {
        $this->exampleLimit = $examples;
        $this->report = ['rules' => [], 'anomalies' => []];
        foreach ($rules as $rule) {
            $this->report['rules'][$rule] = ['consultations' => 0, 'changes' => 0, 'examples' => []];
        }

        $this->done = [];
        DB::table('consultation_legacy_repairs')
            ->select(['id', 'target_table', 'target_id', 'column_name', 'rule'])
            ->chunkById(2000, function ($rows) {
                foreach ($rows as $row) {
                    $this->done[$this->key($row->target_table, $row->target_id, $row->column_name, $row->rule)] = true;
                }
            });

        $columns = array_values(array_unique([
            'id', ...self::DECIMAL_COLUMNS, ...self::TEXT_COLUMNS, ...$this->rxUsoColumns('rx_uso_'),
        ]));

        DB::table(self::CONSULTATIONS)
            ->whereNotNull('legacy_id')
            ->select($columns)
            ->chunkById(500, function ($consultations) use ($rules, $dryRun) {
                $entries = DB::table(self::RX_USO_ENTRIES)
                    ->whereIn('consultation_id', $consultations->pluck('id'))
                    ->where('orden', 0)
                    ->get(['id', 'consultation_id', ...$this->rxUsoColumns('')])
                    ->groupBy('consultation_id');

                $changes = [];
                foreach ($consultations as $consultation) {
                    $row = (array) $consultation;
                    $id = (int) $row['id'];

                    foreach ($rules as $rule) {
                        $found = match ($rule) {
                            self::RULE_DECIMALS => $this->decimalChanges($id, $row),
                            self::RULE_RX_USO => [
                                ...$this->rxUsoChanges($id, self::CONSULTATIONS, $id, $row, 'rx_uso_'),
                                ...collect($entries->get($id, []))->flatMap(
                                    fn ($entry) => $this->rxUsoChanges($id, self::RX_USO_ENTRIES, (int) $entry->id, (array) $entry, '')
                                )->all(),
                            ],
                            self::RULE_ARK => $this->arkChanges($id, $row),
                            self::RULE_SUBJ => $this->subjChanges($id, $row),
                            default => [],
                        };

                        // Lo ya anotado en la bitacora no se vuelve a aplicar.
                        $found = array_values(array_filter(
                            $found,
                            fn ($change) => ! isset($this->done[$this->key($change['table'], $change['id'], $change['column'], $rule)])
                        ));

                        if ($found === []) {
                            continue;
                        }

                        $this->record($rule, $id, $found);
                        foreach ($found as $change) {
                            $changes[] = $change + ['rule' => $rule, 'consultation_id' => $id];
                        }
                    }
                }

                if (! $dryRun && $changes !== []) {
                    $this->apply($changes);
                }
            });

        return $this->report;
    }

    /**
     * Devuelve cada valor a como estaba antes de la reparacion y borra la
     * bitacora de esas reglas, de la mas reciente a la mas antigua.
     *
     * @param  list<string>  $rules
     * @return int Valores restaurados
     */
    public function revert(array $rules = self::RULES, bool $dryRun = false): int
    {
        $restored = 0;

        DB::table('consultation_legacy_repairs')
            ->whereIn('rule', $rules)
            ->chunkByIdDesc(500, function ($repairs) use (&$restored, $dryRun) {
                $restored += $repairs->count();

                if ($dryRun) {
                    return;
                }

                DB::transaction(function () use ($repairs) {
                    foreach ($repairs as $repair) {
                        DB::table($repair->target_table)
                            ->where('id', $repair->target_id)
                            ->update([$repair->column_name => $repair->old_value]);
                    }

                    DB::table('consultation_legacy_repairs')->whereIn('id', $repairs->pluck('id'))->delete();
                });
            });

        return $restored;
    }

    /** Entero de 25 o mas: se escribio sin punto ("300" por 3.00). */
    private function scale(float $value): float
    {
        $isInteger = abs($value - round($value)) < 0.001;

        return $isInteger && abs($value) >= 25 ? round($value / 100, 2) : $value;
    }

    private function decimalChanges(int $consultationId, array $row): array
    {
        $changes = [];

        foreach (self::DECIMAL_COLUMNS as $column) {
            $old = $row[$column] ?? null;
            if ($old === null || ! is_numeric($old)) {
                continue;
            }

            $new = $this->scale((float) $old);
            if (abs($new - (float) $old) < 0.001) {
                continue;
            }

            if (abs($new) > self::MAX_DIOPTERS) {
                $this->anomaly($consultationId, $column, $old, 'Ni dividido entre 100 es una medida posible');

                continue;
            }

            $changes[] = $this->change(self::CONSULTATIONS, $consultationId, $column, $old, $this->decimal($new));
        }

        return $changes;
    }

    /**
     * RX en uso de un ojo con forma legacy: sin cilindro y con un "eje" (un eje
     * sin cilindro no existe: es la esfera) o con el 20 residual en la esfera.
     * Una receta que alguien ya corrigio a mano tiene cilindro o no tiene eje,
     * y no entra.
     */
    private function rxUsoChanges(int $consultationId, string $table, int $targetId, array $row, string $prefix): array
    {
        $changes = [];

        foreach (['od', 'oi'] as $eye) {
            $esfera = $row["{$prefix}esfera_{$eye}"] ?? null;
            $cilindro = $row["{$prefix}cilindro_{$eye}"] ?? null;
            $eje = $row["{$prefix}eje_{$eye}"] ?? null;
            $add = $row["{$prefix}add_{$eye}"] ?? null;

            // La ADD si esta en su columna: solo le falta el punto decimal.
            if ($add !== null && is_numeric($add)) {
                $newAdd = $this->scale((float) $add);
                if (abs($newAdd - (float) $add) >= 0.001 && abs($newAdd) <= self::MAX_DIOPTERS) {
                    $changes[] = $this->change($table, $targetId, "{$prefix}add_{$eye}", $add, $this->decimal($newAdd));
                }
            }

            $residualAcuity = $esfera !== null && abs((float) $esfera - 20) < 0.001;
            if ($cilindro !== null || ($eje === null && ! $residualAcuity)) {
                continue;
            }

            $newEsfera = $eje === null ? null : $this->scale((float) $eje);
            if ($newEsfera !== null && abs($newEsfera) > self::MAX_DIOPTERS) {
                $this->anomaly($consultationId, "{$prefix}eje_{$eye}", $eje, 'No es una esfera posible');

                continue;
            }

            $changes[] = $this->change($table, $targetId, "{$prefix}esfera_{$eye}", $esfera, $newEsfera === null ? null : $this->decimal($newEsfera));

            if ($eje !== null) {
                $changes[] = $this->change($table, $targetId, "{$prefix}eje_{$eye}", $eje, null);
            }
        }

        return $changes;
    }

    /**
     * Una queratometria real ("43.50/44.25@10") escrita en el campo ARK despues
     * de la importacion no es una retinoscopia y se queda donde esta.
     */
    private function looksLikeKeratometry(?string $value): bool
    {
        return $value !== null
            && (str_contains($value, '@') || preg_match('/\b(3[6-9]|4\d|5[0-2])[.,]\d{2}\b/', $value) === 1);
    }

    private function arkChanges(int $consultationId, array $row): array
    {
        foreach (['ark_od', 'ark_oi'] as $column) {
            if ($this->looksLikeKeratometry($row[$column] ?? null)) {
                $this->anomaly($consultationId, $column, $row[$column], 'Parece una queratometria: no se mueve a retinoscopia');
                $row[$column] = null;
            }
        }

        $fixed = LegacyOpticalParser::retinoscopy(
            $row['ark_od'] ?? null,
            $row['ark_oi'] ?? null,
            $row['retinoscopia_od'] ?? null,
            $row['retinoscopia_oi'] ?? null,
            $row['cover_test'] ?? null,
        );

        $changes = [];
        foreach ($fixed as $column => $new) {
            $old = $row[$column] ?? null;
            if ((string) $old !== (string) $new) {
                $changes[] = $this->change(self::CONSULTATIONS, $consultationId, $column, $old, $new);
            }
        }

        return $changes;
    }

    /** Subjetivo con esfera vacia y "cilindro" lleno: el cilindro es la esfera. */
    private function subjChanges(int $consultationId, array $row): array
    {
        $changes = [];

        foreach (['od', 'oi'] as $eye) {
            $esfera = $row["subj_esfera_{$eye}"] ?? null;
            $cilindro = $row["subj_cilindro_{$eye}"] ?? null;

            if ($esfera !== null || $cilindro === null || ! is_numeric($cilindro)) {
                continue;
            }

            // Si `decimales` ya paso por la columna, el valor esta en dioptrias.
            $alreadyScaled = isset($this->done[$this->key(self::CONSULTATIONS, $consultationId, "subj_cilindro_{$eye}", self::RULE_DECIMALS)]);
            $new = $alreadyScaled ? (float) $cilindro : $this->scale((float) $cilindro);

            if (abs($new) > self::MAX_DIOPTERS) {
                $this->anomaly($consultationId, "subj_cilindro_{$eye}", $cilindro, 'No es una esfera posible');

                continue;
            }

            $changes[] = $this->change(self::CONSULTATIONS, $consultationId, "subj_esfera_{$eye}", null, $this->decimal($new));
            $changes[] = $this->change(self::CONSULTATIONS, $consultationId, "subj_cilindro_{$eye}", $cilindro, null);
        }

        return $changes;
    }

    /** @param  list<array>  $changes */
    private function apply(array $changes): void
    {
        DB::transaction(function () use ($changes) {
            $now = now();
            $log = [];

            foreach ($changes as $change) {
                DB::table($change['table'])
                    ->where('id', $change['id'])
                    ->update([$change['column'] => $change['new']]);

                $log[] = [
                    'consultation_id' => $change['consultation_id'],
                    'target_table' => $change['table'],
                    'target_id' => $change['id'],
                    'column_name' => $change['column'],
                    'rule' => $change['rule'],
                    'old_value' => $change['old'],
                    'new_value' => $change['new'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ];

                $this->done[$this->key($change['table'], $change['id'], $change['column'], $change['rule'])] = true;
            }

            foreach (array_chunk($log, 500) as $rows) {
                DB::table('consultation_legacy_repairs')->insert($rows);
            }
        });
    }

    private function record(string $rule, int $consultationId, array $changes): void
    {
        $summary = &$this->report['rules'][$rule];
        $summary['consultations']++;
        $summary['changes'] += count($changes);

        if (count($summary['examples']) < $this->exampleLimit) {
            $summary['examples'][] = [
                'consultation_id' => $consultationId,
                'changes' => array_map(fn ($change) => [
                    'column' => ($change['table'] === self::CONSULTATIONS ? '' : 'entrada.').$change['column'],
                    'old' => $change['old'],
                    'new' => $change['new'],
                ], $changes),
            ];
        }
    }

    private function anomaly(int $consultationId, string $column, mixed $value, string $reason): void
    {
        $this->report['anomalies'][] = [
            'consultation_id' => $consultationId,
            'column' => $column,
            'value' => $value,
            'reason' => $reason,
        ];
    }

    private function change(string $table, int $id, string $column, mixed $old, mixed $new): array
    {
        return [
            'table' => $table,
            'id' => $id,
            'column' => $column,
            'old' => $old === null ? null : (string) $old,
            'new' => $new === null ? null : (string) $new,
        ];
    }

    private function decimal(float $value): string
    {
        return number_format($value, 2, '.', '');
    }

    private function key(string $table, int|string $id, string $column, string $rule): string
    {
        return "{$table}|{$id}|{$column}|{$rule}";
    }

    /** @return list<string> */
    private function rxUsoColumns(string $prefix): array
    {
        $columns = [];
        foreach (['od', 'oi'] as $eye) {
            foreach (['esfera', 'cilindro', 'eje', 'add'] as $column) {
                $columns[] = "{$prefix}{$column}_{$eye}";
            }
        }

        return $columns;
    }
}
