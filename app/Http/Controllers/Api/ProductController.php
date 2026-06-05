<?php

namespace App\Http\Controllers\Api;

use App\Enums\Permission;
use App\Http\Controllers\Api\Concerns\ApiResponses;
use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\InventoryService;
use App\Support\AppConfig;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    use ApiResponses;

    /**
     * Listar productos con variantes y stock.
     * GET /api/products
     */
    public function index(Request $request): JsonResponse
    {
        if (!$request->user()->can(Permission::PRODUCTS_VIEW->value)) {
            return $this->forbidden();
        }

        $query = Product::with(['supplier', 'variants' => function ($q) {
            $q->where('is_active', true)->with(['inventory']);
        }])->withCount('variants');

        // Filtros
        if ($request->filled('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('name', 'LIKE', "%{$request->search}%")
                  ->orWhere('sku', 'LIKE', "%{$request->search}%")
                  ->orWhere('brand', 'LIKE', "%{$request->search}%");
            });
        }

        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }

        if ($request->filled('brand')) {
            $query->where('brand', $request->brand);
        }

        if ($request->filled('supplier_id')) {
            $query->where('supplier_id', $request->supplier_id);
        }

        if ($request->boolean('active_only', true)) {
            $query->where('is_active', true);
        }

        $products = $query->orderBy('name')
            ->paginate($request->get('per_page', AppConfig::PRODUCTS_PER_PAGE));

        return $this->ok($products);
    }

    /**
     * Crear producto.
     * POST /api/products
     */
    public function store(Request $request): JsonResponse
    {
        if (!$request->user()->can(Permission::PRODUCTS_CREATE->value)) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'name'                  => ['required', 'string', 'max:200'],
            'sku'                   => ['required', 'string', 'max:50', 'unique:products,sku'],
            'brand'                 => ['nullable', 'string', 'max:100'],
            'category'              => ['required', 'in:armazon,luna,lente_contacto,accesorio,servicio,repuesto'],
            'subcategory'           => ['nullable', 'string', 'max:100'],
            'description'           => ['nullable', 'string'],
            'supplier_id'           => ['nullable', 'integer', 'exists:suppliers,id'],
            'requires_prescription' => ['nullable', 'boolean'],
            'is_active'             => ['nullable', 'boolean'],
            'has_variants'          => ['nullable', 'boolean'],
            'track_inventory'       => ['nullable', 'boolean'],
            'meta'                  => ['nullable', 'array'],
        ]);

        $product = Product::create($validated);

        return $this->created($product->load('supplier'), 'Producto creado exitosamente.');
    }

    /**
     * Ver producto con sus variantes y stock.
     * GET /api/products/{product}
     */
    public function show(Request $request, Product $product): JsonResponse
    {
        if (!$request->user()->can(Permission::PRODUCTS_VIEW->value)) {
            return $this->forbidden();
        }

        $product->load([
            'supplier',
            'variants' => function ($q) {
                $q->where('is_active', true)->with(['inventory.warehouse']);
            },
        ]);

        $response = $product->toArray();

        // Incluir costo solo para usuarios con permiso
        if (!$request->user()->can(Permission::SALES_VIEW_COST->value)) {
            foreach ($response['variants'] as &$v) {
                unset($v['cost_price'], $v['wholesale_price']);
            }
        }

        return $this->ok($response);
    }

    /**
     * Actualizar producto.
     * PUT /api/products/{product}
     */
    public function update(Request $request, Product $product): JsonResponse
    {
        if (!$request->user()->can(Permission::PRODUCTS_EDIT->value)) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'name'        => ['sometimes', 'string', 'max:200'],
            'brand'       => ['nullable', 'string', 'max:100'],
            'category'    => ['sometimes', 'in:armazon,luna,lente_contacto,accesorio,servicio,repuesto'],
            'subcategory' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string'],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'is_active'   => ['nullable', 'boolean'],
            'meta'        => ['nullable', 'array'],
        ]);

        $product->update($validated);

        return $this->ok($product->fresh()->load('supplier'), 'Producto actualizado.');
    }

    /**
     * Eliminar producto (soft delete).
     * DELETE /api/products/{product}
     */
    public function destroy(Request $request, Product $product): JsonResponse
    {
        if (!$request->user()->can(Permission::PRODUCTS_DELETE->value)) {
            return $this->forbidden();
        }

        if ($product->variants()->whereHas('inventory', fn($q) => $q->where('quantity', '>', 0))->exists()) {
            return response()->json([
                'message' => 'No se puede eliminar el producto porque tiene stock en inventario.',
            ], 422);
        }

        $product->delete();

        return $this->noContent();
    }

    // ─── Variantes ──────────────────────────────────────────────────────────────

    /**
     * Listar variantes de un producto con stock.
     * GET /api/products/{product}/variants
     */
    public function variants(Request $request, Product $product): JsonResponse
    {
        if (!$request->user()->can(Permission::PRODUCTS_VIEW->value)) {
            return $this->forbidden();
        }

        $variants = $product->variants()
            ->where('is_active', true)
            ->with(['inventory.warehouse'])
            ->get();

        // Ocultar costos si no tiene permiso
        if (!$request->user()->can(Permission::SALES_VIEW_COST->value)) {
            $variants->each(function ($v) {
                unset($v->cost_price, $v->wholesale_price);
            });
        }

        return $this->ok($variants);
    }

    /**
     * Crear variante de producto.
     * POST /api/products/{product}/variants
     */
    public function storeVariant(Request $request, Product $product): JsonResponse
    {
        if (!$request->user()->can(Permission::PRODUCTS_CREATE->value)) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'sku'             => ['required', 'string', 'max:80', 'unique:product_variants,sku'],
            'barcode'         => ['nullable', 'string', 'max:50', 'unique:product_variants,barcode'],
            'color'           => ['nullable', 'string', 'max:60'],
            'size'            => ['nullable', 'string', 'max:20'],
            'material'        => ['nullable', 'string', 'max:60'],
            'gender'          => ['nullable', 'in:unisex,hombre,mujer,nino'],
            'frame_shape'     => ['nullable', 'string', 'max:40'],
            'lens_type'       => ['nullable', 'in:monofocal,bifocal,progresivo,ocupacional,contacto'],
            'lens_material'   => ['nullable', 'string', 'max:60'],
            'lens_index'      => ['nullable', 'numeric', 'min:1', 'max:2'],
            'lens_treatment'  => ['nullable', 'string', 'max:150'],
            'base_curve'      => ['nullable', 'numeric'],
            'lens_diameter'   => ['nullable', 'numeric'],
            'lens_power'      => ['nullable', 'string', 'max:20'],
            'lens_duration'   => ['nullable', 'string', 'max:30'],
            'cost_price'      => ['nullable', 'numeric', 'min:0'],
            'sale_price'      => ['required', 'numeric', 'min:0'],
            'wholesale_price' => ['nullable', 'numeric', 'min:0'],
            'supplier_ref'    => ['nullable', 'string', 'max:50'],
            'is_active'       => ['nullable', 'boolean'],
            // Stock inicial opcional
            'initial_stock'   => ['nullable', 'integer', 'min:0'],
            'warehouse_id'    => ['nullable', 'integer', 'exists:warehouses,id'],
        ]);

        $variant = $product->variants()->create(
            collect($validated)->except(['initial_stock', 'warehouse_id'])->toArray()
        );

        // Stock inicial si se provee
        if (!empty($validated['initial_stock']) && !empty($validated['warehouse_id'])) {
            app(InventoryService::class)->addStock(
                $variant->id,
                $validated['warehouse_id'],
                (int) $validated['initial_stock'],
                'initial',
                $request->user()->id,
                (float) ($validated['cost_price'] ?? 0),
                'Stock inicial al crear variante'
            );
        }

        return $this->created($variant->load('inventory'), 'Variante creada exitosamente.');
    }

    /**
     * Actualizar variante.
     * PUT /api/products/{product}/variants/{variant}
     */
    public function updateVariant(Request $request, Product $product, ProductVariant $variant): JsonResponse
    {
        if ($variant->product_id !== $product->id) {
            return $this->notFound('La variante no pertenece a este producto.');
        }

        if (!$request->user()->can(Permission::PRODUCTS_EDIT->value)) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'color'           => ['nullable', 'string', 'max:60'],
            'size'            => ['nullable', 'string', 'max:20'],
            'material'        => ['nullable', 'string', 'max:60'],
            'cost_price'      => ['nullable', 'numeric', 'min:0'],
            'sale_price'      => ['nullable', 'numeric', 'min:0'],
            'wholesale_price' => ['nullable', 'numeric', 'min:0'],
            'is_active'       => ['nullable', 'boolean'],
            'barcode'         => ['nullable', 'string', 'max:50'],
        ]);

        $variant->update($validated);

        return $this->ok($variant->fresh()->load('inventory'), 'Variante actualizada.');
    }

    /**
     * Buscar producto por código de barras.
     * GET /api/products/barcode/{barcode}
     */
    public function findByBarcode(Request $request, string $barcode): JsonResponse
    {
        if (!$request->user()->can(Permission::PRODUCTS_VIEW->value)) {
            return $this->forbidden();
        }

        $variant = ProductVariant::where('barcode', $barcode)
            ->with(['product.supplier', 'inventory'])
            ->first();

        if (!$variant) {
            return $this->notFound("No se encontró producto con código de barras: {$barcode}");
        }

        return $this->ok($variant);
    }
}
