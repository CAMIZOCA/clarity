import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, Edit2, Trash2, User } from 'lucide-react';
import client from '../../api/client';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/Toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function PatientListPage() {
    const [patients, setPatients] = useState([]);
    const [meta, setMeta] = useState(null);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [toDelete, setToDelete] = useState(null);
    const { addToast } = useToast();
    const navigate = useNavigate();

    const fetchPatients = useCallback(async () => {
        setLoading(true);
        try {
            const res = await client.get('/patients', { params: { q: search, page } });
            setPatients(res.data.data);
            setMeta(res.data.meta ?? res.data);
        } catch {
            addToast('Error al cargar pacientes', 'error');
        } finally {
            setLoading(false);
        }
    }, [search, page]);

    useEffect(() => {
        const t = setTimeout(fetchPatients, 300);
        return () => clearTimeout(t);
    }, [fetchPatients]);

    const askDelete = (p) => { setToDelete(p); setConfirmOpen(true); };

    const handleDelete = async () => {
        try {
            await client.delete(`/patients/${toDelete.id}`);
            addToast('Paciente eliminado', 'success');
            setConfirmOpen(false);
            setToDelete(null);
            fetchPatients();
        } catch {
            addToast('Error al eliminar', 'error');
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Pacientes</h1>
                    <p className="text-gray-500 mt-1">Gestión del registro de pacientes</p>
                </div>
                <Link to="/pacientes/nuevo">
                    <Button size="lg">
                        <Plus size={20} />
                        Nuevo Paciente
                    </Button>
                </Link>
            </div>

            {/* Search */}
            <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                    type="text"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Buscar por nombre o cédula..."
                    className="w-full pl-12 pr-4 py-3 text-base rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] bg-white"
                />
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-[#1a2a4a] text-white">
                            <th className="px-6 py-4 text-left text-sm font-semibold">Paciente</th>
                            <th className="px-6 py-4 text-left text-sm font-semibold">Cédula</th>
                            <th className="px-6 py-4 text-left text-sm font-semibold">Edad</th>
                            <th className="px-6 py-4 text-left text-sm font-semibold">Teléfono</th>
                            <th className="px-6 py-4 text-left text-sm font-semibold">Consultas</th>
                            <th className="px-6 py-4 text-center text-sm font-semibold">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} className="py-16 text-center text-gray-400">
                                <div className="animate-spin h-8 w-8 border-4 border-[#1a2a4a] border-t-transparent rounded-full mx-auto" />
                            </td></tr>
                        ) : patients.length === 0 ? (
                            <tr><td colSpan={6} className="py-16 text-center">
                                <User size={48} className="mx-auto text-gray-300 mb-3" />
                                <p className="text-gray-500 text-lg">No se encontraron pacientes</p>
                                <Link to="/pacientes/nuevo">
                                    <Button className="mt-4" variant="secondary">Registrar primer paciente</Button>
                                </Link>
                            </td></tr>
                        ) : patients.map((p, i) => (
                            <tr key={p.id} className={`border-t border-gray-100 hover:bg-blue-50/50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-[#1a2a4a]/10 flex items-center justify-center flex-shrink-0">
                                            <span className="text-[#1a2a4a] font-semibold text-sm">{p.nombre[0]}</span>
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">{p.nombre}</p>
                                            <p className="text-sm text-gray-500">{p.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-gray-700 font-mono">{p.cedula}</td>
                                <td className="px-6 py-4 text-gray-700">{p.edad} años</td>
                                <td className="px-6 py-4 text-gray-700">{p.telefono || '—'}</td>
                                <td className="px-6 py-4">
                                    <Badge label={`${p.consultations_count ?? '?'} consultas`} color="default" />
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center justify-center gap-2">
                                        <button onClick={() => navigate(`/pacientes/${p.id}`)}
                                            className="p-2 rounded-lg hover:bg-blue-100 text-blue-600" title="Ver detalle">
                                            <Eye size={18} />
                                        </button>
                                        <button onClick={() => navigate(`/pacientes/${p.id}/editar`)}
                                            className="p-2 rounded-lg hover:bg-yellow-100 text-yellow-600" title="Editar">
                                            <Edit2 size={18} />
                                        </button>
                                        <button onClick={() => askDelete(p)}
                                            className="p-2 rounded-lg hover:bg-red-100 text-red-500" title="Eliminar">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Pagination */}
                {meta?.last_page > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
                        <p className="text-sm text-gray-500">
                            Mostrando {meta.from}–{meta.to} de {meta.total} pacientes
                        </p>
                        <div className="flex gap-2">
                            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                            <Button variant="secondary" size="sm" disabled={page >= meta.last_page} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
                        </div>
                    </div>
                )}
            </div>

            <ConfirmModal
                open={confirmOpen}
                title={`¿Eliminar a "${toDelete?.nombre}"?`}
                message="Esta acción no se puede deshacer. El paciente y sus datos serán eliminados."
                confirmLabel="Eliminar paciente"
                onConfirm={handleDelete}
                onCancel={() => { setConfirmOpen(false); setToDelete(null); }}
            />
        </div>
    );
}
