import React, { useState, useEffect, useCallback } from 'react';
import {
    BarChart2, Package, FlaskConical, DollarSign,
    Download, RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react';
import {
    getSalesReport,
    getInventoryReport,
    getLabReport,
    getCashReport,
    exportSales,
    exportInventory,
} from '../../api/reports';
import ErrorState from '../../components/ui/ErrorState';
import { useToast } from '../../components/ui/Toast';
import { format, startOfMonth } from 'date-fns';

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────
const money  = (n) => `$${Number(n ?? 0).toFixed(2)}`;
const pct    = (n) => `${Number(n ?? 0).toFixed(1)}%`;
const today  = () => format(new Date(), 'yyyy-MM-dd');
const firstDayOfMonth = () => format(startOfMonth(new Date()), 'yyyy-MM-dd');

/** Los nombres de filtro son los que lee ReportController: date_from / date_to. */
const defaultRange = () => ({ date_from: firstDayOfMonth(), date_to: today() });

/** `2026-09-08 19:30:00` → `19:30`; null → guion. */
const timeOf = (value) => (value ? String(value).slice(11, 16) || '—' : '—');
const dateOf = (value) => (value ? String(value).slice(0, 10) : '—');

function Skeleton({ className = '' }) {
    return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

function TabButton({ active, onClick, icon: Icon, label }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                    ? 'bg-[#1a2a4a] text-white'
                    : 'text-gray-600 hover:bg-gray-100'
            }`}
        >
            <Icon size={16} />
            {label}
        </button>
    );
}

/** Rango de fechas compartido por las pestañas que filtran por periodo. */
function RangeFilters({ filters, setFilters, onApply, children }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex flex-wrap gap-4 items-end">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
                    <input
                        type="date"
                        value={filters.date_from}
                        onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]/30"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
                    <input
                        type="date"
                        value={filters.date_to}
                        onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]/30"
                    />
                </div>
                <div className="flex gap-2 ml-auto">
                    <button
                        onClick={onApply}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                    >
                        <RefreshCw size={14} /> Aplicar
                    </button>
                    {children}
                </div>
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────
// Bar chart (CSS, horizontal)
// ────────────────────────────────────────────────────────────────
function HBarChart({ data = [], labelKey = 'period', valueKey = 'amount', colorClass = 'bg-blue-500' }) {
    const max = Math.max(...data.map(d => d[valueKey]), 1);
    return (
        <div className="space-y-2">
            {data.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-24 flex-shrink-0 truncate">{item[labelKey]}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                        <div
                            className={`${colorClass} h-full rounded-full transition-all`}
                            style={{ width: `${Math.max((item[valueKey] / max) * 100, 2)}%` }}
                        />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 w-24 text-right flex-shrink-0">
                        {money(item[valueKey])}
                    </span>
                </div>
            ))}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────
// Table
// ────────────────────────────────────────────────────────────────
function DataTable({ columns = [], rows = [], loading = false }) {
    const [sortCol, setSortCol] = useState(null);
    const [sortDir, setSortDir] = useState('asc');

    const sorted = [...rows].sort((a, b) => {
        if (!sortCol) return 0;
        const av = a[sortCol];
        const bv = b[sortCol];
        const cmp = typeof av === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''));
        return sortDir === 'asc' ? cmp : -cmp;
    });

    const toggleSort = (key) => {
        if (sortCol === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortCol(key); setSortDir('asc'); }
    };

    return (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <tr>
                        {columns.map(col => (
                            <th
                                key={col.key}
                                className={`px-4 py-3 text-left select-none ${col.sortable !== false ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                                onClick={col.sortable !== false ? () => toggleSort(col.key) : undefined}
                            >
                                <span className="flex items-center gap-1">
                                    {col.label}
                                    {sortCol === col.key && (
                                        sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                                    )}
                                </span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {loading ? (
                        [...Array(5)].map((_, i) => (
                            <tr key={i}>
                                {columns.map(col => (
                                    <td key={col.key} className="px-4 py-3">
                                        <Skeleton className="h-4" />
                                    </td>
                                ))}
                            </tr>
                        ))
                    ) : sorted.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                                Sin datos para el período seleccionado
                            </td>
                        </tr>
                    ) : sorted.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                            {columns.map(col => (
                                <td key={col.key} className={`px-4 py-3 text-gray-700 ${col.className ?? ''}`}>
                                    {col.render ? col.render(row[col.key], row, i) : (row[col.key] ?? '—')}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────
// Payment method breakdown
// ────────────────────────────────────────────────────────────────
function PaymentBreakdown({ data = [], loading }) {
    if (loading) return <div className="grid grid-cols-2 gap-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>;
    if (!data.length) return <p className="text-sm text-gray-400">Sin datos</p>;
    const total = data.reduce((s, d) => s + (d.amount ?? 0), 0);
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {data.map((item, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 truncate capitalize">{item.method}</p>
                    <p className="text-lg font-bold text-gray-900">{money(item.amount)}</p>
                    <p className="text-xs text-gray-400">{pct(total ? (item.amount / total) * 100 : 0)}</p>
                </div>
            ))}
        </div>
    );
}

/**
 * Carga de un reporte con estado de error explicito.
 *
 * Antes cada pestaña hacia `.catch(() => setData(null))`: un 500 quedaba
 * indistinguible de un periodo sin ventas y el usuario leia "$0.00" como si
 * fuera el dato real. Ahora un fallo se ve y se puede reintentar.
 */
function useReport(fetcher, params) {
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        setError(false);
        fetcher(params)
            .then(r => setData(r.data))
            .catch(() => { setData(null); setError(true); })
            .finally(() => setLoading(false));
        // `fetcher` es una funcion estable importada del modulo de API.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params]);

    useEffect(() => { load(); }, [load]);

    return { data, loading, error, reload: load };
}

/** Descarga un blob de exportacion como archivo. */
function useExport(exporter, filename) {
    const [exporting, setExporting] = useState(false);
    const { addToast } = useToast();

    const run = async (params) => {
        setExporting(true);
        try {
            const response = await exporter(params);
            const url  = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            addToast('No se pudo generar el archivo. Intente nuevamente.', 'error');
        } finally {
            setExporting(false);
        }
    };

    return { exporting, run };
}

// ────────────────────────────────────────────────────────────────
// Tab: Ventas
// ────────────────────────────────────────────────────────────────
function SalesTab() {
    const [filters, setFilters] = useState(defaultRange);
    const [applied, setApplied] = useState(filters);
    const { data, loading, error, reload } = useReport(getSalesReport, applied);
    const { exporting, run: runExport } = useExport(exportSales, 'ventas.xlsx');

    const topSellersCols = [
        { key: 'position',  label: '#',        sortable: false, render: (_, __, idx) => idx + 1 },
        { key: 'name',      label: 'Vendedor' },
        { key: 'count',     label: 'Ventas',   render: v => v ?? 0 },
        { key: 'amount',    label: 'Total',    render: v => money(v), className: 'font-mono font-semibold' },
    ];

    const summary = data?.summary;

    return (
        <div className="space-y-6">
            <RangeFilters filters={filters} setFilters={setFilters} onApply={() => setApplied(filters)}>
                <button
                    onClick={() => runExport(applied)}
                    disabled={exporting}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors disabled:opacity-60"
                >
                    <Download size={14} />
                    {exporting ? 'Exportando...' : 'Exportar Excel'}
                </button>
            </RangeFilters>

            {error ? <ErrorState onRetry={reload} /> : (
                <>
                    {/* Summary cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {loading ? [...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />) : (
                            <>
                                {[
                                    { label: 'Total ventas',    value: money(summary?.total_amount) },
                                    { label: 'Núm. ventas',     value: summary?.total_sales ?? 0 },
                                    { label: 'Ticket promedio', value: money(summary?.avg_ticket) },
                                    { label: 'Descuentos',      value: money(summary?.total_discount) },
                                ].map(card => (
                                    <div key={card.label} className="bg-white rounded-2xl border border-gray-200 p-4">
                                        <p className="text-xs text-gray-500">{card.label}</p>
                                        <p className="text-xl font-bold text-gray-900 mt-1">{card.value}</p>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>

                    {/* Margen */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {loading ? [...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />) : (
                            <>
                                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                                    <p className="text-xs text-gray-500">Costo total</p>
                                    <p className="text-xl font-bold text-gray-900 mt-1">{money(summary?.total_cost)}</p>
                                </div>
                                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                                    <p className="text-xs text-gray-500">Margen bruto</p>
                                    <p className="text-xl font-bold text-emerald-700 mt-1">{money(summary?.gross_margin)}</p>
                                </div>
                                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                                    <p className="text-xs text-gray-500">Margen %</p>
                                    <p className="text-xl font-bold text-gray-900 mt-1">{pct(summary?.gross_margin_pct)}</p>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Sales by period chart */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5">
                        <h3 className="font-semibold text-gray-900 mb-4">Ventas por período</h3>
                        {loading
                            ? <Skeleton className="h-24" />
                            : <HBarChart data={data?.by_period ?? []} labelKey="period" valueKey="amount" />
                        }
                    </div>

                    {/* Payment method breakdown */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5">
                        <h3 className="font-semibold text-gray-900 mb-4">Desglose por método de pago</h3>
                        <PaymentBreakdown data={data?.by_payment_method ?? []} loading={loading} />
                    </div>

                    {/* Top sellers */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5">
                        <h3 className="font-semibold text-gray-900 mb-4">Top vendedores</h3>
                        <DataTable columns={topSellersCols} rows={data?.by_seller ?? []} loading={loading} />
                    </div>
                </>
            )}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────
// Tab: Inventario
// ────────────────────────────────────────────────────────────────
const NO_PARAMS = {};

function InventoryTab() {
    const { data, loading, error, reload } = useReport(getInventoryReport, NO_PARAMS);
    const { exporting, run: runExport } = useExport(exportInventory, 'inventario.xlsx');

    const lowStockCols = [
        { key: 'sku',       label: 'SKU' },
        { key: 'name',      label: 'Producto' },
        { key: 'warehouse', label: 'Bodega' },
        { key: 'quantity',  label: 'Stock actual', className: 'font-semibold text-red-500' },
        { key: 'min_stock', label: 'Stock mínimo' },
    ];

    const noMovCols = [
        { key: 'sku',           label: 'SKU' },
        { key: 'name',          label: 'Producto' },
        { key: 'quantity',      label: 'Stock' },
        { key: 'last_movement', label: 'Último movimiento' },
    ];

    const byCatCols = [
        { key: 'category',   label: 'Categoría' },
        { key: 'units',      label: 'Unidades' },
        { key: 'cost_value', label: 'Valor costo', render: v => money(v), className: 'font-mono' },
        { key: 'sale_value', label: 'Valor venta', render: v => money(v), className: 'font-mono font-semibold' },
    ];

    const valuation = data?.valuation;
    const lowStock  = data?.low_stock ?? [];

    return (
        <div className="space-y-6">
            {/* Header actions */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Inventario</h3>
                <div className="flex gap-2">
                    <button onClick={reload} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
                        <RefreshCw size={14} /> Actualizar
                    </button>
                    <button
                        onClick={() => runExport()}
                        disabled={exporting}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-60"
                    >
                        <Download size={14} /> {exporting ? 'Exportando...' : 'Exportar Excel'}
                    </button>
                </div>
            </div>

            {error ? <ErrorState onRetry={reload} /> : (
                <>
                    {/* Valorization */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {loading ? [...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />) : (
                            <>
                                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                                    <p className="text-xs text-gray-500">Valorización total (costo)</p>
                                    <p className="text-xl font-bold text-gray-900 mt-1">{money(valuation?.total_cost_value)}</p>
                                </div>
                                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                                    <p className="text-xs text-gray-500">Valorización total (venta)</p>
                                    <p className="text-xl font-bold text-gray-900 mt-1">{money(valuation?.total_sale_value)}</p>
                                </div>
                                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                                    <p className="text-xs text-gray-500">Productos con stock bajo</p>
                                    <p className="text-xl font-bold text-red-600 mt-1">{lowStock.length}</p>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Low stock */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5">
                        <h3 className="font-semibold mb-4 text-red-600">Productos con stock bajo</h3>
                        <DataTable columns={lowStockCols} rows={lowStock} loading={loading} />
                    </div>

                    {/* No movement */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5">
                        <h3 className="font-semibold text-gray-900 mb-4">Sin movimiento (últimos 30 días)</h3>
                        <DataTable columns={noMovCols} rows={data?.no_movement_30d ?? []} loading={loading} />
                    </div>

                    {/* By category */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5">
                        <h3 className="font-semibold text-gray-900 mb-4">Por categoría</h3>
                        <DataTable columns={byCatCols} rows={data?.by_category ?? []} loading={loading} />
                    </div>
                </>
            )}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────
// Tab: Laboratorio
// ────────────────────────────────────────────────────────────────
function LabTab() {
    const [filters, setFilters] = useState(defaultRange);
    const [applied, setApplied] = useState(filters);
    const { data, loading, error, reload } = useReport(getLabReport, applied);

    const lateOrdersCols = [
        { key: 'order_number', label: 'Orden' },
        { key: 'patient',      label: 'Paciente' },
        { key: 'lab',          label: 'Laboratorio' },
        { key: 'days_overdue', label: 'Días atrasado', render: v => <span className="text-red-500 font-semibold">{v}</span> },
    ];

    const labPerfCols = [
        { key: 'lab_name', label: 'Laboratorio' },
        { key: 'total',    label: 'Órdenes' },
        { key: 'avg_days', label: 'Días promedio', render: v => (v ?? '—') },
    ];

    const statuses = data?.by_status ?? [];
    const summary  = data?.summary;

    return (
        <div className="space-y-6">
            <RangeFilters filters={filters} setFilters={setFilters} onApply={() => setApplied(filters)} />

            {error ? <ErrorState onRetry={reload} /> : (
                <>
                    {/* Summary */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {loading ? [...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />) : (
                            <>
                                {[
                                    { label: 'Órdenes totales', value: summary?.total_orders ?? 0, tone: 'text-gray-900' },
                                    { label: 'Pendientes',      value: summary?.pending ?? 0,      tone: 'text-gray-900' },
                                    { label: 'Atrasadas',       value: summary?.overdue ?? 0,      tone: 'text-red-600' },
                                    { label: 'Días promedio',   value: summary?.avg_turnaround_days ?? '—', tone: 'text-gray-900' },
                                ].map(card => (
                                    <div key={card.label} className="bg-white rounded-2xl border border-gray-200 p-4">
                                        <p className="text-xs text-gray-500">{card.label}</p>
                                        <p className={`text-2xl font-bold mt-1 ${card.tone}`}>{card.value}</p>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>

                    {/* Status breakdown */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5">
                        <h3 className="font-semibold text-gray-900 mb-4">Órdenes por estado</h3>
                        {loading ? <Skeleton className="h-20" /> : (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {statuses.length === 0
                                    ? <p className="text-sm text-gray-400">Sin datos para el período seleccionado</p>
                                    : statuses.map(s => (
                                        <div key={s.status} className="bg-gray-50 rounded-xl p-3">
                                            <p className="text-xs text-gray-500 capitalize">{s.status}</p>
                                            <p className="text-lg font-bold text-gray-900">{s.total}</p>
                                        </div>
                                    ))
                                }
                            </div>
                        )}
                    </div>

                    {/* Late orders */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5">
                        <h3 className="font-semibold mb-4 text-red-600">Órdenes atrasadas</h3>
                        <DataTable columns={lateOrdersCols} rows={data?.overdue_orders ?? []} loading={loading} />
                    </div>

                    {/* Performance per lab */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5">
                        <h3 className="font-semibold text-gray-900 mb-4">Rendimiento por laboratorio</h3>
                        <DataTable columns={labPerfCols} rows={data?.by_lab ?? []} loading={loading} />
                    </div>
                </>
            )}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────
// Tab: Caja
// ────────────────────────────────────────────────────────────────
function CashTab() {
    const [filters, setFilters] = useState(defaultRange);
    const [applied, setApplied] = useState(filters);
    const { data, loading, error, reload } = useReport(getCashReport, applied);

    const sessionCols = [
        { key: 'opened_at',      label: 'Fecha',          render: v => dateOf(v) },
        { key: 'register',       label: 'Caja' },
        { key: 'opened_by',      label: 'Abierta por' },
        { key: 'opening_amount', label: 'Monto apertura', render: v => money(v), className: 'font-mono' },
        { key: 'actual_cash',    label: 'Monto cierre',   render: v => (v === null || v === undefined ? '—' : money(v)), className: 'font-mono font-semibold' },
        { key: 'difference',     label: 'Diferencia',     render: v => (v === null || v === undefined ? '—' : money(v)), className: 'font-mono' },
        { key: 'closed_at',      label: 'Cierre',         render: v => timeOf(v) },
        { key: 'status',         label: 'Estado' },
    ];

    const expenseCols = [
        { key: 'category', label: 'Categoría' },
        { key: 'count',    label: 'Gastos' },
        { key: 'total',    label: 'Monto', render: v => money(v), className: 'font-mono font-semibold' },
    ];

    const summary = data?.summary;

    // El backend entrega totales planos por metodo, no una lista.
    const paymentTotals = summary ? [
        { method: 'Efectivo',      amount: summary.total_cash },
        { method: 'Tarjeta',       amount: summary.total_card },
        { method: 'Transferencia', amount: summary.total_transfer },
        { method: 'Crédito',       amount: summary.total_credit },
    ] : [];

    const ingresos = Number(summary?.total_sales ?? 0);
    const gastos   = Number(summary?.total_expenses ?? 0);

    return (
        <div className="space-y-6">
            <RangeFilters filters={filters} setFilters={setFilters} onApply={() => setApplied(filters)} />

            {error ? <ErrorState onRetry={reload} /> : (
                <>
                    {/* Summary */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {loading ? [...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />) : (
                            <>
                                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                                    <p className="text-xs text-gray-500">Ingresos totales</p>
                                    <p className="text-xl font-bold text-emerald-700 mt-1">{money(ingresos)}</p>
                                </div>
                                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                                    <p className="text-xs text-gray-500">Gastos del período</p>
                                    <p className="text-xl font-bold text-red-600 mt-1">{money(gastos)}</p>
                                </div>
                                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                                    <p className="text-xs text-gray-500">Saldo neto</p>
                                    <p className="text-xl font-bold text-gray-900 mt-1">{money(ingresos - gastos)}</p>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Payment totals */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5">
                        <h3 className="font-semibold text-gray-900 mb-4">Totales por método de pago</h3>
                        <PaymentBreakdown data={paymentTotals} loading={loading} />
                    </div>

                    {/* Sessions */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5">
                        <h3 className="font-semibold text-gray-900 mb-4">Historial de sesiones de caja</h3>
                        <DataTable columns={sessionCols} rows={data?.sessions ?? []} loading={loading} />
                    </div>

                    {/* Expenses by category */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5">
                        <h3 className="font-semibold text-gray-900 mb-4">Gastos por categoría</h3>
                        <DataTable columns={expenseCols} rows={data?.by_expense_category ?? []} loading={loading} />
                    </div>
                </>
            )}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────
const TABS = [
    { key: 'ventas',      label: 'Ventas',      icon: BarChart2,    Component: SalesTab },
    { key: 'inventario',  label: 'Inventario',  icon: Package,      Component: InventoryTab },
    { key: 'laboratorio', label: 'Laboratorio', icon: FlaskConical, Component: LabTab },
    { key: 'caja',        label: 'Caja',        icon: DollarSign,   Component: CashTab },
];

export default function CommercialReportsPage() {
    const [activeTab, setActiveTab] = useState('ventas');
    const ActiveComponent = TABS.find(t => t.key === activeTab)?.Component ?? SalesTab;

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <BarChart2 size={24} className="text-[#1a2a4a]" />
                    Reportes Comerciales
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">Análisis de ventas, inventario, laboratorio y caja</p>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-6 bg-gray-100 rounded-xl p-1.5">
                {TABS.map(tab => (
                    <TabButton
                        key={tab.key}
                        active={activeTab === tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        icon={tab.icon}
                        label={tab.label}
                    />
                ))}
            </div>

            {/* Active Tab Content */}
            <ActiveComponent />
        </div>
    );
}
