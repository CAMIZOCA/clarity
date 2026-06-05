<?php

namespace App\Http\Controllers\Api;

use App\Enums\Permission;
use App\Http\Controllers\Api\Concerns\ApiResponses;
use App\Http\Controllers\Controller;
use App\Models\Branch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BranchController extends Controller
{
    use ApiResponses;

    /**
     * Listar sucursales.
     * GET /api/branches
     */
    public function index(Request $request): JsonResponse
    {
        if (!$request->user()->can(Permission::BRANCHES_MANAGE->value)) {
            return $this->forbidden();
        }

        $branches = Branch::withCount('warehouses')
            ->orderBy('is_main', 'desc')
            ->orderBy('name')
            ->get();

        return $this->ok($branches);
    }

    /**
     * Crear sucursal.
     * POST /api/branches
     */
    public function store(Request $request): JsonResponse
    {
        if (!$request->user()->can(Permission::BRANCHES_MANAGE->value)) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'name'             => ['required', 'string', 'max:150'],
            'code'             => ['required', 'string', 'max:10', 'unique:branches,code'],
            'address'          => ['nullable', 'string', 'max:300'],
            'city'             => ['nullable', 'string', 'max:100'],
            'province'         => ['nullable', 'string', 'max:100'],
            'phone'            => ['nullable', 'string', 'max:20'],
            'email'            => ['nullable', 'email', 'max:100'],
            'ruc'              => ['nullable', 'string', 'max:13', 'regex:/^\d{10,13}$/'],
            'sri_establishment' => ['nullable', 'string', 'max:3'],
            'is_active'        => ['nullable', 'boolean'],
            'is_main'          => ['nullable', 'boolean'],
            'settings'         => ['nullable', 'array'],
            'notes'            => ['nullable', 'string'],
        ]);

        $branch = Branch::create($validated);

        return $this->created($branch, 'Sucursal creada exitosamente.');
    }

    /**
     * Ver sucursal con sus bodegas.
     * GET /api/branches/{branch}
     */
    public function show(Request $request, Branch $branch): JsonResponse
    {
        if (!$request->user()->can(Permission::BRANCHES_MANAGE->value)) {
            return $this->forbidden();
        }

        $branch->load('warehouses');

        return $this->ok($branch);
    }

    /**
     * Actualizar sucursal.
     * PUT /api/branches/{branch}
     */
    public function update(Request $request, Branch $branch): JsonResponse
    {
        if (!$request->user()->can(Permission::BRANCHES_MANAGE->value)) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'name'             => ['sometimes', 'string', 'max:150'],
            'code'             => ['sometimes', 'string', 'max:10', "unique:branches,code,{$branch->id}"],
            'address'          => ['nullable', 'string', 'max:300'],
            'city'             => ['nullable', 'string', 'max:100'],
            'province'         => ['nullable', 'string', 'max:100'],
            'phone'            => ['nullable', 'string', 'max:20'],
            'email'            => ['nullable', 'email', 'max:100'],
            'ruc'              => ['nullable', 'string', 'max:13', 'regex:/^\d{10,13}$/'],
            'sri_establishment' => ['nullable', 'string', 'max:3'],
            'is_active'        => ['nullable', 'boolean'],
            'is_main'          => ['nullable', 'boolean'],
            'settings'         => ['nullable', 'array'],
            'notes'            => ['nullable', 'string'],
        ]);

        $branch->update($validated);

        return $this->ok($branch->fresh()->load('warehouses'), 'Sucursal actualizada.');
    }

    /**
     * Eliminar sucursal (soft delete).
     * DELETE /api/branches/{branch}
     */
    public function destroy(Request $request, Branch $branch): JsonResponse
    {
        if (!$request->user()->can(Permission::BRANCHES_MANAGE->value)) {
            return $this->forbidden();
        }

        if ($branch->is_main) {
            return response()->json([
                'message' => 'No se puede eliminar la sucursal principal.',
            ], 422);
        }

        if ($branch->warehouses()->exists()) {
            return response()->json([
                'message' => 'No se puede eliminar la sucursal porque tiene bodegas asociadas.',
            ], 422);
        }

        $branch->delete();

        return $this->noContent();
    }
}
