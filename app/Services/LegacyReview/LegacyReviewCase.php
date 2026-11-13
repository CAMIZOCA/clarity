<?php

namespace App\Services\LegacyReview;

use Illuminate\Database\Query\Builder;

/**
 * Un tipo de dato que la importacion del sistema anterior dejo en otro campo.
 *
 * El caso decide que consultas son candidatas y, para cada una, que hay hoy en
 * cada campo, que se propone y por que. `LegacyReviewService` se encarga de la
 * lista, la seleccion, el backup, la bitacora y deshacer.
 */
interface LegacyReviewCase
{
    /** Identificador en la URL (`/admin/legacy-review/{key}`). */
    public function key(): string;

    /** Regla con la que cada cambio queda en `consultation_legacy_repairs` (max. 20 caracteres). */
    public function rule(): string;

    public function label(): string;

    public function description(): string;

    /**
     * Campos que la tabla muestra por ojo, en orden.
     *
     * @return list<array{key: string, label: string}>
     */
    public function columns(): array;

    /**
     * Restringe la consulta base (`consultations as c` unida a `patients as p`,
     * ya filtrada por importadas, busqueda y fechas) a las candidatas.
     */
    public function candidates(Builder $query): Builder;

    /**
     * Evalua las consultas con los datos actuales de la BD.
     *
     * Cada fila trae `status`, `selectable`, `preselected`, `flags`, `eyes`
     * (`{od: {status, current: {...}, proposed: {...}}}`) y `changes`: la lista
     * de valores a escribir, cada uno `{table, id, column, old, new, group}`.
     * `group` agrupa lo que se deshace junto (un ojo de una consulta).
     *
     * @param  list<int>  $ids
     * @return array<int, array<string, mixed>> por id de consulta
     */
    public function evaluate(array $ids): array;
}
