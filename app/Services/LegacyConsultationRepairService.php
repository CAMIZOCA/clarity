<?php

namespace App\Services;

use App\Support\LegacyOpticalParser;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PDO;

/**
 * Repara las consultas importadas del sistema anterior de Optica Andina.
 *
 * La importacion leyo las medidas tal cual estaban escritas y en las columnas
 * que decia el sistema viejo (ver `LegacyOpticalParser` para el detalle). Aqui
 * se corrige lo que ya quedo guardado, sin el respaldo original: solo se tocan
 * consultas con `legacy_id` y cada cambio se anota en
 * `consultation_legacy_repairs` con el valor anterior, de modo que nada se
 * pierde, se puede revertir y volver a correr el comando no repite el arreglo.
 *
 * Con el respaldo original (`repairFromSource`) se recupera ademas lo que la
 * importacion nunca trajo: el subjetivo y la RX en uso venian como un solo
 * texto por ojo y solo se guardo su primer numero.
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

    /** Subjetivo completo desde el respaldo: el "cilindro" importado era la refraccion entera. */
    public const RULE_SUBJ_SOURCE = 'subj_origen';

    /** RX en uso completa desde el respaldo: la receta entera estaba en "eje". */
    public const RULE_RX_USO_SOURCE = 'rx_uso_origen';

    /**
     * AV.SC lejos desde el respaldo: la agudeza de RX_EN USO_ESFERA es la casilla
     * "AV.SC lejos" del Access y la importacion la dejo como AV.CC de la RX en uso.
     */
    public const RULE_AVSC_SOURCE = 'avsc_origen';

    /**
     * Lentes de contacto blandos: el Access guarda su esfera, cilindro y eje en
     * RETINOSCOPIA_ESFERA/CILINDRO/EJE, que la importacion copio a columnas que
     * ninguna pantalla muestra. Pasan a "Poder" del lente definitivo.
     */
    public const RULE_SOFT_CONTACT_LENS = 'lc_blandos';

    public const DEFAULT_RULES = [self::RULE_DECIMALS, self::RULE_RX_USO, self::RULE_ARK, self::RULE_SOFT_CONTACT_LENS];

    /** Reglas que necesitan el respaldo original: solo corren con `repairFromSource`. */
    public const SOURCE_RULES = [self::RULE_SUBJ_SOURCE, self::RULE_RX_USO_SOURCE, self::RULE_AVSC_SOURCE];

    public const RULES = [
        self::RULE_DECIMALS, self::RULE_RX_USO, self::RULE_ARK, self::RULE_SUBJ,
        self::RULE_SUBJ_SOURCE, self::RULE_RX_USO_SOURCE, self::RULE_AVSC_SOURCE,
        self::RULE_SOFT_CONTACT_LENS,
    ];

    private const CONSULTATIONS = 'consultations';

    private const RX_USO_ENTRIES = 'consultation_rx_uso_entries';

    private const CONTACT_LENS_MODULES = 'consultation_contact_lens_modules';

    /** Casillas de cada ojo del lente definitivo en el formulario (`final_lens.od.*`). */
    private const FINAL_LENS_FIELDS = ['curva_base', 'poder', 'diametro', 'h2o', 'material'];

    /** Claves planas que dejaba el importador (`poder_od`) y su casilla. */
    private const FLAT_FINAL_LENS_FIELDS = ['cb' => 'curva_base', 'poder' => 'poder', 'diametro' => 'diametro', 'h2o' => 'h2o', 'material' => 'material'];

    /** Claves planas sin casilla en el formulario: van a la observacion del lente. */
    private const FLAT_FINAL_LENS_NOTES = ['av' => 'AV', 'color' => 'Color'];

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

    private const SOURCE_TABLE = 'HISTORIAL OPTAMOLOGIA';

    private const EYES = ['od' => 'OD', 'oi' => 'OI'];

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
        $this->start($rules, $examples);

        $columns = array_values(array_unique([
            'id', ...self::DECIMAL_COLUMNS, ...self::TEXT_COLUMNS, ...$this->rxUsoColumns('rx_uso_'),
            ...$this->softContactLensColumns(),
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
                $modules = in_array(self::RULE_SOFT_CONTACT_LENS, $rules, true)
                    ? DB::table(self::CONTACT_LENS_MODULES)
                        ->whereIn('consultation_id', $consultations->pluck('id'))
                        ->get(['id', 'consultation_id', 'final_lens'])
                        ->keyBy('consultation_id')
                    : collect();

                $changes = [];
                foreach ($consultations as $consultation) {
                    $row = (array) $consultation;
                    $id = (int) $row['id'];

                    foreach ($rules as $rule) {
                        $found = match ($rule) {
                            self::RULE_SOFT_CONTACT_LENS => $this->softContactLensChanges($id, $row, $modules->get($id), $dryRun),
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

                        $this->collect($rule, $id, $found, $changes);
                    }
                }

                if (! $dryRun && $changes !== []) {
                    $this->apply($changes);
                }
            });

        return $this->report;
    }

    /**
     * Recupera del respaldo original (el SQLite convertido del Access) el
     * subjetivo y la RX en uso completos de las consultas ya importadas.
     *
     * Solo toca un ojo cuyos valores siguen siendo los que dejo la importacion;
     * lo corregido a mano en este sistema se respeta.
     *
     * @param  list<string>  $rules
     * @return array{rules: array<string, array{consultations: int, changes: int, examples: list<array>}>, anomalies: list<array>}
     */
    public function repairFromSource(PDO $source, array $rules = self::SOURCE_RULES, bool $dryRun = false, int $examples = 20): array
    {
        $this->start($rules, $examples);

        $columns = ['id', 'legacy_id', 'rx_uso_avcc_od', 'rx_uso_avcc_oi', 'rx_uso_esfera_od_neutral', 'rx_uso_esfera_oi_neutral', 'avsc_od', 'avsc_oi'];
        foreach (array_keys(self::EYES) as $eye) {
            array_push(
                $columns,
                "subj_esfera_{$eye}", "subj_cilindro_{$eye}", "subj_eje_{$eye}", "subj_avl_{$eye}", "subj_esfera_{$eye}_neutral",
            );
        }
        $columns = [...$columns, ...$this->rxUsoColumns('rx_uso_')];

        DB::table(self::CONSULTATIONS)
            ->whereNotNull('legacy_id')
            ->select($columns)
            ->chunkById(500, function ($consultations) use ($source, $rules, $dryRun) {
                $originals = $this->sourceRows($source, $consultations->pluck('legacy_id')->all());
                $entries = DB::table(self::RX_USO_ENTRIES)
                    ->whereIn('consultation_id', $consultations->pluck('id'))
                    ->where('orden', 0)
                    ->get()
                    ->groupBy('consultation_id');

                $changes = [];
                foreach ($consultations as $consultation) {
                    $row = (array) $consultation;
                    $id = (int) $row['id'];
                    $original = $originals[trim((string) $row['legacy_id'])] ?? null;

                    if ($original === null) {
                        continue;
                    }

                    foreach ($rules as $rule) {
                        $found = match ($rule) {
                            self::RULE_SUBJ_SOURCE => $this->subjSourceChanges($id, $row, $original),
                            self::RULE_RX_USO_SOURCE => [
                                ...$this->rxUsoSourceChanges(self::CONSULTATIONS, $id, $row, 'rx_uso_', $original),
                                ...collect($entries->get($id, []))->flatMap(fn ($entry) => [
                                    ...$this->rxUsoSourceChanges(self::RX_USO_ENTRIES, (int) $entry->id, (array) $entry, '', $original),
                                    ...$this->rxUsoNoteChanges((int) $entry->id, (array) $entry, $original),
                                ])->all(),
                            ],
                            self::RULE_AVSC_SOURCE => $this->avscSourceChanges($id, $row, $entries->get($id, collect())->all(), $original),
                            default => [],
                        };

                        $this->collect($rule, $id, $found, $changes);
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

    /**
     * Subjetivo de cada ojo tal como lo escribio la optica en un solo campo.
     *
     * La importacion guardo en `subj_cilindro` solo el primer numero del texto
     * (que casi siempre es la esfera) y nada en esfera ni eje. Si el ojo sigue
     * asi, se reparte la refraccion completa.
     */
    private function subjSourceChanges(int $consultationId, array $row, array $original): array
    {
        $changes = [];

        foreach (self::EYES as $eye => $suffix) {
            $text = $this->raw($original, "RXPARCIAL_CILINDRO_{$suffix}");

            // Con ESFERA o EJE llenas las columnas se usaron de verdad: no hay nada que repartir.
            if ($text === null
                || $this->raw($original, "RXPARCIAL_ESFERA_{$suffix}") !== null
                || $this->raw($original, "RXPARCIAL_EJE_{$suffix}") !== null) {
                continue;
            }

            $untouched = ($row["subj_esfera_{$eye}"] ?? null) === null
                && ($row["subj_eje_{$eye}"] ?? null) === null
                && $this->oneOf($row["subj_cilindro_{$eye}"] ?? null, $this->importedDiopters($text));

            if (! $untouched) {
                continue;
            }

            $target = LegacyOpticalParser::subjective(null, $text, null, $this->raw($original, "RXPARCIAL_AVL_{$suffix}"));

            if (! $target['legible']) {
                if (preg_match('/\d/', $text) === 1) {
                    $this->anomaly($consultationId, "subj_cilindro_{$eye}", $text, 'El subjetivo del respaldo no se lee como una refraccion');
                }

                continue;
            }

            $changes = [
                ...$changes,
                ...$this->measureChanges(self::CONSULTATIONS, $consultationId, $row, [
                    "subj_esfera_{$eye}" => $target['esfera'],
                    "subj_cilindro_{$eye}" => $target['cilindro'],
                    "subj_eje_{$eye}" => $target['eje'],
                ]),
                ...$this->flagChanges(self::CONSULTATIONS, $consultationId, $row, "subj_esfera_{$eye}_neutral", $target['esfera_neutral']),
                ...$this->textChanges(self::CONSULTATIONS, $consultationId, $row, "subj_avl_{$eye}", $target['avl']),
            ];
        }

        return $changes;
    }

    /**
     * RX en uso de cada ojo desde el respaldo: la receta entera estaba en EJE y
     * una agudeza en ESFERA. Un ojo sigue como lo dejo la importacion si no
     * tiene cilindro, su eje es el primer numero del texto (o ya se vacio) y su
     * esfera es la agudeza leida como numero o ese mismo primer numero.
     */
    private function rxUsoSourceChanges(string $table, int $targetId, array $row, string $prefix, array $original): array
    {
        $changes = [];

        foreach (self::EYES as $eye => $suffix) {
            $text = $this->raw($original, "RX_EN USO_EJE_{$suffix}");
            $acuity = $this->raw($original, "RX_EN USO_ESFERA_{$suffix}");
            if ($text === null && $acuity === null) {
                continue;
            }

            $eje = $row["{$prefix}eje_{$eye}"] ?? null;
            $literalAxis = LegacyOpticalParser::axis($text);

            $untouched = ($row["{$prefix}cilindro_{$eye}"] ?? null) === null
                && ($eje === null || ($literalAxis !== null && (int) $eje === $literalAxis))
                && $this->oneOf($row["{$prefix}esfera_{$eye}"] ?? null, [
                    null,
                    $this->legacyDecimal($acuity),
                    LegacyOpticalParser::diopter($acuity),
                    $literalAxis === null ? null : $this->scale((float) $literalAxis),
                    LegacyOpticalParser::diopter($text),
                ]);

            if (! $untouched) {
                continue;
            }

            $target = LegacyOpticalParser::rxUso(
                $acuity,
                $this->raw($original, "RX_EN USO_CILINDRO_{$suffix}"),
                $text,
                null,
                $this->raw($original, "RX_EN USO_AVCC_{$suffix}"),
            );

            $changes = [
                ...$changes,
                ...$this->measureChanges($table, $targetId, $row, [
                    "{$prefix}esfera_{$eye}" => $target['esfera'],
                    "{$prefix}cilindro_{$eye}" => $target['cilindro'],
                    "{$prefix}eje_{$eye}" => $target['eje'],
                ]),
                ...$this->flagChanges($table, $targetId, $row, "{$prefix}esfera_{$eye}_neutral", $target['esfera_neutral']),
                ...$this->textChanges($table, $targetId, $row, "{$prefix}avcc_{$eye}", $target['avcc']),
            ];
        }

        return $changes;
    }

    /**
     * AV.SC lejos de cada ojo desde el respaldo. La agudeza de RX_EN USO_ESFERA
     * pasa a `avsc` si esta vacia, y sale de la AV.CC de la RX en uso (consulta
     * y primera entrada) solo donde sigue siendo ese mismo texto; ahi queda la AV
     * escrita junto a la receta, si la habia. Un AV.SC distinta puesta a mano
     * deja el ojo como esta.
     *
     * @param  list<object>  $entries  entrada `orden = 0` de la RX en uso
     */
    private function avscSourceChanges(int $consultationId, array $row, array $entries, array $original): array
    {
        $changes = [];

        foreach (self::EYES as $eye => $suffix) {
            $target = LegacyOpticalParser::rxUso(
                $this->raw($original, "RX_EN USO_ESFERA_{$suffix}"),
                $this->raw($original, "RX_EN USO_CILINDRO_{$suffix}"),
                $this->raw($original, "RX_EN USO_EJE_{$suffix}"),
                null,
                $this->raw($original, "RX_EN USO_AVCC_{$suffix}"),
            );
            if ($target['avsc'] === null) {
                continue;
            }

            $acuity = Str::limit($target['avsc'], 20, '');
            $current = trim((string) ($row["avsc_{$eye}"] ?? ''));
            if ($current !== '' && $current !== $acuity) {
                continue;
            }

            $withRx = $target['avcc'] === null ? null : Str::limit($target['avcc'], 20, '');
            $changes = [...$changes, ...$this->textChanges(self::CONSULTATIONS, $consultationId, $row, "avsc_{$eye}", $acuity)];

            $targets = [[self::CONSULTATIONS, $consultationId, $row, "rx_uso_avcc_{$eye}"]];
            foreach ($entries as $entry) {
                $targets[] = [self::RX_USO_ENTRIES, (int) $entry->id, (array) $entry, "avcc_{$eye}"];
            }

            foreach ($targets as [$table, $targetId, $values, $column]) {
                $old = $values[$column] ?? null;
                if ($old !== null && trim((string) $old) === $acuity && $old !== $withRx) {
                    $changes[] = $this->change($table, $targetId, $column, $old, $withRx);
                }
            }
        }

        return $changes;
    }

    /** Lo que acompanaba a la receta ("prog ev gold", "No trajo") va a la observacion de la entrada. */
    private function rxUsoNoteChanges(int $entryId, array $entry, array $original): array
    {
        $notes = [];
        foreach (self::EYES as $suffix) {
            $text = $this->raw($original, "RX_EN USO_EJE_{$suffix}");
            if ($text === null) {
                continue;
            }

            $note = LegacyOpticalParser::rxUso($this->raw($original, "RX_EN USO_ESFERA_{$suffix}"), null, $text, null, null)['observacion'];
            if ($note !== null) {
                $notes[] = "{$suffix}: {$note}";
            }
        }

        return $notes === [] ? [] : $this->textChanges(self::RX_USO_ENTRIES, $entryId, $entry, 'observacion', implode(' / ', $notes), limit: null);
    }

    /** @return array<string, array<string, mixed>> Filas del respaldo por su Id (el `legacy_id` de la consulta). */
    private function sourceRows(PDO $source, array $legacyIds): array
    {
        $ids = array_values(array_unique(array_map(fn ($id) => trim((string) $id), $legacyIds)));
        if ($ids === []) {
            return [];
        }

        $statement = $source->prepare(
            'select * from "'.self::SOURCE_TABLE.'" where cast("Id" as text) in ('.implode(',', array_fill(0, count($ids), '?')).')'
        );
        $statement->execute($ids);

        $rows = [];
        foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $rows[trim((string) $row['Id'])] = $row;
        }

        return $rows;
    }

    private function raw(array $original, string $column): ?string
    {
        $value = trim((string) ($original[$column] ?? ''));

        return $value === '' ? null : $value;
    }

    /** Como leyo un texto la primera importacion: el primer numero, tal cual. */
    private function legacyDecimal(?string $raw): ?float
    {
        if ($raw === null || ! preg_match('/[-+]?\d+(?:\.\d+)?/', str_replace(',', '.', $raw), $matches)) {
            return null;
        }

        return (float) $matches[0];
    }

    /**
     * Valores que pudo dejar la importacion a partir de un texto: el primer
     * numero literal (300), ese numero ya pasado por `decimales` (3.00) o lo
     * que lee el importador actual.
     *
     * @return list<float|string|null>
     */
    private function importedDiopters(string $raw): array
    {
        $literal = $this->legacyDecimal($raw);

        return [$literal, $literal === null ? null : $this->scale($literal), LegacyOpticalParser::diopter($raw)];
    }

    private function oneOf(mixed $value, array $candidates): bool
    {
        foreach ($candidates as $candidate) {
            if ($this->sameNumber($value, $candidate)) {
                return true;
            }
        }

        return false;
    }

    private function sameNumber(mixed $a, mixed $b): bool
    {
        if ($a === null || $b === null) {
            return $a === null && $b === null;
        }

        return is_numeric($a) && is_numeric($b) && abs((float) $a - (float) $b) < 0.001;
    }

    /** @param  array<string, string|int|null>  $targets  columna => medida que debe quedar */
    private function measureChanges(string $table, int $targetId, array $row, array $targets): array
    {
        $changes = [];
        foreach ($targets as $column => $new) {
            $old = $row[$column] ?? null;
            if (! $this->sameNumber($old, $new)) {
                $changes[] = $this->change($table, $targetId, $column, $old, $new);
            }
        }

        return $changes;
    }

    /** El flag de esfera neutra solo se enciende: nunca se apaga uno puesto a mano. */
    private function flagChanges(string $table, int $targetId, array $row, string $column, bool $neutral): array
    {
        return $neutral && ! ($row[$column] ?? false)
            ? [$this->change($table, $targetId, $column, (int) ($row[$column] ?? 0), 1)]
            : [];
    }

    /** Un texto recuperado solo llena un campo vacio. */
    private function textChanges(string $table, int $targetId, array $row, string $column, ?string $new, ?int $limit = 20): array
    {
        if ($new === null || filled($row[$column] ?? null)) {
            return [];
        }

        return [$this->change($table, $targetId, $column, null, $limit === null ? $new : Str::limit($new, $limit, ''))];
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

    /**
     * Lleva la esfera, cilindro y eje de los lentes blandos del Access al
     * "Poder" del lente definitivo (`final_lens.{ojo}.poder`), solo si esa
     * casilla esta vacia. De paso deja `final_lens` en la forma que lee el
     * formulario si el importador lo guardo con claves planas (`poder_od`).
     *
     * Un ojo cuyo texto no es una medida ("Test de H +", "AE 20/30") no se
     * mueve y se informa. Si la consulta no tiene modulo de lentes de contacto
     * se crea vacio (salvo en dry-run) y el cambio queda en su `final_lens`.
     */
    private function softContactLensChanges(int $consultationId, array $row, ?object $module, bool $dryRun): array
    {
        if ($module !== null && isset($this->done[$this->key(self::CONTACT_LENS_MODULES, $module->id, 'final_lens', self::RULE_SOFT_CONTACT_LENS)])) {
            return [];
        }

        $current = $module?->final_lens !== null ? json_decode((string) $module->final_lens, true) : null;
        $current = is_array($current) ? $current : [];
        $lens = $this->nestedFinalLens($current);

        foreach (array_keys(self::EYES) as $eye) {
            $parts = [
                $row["retinoscopia_esfera_{$eye}"] ?? null,
                $row["retinoscopia_cilindro_{$eye}"] ?? null,
                $row["retinoscopia_eje_{$eye}"] ?? null,
            ];
            $written = trim(implode(' ', array_filter($parts, 'filled')));
            if ($written === '') {
                continue;
            }

            $power = LegacyOpticalParser::contactLensPower(...$parts);
            if ($power === null) {
                $this->anomaly($consultationId, "retinoscopia_esfera/cilindro/eje_{$eye}", $written, 'No es una medida de lente de contacto: se deja donde esta');

                continue;
            }

            if (blank($lens[$eye]['poder'] ?? null)) {
                $lens[$eye] = $this->finalLensEye($lens[$eye] ?? []);
                $lens[$eye]['poder'] = $power;
            }
        }

        if ($lens == $current) {
            return [];
        }

        $moduleId = $module?->id;
        if ($moduleId === null) {
            $moduleId = $dryRun ? 0 : (int) DB::table(self::CONTACT_LENS_MODULES)->insertGetId([
                'consultation_id' => $consultationId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return [$this->change(
            self::CONTACT_LENS_MODULES,
            (int) $moduleId,
            'final_lens',
            $module?->final_lens,
            json_encode($lens, JSON_UNESCAPED_UNICODE),
        )];
    }

    /**
     * `{poder_od: "-200", cb_od: "8,6"}` -> `{od: {poder: "-200", curva_base: "8,6", ...}}`.
     * Lo que no tiene casilla (AV, color, tipo de lente) pasa a `observacion`.
     */
    private function nestedFinalLens(array $current): array
    {
        $lens = $current;
        $notes = [];

        foreach ($current as $key => $value) {
            if ($key === 'tipo_lente') {
                unset($lens[$key]);
                if (filled($value)) {
                    $notes[] = 'Tipo: '.trim((string) $value);
                }

                continue;
            }

            if (! is_string($key) || ! preg_match('/^(cb|poder|diametro|h2o|material|av|color)_(od|oi)$/', $key, $matches)) {
                continue;
            }

            unset($lens[$key]);
            if (blank($value)) {
                continue;
            }

            [, $flat, $eye] = $matches;
            $value = trim((string) $value);
            $field = self::FLAT_FINAL_LENS_FIELDS[$flat] ?? null;

            if ($field !== null && blank($lens[$eye][$field] ?? null)) {
                $lens[$eye] = $this->finalLensEye($lens[$eye] ?? []);
                $lens[$eye][$field] = $value;
            } else {
                $label = self::FLAT_FINAL_LENS_NOTES[$flat] ?? $field;
                $notes[] = strtoupper($eye)." {$label}: {$value}";
            }
        }

        if ($notes !== []) {
            $lens['observacion'] = implode(' / ', array_filter([
                filled($lens['observacion'] ?? null) ? trim((string) $lens['observacion']) : null,
                ...$notes,
            ]));
        }

        return $lens;
    }

    /** Un ojo del lente definitivo con todas sus casillas. */
    private function finalLensEye(mixed $eye): array
    {
        $eye = is_array($eye) ? $eye : [];

        return $eye + array_fill_keys(self::FINAL_LENS_FIELDS, null);
    }

    /** @return list<string> */
    private function softContactLensColumns(): array
    {
        $columns = [];
        foreach (array_keys(self::EYES) as $eye) {
            foreach (['esfera', 'cilindro', 'eje'] as $part) {
                $columns[] = "retinoscopia_{$part}_{$eye}";
            }
        }

        return $columns;
    }

    /** Prepara el informe y carga de la bitacora lo que ya se aplico. */
    private function start(array $rules, int $examples): void
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
    }

    /** Suma al lote los cambios de una regla que la bitacora no tenga ya anotados. */
    private function collect(string $rule, int $consultationId, array $found, array &$changes): void
    {
        $found = array_values(array_filter(
            $found,
            fn ($change) => ! isset($this->done[$this->key($change['table'], $change['id'], $change['column'], $rule)])
        ));

        if ($found === []) {
            return;
        }

        $this->record($rule, $consultationId, $found);
        foreach ($found as $change) {
            $changes[] = $change + ['rule' => $rule, 'consultation_id' => $consultationId];
        }
    }

    /** @param  list<array>  $changes */
    private function apply(array $changes): void
    {
        DB::transaction(function () use ($changes) {
            $now = now();
            $log = [];
            // Un UPDATE por fila y no por columna: son decenas de miles de valores.
            $updates = [];

            foreach ($changes as $change) {
                $updates[$change['table']][$change['id']][$change['column']] = $change['new'];

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

            foreach ($updates as $table => $rows) {
                foreach ($rows as $id => $values) {
                    DB::table($table)->where('id', $id)->update($values);
                }
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
                    'column' => match ($change['table']) {
                        self::CONSULTATIONS => '',
                        self::CONTACT_LENS_MODULES => 'lente_contacto.',
                        default => 'entrada.',
                    }.$change['column'],
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
