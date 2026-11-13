<?php

namespace App\Services\LegacyReview;

use Illuminate\Database\Query\Builder;

/**
 * Un tipo de dato que la importacion del sistema anterior dejo en otro campo.
 *
 * El caso decide que consultas son candidatas y, para cada una, que hay hoy en
 * cada campo, que se propone y por que. Tambien declara como se presenta
 * (estados, avisos, filtros, contadores, columnas): la pantalla no tiene nada
 * fijo de un caso. `LegacyReviewService` se encarga de la lista, la seleccion,
 * el backup, la bitacora y deshacer. Los casos extienden `BaseLegacyReviewCase`.
 */
interface LegacyReviewCase
{
    /** Identificador en la URL (`/admin/legacy-review/{key}`). */
    public function key(): string;

    /** Regla con la que cada cambio queda en `consultation_legacy_repairs` (max. 20 caracteres). */
    public function rule(): string;

    public function label(): string;

    public function description(): string;

    /** Si solo entran consultas importadas (`legacy_id`). */
    public function legacyOnly(): bool;

    /**
     * Campos que la tabla muestra por ojo, en orden.
     *
     * @return list<array{key: string, label: string}>
     */
    public function columns(): array;

    /**
     * Campos por consulta (no por ojo): `row.fields[key] = {current, proposed}`.
     *
     * @return list<array{key: string, label: string}>
     */
    public function rowColumns(): array;

    /**
     * Estados de un ojo o de la fila. `igual` (nada que hacer) no se lista.
     *
     * @return array<string, array{label: string, tone: string}> tone: ok|warn|danger|muted
     */
    public function statuses(): array;

    /** @return array<string, array{label: string, tone: string, title: string}> */
    public function flags(): array;

    /**
     * Filtros de estado: `match` es `['all']`, `['preselected']`, `['status', x]` o `['flag', y]`.
     *
     * @return list<array{value: string, label: string, match: list<string>}>
     */
    public function filters(): array;

    /**
     * Contadores de arriba. `match` como en `filters()`, o `['applied']`.
     *
     * @return list<array{label: string, match: list<string>, tone?: string}>
     */
    public function cards(): array;

    /**
     * Restringe la consulta base (`consultations as c` unida a `patients as p`,
     * ya filtrada por busqueda y fechas) a las candidatas.
     */
    public function candidates(Builder $query): Builder;

    /**
     * Evalua las consultas con los datos actuales de la BD.
     *
     * Cada fila trae `status`, `selectable`, `preselected`, `flags`, `eyes`
     * (`{od: {status, current: {...}, proposed: {...}}}`), `fields` y
     * `changes`: la lista de valores a escribir, cada uno
     * `{table, id, column, old, new, group}`. Un cambio con `id` null y
     * `create: {consultation_id}` crea la fila (modulo de lentes) al aplicar.
     *
     * @param  list<int>  $ids
     * @return array<int, array<string, mixed>> por id de consulta
     */
    public function evaluate(array $ids): array;
}
