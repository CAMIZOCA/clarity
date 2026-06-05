<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * Lee el header X-Branch-Id y lo pone disponible en la request.
 * Útil para filtrar datos automáticamente por sucursal.
 */
class SetActiveBranch
{
    public function handle(Request $request, Closure $next): mixed
    {
        $branchId = $request->header('X-Branch-Id');
        if ($branchId && is_numeric($branchId)) {
            $request->merge(['_active_branch_id' => (int) $branchId]);
            // Disponible en todos los controladores via $request->get('_active_branch_id')
        }
        return $next($request);
    }
}
