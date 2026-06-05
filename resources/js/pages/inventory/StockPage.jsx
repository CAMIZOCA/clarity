import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, DollarSign, Package, TrendingUp, Layers } from 'lucide-react';
import { getInventory, getLowStock, getValuation } from '../../api/inventory';
import Button from '../../components/ui/Button';
import StockBadge from '../../components/ui/StockBadge';
import { useToast } from '../../components/ui/Toast';
import { getList, getPayload } from '../../api/response';

function StatCard({ icon: Icon, label, value, color = 'blue' }) {
    const colors = {
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-green-50 text-green-600',
        purple: 'bg-purple-50 text-purple-600',
        yellow: 'bg-yellow-50 text-yellow-600',
        gray: 'bg-gray-50 text-gray-600',
    };
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors[color]}`}>
                <Icon size={22} />
            </div>
            <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</p>
                <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
            </div>
        </div>
    );
}

export default function StockPage() {
    const [tab, setTab] = useState('actual');
    const [inventory, setInventory] = useState([]);
    const [valuation, setValuation] = useState(null);
    const [topProducts, setTopProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [onlyLowStock, setOnlyLowStock] = useState(false);
    const [filterBodega, setFilterBodega] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const { addToast } = useToast();

    const loadInventory = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (filterBodega) params.warehouse_id = filterBodega;
            if (filterCategory) params.category = filterCategory;
            if (onlyLowStock) params.low_stock = 1;

            const res = onlyLowStock
                ? await getLowStock(params)
                : await getInventory(params);
            setInventory(getList(res));
        } catch {
            addToast('Error al cargar el inventario', 'error');
        } finally {
            setLoading(false);
        }
    }, [filterBodega, filterCategory, onlyLowStock]);

    const loadValuation = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getValuation();
            const data = getPayload(res);
            setValuation(data);
            setTopProducts(data.top_products ?? []);
        } catch {
            addToast('Error al cargar la valorización', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (tab === 'actual') loadInventory();
        if (tab === 'valorizacion') loadValuation();
    }, [tab, loadInventory, loadValuation]);

    const fmt = (v) => v != null ? `$${Number(v).toLocaleString('es-ES', { minimumFractionDigits: 2 })}` : '—';

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Stock General</h1>
                    <p className="text-gray-500 mt-1">Niveles de inventario y valorización</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-5 border-b border-gray-200">
                {[
                    { key: 'actual', label: 'Stock Actual' },
                    { key: 'valorizacion', label: 'Valorización' },
                ].map(({ key, label }) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                            tab === key
                                ? 'bg-white border border-b-white text-[#1a2a4a] -mb-px'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* ── Tab: Stock Actual ── */}
            {tab === 'actual' && (
                <>
                    {/* Filtros */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5 flex flex-wrap gap-4 items-center">
                        <input
                            type="text"
                            value={filterBodega}
                            onChange={e => setFilterBodega(e.target.value)}
                            placeholder="Filtrar por bodega..."
                            className="py-2.5 px-3 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] bg-white"
                        />
                        <select
                            value={filterCategory}
                            onChange={e => setFilterCategory(e.target.value)}
                            className="py-2.5 px-3 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] bg-white"
                        >
                            <option value="">Todas las categorías</option>
                            <option value="armazon">Armazón</option>
                            <option value="luna">Luna</option>
                            <option value="lente_contacto">Lente de Contacto</option>
                            <option value="accesorio">Accesorio</option>
                            <option value="servicio">Servicio</option>
                        </select>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={onlyLowStock}
                                onChange={e => setOnlyLowStock(e.target.checked)}
                                className="w-4 h-4"
                            />
                            <span className="text-sm text-gray-700">Solo stock bajo</span>
                        </label>
                        <Button size="sm" variant="secondary" onClick={loadInventory}>
                            Actualizar
                        </Button>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#1a2a4a] text-white">
                                    <th className="px-5 py-4 text-left font-semibold">Producto / Variante</th>
                                    <th className="px-5 py-4 text-left font-semibold">Bodega</th>
                                    <th className="px-5 py-4 text-center font-semibold">Cantidad</th>
                                    <th className="px-5 py-4 text-center font-semibold">Reservado</th>
                                    <th className="px-5 py-4 text-center font-semibold">Disponible</th>
                                    <th className="px-5 py-4 text-center font-semibold">Mínimo</th>
                                    <th className="px-5 py-4 text-center font-semibold">Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="py-16 text-center">
                                            <div className="animate-spin h-8 w-8 border-4 border-[#1a2a4a] border-t-transparent rounded-full mx-auto" />
                                        </td>
                                    </tr>
                                ) : inventory.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-12 text-center text-gray-400">
                                            <Layers size={36} className="mx-auto mb-2 text-gray-300" />
                                            No se encontraron registros de inventario
                                        </td>
                                    </tr>
                                ) : inventory.map((item, i) => {
                                    const variant = item.product_variant ?? item.productVariant ?? {};
                                    const product = variant.product ?? {};
                                    const warehouse = item.warehouse ?? {};
                                    const qty = item.cantidad ?? item.quantity ?? 0;
                                    const reserved = item.reservado ?? item.reserved ?? 0;
                                    const available = item.disponible ?? item.available ?? (qty - reserved);
                                    const minStock = item.stock_minimo ?? item.min_stock ?? 0;
                                    return (
                                        <tr key={item.id ?? i} className={`border-t border-gray-100 hover:bg-blue-50/40 ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                                            <td className="px-5 py-3">
                                                <p className="font-medium text-gray-900">{item.producto ?? item.product_name ?? product.name ?? '—'}</p>
                                                <p className="text-xs text-gray-500">{item.variante ?? variant.sku ?? '—'}</p>
                                            </td>
                                            <td className="px-5 py-3 text-gray-600">{item.bodega ?? warehouse.name ?? '—'}</td>
                                            <td className="px-5 py-3 text-center font-medium">{qty}</td>
                                            <td className="px-5 py-3 text-center text-gray-500">{reserved}</td>
                                            <td className="px-5 py-3 text-center font-medium text-blue-700">{available}</td>
                                            <td className="px-5 py-3 text-center text-gray-500">{minStock}</td>
                                            <td className="px-5 py-3 text-center">
                                                <StockBadge quantity={available} minStock={minStock} />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* ── Tab: Valorización ── */}
            {tab === 'valorizacion' && (
                <>
                    {loading ? (
                        <div className="flex items-center justify-center h-48">
                            <div className="animate-spin h-10 w-10 border-4 border-[#1a2a4a] border-t-transparent rounded-full" />
                        </div>
                    ) : (
                        <>
                            {/* Tarjetas */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                <StatCard icon={DollarSign} label="Valor al Costo" value={fmt(valuation?.total_cost_value)} color="blue" />
                                <StatCard icon={TrendingUp} label="Valor de Venta" value={fmt(valuation?.total_sale_value)} color="green" />
                                <StatCard icon={BarChart3} label="Margen Potencial" value={fmt(valuation?.potential_margin)} color="purple" />
                                <StatCard icon={Package} label="Total Unidades" value={valuation?.total_units ?? '—'} color="yellow" />
                            </div>

                            {/* Top productos */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="px-5 py-4 border-b border-gray-100">
                                    <p className="font-semibold text-gray-800">Top 10 productos más valiosos</p>
                                </div>
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
                                            <th className="px-4 py-3 text-left">#</th>
                                            <th className="px-4 py-3 text-left">Producto</th>
                                            <th className="px-4 py-3 text-center">Unidades</th>
                                            <th className="px-4 py-3 text-right">Valor Costo</th>
                                            <th className="px-4 py-3 text-right">Valor Venta</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {topProducts.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-10 text-center text-gray-400">
                                                    Sin datos de valorización disponibles
                                                </td>
                                            </tr>
                                        ) : topProducts.map((p, i) => (
                                            <tr key={p.id ?? i} className={`border-t border-gray-100 ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                                                <td className="px-4 py-3 text-gray-500 font-medium">{i + 1}</td>
                                                <td className="px-4 py-3 font-medium text-gray-900">{p.nombre ?? p.name}</td>
                                                <td className="px-4 py-3 text-center">{p.total_units ?? '—'}</td>
                                                <td className="px-4 py-3 text-right">{fmt(p.cost_value)}</td>
                                                <td className="px-4 py-3 text-right font-medium text-green-700">{fmt(p.sale_value)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}
