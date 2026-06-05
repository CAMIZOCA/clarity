<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Branch;
use App\Models\Consultation;
use App\Models\CashRegisterSession;
use App\Models\Expense;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\LabOrder;
use App\Models\Patient;
use App\Models\Payment;
use App\Models\Sale;
use App\Support\AppConfig;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    public function dashboard(): JsonResponse
    {
        $cacheKey = 'dashboard_stats_' . now()->format('Y-m-d-H-i');
        $cacheHit = Cache::has($cacheKey);

        $data = Cache::remember($cacheKey, AppConfig::CACHE_DASHBOARD, function () {
            $today = now()->toDateString();

            $totalPacientes = Patient::count();

            $consultasHoy = Consultation::whereDate('fecha_consulta', $today)->count();

            $citasPendientes = Appointment::where('estado', 'pendiente')
                ->where('fecha_hora_inicio', '>=', now()->startOfDay())
                ->where('fecha_hora_inicio', '<=', now()->addDays(7)->endOfDay())
                ->count();

            $ultimasConsultas = Consultation::with(['patient:id,nombre', 'optometrista:id,name'])
                ->orderByDesc('fecha_consulta')
                ->limit(5)
                ->get(['id', 'numero_consulta', 'patient_id', 'optometrista_id', 'fecha_consulta', 'estado', 'diagnostico_cie10', 'diagnostico_descripcion']);

            $proximasCitas = Appointment::with(['patient:id,nombre'])
                ->where('estado', 'pendiente')
                ->where('fecha_hora_inicio', '>=', now()->startOfDay())
                ->orderBy('fecha_hora_inicio')
                ->limit(5)
                ->get(['id', 'patient_id', 'titulo', 'fecha_hora_inicio', 'estado']);

            return [
                'totalPacientes'   => $totalPacientes,
                'consultasHoy'     => $consultasHoy,
                'citasPendientes'  => $citasPendientes,
                'ultimasConsultas' => $ultimasConsultas->values()->toArray(),
                'proximasCitas'    => $proximasCitas->values()->toArray(),
            ];
        });

        return response()->json(array_merge($data, [
            'cache_hit'    => $cacheHit,
            'generated_at' => now()->toISOString(),
        ]));
    }

    public function consultations(Request $request): JsonResponse
    {
        $from = $request->input('from', now()->startOfMonth()->toDateString());
        $to   = $request->input('to', now()->toDateString());

        $query = Consultation::whereBetween('fecha_consulta', [$from, $to]);

        if ($id = $request->input('optometrista_id')) {
            $query->where('optometrista_id', $id);
        }

        $total      = $query->count();
        $completadas = (clone $query)->where('estado', 'completada')->count();

        $porDia = (clone $query)
            ->select(DB::raw('DATE(fecha_consulta) as dia'), DB::raw('count(*) as total'))
            ->groupBy('dia')
            ->orderBy('dia')
            ->get();

        return response()->json(compact('total', 'completadas', 'porDia'));
    }

    public function diagnoses(Request $request): JsonResponse
    {
        $from = $request->input('from', now()->startOfYear()->toDateString());
        $to   = $request->input('to', now()->toDateString());

        $diagnoses = Consultation::whereBetween('fecha_consulta', [$from, $to])
            ->whereNotNull('diagnostico_cie10')
            ->select('diagnostico_cie10', 'diagnostico_descripcion', DB::raw('count(*) as total'))
            ->groupBy('diagnostico_cie10', 'diagnostico_descripcion')
            ->orderByDesc('total')
            ->limit(15)
            ->get();

        return response()->json($diagnoses);
    }

    public function patients(Request $request): JsonResponse
    {
        $from = $request->input('from', now()->startOfMonth()->toDateString());
        $to   = $request->input('to', now()->toDateString());

        $nuevos = Patient::whereBetween('created_at', [$from . ' 00:00:00', $to . ' 23:59:59'])->count();

        $conConsulta = Consultation::whereBetween('fecha_consulta', [$from, $to])
            ->distinct('patient_id')
            ->count('patient_id');

        $controles = max(0, $conConsulta - $nuevos);

        return response()->json(compact('nuevos', 'controles', 'conConsulta'));
    }

    public function exportCsv(Request $request): Response
    {
        $from = $request->input('from', now()->startOfMonth()->toDateString());
        $to   = $request->input('to', now()->toDateString());

        $consultations = Consultation::with(['patient:id,nombre,cedula', 'optometrista:id,name'])
            ->whereBetween('fecha_consulta', [$from, $to])
            ->orderBy('fecha_consulta')
            ->get();

        $lines   = [];
        $lines[] = implode(',', [
            'ID', 'N° Consulta', 'Fecha', 'Paciente', 'Cédula', 'Optómetra',
            'Diagnóstico CIE-10', 'Descripción', 'Estado',
        ]);

        foreach ($consultations as $c) {
            $lines[] = implode(',', [
                $c->id,
                $c->numero_consulta,
                $c->fecha_consulta->format('Y-m-d'),
                '"' . str_replace('"', '""', $c->patient?->nombre ?? '') . '"',
                $c->patient?->cedula ?? '',
                '"' . str_replace('"', '""', $c->optometrista?->name ?? '') . '"',
                $c->diagnostico_cie10 ?? '',
                '"' . str_replace('"', '""', $c->diagnostico_descripcion ?? '') . '"',
                $c->estado,
            ]);
        }

        $csv = implode("\n", $lines);

        return response($csv, 200, [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="consultas_' . $from . '_' . $to . '.csv"',
        ]);
    }

    // ─── REPORTES COMERCIALES ────────────────────────────────────────────────

    /**
     * Reporte de ventas con agrupación por período, método de pago y vendedor.
     * GET /api/reports/sales
     */
    public function salesReport(Request $request): JsonResponse
    {
        $dateFrom = $request->input('date_from', now()->startOfMonth()->toDateString());
        $dateTo   = $request->input('date_to', now()->toDateString());
        $branchId = $request->input('branch_id');
        $userId   = $request->input('user_id');
        $groupBy  = $request->input('group_by', 'day');

        $cacheKey = 'report_sales_' . md5("{$dateFrom}_{$dateTo}_{$branchId}_{$userId}_{$groupBy}");

        $data = Cache::remember($cacheKey, 300, function () use ($dateFrom, $dateTo, $branchId, $userId, $groupBy) {
            $isSqlite = DB::getDriverName() === 'sqlite';

            // Base query — excluye borradores y canceladas
            $base = Sale::query()
                ->whereNotIn('status', ['draft', 'cancelled'])
                ->whereDate('created_at', '>=', $dateFrom)
                ->whereDate('created_at', '<=', $dateTo);

            if ($branchId) {
                $base->where('branch_id', $branchId);
            }
            if ($userId) {
                $base->where('user_id', $userId);
            }

            // Resumen general
            $summary = (clone $base)->selectRaw(
                'COUNT(*) as total_sales,
                 COALESCE(SUM(total), 0) as total_amount,
                 COALESCE(SUM(paid_amount), 0) as total_paid,
                 COALESCE(SUM(balance), 0) as total_balance,
                 COALESCE(SUM(discount_total), 0) as total_discount,
                 COALESCE(SUM(cost_total), 0) as total_cost'
            )->first();

            $totalAmount   = (float) $summary->total_amount;
            $totalCost     = (float) $summary->total_cost;
            $grossMargin   = $totalAmount - $totalCost;
            $grossMarginPct = $totalAmount > 0 ? round(($grossMargin / $totalAmount) * 100, 2) : 0;
            $avgTicket     = $summary->total_sales > 0 ? round($totalAmount / $summary->total_sales, 2) : 0;

            // Canceladas
            $cancelled = Sale::query()
                ->where('status', 'cancelled')
                ->whereDate('created_at', '>=', $dateFrom)
                ->whereDate('created_at', '<=', $dateTo)
                ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
                ->selectRaw('COUNT(*) as cnt, COALESCE(SUM(total),0) as amt')
                ->first();

            // Agrupación por período
            $periodExpr = match ($groupBy) {
                'month' => $isSqlite ? "STRFTIME('%Y-%m', created_at)" : "DATE_FORMAT(created_at, '%Y-%m')",
                'week'  => $isSqlite ? "STRFTIME('%Y-%W', created_at)" : "YEARWEEK(created_at)",
                default => $isSqlite ? "DATE(created_at)" : "DATE(created_at)",
            };

            $byPeriod = (clone $base)
                ->selectRaw("{$periodExpr} as period, COUNT(*) as count, COALESCE(SUM(total),0) as amount, COALESCE(SUM(cost_total),0) as cost")
                ->groupByRaw($periodExpr)
                ->orderByRaw($periodExpr)
                ->get();

            // Por método de pago
            $byMethod = Payment::query()
                ->join('sales', 'payments.sale_id', '=', 'sales.id')
                ->whereNotIn('sales.status', ['draft', 'cancelled'])
                ->whereDate('payments.created_at', '>=', $dateFrom)
                ->whereDate('payments.created_at', '<=', $dateTo)
                ->when($branchId, fn ($q) => $q->where('sales.branch_id', $branchId))
                ->selectRaw('payments.method, COUNT(DISTINCT payments.sale_id) as count, COALESCE(SUM(payments.amount),0) as amount')
                ->groupBy('payments.method')
                ->get();

            // Por vendedor
            $bySeller = (clone $base)
                ->join('users', 'sales.user_id', '=', 'users.id')
                ->selectRaw('sales.user_id, users.name, COUNT(*) as count, COALESCE(SUM(sales.total),0) as amount')
                ->groupBy('sales.user_id', 'users.name')
                ->orderByDesc('amount')
                ->get();

            return [
                'summary' => [
                    'total_sales'       => (int) $summary->total_sales,
                    'total_amount'      => $totalAmount,
                    'total_paid'        => (float) $summary->total_paid,
                    'total_balance'     => (float) $summary->total_balance,
                    'total_discount'    => (float) $summary->total_discount,
                    'total_cost'        => $totalCost,
                    'gross_margin'      => $grossMargin,
                    'gross_margin_pct'  => $grossMarginPct,
                    'avg_ticket'        => $avgTicket,
                    'cancelled_count'   => (int) $cancelled->cnt,
                    'cancelled_amount'  => (float) $cancelled->amt,
                ],
                'by_period'         => $byPeriod->map(fn ($r) => [
                    'period' => $r->period,
                    'count'  => (int) $r->count,
                    'amount' => (float) $r->amount,
                    'cost'   => (float) $r->cost,
                ])->values(),
                'by_payment_method' => $byMethod->map(fn ($r) => [
                    'method' => $r->method,
                    'count'  => (int) $r->count,
                    'amount' => (float) $r->amount,
                ])->values(),
                'by_seller' => $bySeller->map(fn ($r) => [
                    'user_id' => $r->user_id,
                    'name'    => $r->name,
                    'count'   => (int) $r->count,
                    'amount'  => (float) $r->amount,
                ])->values(),
            ];
        });

        return response()->json($data);
    }

    /**
     * Reporte de inventario con valorización, stock bajo y sin movimiento.
     * GET /api/reports/inventory
     */
    public function inventoryReport(Request $request): JsonResponse
    {
        $warehouseId  = $request->input('warehouse_id');
        $branchId     = $request->input('branch_id');
        $category     = $request->input('category');
        $lowStockOnly = $request->boolean('low_stock_only', false);

        $cacheKey = 'report_inventory_' . md5("{$warehouseId}_{$branchId}_{$category}_{$lowStockOnly}");

        $data = Cache::remember($cacheKey, 300, function () use ($warehouseId, $branchId, $category, $lowStockOnly) {
            // Base: inventario con variantes y productos
            $base = Inventory::query()
                ->join('product_variants', 'inventory.product_variant_id', '=', 'product_variants.id')
                ->join('products', 'product_variants.product_id', '=', 'products.id')
                ->join('warehouses', 'inventory.warehouse_id', '=', 'warehouses.id')
                ->whereNull('product_variants.deleted_at')
                ->whereNull('products.deleted_at');

            if ($warehouseId) {
                $base->where('inventory.warehouse_id', $warehouseId);
            }
            if ($branchId) {
                $base->where('warehouses.branch_id', $branchId);
            }
            if ($category) {
                $base->where('products.category', $category);
            }
            if ($lowStockOnly) {
                $base->whereRaw('inventory.quantity <= inventory.min_stock');
            }

            // Valorización global
            $valuation = (clone $base)->selectRaw(
                'COALESCE(SUM(inventory.quantity * product_variants.cost_price), 0) as total_cost_value,
                 COALESCE(SUM(inventory.quantity * product_variants.sale_price), 0) as total_sale_value,
                 COALESCE(SUM(inventory.quantity), 0) as total_units,
                 COUNT(DISTINCT inventory.product_variant_id) as total_skus'
            )->first();

            $totalCostVal = (float) $valuation->total_cost_value;
            $totalSaleVal = (float) $valuation->total_sale_value;

            // Por categoría
            $byCategory = (clone $base)
                ->selectRaw(
                    'products.category,
                     COALESCE(SUM(inventory.quantity),0) as units,
                     COALESCE(SUM(inventory.quantity * product_variants.cost_price),0) as cost_value,
                     COALESCE(SUM(inventory.quantity * product_variants.sale_price),0) as sale_value'
                )
                ->groupBy('products.category')
                ->orderByDesc('cost_value')
                ->get();

            // Stock bajo
            $lowStock = (clone $base)
                ->whereRaw('inventory.quantity <= inventory.min_stock')
                ->selectRaw(
                    'product_variants.sku,
                     products.name,
                     inventory.quantity,
                     inventory.min_stock,
                     warehouses.name as warehouse_name'
                )
                ->orderBy('inventory.quantity')
                ->get();

            // Sin movimiento en 30 días
            $cutoff = now()->subDays(30)->toDateString();
            $noMovement = (clone $base)
                ->selectRaw(
                    'product_variants.sku,
                     products.name,
                     inventory.quantity,
                     inventory.warehouse_id'
                )
                ->where('inventory.quantity', '>', 0)
                ->whereNotExists(function ($q) use ($cutoff) {
                    $q->select(DB::raw(1))
                        ->from('inventory_movements')
                        ->whereColumn('inventory_movements.product_variant_id', 'inventory.product_variant_id')
                        ->whereColumn('inventory_movements.warehouse_id', 'inventory.warehouse_id')
                        ->where('inventory_movements.created_at', '>=', $cutoff);
                })
                ->limit(50)
                ->get();

            // Última fecha de movimiento para los "sin movimiento"
            $noMovementResult = $noMovement->map(function ($row) {
                $last = InventoryMovement::where('product_variant_id', $row->product_variant_id ?? null)
                    ->where('warehouse_id', $row->warehouse_id)
                    ->orderByDesc('created_at')
                    ->value('created_at');

                return [
                    'sku'           => $row->sku,
                    'name'          => $row->name,
                    'quantity'      => (int) $row->quantity,
                    'last_movement' => $last ? \Carbon\Carbon::parse($last)->toDateString() : null,
                ];
            });

            return [
                'valuation' => [
                    'total_cost_value'  => $totalCostVal,
                    'total_sale_value'  => $totalSaleVal,
                    'potential_margin'  => $totalSaleVal - $totalCostVal,
                    'total_units'       => (int) $valuation->total_units,
                    'total_skus'        => (int) $valuation->total_skus,
                ],
                'by_category' => $byCategory->map(fn ($r) => [
                    'category'   => $r->category,
                    'units'      => (int) $r->units,
                    'cost_value' => (float) $r->cost_value,
                    'sale_value' => (float) $r->sale_value,
                ])->values(),
                'low_stock' => $lowStock->map(fn ($r) => [
                    'sku'       => $r->sku,
                    'name'      => $r->name,
                    'quantity'  => (int) $r->quantity,
                    'min_stock' => (int) $r->min_stock,
                    'warehouse' => $r->warehouse_name,
                ])->values(),
                'no_movement_30d' => $noMovementResult->values(),
            ];
        });

        return response()->json($data);
    }

    /**
     * Reporte de órdenes de laboratorio.
     * GET /api/reports/lab
     */
    public function labReport(Request $request): JsonResponse
    {
        $dateFrom      = $request->input('date_from', now()->startOfMonth()->toDateString());
        $dateTo        = $request->input('date_to', now()->toDateString());
        $labSupplierId = $request->input('lab_supplier_id');
        $branchId      = $request->input('branch_id');

        $cacheKey = 'report_lab_' . md5("{$dateFrom}_{$dateTo}_{$labSupplierId}_{$branchId}");

        $data = Cache::remember($cacheKey, 300, function () use ($dateFrom, $dateTo, $labSupplierId, $branchId) {
            $base = LabOrder::query()
                ->whereDate('created_at', '>=', $dateFrom)
                ->whereDate('created_at', '<=', $dateTo);

            if ($labSupplierId) {
                $base->where('lab_supplier_id', $labSupplierId);
            }
            if ($branchId) {
                $base->where('branch_id', $branchId);
            }

            $isSqlite = DB::getDriverName() === 'sqlite';

            // Conteos por estado
            $statusCounts = (clone $base)
                ->selectRaw('status, COUNT(*) as total')
                ->groupBy('status')
                ->pluck('total', 'status');

            $total      = $statusCounts->sum();
            $pending    = (int) ($statusCounts['pending']    ?? 0);
            $inProgress = (int) ($statusCounts['in_progress'] ?? 0);
            $ready      = (int) ($statusCounts['ready']       ?? 0);
            $delivered  = (int) ($statusCounts['delivered']   ?? 0);

            // Vencidas (con fecha estimada pasada y no entregadas/canceladas)
            $overdue = (clone $base)->overdue()->count();

            // Reprocesos
            $reprocessCount = (clone $base)
                ->whereNotNull('reprocess_reason')
                ->count();

            // Promedio de entrega en días
            $avgTurnaround = (clone $base)
                ->where('status', 'delivered')
                ->whereNotNull('actual_delivery_date')
                ->selectRaw(
                    $isSqlite
                        ? 'AVG(JULIANDAY(actual_delivery_date) - JULIANDAY(created_at)) as avg_days'
                        : 'AVG(DATEDIFF(actual_delivery_date, DATE(created_at))) as avg_days'
                )
                ->value('avg_days');

            // Por estado
            $byStatus = (clone $base)
                ->selectRaw('status, COUNT(*) as total')
                ->groupBy('status')
                ->get()
                ->map(fn ($r) => ['status' => $r->status, 'total' => (int) $r->total])
                ->values();

            // Por laboratorio
            $byLab = (clone $base)
                ->leftJoin('lab_suppliers', 'lab_orders.lab_supplier_id', '=', 'lab_suppliers.id')
                ->selectRaw(
                    'lab_suppliers.name as lab_name,
                     COUNT(*) as total,
                     SUM(CASE WHEN lab_orders.status = \'delivered\' AND lab_orders.actual_delivery_date IS NOT NULL THEN '
                        . ($isSqlite
                            ? 'JULIANDAY(lab_orders.actual_delivery_date) - JULIANDAY(DATE(lab_orders.created_at))'
                            : 'DATEDIFF(lab_orders.actual_delivery_date, DATE(lab_orders.created_at))')
                        . ' ELSE NULL END) as total_days,
                     SUM(CASE WHEN lab_orders.status = \'delivered\' AND lab_orders.actual_delivery_date IS NOT NULL THEN 1 ELSE 0 END) as delivered_count'
                )
                ->groupBy('lab_suppliers.name')
                ->get()
                ->map(function ($r) {
                    $avgDays = $r->delivered_count > 0 ? round($r->total_days / $r->delivered_count, 1) : null;
                    return [
                        'lab_name' => $r->lab_name ?? 'Sin laboratorio',
                        'total'    => (int) $r->total,
                        'avg_days' => $avgDays,
                    ];
                })
                ->values();

            // Órdenes vencidas con detalle
            $overdueOrders = (clone $base)
                ->overdue()
                ->with(['patient:id,nombre', 'labSupplier:id,name'])
                ->selectRaw(
                    'lab_orders.*,'
                    . ($isSqlite
                        ? ' CAST(JULIANDAY(\'now\') - JULIANDAY(estimated_delivery_date) AS INTEGER) as days_overdue'
                        : ' DATEDIFF(CURDATE(), estimated_delivery_date) as days_overdue')
                )
                ->orderByDesc('days_overdue')
                ->limit(20)
                ->get()
                ->map(fn ($r) => [
                    'order_number' => $r->order_number,
                    'patient'      => $r->patient?->nombre,
                    'days_overdue' => (int) $r->days_overdue,
                    'lab'          => $r->labSupplier?->name,
                ]);

            return [
                'summary' => [
                    'total_orders'       => (int) $total,
                    'pending'            => $pending,
                    'in_progress'        => $inProgress,
                    'ready'              => $ready,
                    'delivered'          => $delivered,
                    'overdue'            => $overdue,
                    'avg_turnaround_days' => $avgTurnaround ? round((float) $avgTurnaround, 1) : null,
                    'reprocess_count'    => $reprocessCount,
                ],
                'by_status'      => $byStatus,
                'by_lab'         => $byLab,
                'overdue_orders' => $overdueOrders->values(),
            ];
        });

        return response()->json($data);
    }

    /**
     * Reporte de caja: sesiones, recaudación y gastos.
     * GET /api/reports/cash
     */
    public function cashReport(Request $request): JsonResponse
    {
        $dateFrom = $request->input('date_from', now()->startOfMonth()->toDateString());
        $dateTo   = $request->input('date_to', now()->toDateString());
        $branchId = $request->input('branch_id');

        $cacheKey = 'report_cash_' . md5("{$dateFrom}_{$dateTo}_{$branchId}");

        $data = Cache::remember($cacheKey, 300, function () use ($dateFrom, $dateTo, $branchId) {
            $base = CashRegisterSession::query()
                ->join('cash_registers', 'cash_register_sessions.cash_register_id', '=', 'cash_registers.id')
                ->whereDate('cash_register_sessions.opened_at', '>=', $dateFrom)
                ->whereDate('cash_register_sessions.opened_at', '<=', $dateTo);

            if ($branchId) {
                $base->where('cash_registers.branch_id', $branchId);
            }

            // Totales por método de pago
            $totals = (clone $base)->selectRaw(
                'COALESCE(SUM(cash_register_sessions.total_cash), 0) as total_cash,
                 COALESCE(SUM(cash_register_sessions.total_card), 0) as total_card,
                 COALESCE(SUM(cash_register_sessions.total_transfer), 0) as total_transfer,
                 COALESCE(SUM(cash_register_sessions.total_credit), 0) as total_credit,
                 COALESCE(SUM(cash_register_sessions.total_sales), 0) as total_sales,
                 COALESCE(SUM(cash_register_sessions.total_expenses), 0) as total_expenses,
                 COALESCE(SUM(cash_register_sessions.total_refunds), 0) as total_refunds,
                 COUNT(*) as session_count,
                 SUM(CASE WHEN cash_register_sessions.difference < 0 THEN ABS(cash_register_sessions.difference) ELSE 0 END) as total_shortfall,
                 SUM(CASE WHEN cash_register_sessions.difference > 0 THEN cash_register_sessions.difference ELSE 0 END) as total_overage'
            )->first();

            // Gastos por categoría
            $expenseBase = Expense::query()
                ->whereBetween('expense_date', [$dateFrom, $dateTo]);
            if ($branchId) {
                $expenseBase->where('branch_id', $branchId);
            }

            $byCategory = (clone $expenseBase)
                ->selectRaw('category, COUNT(*) as count, COALESCE(SUM(amount),0) as total')
                ->groupBy('category')
                ->orderByDesc('total')
                ->get()
                ->map(fn ($r) => [
                    'category' => $r->category,
                    'count'    => (int) $r->count,
                    'total'    => (float) $r->total,
                ])
                ->values();

            // Sesiones individuales
            $sessions = CashRegisterSession::query()
                ->join('cash_registers', 'cash_register_sessions.cash_register_id', '=', 'cash_registers.id')
                ->leftJoin('users as opener', 'cash_register_sessions.opened_by', '=', 'opener.id')
                ->leftJoin('users as closer', 'cash_register_sessions.closed_by', '=', 'closer.id')
                ->whereDate('cash_register_sessions.opened_at', '>=', $dateFrom)
                ->whereDate('cash_register_sessions.opened_at', '<=', $dateTo)
                ->when($branchId, fn ($q) => $q->where('cash_registers.branch_id', $branchId))
                ->select(
                    'cash_register_sessions.id',
                    'cash_registers.name as register_name',
                    'opener.name as opened_by_name',
                    'closer.name as closed_by_name',
                    'cash_register_sessions.opened_at',
                    'cash_register_sessions.closed_at',
                    'cash_register_sessions.opening_amount',
                    'cash_register_sessions.total_sales',
                    'cash_register_sessions.total_expenses',
                    'cash_register_sessions.expected_cash',
                    'cash_register_sessions.actual_cash',
                    'cash_register_sessions.difference',
                    'cash_register_sessions.status'
                )
                ->orderByDesc('cash_register_sessions.opened_at')
                ->get()
                ->map(fn ($r) => [
                    'id'             => $r->id,
                    'register'       => $r->register_name,
                    'opened_by'      => $r->opened_by_name,
                    'closed_by'      => $r->closed_by_name,
                    'opened_at'      => $r->opened_at,
                    'closed_at'      => $r->closed_at,
                    'opening_amount' => (float) $r->opening_amount,
                    'total_sales'    => (float) $r->total_sales,
                    'total_expenses' => (float) $r->total_expenses,
                    'expected_cash'  => (float) $r->expected_cash,
                    'actual_cash'    => $r->actual_cash !== null ? (float) $r->actual_cash : null,
                    'difference'     => $r->difference !== null ? (float) $r->difference : null,
                    'status'         => $r->status,
                ])
                ->values();

            return [
                'summary' => [
                    'session_count'    => (int) $totals->session_count,
                    'total_sales'      => (float) $totals->total_sales,
                    'total_cash'       => (float) $totals->total_cash,
                    'total_card'       => (float) $totals->total_card,
                    'total_transfer'   => (float) $totals->total_transfer,
                    'total_credit'     => (float) $totals->total_credit,
                    'total_expenses'   => (float) $totals->total_expenses,
                    'total_refunds'    => (float) $totals->total_refunds,
                    'total_shortfall'  => (float) $totals->total_shortfall,
                    'total_overage'    => (float) $totals->total_overage,
                ],
                'by_expense_category' => $byCategory,
                'sessions'            => $sessions,
            ];
        });

        return response()->json($data);
    }

    /**
     * Comparativo de ventas y actividad entre sucursales.
     * GET /api/reports/branch-comparison
     */
    public function branchComparison(Request $request): JsonResponse
    {
        $dateFrom = $request->input('date_from', now()->startOfMonth()->toDateString());
        $dateTo   = $request->input('date_to', now()->toDateString());

        $branches = Branch::where('is_active', true)->orderBy('is_main', 'desc')->orderBy('name')->get();

        $result = $branches->map(function (Branch $branch) use ($dateFrom, $dateTo) {
            $salesQuery = Sale::query()
                ->where('branch_id', $branch->id)
                ->whereNotIn('status', ['draft', 'cancelled'])
                ->whereDate('created_at', '>=', $dateFrom)
                ->whereDate('created_at', '<=', $dateTo);

            $salesAgg = (clone $salesQuery)
                ->selectRaw('COUNT(*) as sales_count, COALESCE(SUM(total),0) as sales_amount')
                ->first();

            $salesCount  = (int) $salesAgg->sales_count;
            $salesAmount = (float) $salesAgg->sales_amount;
            $avgTicket   = $salesCount > 0 ? round($salesAmount / $salesCount, 2) : 0;

            $labOrders = LabOrder::where('branch_id', $branch->id)
                ->whereDate('created_at', '>=', $dateFrom)
                ->whereDate('created_at', '<=', $dateTo)
                ->count();

            $newPatients = Patient::where('branch_id', $branch->id)
                ->whereDate('created_at', '>=', $dateFrom)
                ->whereDate('created_at', '<=', $dateTo)
                ->count();

            return [
                'branch_id'   => $branch->id,
                'branch_name' => $branch->name,
                'sales_count' => $salesCount,
                'sales_amount' => $salesAmount,
                'avg_ticket'  => $avgTicket,
                'lab_orders'  => $labOrders,
                'new_patients' => $newPatients,
            ];
        })->values();

        return response()->json([
            'branches' => $result,
            'period'   => ['from' => $dateFrom, 'to' => $dateTo],
        ]);
    }

    /**
     * Dashboard comercial con KPIs en tiempo real para el dueño.
     * GET /api/reports/dashboard-commercial
     */
    public function dashboardCommercial(Request $request): JsonResponse
    {
        $cacheKey = 'report_dashboard_commercial_' . now()->format('Y-m-d-H-i');

        $data = Cache::remember($cacheKey, 60, function () {
            $today     = now()->toDateString();
            $monthStart = now()->startOfMonth()->toDateString();
            $lastMonthStart = now()->subMonth()->startOfMonth()->toDateString();
            $lastMonthEnd   = now()->subMonth()->endOfMonth()->toDateString();
            $weekStart  = now()->startOfWeek()->toDateString();

            $isSqlite = DB::getDriverName() === 'sqlite';

            // Hoy
            $todaySales = Sale::query()
                ->whereNotIn('status', ['draft', 'cancelled'])
                ->whereDate('created_at', $today)
                ->selectRaw('COUNT(*) as cnt, COALESCE(SUM(total),0) as amount')
                ->first();

            $newPatientsToday = Patient::whereDate('created_at', $today)->count();

            $todayCount  = (int) $todaySales->cnt;
            $todayAmount = (float) $todaySales->amount;

            // Mes actual
            $monthSales = Sale::query()
                ->whereNotIn('status', ['draft', 'cancelled'])
                ->whereDate('created_at', '>=', $monthStart)
                ->whereDate('created_at', '<=', $today)
                ->selectRaw('COUNT(*) as cnt, COALESCE(SUM(total),0) as amount')
                ->first();

            $monthCount  = (int) $monthSales->cnt;
            $monthAmount = (float) $monthSales->amount;

            // Mes anterior (para comparativa)
            $lastMonthAmount = Sale::query()
                ->whereNotIn('status', ['draft', 'cancelled'])
                ->whereDate('created_at', '>=', $lastMonthStart)
                ->whereDate('created_at', '<=', $lastMonthEnd)
                ->sum('total');

            $vsLastMonthPct = $lastMonthAmount > 0
                ? round((($monthAmount - $lastMonthAmount) / $lastMonthAmount) * 100, 1)
                : null;

            // Pendientes
            $labReady   = LabOrder::where('status', 'ready')->count();
            $labOverdue = LabOrder::overdue()->count();

            $balancePending = Sale::query()
                ->whereNotIn('status', ['draft', 'cancelled'])
                ->where('balance', '>', 0)
                ->selectRaw('COUNT(*) as cnt, COALESCE(SUM(balance),0) as total_balance')
                ->first();

            // Inventario crítico
            $lowStock    = Inventory::whereRaw('quantity <= min_stock AND quantity > 0')->count();
            $outOfStock  = Inventory::where('quantity', '<=', 0)->count();

            // Top vendedores de la semana
            $topSellers = Sale::query()
                ->whereNotIn('status', ['draft', 'cancelled'])
                ->whereDate('created_at', '>=', $weekStart)
                ->whereDate('created_at', '<=', $today)
                ->join('users', 'sales.user_id', '=', 'users.id')
                ->selectRaw('users.name, COUNT(*) as count, COALESCE(SUM(sales.total),0) as amount')
                ->groupBy('users.name')
                ->orderByDesc('amount')
                ->limit(5)
                ->get()
                ->map(fn ($r) => [
                    'name'   => $r->name,
                    'amount' => (float) $r->amount,
                    'count'  => (int) $r->count,
                ])
                ->values();

            // Ventas por hora hoy
            $hourExpr = $isSqlite ? "CAST(STRFTIME('%H', created_at) AS INTEGER)" : 'HOUR(created_at)';
            $byHour = Sale::query()
                ->whereNotIn('status', ['draft', 'cancelled'])
                ->whereDate('created_at', $today)
                ->selectRaw("{$hourExpr} as hour, COUNT(*) as count, COALESCE(SUM(total),0) as amount")
                ->groupByRaw($hourExpr)
                ->orderByRaw($hourExpr)
                ->get()
                ->map(fn ($r) => [
                    'hour'   => (int) $r->hour,
                    'count'  => (int) $r->count,
                    'amount' => (float) $r->amount,
                ])
                ->values();

            return [
                'today' => [
                    'sales_count'  => $todayCount,
                    'sales_amount' => $todayAmount,
                    'avg_ticket'   => $todayCount > 0 ? round($todayAmount / $todayCount, 2) : 0,
                    'new_patients' => $newPatientsToday,
                ],
                'month' => [
                    'sales_amount'       => $monthAmount,
                    'sales_count'        => $monthCount,
                    'avg_ticket'         => $monthCount > 0 ? round($monthAmount / $monthCount, 2) : 0,
                    'vs_last_month_pct'  => $vsLastMonthPct,
                ],
                'pending' => [
                    'lab_orders_ready'     => $labReady,
                    'lab_orders_overdue'   => $labOverdue,
                    'sales_with_balance'   => (int) $balancePending->cnt,
                    'total_pending_balance' => (float) $balancePending->total_balance,
                ],
                'inventory' => [
                    'low_stock_count'    => $lowStock,
                    'out_of_stock_count' => $outOfStock,
                ],
                'top_sellers_week'     => $topSellers,
                'sales_by_hour_today'  => $byHour,
                'generated_at'         => now()->toISOString(),
            ];
        });

        return response()->json($data);
    }
}
