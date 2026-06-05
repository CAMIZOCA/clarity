import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, Edit2, Trash2, Package, BarChart3 } from 'lucide-react';
import {
    getProducts,
    deleteProduct,
    findByBarcode,
} from '../../api/inventory';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import ConfirmModal from '../../components/ui/ConfirmModal';
import StockBadge from '../../components/ui/StockBadge';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { getList, getPagination } from '../../api/response';

const CATEGORY_LABELS = {
    armazon: 'Armazón',
    luna: 'Luna',
    lente_contacto: 'Lente de Contacto',
    accesorio: 'Accesorio',
    servicio: 'Servicio',
};

const CATEGORY_COLORS = {
    armazon: 'bg-blue-100 text-blue-800',
    luna: 'bg-green-100 text-green-800',
    lente_contacto: 'bg-purple-100 text-purple-800',
    accesorio: 'bg-yellow-100 text-yellow-800',
    servicio: 'bg-gray-100 text-gray-700',
};

function CategoryBadge({ category }) {
    const label = CATEGORY_LABELS[category] ?? category;
    const cls = CATEGORY_COLORS[category] ?? 'bg-gray-100 text-gray-700';
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
            {label}
        </span>
    );
}

export default function ProductListPage() {
    const [products, setProducts] = useState([]);
    const [meta, setMeta] = useState(null);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');
    const [status, setStatus] = useState('');
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [toDelete, setToDelete] = useState(null);
    const [barcode, setBarcode] = useState('');
    const [barcodeLoading, setBarcodeLoading] = useState(false);
    const { addToast } = useToast();
    const { user } = useAuth();
    const navigate = useNavigate();

    const canCreate = user?.permissions?.includes('products.create') ?? true;

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        try {
            const params = { search, page };
            if (category) params.category = category;
            if (status) params.active_only = status;
            const res = await getProducts(params);
            setProducts(getList(res));
            setMeta(getPagination(res));
        } catch {
            addToast('Error al cargar productos', 'error');
        } finally {
            setLoading(false);
        }
    }, [search, category, status, page]);

    useEffect(() => {
        const t = setTimeout(fetchProducts, 300);
        return () => clearTimeout(t);
    }, [fetchProducts]);

    const askDelete = (p) => { setToDelete(p); setConfirmOpen(true); };

    const handleDelete = async () => {
        try {
            await deleteProduct(toDelete.id);
            addToast('Producto eliminado', 'success');
            setConfirmOpen(false);
            setToDelete(null);
            fetchProducts();
        } catch {
            addToast('Error al eliminar el producto', 'error');
        }
    };

    const handleBarcodeSearch = async () => {
        if (!barcode.trim()) return;
        setBarcodeLoading(true);
        try {
            const res = await findByBarcode(barcode.trim());
            if (res.data?.id) {
                navigate(`/inventario/productos/${res.data.id}`);
            } else {
                addToast('No se encontró ningún producto con ese código', 'error');
            }
        } catch {
            addToast('No se encontró ningún producto con ese código', 'error');
        } finally {
            setBarcodeLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Inventario de Productos</h1>
                    <p className="text-gray-500 mt-1">Gestión de productos y variantes</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link to="/inventario/stock">
                        <Button variant="secondary" size="md">
                            <BarChart3 size={18} />
                            Ver Stock
                        </Button>
                    </Link>
                    {canCreate && (
                        <Link to="/inventario/productos/nuevo">
                            <Button size="md">
                                <Plus size={18} />
                                Nuevo Producto
                            </Button>
                        </Link>
                    )}
                </div>
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5 flex flex-wrap gap-4 items-end">
                {/* Búsqueda texto */}
                <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                        placeholder="Buscar por nombre o SKU..."
                        className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] bg-white"
                    />
                </div>

                {/* Filtro categoría */}
                <select
                    value={category}
                    onChange={e => { setCategory(e.target.value); setPage(1); }}
                    className="py-2.5 px-3 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] bg-white"
                >
                    <option value="">Todas las categorías</option>
                    <option value="armazon">Armazón</option>
                    <option value="luna">Luna</option>
                    <option value="lente_contacto">Lente de Contacto</option>
                    <option value="accesorio">Accesorio</option>
                    <option value="servicio">Servicio</option>
                </select>

                {/* Filtro estado */}
                <select
                    value={status}
                    onChange={e => { setStatus(e.target.value); setPage(1); }}
                    className="py-2.5 px-3 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] bg-white"
                >
                    <option value="">Todos los estados</option>
                    <option value="1">Activo</option>
                    <option value="0">Inactivo</option>
                </select>

                {/* Búsqueda por código de barras */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={barcode}
                        onChange={e => setBarcode(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleBarcodeSearch()}
                        placeholder="Código de barras..."
                        className="py-2.5 px-3 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] bg-white w-44"
                    />
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleBarcodeSearch}
                        loading={barcodeLoading}
                    >
                        Buscar
                    </Button>
                </div>
            </div>

            {/* Tabla */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-[#1a2a4a] text-white">
                            <th className="px-5 py-4 text-left text-sm font-semibold">SKU</th>
                            <th className="px-5 py-4 text-left text-sm font-semibold">Nombre / Marca</th>
                            <th className="px-5 py-4 text-left text-sm font-semibold">Categoría</th>
                            <th className="px-5 py-4 text-center text-sm font-semibold">Variantes</th>
                            <th className="px-5 py-4 text-center text-sm font-semibold">Stock Total</th>
                            <th className="px-5 py-4 text-right text-sm font-semibold">Precio Venta</th>
                            <th className="px-5 py-4 text-center text-sm font-semibold">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="py-16 text-center text-gray-400">
                                    <div className="animate-spin h-8 w-8 border-4 border-[#1a2a4a] border-t-transparent rounded-full mx-auto" />
                                </td>
                            </tr>
                        ) : products.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="py-16 text-center">
                                    <Package size={48} className="mx-auto text-gray-300 mb-3" />
                                    <p className="text-gray-500 text-lg">No se encontraron productos</p>
                                    {canCreate && (
                                        <Link to="/inventario/productos/nuevo">
                                            <Button className="mt-4" variant="secondary">Agregar primer producto</Button>
                                        </Link>
                                    )}
                                </td>
                            </tr>
                        ) : products.map((p, i) => (
                            <tr
                                key={p.id}
                                className={`border-t border-gray-100 hover:bg-blue-50/50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}
                            >
                                <td className="px-5 py-4 font-mono text-sm text-gray-700">{p.sku || '—'}</td>
                                <td className="px-5 py-4">
                                    <p className="font-medium text-gray-900">{p.nombre ?? p.name}</p>
                                    {p.marca && <p className="text-xs text-gray-500">{p.marca}</p>}
                                </td>
                                <td className="px-5 py-4">
                                    <CategoryBadge category={p.categoria ?? p.category} />
                                </td>
                                <td className="px-5 py-4 text-center">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                        {p.variants_count ?? p.variantes_count ?? 0}
                                    </span>
                                </td>
                                <td className="px-5 py-4 text-center">
                                    <StockBadge quantity={p.stock_total ?? 0} minStock={p.stock_minimo ?? 0} />
                                </td>
                                <td className="px-5 py-4 text-right font-medium text-gray-800">
                                    {p.precio_venta != null
                                        ? `$${Number(p.precio_venta).toFixed(2)}`
                                        : '—'}
                                </td>
                                <td className="px-5 py-4">
                                    <div className="flex items-center justify-center gap-1">
                                        <button
                                            onClick={() => navigate(`/inventario/productos/${p.id}`)}
                                            className="p-2 rounded-lg hover:bg-blue-100 text-blue-600"
                                            title="Ver detalle"
                                        >
                                            <Eye size={17} />
                                        </button>
                                        <button
                                            onClick={() => navigate(`/inventario/productos/${p.id}/editar`)}
                                            className="p-2 rounded-lg hover:bg-yellow-100 text-yellow-600"
                                            title="Editar"
                                        >
                                            <Edit2 size={17} />
                                        </button>
                                        <button
                                            onClick={() => askDelete(p)}
                                            className="p-2 rounded-lg hover:bg-red-100 text-red-500"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={17} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Paginación */}
                {meta?.last_page > 1 && (
                    <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200">
                        <p className="text-sm text-gray-500">
                            Mostrando {meta.from}–{meta.to} de {meta.total} productos
                        </p>
                        <div className="flex gap-2">
                            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                                Anterior
                            </Button>
                            <Button variant="secondary" size="sm" disabled={page >= meta.last_page} onClick={() => setPage(p => p + 1)}>
                                Siguiente
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <ConfirmModal
                open={confirmOpen}
                title={`¿Eliminar "${toDelete?.nombre ?? toDelete?.name}"?`}
                message="Esta acción no se puede deshacer. El producto y sus variantes serán eliminados."
                confirmLabel="Eliminar producto"
                onConfirm={handleDelete}
                onCancel={() => { setConfirmOpen(false); setToDelete(null); }}
            />
        </div>
    );
}
