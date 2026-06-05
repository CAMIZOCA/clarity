import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import { getList } from '../../api/response';

const emptyForm = {
    name: '',
    code: '',
    address: '',
    city: '',
    province: '',
    phone: '',
    email: '',
    ruc: '',
    sri_establishment: '',
    is_active: true,
    is_main: false,
};

export default function BranchesPage() {
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
        client.get('/branches')
            .then(res => {
                setBranches(getList(res));
            })
            .catch(() => setError('No se pudo cargar las sucursales.'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const openNew = () => {
        setEditing(null);
        setForm(emptyForm);
        setFormError(null);
        setShowModal(true);
    };

    const openEdit = (branch) => {
        setEditing(branch);
        setForm({
            name: branch.name || '',
            code: branch.code || '',
            address: branch.address || '',
            city: branch.city || '',
            province: branch.province || '',
            phone: branch.phone || '',
            email: branch.email || '',
            ruc: branch.ruc || '',
            sri_establishment: branch.sri_establishment || '',
            is_active: branch.is_active ?? true,
            is_main: branch.is_main ?? false,
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
                await client.put(`/branches/${editing.id}`, form);
            } else {
                await client.post('/branches', form);
            }
            setShowModal(false);
            load();
        } catch (err) {
            const msg = err.response?.data?.message || err.response?.data?.errors
                ? Object.values(err.response.data.errors || {}).flat().join(' ')
                : 'Error al guardar la sucursal.';
            setFormError(msg);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Sucursales</h1>
                <button
                    onClick={openNew}
                    className="bg-[#1a2a4a] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#243660] transition-colors"
                >
                    + Nueva Sucursal
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
                                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Ciudad</th>
                                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Teléfono</th>
                                <th className="text-left px-4 py-3 text-gray-600 font-semibold">RUC</th>
                                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Bodegas</th>
                                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Estado</th>
                                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {branches.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="text-center py-8 text-gray-400">
                                        No hay sucursales registradas.
                                    </td>
                                </tr>
                            )}
                            {branches.map(branch => (
                                <tr key={branch.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 font-medium text-gray-800">
                                        {branch.name}
                                        {branch.is_main && (
                                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Principal</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">{branch.code}</td>
                                    <td className="px-4 py-3 text-gray-600">{branch.city || '—'}</td>
                                    <td className="px-4 py-3 text-gray-600">{branch.phone || '—'}</td>
                                    <td className="px-4 py-3 text-gray-600">{branch.ruc || '—'}</td>
                                    <td className="px-4 py-3 text-gray-600">{branch.warehouses_count ?? '—'}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${branch.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {branch.is_active ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => openEdit(branch)}
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
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                            <h2 className="text-lg font-bold text-gray-800">
                                {editing ? 'Editar Sucursal' : 'Nueva Sucursal'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
                            {formError && (
                                <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-3 text-sm">{formError}</div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                                    <input name="name" value={form.name} onChange={handleChange} required
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
                                    <input name="code" value={form.code} onChange={handleChange} required maxLength={10}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                                <input name="address" value={form.address} onChange={handleChange}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                                    <input name="city" value={form.city} onChange={handleChange}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Provincia</label>
                                    <input name="province" value={form.province} onChange={handleChange}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                                    <input name="phone" value={form.phone} onChange={handleChange}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input name="email" type="email" value={form.email} onChange={handleChange}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">RUC</label>
                                    <input name="ruc" value={form.ruc} onChange={handleChange} maxLength={13}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Establecimiento SRI</label>
                                    <input name="sri_establishment" value={form.sri_establishment} onChange={handleChange} maxLength={3}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                                </div>
                            </div>

                            <div className="flex gap-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange}
                                        className="rounded border-gray-300 text-[#1a2a4a]" />
                                    <span className="text-sm text-gray-700">Activa</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" name="is_main" checked={form.is_main} onChange={handleChange}
                                        className="rounded border-gray-300 text-[#1a2a4a]" />
                                    <span className="text-sm text-gray-700">Sucursal principal</span>
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
