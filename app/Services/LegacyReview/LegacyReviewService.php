<?php

namespace App\Services\LegacyReview;

use App\Models\LegacyReviewBatch;
use App\Models\MaintenanceOperation;
use App\Models\User;
use App\Services\DatabaseBackupService;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Pantalla "Revision de datos heredados": lista las consultas importadas de un
 * caso con lo que hay y lo que se propone, aplica lo elegido y lo deshace.
 *
 * El servidor nunca escribe valores que mande el navegador: al aplicar vuelve a
 * evaluar cada consulta con los datos de ese momento. Cada valor cambiado queda
 * en `consultation_legacy_repairs` con el valor anterior y el `batch_id`.
 */
class LegacyReviewService
{
    /** Estado de una fila sin nada que hacer: no se lista, solo se cuenta. */
    public const STATUS_OK = 'igual';

    private const CHUNK = 500;

    /** @var array<string, LegacyReviewCase> */
    private array $cases;

    public function __construct(private readonly DatabaseBackupService $backups)
    {
        $this->cases = collect([
            new AvscFromRxUsoCase,
            new SoftContactLensPowerCase,
            new TrialLensFlatCase,
            new ContactLensBrandCase,
        ])
            ->keyBy(fn (LegacyReviewCase $case) => $case->key())
            ->all();
    }

    /** @return list<array<string, mixed>> */
    public function cases(): array
    {
        return array_values(array_map(fn (LegacyReviewCase $case) => $this->caseInfo($case), $this->cases));
    }

    public function find(string $key): ?LegacyReviewCase
    {
        return $this->cases[$key] ?? null;
    }

    public function caseInfo(LegacyReviewCase $case): array
    {
        return [
            'key' => $case->key(),
            'label' => $case->label(),
            'description' => $case->description(),
            'columns' => $case->columns(),
            'row_columns' => $case->rowColumns(),
            'statuses' => $case->statuses(),
            'flags' => $case->flags(),
            'filters' => array_map(fn (array $filter) => ['value' => $filter['value'], 'label' => $filter['label']], $case->filters()),
            // Cada contador lleva el filtro que muestra esas filas (o null), para poder pulsarlo.
            'cards' => array_map(fn (array $card) => [
                ...$card,
                'filter' => collect($case->filters())->first(fn ($filter) => $filter['match'] === $card['match'])['value'] ?? null,
            ], $case->cards()),
        ];
    }

    /**
     * Pagina de filas que cumplen los filtros, con el resumen del caso entero
     * (con la busqueda y las fechas, sin el filtro de estado).
     *
     * @param  array{search?: ?string, from?: ?string, to?: ?string, status?: ?string}  $filters
     */
    public function list(LegacyReviewCase $case, array $filters, int $page = 1, int $perPage = 25): array
    {
        $all = $this->evaluateAll($case, $filters, includeOk: true);
        $rows = array_filter($all, fn (array $row) => $row['status'] !== self::STATUS_OK);
        $summary = $this->summary($case, $rows, count($all) - count($rows));

        $filtered = array_values(array_filter($rows, fn (array $row) => $this->matchesStatus($case, $row, $filters['status'] ?? null)));
        $total = count($filtered);
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min(max(1, $page), $lastPage);

        $data = array_map(
            fn (array $row) => $this->publicRow($row),
            array_slice($filtered, ($page - 1) * $perPage, $perPage),
        );

        return [
            'data' => $data,
            'current_page' => $page,
            'last_page' => $lastPage,
            'per_page' => $perPage,
            'total' => $total,
            'selectable_total' => count(array_filter($filtered, fn ($row) => $row['selectable'])),
            'preselected_total' => count(array_filter($filtered, fn ($row) => $row['preselected'])),
            'summary' => $summary,
        ];
    }

    /**
     * Lo que haria `apply()` con esa seleccion, sin escribir.
     *
     * @param  array{ids?: list<int>, all?: bool, except?: list<int>, filters?: array}  $selection
     */
    public function preview(LegacyReviewCase $case, array $selection, int $examples = 10): array
    {
        $rows = $this->selectedRows($case, $selection);

        $flags = [];
        foreach ($rows as $row) {
            foreach ($row['flags'] as $flag) {
                $flags[$flag] = ($flags[$flag] ?? 0) + 1;
            }
        }

        return [
            'consultations' => count($rows),
            'changes' => array_sum(array_map(fn ($row) => count($row['changes']), $rows)),
            'flags' => $flags,
            'examples' => array_map(fn ($row) => $this->publicRow($row), array_slice(array_values($rows), 0, $examples)),
        ];
    }

    /**
     * Aplica la seleccion: backup, cambios y bitacora del lote.
     *
     * @param  array{ids?: list<int>, all?: bool, except?: list<int>, filters?: array}  $selection
     */
    public function apply(LegacyReviewCase $case, array $selection, User $user): LegacyReviewBatch
    {
        $rows = $this->selectedRows($case, $selection);
        if ($rows === []) {
            throw new RuntimeException('No hay consultas seleccionadas que se puedan corregir.');
        }

        $backup = $this->backup($user);

        $batch = LegacyReviewBatch::create([
            'user_id' => $user->id,
            'case_key' => $case->key(),
            'backup_operation_id' => $backup?->id,
        ]);

        $consultations = 0;
        $changes = 0;

        foreach (array_chunk(array_keys($rows), self::CHUNK) as $ids) {
            DB::transaction(function () use ($case, $ids, $batch, &$consultations, &$changes) {
                // Se vuelve a leer dentro de la transaccion: nada de lo que se escribe viene del navegador.
                foreach ($case->evaluate($ids) as $id => $row) {
                    if (! $row['selectable']) {
                        continue;
                    }

                    $written = $this->write($case, $batch, $id, $row['changes']);
                    if ($written > 0) {
                        $consultations++;
                        $changes += $written;
                    }
                }
            });
        }

        $batch->update(['consultations' => $consultations, 'changes' => $changes]);

        return $batch->fresh();
    }

    /**
     * Deshace un lote. Un ojo solo se restaura si todos sus valores siguen como
     * los dejo el lote; si alguien edito uno despues, el ojo entero se deja.
     */
    public function revert(LegacyReviewBatch $batch, User $user): LegacyReviewBatch
    {
        if ($batch->reverted_at !== null) {
            throw new RuntimeException('Este lote ya se deshizo.');
        }

        $restored = 0;
        $skipped = [];

        DB::table('consultation_legacy_repairs')
            ->where('batch_id', $batch->id)
            ->orderBy('id')
            ->get()
            ->groupBy(fn ($log) => $log->consultation_id.'|'.$this->eyeOf($log->column_name))
            ->chunk(self::CHUNK)
            ->each(function ($groups) use (&$restored, &$skipped) {
                DB::transaction(function () use ($groups, &$restored, &$skipped) {
                    foreach ($groups as $logs) {
                        $targets = [];
                        foreach ($logs as $log) {
                            $target = $this->revertTarget($log);
                            if ($target === null) {
                                $skipped[] = (int) $log->consultation_id;

                                continue 2;
                            }
                            $targets[] = [$target, $log];
                        }

                        foreach ($targets as [[$table, $id], $log]) {
                            DB::table($table)->where('id', $id)->update([$log->column_name => $log->old_value]);
                            $restored++;
                        }
                    }

                    DB::table('consultation_legacy_repairs')
                        ->whereIn('id', $groups->flatten()->pluck('id'))
                        ->delete();
                });
            });

        $skipped = array_values(array_unique($skipped));

        $batch->update([
            'reverted_at' => now(),
            'reverted_by' => $user->id,
            'revert_summary' => [
                'restored' => $restored,
                'skipped_consultations' => count($skipped),
                'skipped_ids' => array_slice($skipped, 0, 100),
            ],
        ]);

        return $batch->fresh();
    }

    /** @return list<array<string, mixed>> */
    public function batches(int $limit = 30): array
    {
        return LegacyReviewBatch::with(['user:id,name', 'revertedBy:id,name'])
            ->latest('id')
            ->limit($limit)
            ->get()
            ->map(fn (LegacyReviewBatch $batch) => [
                'id' => $batch->id,
                'case_key' => $batch->case_key,
                'case_label' => $this->find($batch->case_key)?->label() ?? $batch->case_key,
                'consultations' => $batch->consultations,
                'changes' => $batch->changes,
                'user' => $batch->user?->name,
                'created_at' => $batch->created_at?->toDateTimeString(),
                'reverted_at' => $batch->reverted_at?->toDateTimeString(),
                'reverted_by' => $batch->revertedBy?->name,
                'revert_summary' => $batch->revert_summary,
                'backup_operation_id' => $batch->backup_operation_id,
            ])
            ->all();
    }

    /** @return array<int, array<string, mixed>> */
    private function evaluateAll(LegacyReviewCase $case, array $filters, ?array $onlyIds = null, bool $includeOk = false): array
    {
        $query = $case->candidates($this->baseQuery($filters, $case->legacyOnly()));
        if ($onlyIds !== null) {
            $query->whereIn('c.id', $onlyIds === [] ? [0] : $onlyIds);
        }

        $ids = $query
            ->orderByDesc('c.fecha_consulta')
            ->orderByDesc('c.id')
            ->pluck('c.id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $rows = [];
        foreach (array_chunk($ids, self::CHUNK) as $chunk) {
            $rows += $case->evaluate($chunk);
        }

        return $includeOk ? $rows : array_filter($rows, fn (array $row) => $row['status'] !== self::STATUS_OK);
    }

    private function baseQuery(array $filters, bool $legacyOnly = true): Builder
    {
        $query = DB::table('consultations as c')
            ->join('patients as p', 'p.id', '=', 'c.patient_id')
            ->whereNull('c.deleted_at');

        if ($legacyOnly) {
            $query->whereNotNull('c.legacy_id');
        }

        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $like = '%'.str_replace(['%', '_'], ['\\%', '\\_'], $search).'%';
            $query->where(fn ($q) => $q
                ->where('p.nombre', 'like', $like)
                ->orWhere('p.apellido', 'like', $like)
                ->orWhere('p.cedula', 'like', $like)
                ->orWhere('p.codigo_interno', 'like', $like)
                ->orWhere('c.legacy_id', $search));
        }
        if (filled($filters['from'] ?? null)) {
            $query->where('c.fecha_consulta', '>=', $filters['from']);
        }
        if (filled($filters['to'] ?? null)) {
            $query->where('c.fecha_consulta', '<=', $filters['to']);
        }

        return $query;
    }

    /** @return array<int, array<string, mixed>> */
    private function selectedRows(LegacyReviewCase $case, array $selection): array
    {
        if (! empty($selection['all'])) {
            $except = array_flip(array_map('intval', $selection['except'] ?? []));
            $include = array_flip(array_map('intval', $selection['include'] ?? []));
            $filters = $selection['filters'] ?? [];

            // "Todas": las que vienen marcadas por defecto y cumplen el filtro de estado,
            // menos las desmarcadas, mas las no preseleccionadas que se marcaron a mano.
            return array_filter(
                $this->evaluateAll($case, $filters),
                fn (array $row, int $id) => $row['selectable']
                    && ! isset($except[$id])
                    && $this->matchesStatus($case, $row, $filters['status'] ?? null)
                    && ($row['preselected'] || isset($include[$id])),
                ARRAY_FILTER_USE_BOTH,
            );
        }

        $ids = array_values(array_unique(array_map('intval', $selection['ids'] ?? [])));

        return array_filter($this->evaluateAll($case, [], $ids), fn (array $row) => $row['selectable']);
    }

    private function write(LegacyReviewCase $case, LegacyReviewBatch $batch, int $consultationId, array $changes): int
    {
        $logs = [];
        $now = now();
        $created = [];

        foreach ($changes as $change) {
            // Fila que todavia no existe (modulo de lentes de contacto): se crea una vez por tabla.
            if ($change['id'] === null) {
                if (! isset($change['create'])) {
                    continue;
                }
                $change['id'] = $created[$change['table']] ??= (int) DB::table($change['table'])->insertGetId([
                    ...$change['create'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            $logged = DB::table('consultation_legacy_repairs')
                ->where('target_table', $change['table'])
                ->where('target_id', $change['id'])
                ->where('column_name', $change['column'])
                ->where('rule', $case->rule())
                ->exists();
            // La bitacora admite un registro por columna y regla; sin el, no se podria deshacer.
            if ($logged) {
                continue;
            }

            DB::table($change['table'])->where('id', $change['id'])->update([$change['column'] => $change['new']]);

            $logs[] = [
                'consultation_id' => $consultationId,
                'target_table' => $change['table'],
                'target_id' => $change['id'],
                'column_name' => $change['column'],
                'rule' => $case->rule(),
                'batch_id' => $batch->id,
                'old_value' => $change['old'],
                'new_value' => $change['new'],
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        if ($logs !== []) {
            DB::table('consultation_legacy_repairs')->insert($logs);
        }

        return count($logs);
    }

    /**
     * Fila a restaurar, o null si el valor ya no es el que dejo el lote.
     * Guardar la consulta recrea las entradas de la RX en uso con otro id: si la
     * del lote ya no existe, se usa la entrada `orden = 0` actual.
     *
     * @return array{0: string, 1: int}|null
     */
    private function revertTarget(object $log): ?array
    {
        $table = $log->target_table;
        $row = DB::table($table)->where('id', $log->target_id)->first([$log->column_name]);

        if ($row === null && $table === 'consultation_rx_uso_entries') {
            $row = DB::table($table)
                ->where('consultation_id', $log->consultation_id)
                ->where('orden', 0)
                ->orderBy('id')
                ->first(['id', $log->column_name]);
            $id = $row?->id;
        } else {
            $id = $log->target_id;
        }

        if ($row === null) {
            return null;
        }

        $current = trim((string) ($row->{$log->column_name} ?? ''));
        $expected = trim((string) ($log->new_value ?? ''));

        return $current === $expected ? [$table, (int) $id] : null;
    }

    private function eyeOf(string $column): string
    {
        return str_ends_with($column, '_oi') ? 'oi' : (str_ends_with($column, '_od') ? 'od' : '');
    }

    /** El filtro de estado elegido, segun los `filters()` del caso; uno desconocido no filtra. */
    private function matchesStatus(LegacyReviewCase $case, array $row, ?string $status): bool
    {
        $filter = collect($case->filters())->firstWhere('value', $status ?: 'todas');

        return $this->matches($row, $filter['match'] ?? ['all']);
    }

    /** @param  list<string>  $match */
    private function matches(array $row, array $match): bool
    {
        return match ($match[0] ?? 'all') {
            'preselected' => $row['preselected'],
            'status' => $row['status'] === ($match[1] ?? null)
                || in_array($match[1] ?? null, array_column($row['eyes'] ?? [], 'status'), true),
            'flag' => in_array($match[1] ?? null, $row['flags'], true),
            default => true,
        };
    }

    private function summary(LegacyReviewCase $case, array $rows, int $ok): array
    {
        $statuses = [];
        foreach (array_keys($case->statuses()) as $status) {
            $statuses[$status] = count(array_filter($rows, fn ($row) => $this->matches($row, ['status', $status])));
        }
        $flags = [];
        foreach (array_keys($case->flags()) as $flag) {
            $flags[$flag] = count(array_filter($rows, fn ($row) => in_array($flag, $row['flags'], true)));
        }

        return [
            'candidates' => count($rows),
            'preselected' => count(array_filter($rows, fn ($row) => $row['preselected'])),
            'ok' => $ok,
            'statuses' => $statuses,
            'flags' => $flags,
            'applied' => DB::table('consultation_legacy_repairs')
                ->where('rule', $case->rule())
                ->whereNotNull('batch_id')
                ->distinct()
                ->count('consultation_id'),
        ];
    }

    /** La fila sin la lista interna de cambios, con solo cuantos son. */
    private function publicRow(array $row): array
    {
        $row['changes_count'] = count($row['changes']);
        unset($row['changes']);

        return $row;
    }

    /**
     * Backup antes de escribir, igual que la importacion en Mantenimiento. Si
     * falla, no se aplica nada.
     */
    private function backup(User $user): ?MaintenanceOperation
    {
        $operation = MaintenanceOperation::create([
            'type' => 'backup',
            'status' => 'pending',
            'user_id' => $user->id,
            'mode' => 'before-legacy-review',
            'expires_at' => now()->addDays(7),
        ]);

        try {
            return $this->backups->generate($operation, 'before-legacy-review');
        } catch (\Throwable $e) {
            $operation->update(['status' => 'failed', 'error_message' => $e->getMessage(), 'finished_at' => now()]);

            throw new RuntimeException('No se pudo generar el backup previo; no se aplicó ningún cambio.', previous: $e);
        }
    }
}
