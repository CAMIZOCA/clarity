import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    TrendingUp, TrendingDown, RefreshCw, AlertTriangle,
    DollarSign, ShoppingCart, Users, FlaskConical, ArrowRight,
    BarChart2
} from 'lucide-react';
import { getDashboardCommercial } from '../../api/reports';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import AiSalesAnalysis from '../../components/ai/AiSalesAnalysis';
import client from '../../api/client';

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────
const money = (n) => `$${Number(n ?? 0).toFixed(2)}`;
const pct   = (n) => `${Number(n ?? 0).toFixed(1)}%`;

function DeltaBadge({ value }) {
    const up = Number(value) >= 0;
    return (
        <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? 'text-green-600' : 'text-red-500'}`}>
            {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(Number(value ?? 0)).toFixed(1)}%
        </span>
    );
}

// ────────────────────────────────────────────────────────────────
// KPI Card
// ────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, delta, deltaLabel, sub, color }) {
    return (
        <div className={`bg-white rounded-2xl shadow-sm border border-gray-200 p-5`}>
            <div className="flex items-start justify-between mb-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
                    <Icon size={22} className="text-white" />
                </div>
                {delta !== undefined && <DeltaBadge value={delta} />}
            </div>
            <p className="text-3xl font-bold text-gray-900 leading-none">{value}</p>
            <p className="text-sm font-medium text-gray-500 mt-1">{label}</p>
            {deltaLabel && <p className="text-xs text-gray-400 mt-0.5">{deltaLabel}</p>}
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────
// Bar Chart (CSS, vertical)
// ────────────────────────────────────────────────────────────────
function BarChart({ data = [], maxValue }) {
    const max = maxValue || Math.max(...data.map(d => d.amount), 1);
    return (
        <div className="flex items-end gap-1 h-32">
            {data.map(({ period, amount }) => (
                <div key={period} className="flex flex-col items-center flex-1 min-w-0">
                    <div
                        className="bg-blue-500 rounded-t w-full min-h-[4px] hover:bg-blue-600 transition-colors cursor-pointer"
                        style={{ height: `${Math.max((amount / max) * 100, 2)}%` }}
                        title={`${period}: ${money(amount)}`}
                    />
                    <span className="text-[9px] text-gray-400 mt-1 truncate w-full text-center">
                        {String(period).split('-')[2] || period}
                    </span>
                </div>
            ))}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────
// Horizontal Bar Chart (hours)
// ────────────────────────────────────────────────────────────────
function HourlyChart({ data = [] }) {
    const maxAmt = Math.max(...data.map(d => d.amount), 1);
    return (
        <div className="space-y-1.5">
            {data.map(({ hour, amount, count }) => (
                <div key={hour} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-10 flex-shrink-0 text-right">
                        {String(hour).padStart(2, '0')}:00
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-4 relative overflow-hidden">
                        <div
                            className="bg-indigo-400 h-full rounded-full transition-all"
                            style={{ width: `${(amount / maxAmt) * 100}%` }}
                        />
                    </div>
                    <span className="text-xs text-gray-400 w-16 flex-shrink-0">
                        {money(amount)} <span className="text-gray-300">({count})</span>
                    </span>
                </div>
            ))}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────
// Skeleton
// ────────────────────────────────────────────────────────────────
function Skeleton({ className = '' }) {
    return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />;
}

function KpiSkeleton() {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-3">
            <Skeleton className="w-11 h-11 rounded-xl" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-4 w-32" />
        </div>
    );
}

// ────────────────────────────────────────────────────────────────
// Alert row
// ────────────────────────────────────────────────────────────────
function AlertRow({ level, label, count, to }) {
    const navigate = useNavigate();
    const dot = level === 'red' ? 'bg-red-500' : level === 'yellow' ? 'bg-amber-400' : 'bg-blue-400';
    return (
        <button
            onClick={() => navigate(to)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
        >
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`} />
            <span className="flex-1 text-sm text-gray-700">{label}</span>
            {count > 0 && (
                <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full">
                    {count}
                </span>
            )}
            <ArrowRight size={14} className="text-gray-400 flex-shrink-0" />
        </button>
    );
}

// ────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────
export default function GerencialDashboard() {
    const [data, setData]           = useState(null);
    const [loading, setLoading]     = useState(true);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [aiEnabled, setAiEnabled] = useState(false);

    const fetchData = useCallback(() => {
        getDashboardCommercial()
            .then(r => {
                setData(r.data);
                setLastUpdate(new Date());
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 120_000);
        return () => clearInterval(interval);
    }, [fetchData]);

    // Check if AI features are enabled
    useEffect(() => {
        client.get('/ai/status')
            .then(r => setAiEnabled(r.data?.enabled ?? false))
            .catch(() => setAiEnabled(false));
    }, []);

    // Seconds since last update
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        const t = setInterval(() => {
            if (lastUpdate) setElapsed(Math.floor((Date.now() - lastUpdate.getTime()) / 1000));
        }, 1000);
        return () => clearInterval(t);
    }, [lastUpdate]);

    const kpis         = data?.kpis         || {};
    const salesByDay   = data?.salesByDay   || [];
    const salesByHour  = data?.salesByHour  || [];
    const topSellers   = data?.topSellers   || [];
    const alerts       = data?.alerts       || {};
    const financial    = data?.financial    || {};

    const maxSale = Math.max(...salesByDay.map(d => d.amount), 1);

    const now   = new Date();
    const month = format(now, "MMMM yyyy", { locale: es });

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <BarChart2 size={26} className="text-[#1a2a4a]" />
                        Dashboard Gerencial
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5 capitalize">
                        {format(now, "EEEE d 'de' MMMM yyyy", { locale: es })}
                        {lastUpdate && (
                            <span className="ml-2 text-gray-400">
                                · Actualizado hace {elapsed}s
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => { setLoading(true); fetchData(); }}
                        className="flex items-center gap-2 px-4 py-2 bg-[#1a2a4a] text-white rounded-lg text-sm font-medium hover:bg-[#253d6b] transition-colors"
                    >
                        <RefreshCw size={15} />
                        Actualizar
                    </button>
                </div>
            </div>

            {/* ── AI Sales Analysis ── */}
            {!loading && data && (
                <AiSalesAnalysis
                    aiEnabled={aiEnabled}
                    salesData={{
                        summary: {
                            total_amount:     financial.ventasBrutas ?? 0,
                            total_sales:      kpis.totalVentas ?? 0,
                            avg_ticket:       kpis.ticketPromedio ?? 0,
                            gross_margin_pct: financial.margenPct ?? 0,
                            total_discount:   financial.descuentos ?? 0,
                        },
                        vs_previous: financial.vsAnterior
                            ? `${financial.vsAnteriorPct?.toFixed(1)}% (${financial.vsAnterior})`
                            : undefined,
                    }}
                />
            )}

            {/* ── KPIs ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {loading ? (
                    <>
                        <KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
                    </>
                ) : (
                    <>
                        <KpiCard
                            icon={DollarSign}
                            label="Ventas hoy"
                            value={money(kpis.ventasHoy)}
                            delta={kpis.ventasHoyDelta}
                            deltaLabel="vs ayer"
                            color="bg-emerald-500"
                        />
                        <KpiCard
                            icon={ShoppingCart}
                            label="Ticket promedio"
                            value={money(kpis.ticketPromedio)}
                            delta={kpis.ticketDelta}
                            deltaLabel="vs mes anterior"
                            color="bg-blue-500"
                        />
                        <KpiCard
                            icon={Users}
                            label="Pacientes nuevos"
                            value={kpis.pacientesNuevos ?? 0}
                            sub={`este mes: ${kpis.pacientesNuevosMes ?? 0}`}
                            color="bg-[#1a2a4a]"
                        />
                        <KpiCard
                            icon={FlaskConical}
                            label="Órdenes pendientes"
                            value={kpis.ordenesPendientes ?? 0}
                            sub={`${kpis.ordenesAtrasadas ?? 0} atrasadas`}
                            color="bg-amber-500"
                        />
                    </>
                )}
            </div>

            {/* ── Ventas del mes + Alertas ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                {/* Ventas por día */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                    <h2 className="font-semibold text-gray-900 mb-4">Ventas del mes — {month}</h2>
                    {loading ? (
                        <Skeleton className="h-32 w-full" />
                    ) : salesByDay.length === 0 ? (
                        <p className="text-sm text-gray-400 py-8 text-center">Sin datos de ventas</p>
                    ) : (
                        <BarChart data={salesByDay} maxValue={maxSale} />
                    )}
                </div>

                {/* Alertas */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                        <AlertTriangle size={16} className="text-amber-500" />
                        <h2 className="font-semibold text-gray-900">Alertas accionables</h2>
                    </div>
                    {loading ? (
                        <div className="p-4 space-y-2">
                            <Skeleton className="h-10" /><Skeleton className="h-10" />
                            <Skeleton className="h-10" /><Skeleton className="h-10" />
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            <AlertRow
                                level={alerts.ordenesAtrasadas > 0 ? 'red' : 'blue'}
                                label="Órdenes de lab atrasadas"
                                count={alerts.ordenesAtrasadas ?? 0}
                                to="/laboratorio"
                            />
                            <AlertRow
                                level="yellow"
                                label="Productos con stock bajo"
                                count={alerts.productosStockBajo ?? 0}
                                to="/inventario/stock"
                            />
                            <AlertRow
                                level="yellow"
                                label="Ventas con saldo pendiente"
                                count={alerts.ventasSaldoPendiente ?? 0}
                                to="/ventas"
                            />
                            <AlertRow
                                level="blue"
                                label="Órdenes listas para entregar"
                                count={alerts.ordenesListas ?? 0}
                                to="/laboratorio"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* ── Top Vendedores + Resumen Financiero ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                {/* Top vendedores */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                    <h2 className="font-semibold text-gray-900 mb-4">Top vendedores — esta semana</h2>
                    {loading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" />
                        </div>
                    ) : topSellers.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-6">Sin datos</p>
                    ) : (
                        <div className="space-y-3">
                            {topSellers.map((seller, idx) => {
                                const maxAmount = topSellers[0]?.total ?? 1;
                                const widthPct  = Math.max((seller.total / maxAmount) * 100, 4);
                                const medals    = ['🥇', '🥈', '🥉'];
                                return (
                                    <div key={seller.id ?? idx} className="flex items-center gap-3">
                                        <span className="text-lg w-8 text-center flex-shrink-0">
                                            {medals[idx] ?? `${idx + 1}.`}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <p className="text-sm font-medium text-gray-800 truncate">{seller.name}</p>
                                                <p className="text-sm font-bold text-gray-900 ml-2 flex-shrink-0">
                                                    {money(seller.total)}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                                                    <div
                                                        className="bg-blue-500 h-full rounded-full"
                                                        style={{ width: `${widthPct}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-gray-400 flex-shrink-0">
                                                    {seller.count} venta{seller.count !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Resumen financiero */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                    <h2 className="font-semibold text-gray-900 mb-4 capitalize">
                        Resumen financiero — {month}
                    </h2>
                    {loading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-5 w-full" />
                            <Skeleton className="h-5 w-3/4" />
                            <Skeleton className="h-5 w-5/6" />
                            <Skeleton className="h-px w-full mt-3 mb-2" />
                            <Skeleton className="h-7 w-full" />
                        </div>
                    ) : (
                        <div className="space-y-0 font-mono text-sm">
                            <div className="flex justify-between py-1.5 border-b border-gray-50">
                                <span className="text-gray-600">Ventas brutas</span>
                                <span className="font-semibold text-gray-900">{money(financial.ventasBrutas)}</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-gray-50">
                                <span className="text-gray-600">Descuentos</span>
                                <span className="text-red-500">-{money(financial.descuentos)}</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-gray-100">
                                <span className="text-gray-600">Costo de ventas</span>
                                <span className="text-red-500">-{money(financial.costoVentas)}</span>
                            </div>
                            <div className="flex justify-between py-2 mt-1 bg-emerald-50 rounded-lg px-2">
                                <span className="font-bold text-gray-800">Margen bruto</span>
                                <span className="font-bold text-emerald-700">
                                    {money(financial.margenBruto)}
                                    {financial.margenPct !== undefined && (
                                        <span className="text-emerald-500 ml-1 font-normal">
                                            ({pct(financial.margenPct)})
                                        </span>
                                    )}
                                </span>
                            </div>
                            {financial.vsAnterior !== undefined && (
                                <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                                    <span>vs mes anterior:</span>
                                    <DeltaBadge value={financial.vsAnteriorPct} />
                                    <span className="text-gray-400">{money(financial.vsAnterior)}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Ventas por hora ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-6">
                <h2 className="font-semibold text-gray-900 mb-4">Ventas por hora — hoy</h2>
                {loading ? (
                    <div className="space-y-2">
                        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-5" />)}
                    </div>
                ) : salesByHour.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">Sin ventas registradas hoy</p>
                ) : (
                    <HourlyChart data={salesByHour} />
                )}
            </div>

            {/* Footer links */}
            <div className="flex flex-wrap gap-3">
                <Link to="/reportes-comerciales" className="text-sm text-[#1a2a4a] hover:underline flex items-center gap-1">
                    Ver reportes detallados <ArrowRight size={14} />
                </Link>
                <span className="text-gray-300">|</span>
                <Link to="/ventas" className="text-sm text-[#1a2a4a] hover:underline flex items-center gap-1">
                    Historial de ventas <ArrowRight size={14} />
                </Link>
                <span className="text-gray-300">|</span>
                <Link to="/caja" className="text-sm text-[#1a2a4a] hover:underline flex items-center gap-1">
                    Caja <ArrowRight size={14} />
                </Link>
            </div>
        </div>
    );
}
