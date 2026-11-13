<?php

namespace App\Services\LegacyReview;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Lo comun de los casos: valores por defecto de la presentacion y ayudas para
 * armar filas y cambios.
 */
abstract class BaseLegacyReviewCase implements LegacyReviewCase
{
    public function legacyOnly(): bool
    {
        return true;
    }

    public function rowColumns(): array
    {
        return [];
    }

    public function flags(): array
    {
        return [
            'editada' => [
                'label' => 'Editada en el sistema',
                'tone' => 'warn',
                'title' => 'Alguien guardó esta consulta en el sistema nuevo. No viene seleccionada.',
            ],
        ];
    }

    public function filters(): array
    {
        return [
            ['value' => 'todas', 'label' => 'Todas las candidatas', 'match' => ['all']],
            ['value' => 'preseleccionadas', 'label' => 'Preseleccionadas', 'match' => ['preselected']],
            ['value' => 'editadas', 'label' => 'Editadas en el sistema', 'match' => ['flag', 'editada']],
        ];
    }

    public function cards(): array
    {
        return [
            ['label' => 'Candidatas', 'match' => ['all']],
            ['label' => 'Preseleccionadas', 'match' => ['preselected'], 'tone' => 'ok'],
            ['label' => 'Editadas en el sistema', 'match' => ['flag', 'editada'], 'tone' => 'warn'],
            ['label' => 'Ya corregidas', 'match' => ['applied'], 'tone' => 'muted'],
        ];
    }

    /**
     * Consultas guardadas en el sistema nuevo (auditoria). Lo que alguien ya
     * toco a mano no viene marcado por defecto.
     *
     * @param  list<int>  $ids
     * @return array<int, int> ids como claves
     */
    protected function editedIds(array $ids): array
    {
        return DB::table('activity_log')
            ->where('subject_type', 'App\\Models\\Consultation')
            ->whereIn('description', ['consultation_updated', 'consultation_completed'])
            ->whereIn('subject_id', $ids)
            ->distinct()
            ->pluck('subject_id')
            ->map(fn ($id) => (int) $id)
            ->flip()
            ->all();
    }

    /**
     * Consultas con los datos del paciente y las columnas pedidas, por id.
     *
     * @param  list<int>  $ids
     * @param  list<string>  $columns  columnas de `consultations` (sin prefijo)
     * @return Collection<int, object>
     */
    protected function consultations(array $ids, array $columns = []): Collection
    {
        return DB::table('consultations as c')
            ->join('patients as p', 'p.id', '=', 'c.patient_id')
            ->whereIn('c.id', $ids)
            ->get([
                'c.id', 'c.legacy_id', 'c.fecha_consulta', 'c.estado', 'c.patient_id',
                ...array_map(fn ($column) => "c.{$column}", $columns),
                'p.nombre', 'p.apellido', 'p.cedula', 'p.codigo_interno',
            ])
            ->keyBy('id');
    }

    /**
     * Primer modulo de lentes de contacto de cada consulta.
     *
     * @param  list<int>  $ids
     * @return Collection<int, object>
     */
    protected function contactLensModules(array $ids): Collection
    {
        return DB::table('consultation_contact_lens_modules')
            ->whereIn('consultation_id', $ids)
            ->orderBy('id')
            ->get(['id', 'consultation_id', 'final_lens', 'test_lens', 'observaciones'])
            ->unique('consultation_id')
            ->keyBy('consultation_id');
    }

    /** Lo comun de toda fila: consulta y paciente. */
    protected function baseRow(object $c): array
    {
        return [
            'id' => (int) $c->id,
            'legacy_id' => $c->legacy_id,
            'fecha_consulta' => $c->fecha_consulta,
            'estado' => $c->estado,
            'patient' => $this->patient($c),
        ];
    }

    /**
     * Estado de la fila a partir de los ojos: el primero de `$priority` que
     * aparezca, o `igual` si no hay nada que hacer.
     *
     * @param  list<string>  $eyeStatuses
     * @param  list<string>  $priority
     */
    protected function rowStatus(array $eyeStatuses, array $priority): string
    {
        foreach ($priority as $status) {
            if (in_array($status, $eyeStatuses, true)) {
                return $status;
            }
        }

        return LegacyReviewService::STATUS_OK;
    }

    /** @return array{id: int, nombre_completo: string, cedula: ?string, codigo_interno: ?string} */
    protected function patient(object $row): array
    {
        return [
            'id' => (int) $row->patient_id,
            'nombre_completo' => trim(($row->nombre ?? '').' '.($row->apellido ?? '')),
            'cedula' => $row->cedula,
            'codigo_interno' => $row->codigo_interno,
        ];
    }

    protected function change(string $table, ?int $id, string $column, mixed $old, ?string $new, string $group, ?array $create = null): array
    {
        return array_filter([
            'table' => $table,
            'id' => $id,
            'column' => $column,
            'old' => $old === null ? null : (string) $old,
            'new' => $new,
            'group' => $group,
            'create' => $create,
        ], fn ($value, $key) => $key !== 'create' || $value !== null, ARRAY_FILTER_USE_BOTH);
    }

    protected function clean(mixed $value): ?string
    {
        $value = trim((string) ($value ?? ''));

        return $value === '' ? null : $value;
    }

    /** @return array<string, mixed> */
    protected function decodeJson(mixed $value): array
    {
        $decoded = is_string($value) ? json_decode($value, true) : null;

        return is_array($decoded) ? $decoded : [];
    }

    protected function encodeJson(array $value): string
    {
        return json_encode($value, JSON_UNESCAPED_UNICODE);
    }
}
