<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Inventory;
use App\Models\Sale;
use Illuminate\Http\Request;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ExportController extends Controller
{
    /**
     * Exporta ventas a Excel.
     * GET /api/export/sales
     *
     * Requiere permiso: sales.export
     */
    public function exportSalesExcel(Request $request): BinaryFileResponse
    {
        $dateFrom = $request->input('date_from', now()->startOfMonth()->toDateString());
        $dateTo = $request->input('date_to', now()->toDateString());
        $branchId = $request->input('branch_id');
        $userId = $request->input('user_id');

        $sales = Sale::query()
            ->with(['patient:id,nombre,apellido,cedula', 'seller:id,name', 'items'])
            ->whereNotIn('status', ['draft', 'cancelled'])
            ->whereDate('sales.created_at', '>=', $dateFrom)
            ->whereDate('sales.created_at', '<=', $dateTo)
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
                $sale->patient?->nombre_completo ?? '',
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

        $headings = [
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

        $formats = [
            'G' => '#,##0.00',
            'H' => '#,##0.00',
            'I' => '#,##0.00',
            'J' => '#,##0.00',
            'K' => '#,##0.00',
            'L' => '#,##0.00',
        ];

        $filename = "ventas-{$dateFrom}-{$dateTo}.xlsx";

        return $this->xlsxDownload($headings, $rows, $formats, $filename);
    }

    /**
     * Exporta inventario valorizado a Excel.
     * GET /api/export/inventory
     *
     * Requiere permiso: reports.inventory
     */
    public function exportInventoryExcel(Request $request): BinaryFileResponse
    {
        $warehouseId = $request->input('warehouse_id');
        $branchId = $request->input('branch_id');
        $category = $request->input('category');

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
            $costValue = (float) $row->cost_price * (float) $row->quantity;
            $saleValue = (float) $row->sale_price * (float) $row->quantity;
            $margin = $row->sale_price > 0
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

        $headings = [
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

        $formats = [
            'K' => '#,##0.00',
            'L' => '#,##0.00',
            'M' => '#,##0.00',
            'N' => '#,##0.00',
            'O' => '0.00"%"',
        ];

        $fecha = now()->format('Y-m-d');
        $filename = "inventario-{$fecha}.xlsx";

        return $this->xlsxDownload($headings, $rows, $formats, $filename);
    }

    /**
     * Escribe un .xlsx con PhpSpreadsheet y lo devuelve como descarga.
     *
     * Se usa PhpSpreadsheet directo a proposito: maatwebsite/excel (el wrapper
     * que este controlador importaba antes) fija phpoffice/phpspreadsheet ^1.x
     * en todas sus versiones, y el proyecto depende de ^2.0 para los comandos
     * de importacion de historias clinicas.
     *
     * @param  array<int, string>  $headings
     * @param  array<int, array<int, mixed>>  $rows
     * @param  array<string, string>  $formats  Formato numerico por letra de columna.
     */
    private function xlsxDownload(array $headings, array $rows, array $formats, string $filename): BinaryFileResponse
    {
        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();

        $sheet->fromArray($headings, null, 'A1');
        if ($rows !== []) {
            $sheet->fromArray($rows, null, 'A2');
        }

        $lastColumn = Coordinate::stringFromColumnIndex(count($headings));
        $lastRow = count($rows) + 1;

        $sheet->getStyle("A1:{$lastColumn}1")->getFont()->setBold(true);
        $sheet->getStyle("A1:{$lastColumn}1")->getFill()
            ->setFillType(Fill::FILL_SOLID)
            ->getStartColor()->setARGB('FFEFEFEF');

        if ($rows !== []) {
            foreach ($formats as $column => $format) {
                $sheet->getStyle("{$column}2:{$column}{$lastRow}")
                    ->getNumberFormat()->setFormatCode($format);
            }
        }

        foreach (range(1, count($headings)) as $index) {
            $sheet->getColumnDimension(Coordinate::stringFromColumnIndex($index))->setAutoSize(true);
        }

        $sheet->freezePane('A2');
        $sheet->setAutoFilter("A1:{$lastColumn}{$lastRow}");

        $path = tempnam(sys_get_temp_dir(), 'clarity_export_');
        (new Xlsx($spreadsheet))->save($path);
        $spreadsheet->disconnectWorksheets();

        return response()->download($path, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }
}
