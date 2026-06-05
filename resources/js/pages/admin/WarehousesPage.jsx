import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import { getList } from '../../api/response';

const emptyForm = {
    branch_id: '',
    name: '',
    code: '',
    type: 'principal',
    is_active: true,
    is_default: false,
    notes: '',
};

const WAREHOUSE_TYPES = [
    { value: 'principal', label: 'Principal' },
    { value: 'consignacion', label: 'Consignación' },
    { value: 'exhibicion', label: 'Exhibición' },
    { value: 'defectuosos', label: 'Defectuosos' },
];

export default function WarehousesPage() {
    const [warehouses, setWarehouses] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState(null);

    const load = () => {
        setLoading(true);
        Promise.all([
            client.get('/warehouses'),
            client.get('/branches'),
        ])
            .then(([wRes, bRes]) => {
                setWarehouses(getList(wRes));
                setBranches(getList(bRes));
            })
            .catch(() => setError('No se pudo cargar las bodegas.'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const openNew = () => {
        setEditing(null);
        setForm({ ...emptyForm, branch_id: branches[0]?.id || '' });
        setFormError(null);
        setShowModal(true);
    };

    const openEdit = (warehouse) => {
        setEditing(warehouse);
        setForm({
            branch_id: warehouse.branch_id || '',
            name: warehouse.name || '',
            code: warehouse.code || '',
            type: warehouse.type || 'principal',
            is_active: warehouse.is_active ?? true,
            is_default: warehouse.is_default ?? false,
            notes: warehouse.notes || '',
        });
        setFormError(null);
        setShowModal(true);
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setFormError(null);
        try {
            if (editing) {
                await client.put(`/warehouses/${editing.id}`, form);
            } else {
                await client.post('/warehouses', form);
            }
            setShowModal(false);
            load();
        } catch (err) {
            const errors = err.response?.data?.errors;
            const msg = errors
                ? Object.values(errors).flat().join(' ')
                : err.response?.data?.message || 'Error al guardar la bodega.';
            setFormError(msg);
        } finally {
            setSaving(false);
        }
    };

    const typeLabel = (type) => WAREHOUSE_TYPES.find(t => t.value === type)?.label || type;

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Bodegas</h1>
                <button
                    onClick={openNew}
                    className="bg-[#1a2a4a] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#243660] transition-colors"
                >
                    + Nueva Bodega
                </button>
            </div>

            {error && <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-4 mb-4">{error}</div>}

            {loading ? (
                <div className="flex justify-center items-center h-40">
                    <div className="animate-spin h-8 w-8 border-4 border-[#1a2a4a] border-t-transparent rounded-full" />
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Nombre</th>
                                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Código</th>
                                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Sucursal</th>
                                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Tipo</th>
                                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Estado</th>
                                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {warehouses.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-gray-400">
                                        No hay bodegas registradas.
                                    </td>
                                </tr>
                            )}
                            {warehouses.map(wh => (
                                <tr key={wh.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 font-medium text-gray-800">
                                        {wh.name}
                                        {wh.is_default && (
                                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Por defecto</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">{wh.code}</td>
                                    <td className="px-4 py-3 text-gray-600">{wh.branch?.name || '—'}</td>
                                    <td className="px-4 py-3 text-gray-600">{typeLabel(wh.type)}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${wh.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {wh.is_active ? 'Activa' : 'Inactiva'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => openEdit(wh)}
                                            className="text-[#1a2a4a] hover:underline text-sm font-medium"
                                        >
                                            Editar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                            <h2 className="text-lg font-bold text-gray-800">
                                {editing ? 'Editar Bodega' : 'Nueva Bodega'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
                            {formError && (
                                <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-3 text-sm">{formError}</div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal *</label>
                                <select name="branch_id" value={form.branch_id} onChange={handleChange} required
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]">
                                    <option value="">Seleccionar...</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                                    <input name="name" value={form.name} onChange={handleChange} required
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
                                    <input name="code" value={form.code} onChange={handleChange} required maxLength={20}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                                <select name="type" value={form.type} onChange={handleChange}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]">
                                    {WAREHOUSE_TYPES.map(t => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                                <textarea name="notes" value={form.notes} onChange={handleChange} rows={2}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                            </div>

                            <div className="flex gap-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange}
                                        className="rounded border-gray-300 text-[#1a2a4a]" />
                                    <span className="text-sm text-gray-700">Activa</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" name="is_default" checked={form.is_default} onChange={handleChange}
                                        className="rounded border-gray-300 text-[#1a2a4a]" />
                                    <span className="text-sm text-gray-700">Por defecto</span>
                                </label>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="submit" disabled={saving}
                                    className="bg-[#1a2a4a] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#243660] transition-colors disabled:opacity-50">
                                    {saving ? 'Guardando...' : 'Guardar'}
                                </button>
                                <button type="button" onClick={() => setShowModal(false)}
                                    className="border border-gray-300 text-gray-700 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
