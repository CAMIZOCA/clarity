<?php

namespace App\Services;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

abstract class BaseService
{
    /**
     * Ejecutar operaciones en una transacción de base de datos.
     * Si falla, hace rollback automático.
     */
    protected function transaction(callable $callback): mixed
    {
        return DB::transaction($callback);
    }

    /**
     * Registrar actividad del sistema.
     */
    protected function logActivity(string $action, Model $model, array $properties = []): void
    {
        if (function_exists('activity')) {
            activity()
                ->performedOn($model)
                ->causedBy(auth()->user())
                ->withProperties($properties)
                ->log($action);
        }
    }
}
