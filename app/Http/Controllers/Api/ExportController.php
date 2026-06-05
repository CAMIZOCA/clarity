<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Inventory;
use App\Models\Sale;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Maatwebsite\Excel\Facades\Excel;

class ExportController extends Controller
{
    /**
     * Exporta ventas a Excel.
     * GET /api/export/sales
     *
     * Requiere permiso: sales.export
     */
    public function exportSalesExcel(Request $request): \Symfony\Component\HttpFoundation\BinaryFileResponse
    {
        $dateFrom = $request->input('date_from', now()->startOfMonth()->toDateString());
        $dateTo   = $request->input('date_to', now()->toDateString());
        $branchId = $request->input('branch_id');
        $userId   = $request->input('user_id');

        $sales = Sale::query()
            ->with(['patient:id,nombre,cedula', 'seller:id,name', 'items'])
            ->whereNotIn('status', ['draft'])
            ->whereDate('created_at', '>=', $dateFrom)
            ->whereDate('created_at', '<=', $dateTo)
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->when($userId, fn ($q) => $q->where('user_id', $userId))
            ->orderBy('created_at')
            ->get();

        $rows = $sales->map(function (Sale $sale) {
            $itemsSummary = $sale->items
                ->map(fn ($i) => $i->description ?? $i->sku ?? 'ítem')
                ->join(', ');

            return [
                $sale->sale_number,
                $sale->created_at->format('Y-m-d H:i'),
                $sale->patient?->nombre ?? '',
                $sale->patient?->cedula ?? '',
                $sale->seller?->name ?? '',
                $itemsSummary,
                (float) $sale->subtotal,
                (float) $sale->discount_total,
                (float) $sale->tax_amount,
                (float) $sale->total,
                (float) $sale->paid_amount,
                (float) $sale->balance,
                $sale->status,
            ];
        })->toArray();

        $export = new class($rows) implements
            \Maatwebsite\Excel\Concerns\FromCollection,
            \Maatwebsite\Excel\Concerns\WithHeadings,
            \Maatwebsite\Excel\Concerns\WithColumnFormatting,
            \Maatwebsite\Excel\Concerns\WithStyles
        {
            public function __construct(private array $rows) {}

            public function collection()
            {
                return collect($this->rows);
            }

            public function headings(): array
            {
                return [
                    'Número',
                    'Fecha',
                    'Cliente',
                    'Cédula',
                    'Vendedor',
                    'Ítems',
                    'Subtotal',
                    'Descuento',
                    'IVA',
                    'Total',
                    'Pagado',
                    'Saldo',
                    'Estado',
                ];
            }

            public function columnFormats(): array
            {
                return [
                    'G' => '#,##0.00',
                    'H' => '#,##0.00',
                    'I' => '#,##0.00',
                    'J' => '#,##0.00',
                    'K' => '#,##0.00',
                    'L' => '#,##0.00',
                ];
            }

            public function styles(\PhpOffice\PhpSpreadsheet\Worksheet\Worksheet $sheet): array
            {
                return [
                    1 => ['font' => ['bold' => true]],
                ];
            }
        };

        $filename = "ventas-{$dateFrom}-{$dateTo}.xlsx";

        return Excel::download($export, $filename);
    }

    /**
     * Exporta inventario valorizado a Excel.
     * GET /api/export/inventory
     *
     * Requiere permiso: reports.inventory
     */
    public function exportInventoryExcel(Request $request): \Symfony\Component\HttpFoundation\BinaryFileResponse
    {
        $warehouseId = $request->input('warehouse_id');
        $branchId    = $request->input('branch_id');
        $category    = $request->input('category');

        $query = Inventory::query()
            ->join('product_variants', 'inventory.product_variant_id', '=', 'product_variants.id')
            ->join('products', 'product_variants.product_id', '=', 'products.id')
            ->join('warehouses', 'inventory.warehouse_id', '=', 'warehouses.id')
            ->whereNull('product_variants.deleted_at')
            ->whereNull('products.deleted_at')
            ->select(
                'product_variants.sku',
                'product_variants.barcode',
                'products.name as product_name',
                'products.brand',
                'products.category',
                'product_variants.color',
                'product_variants.size',
                'warehouses.name as warehouse_name',
                'inventory.quantity',
                'inventory.min_stock',
                'product_variants.cost_price',
                'product_variants.sale_price'
            )
            ->when($warehouseId, fn ($q) => $q->where('inventory.warehouse_id', $warehouseId))
            ->when($branchId, fn ($q) => $q->where('warehouses.branch_id', $branchId))
            ->when($category, fn ($q) => $q->where('products.category', $category))
            ->orderBy('products.category')
            ->orderBy('products.name')
            ->get();

        $rows = $query->map(function ($row) {
            $costValue  = (float) $row->cost_price * (float) $row->quantity;
            $saleValue  = (float) $row->sale_price * (float) $row->quantity;
            $margin     = $row->sale_price > 0
                ? round((($row->sale_price - $row->cost_price) / $row->sale_price) * 100, 2)
                : 0;

            return [
                $row->sku ?? '',
                $row->barcode ?? '',
                $row->product_name ?? '',
                $row->brand ?? '',
                $row->category ?? '',
                $row->color ?? '',
                $row->size ?? '',
                $row->warehouse_name ?? '',
                (int) $row->quantity,
                (int) $row->min_stock,
                (float) $row->cost_price,
                round($costValue, 2),
                (float) $row->sale_price,
                round($saleValue, 2),
                $margin,
            ];
        })->toArray();

        $export = new class($rows) implements
            \Maatwebsite\Excel\Concerns\FromCollection,
            \Maatwebsite\Excel\Concerns\WithHeadings,
            \Maatwebsite\Excel\Concerns\WithColumnFormatting,
            \Maatwebsite\Excel\Concerns\WithStyles
        {
            public function __construct(private array $rows) {}

            public function collection()
            {
                return collect($this->rows);
            }

            public function headings(): array
            {
                return [
                    'SKU',
                    'Código de barras',
                    'Producto',
                    'Marca',
                    'Categoría',
                    'Color',
                    'Talla',
                    'Bodega',
                    'Cantidad',
                    'Mínimo',
                    'Costo Unit.',
                    'Valor Costo',
                    'Precio Venta',
                    'Valor Venta',
                    'Margen %',
                ];
            }

            public function columnFormats(): array
            {
                return [
                    'K' => '#,##0.00',
                    'L' => '#,##0.00',
                    'M' => '#,##0.00',
                    'N' => '#,##0.00',
                    'O' => '0.00"%"',
                ];
            }

            public function styles(\PhpOffice\PhpSpreadsheet\Worksheet\Worksheet $sheet): array
            {
                return [
                    1 => ['font' => ['bold' => true]],
                ];
            }
        };

        $fecha    = now()->format('Y-m-d');
        $filename = "inventario-{$fecha}.xlsx";

        return Excel::download($export, $filename);
    }
}
