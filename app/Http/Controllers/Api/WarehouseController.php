<?php

namespace App\Http\Controllers\Api;

use App\Enums\Permission;
use App\Http\Controllers\Api\Concerns\ApiResponses;
use App\Http\Controllers\Controller;
use App\Models\Warehouse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WarehouseController extends Controller
{
    use ApiResponses;

    /**
     * Listar bodegas.
     * GET /api/warehouses
     */
    public function index(Request $request): JsonResponse
    {
        if (!$request->user()->can(Permission::INVENTORY_VIEW->value)) {
            return $this->forbidden();
        }

        $query = Warehouse::with('branch');

        if ($request->filled('branch_id')) {
            $query->where('branch_id', $request->branch_id);
        }

        if ($request->boolean('active_only', false)) {
            $query->where('is_active', true);
        }

        $warehouses = $query->orderBy('name')->get();

        return $this->ok($warehouses);
    }

    /**
     * Crear bodega.
     * POST /api/warehouses
     */
    public function store(Request $request): JsonResponse
    {
        if (!$request->user()->can(Permission::BRANCHES_MANAGE->value)) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'branch_id'  => ['required', 'integer', 'exists:branches,id'],
            'name'       => ['required', 'string', 'max:150'],
            'code'       => ['required', 'string', 'max:20', 'unique:warehouses,code'],
            'type'       => ['nullable', 'in:store,warehouse,consignment,transit'],
            'is_active'  => ['nullable', 'boolean'],
            'is_default' => ['nullable', 'boolean'],
            'notes'      => ['nullable', 'string'],
        ]);

        $warehouse = Warehouse::create($validated);

        return $this->created($warehouse->load('branch'), 'Bodega creada exitosamente.');
    }

    /**
     * Ver bodega.
     * GET /api/warehouses/{warehouse}
     */
    public function show(Request $request, Warehouse $warehouse): JsonResponse
    {
        if (!$request->user()->can(Permission::INVENTORY_VIEW->value)) {
            return $this->forbidden();
        }

        return $this->ok($warehouse->load('branch'));
    }

    /**
     * Actualizar bodega.
     * PUT /api/warehouses/{warehouse}
     */
    public function update(Request $request, Warehouse $warehouse): JsonResponse
    {
        if (!$request->user()->can(Permission::BRANCHES_MANAGE->value)) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'branch_id'  => ['sometimes', 'integer', 'exists:branches,id'],
            'name'       => ['sometimes', 'string', 'max:150'],
            'code'       => ['sometimes', 'string', 'max:20', "unique:warehouses,code,{$warehouse->id}"],
            'type'       => ['nullable', 'in:store,warehouse,consignment,transit'],
            'is_active'  => ['nullable', 'boolean'],
            'is_default' => ['nullable', 'boolean'],
            'notes'      => ['nullable', 'string'],
        ]);

        $warehouse->update($validated);

        return $this->ok($warehouse->fresh()->load('branch'), 'Bodega actualizada.');
    }

    /**
     * Eliminar bodega (soft delete).
     * DELETE /api/warehouses/{warehouse}
     */
    public function destroy(Request $request, Warehouse $warehouse): JsonResponse
    {
        if (!$request->user()->can(Permission::BRANCHES_MANAGE->value)) {
            return $this->forbidden();
        }

        if ($warehouse->inventory()->where('quantity', '>', 0)->exists()) {
            return response()->json([
                'message' => 'No se puede eliminar la bodega porque tiene stock activo.',
            ], 422);
        }

        $warehouse->delete();

        return $this->noContent();
    }
}
