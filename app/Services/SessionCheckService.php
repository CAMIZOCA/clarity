<?php

namespace App\Services;

use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Chequeo rapido que el SPA pide cuando falla una carga.
 *
 * Sin esto, un "Error al cargar pacientes" no distinguia una red caida, un
 * servidor sin base de datos o una sesion vencida (en un iPad la cookie dejo de
 * llegar y cada busqueda fallaba en silencio). No devuelve datos del usuario ni
 * el mensaje de una excepcion: lo puede pedir cualquiera, con o sin sesion.
 */
class SessionCheckService
{
    public function check(): array
    {
        return [
            'server' => true,
            'database' => $this->databaseResponds(),
            'authenticated' => Auth::check(),
            'version' => AppVersion::current(),
            'time' => now()->toDateTimeString(),
        ];
    }

    private function databaseResponds(): bool
    {
        try {
            DB::select('select 1');

            return true;
        } catch (Throwable) {
            return false;
        }
    }
}
