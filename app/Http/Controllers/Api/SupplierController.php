<?php

namespace App\Http\Controllers\Api;

use App\Enums\Permission;
use App\Http\Controllers\Api\Concerns\ApiResponses;
use App\Http\Controllers\Controller;
use App\Models\Supplier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    use ApiResponses;

    /**
     * Listar proveedores con búsqueda y paginación.
     * GET /api/suppliers
     */
    public function index(Request $request): JsonResponse
    {
        if (!$request->user()->can(Permission::SUPPLIERS_VIEW->value)) {
            return $this->forbidden();
        }

        $query = Supplier::query();

        if ($request->filled('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('name', 'LIKE', "%{$request->search}%")
                  ->orWhere('ruc', 'LIKE', "%{$request->search}%")
                  ->orWhere('contact_name', 'LIKE', "%{$request->search}%")
                  ->orWhere('email', 'LIKE', "%{$request->search}%");
            });
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->boolean('active_only', false)) {
            $query->where('is_active', true);
        }

        $suppliers = $query->orderBy('name')
            ->paginate($request->get('per_page', 20));

        return $this->ok($suppliers);
    }

    /**
     * Crear proveedor.
     * POST /api/suppliers
     */
    public function store(Request $request): JsonResponse
    {
        if (!$request->user()->can(Permission::SUPPLIERS_CREATE->value)) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'name'              => ['required', 'string', 'max:200'],
            'ruc'               => ['nullable', 'string', 'max:13', 'regex:/^\d{10,13}$/', 'unique:suppliers,ruc'],
            'contact_name'      => ['nullable', 'string', 'max:100'],
            'phone'             => ['nullable', 'string', 'max:20'],
            'email'             => ['nullable', 'email', 'max:100'],
            'address'           => ['nullable', 'string', 'max:300'],
            'city'              => ['nullable', 'string', 'max:100'],
            'type'              => ['nullable', 'in:nacional,internacional,fabricante,distribuidor'],
            'payment_terms'     => ['nullable', 'string', 'max:200'],
            'credit_days'       => ['nullable', 'integer', 'min:0'],
            'credit_limit'      => ['nullable', 'numeric', 'min:0'],
            'bank_name'         => ['nullable', 'string', 'max:100'],
            'bank_account'      => ['nullable', 'string', 'max:30'],
            'bank_account_type' => ['nullable', 'in:corriente,ahorros'],
            'is_active'         => ['nullable', 'boolean'],
            'notes'             => ['nullable', 'string'],
        ]);

        $supplier = Supplier::create($validated);

        return $this->created($supplier, 'Proveedor creado exitosamente.');
    }

    /**
     * Ver proveedor.
     * GET /api/suppliers/{supplier}
     */
    public function show(Request $request, Supplier $supplier): JsonResponse
    {
        if (!$request->user()->can(Permission::SUPPLIERS_VIEW->value)) {
            return $this->forbidden();
        }

        return $this->ok($supplier->load('products'));
    }

    /**
     * Actualizar proveedor.
     * PUT /api/suppliers/{supplier}
     */
    public function update(Request $request, Supplier $supplier): JsonResponse
    {
        if (!$request->user()->can(Permission::SUPPLIERS_EDIT->value)) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'name'              => ['sometimes', 'string', 'max:200'],
            'ruc'               => ['nullable', 'string', 'max:13', 'regex:/^\d{10,13}$/', "unique:suppliers,ruc,{$supplier->id}"],
            'contact_name'      => ['nullable', 'string', 'max:100'],
            'phone'             => ['nullable', 'string', 'max:20'],
            'email'             => ['nullable', 'email', 'max:100'],
            'address'           => ['nullable', 'string', 'max:300'],
            'city'              => ['nullable', 'string', 'max:100'],
            'type'              => ['nullable', 'in:nacional,internacional,fabricante,distribuidor'],
            'payment_terms'     => ['nullable', 'string', 'max:200'],
            'credit_days'       => ['nullable', 'integer', 'min:0'],
            'credit_limit'      => ['nullable', 'numeric', 'min:0'],
            'bank_name'         => ['nullable', 'string', 'max:100'],
            'bank_account'      => ['nullable', 'string', 'max:30'],
            'bank_account_type' => ['nullable', 'in:corriente,ahorros'],
            'is_active'         => ['nullable', 'boolean'],
            'notes'             => ['nullable', 'string'],
        ]);

        $supplier->update($validated);

        return $this->ok($supplier->fresh(), 'Proveedor actualizado.');
    }

    /**
     * Eliminar proveedor (soft delete).
     * DELETE /api/suppliers/{supplier}
     */
    public function destroy(Request $request, Supplier $supplier): JsonResponse
    {
        if (!$request->user()->can(Permission::SUPPLIERS_DELETE->value)) {
            return $this->forbidden();
        }

        if ($supplier->products()->exists()) {
            return response()->json([
                'message' => 'No se puede eliminar el proveedor porque tiene productos asociados.',
            ], 422);
        }

        $supplier->delete();

        return $this->noContent();
    }
}
