import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, Shield, MapPin, Calendar } from 'lucide-react';
import client from '../../api/client';
import Button from '../../components/ui/Button';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/Toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function BrigadeListPage() {
    const [brigades, setBrigades] = useState([]);
    const [loading, setLoading] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [toDelete, setToDelete] = useState(null);
    const { addToast } = useToast();
    const navigate = useNavigate();

    const fetch = async () => {
        setLoading(true);
        try {
            const res = await client.get('/brigades');
            setBrigades(res.data.data ?? res.data);
        } catch {
            addToast('Error al cargar brigadas', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetch(); }, []);

    const askDelete = (b) => { setToDelete(b); setConfirmOpen(true); };

    const handleDelete = async () => {
        try {
            await client.delete(`/brigades/${toDelete.id}`);
            addToast('Brigada eliminada', 'success');
            setConfirmOpen(false);
            setToDelete(null);
            fetch();
        } catch {
            addToast('Error al eliminar', 'error');
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Brigadas</h1>
                    <p className="text-gray-500 mt-1">Jornadas extramurales y brigadas visuales</p>
                </div>
                <Link to="/brigadas/nueva">
                    <Button size="lg"><Plus size={20} /> Nueva Brigada</Button>
                </Link>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-[#1a2a4a] text-white">
                            <th className="px-6 py-4 text-left text-sm font-semibold">Brigada</th>
                            <th className="px-6 py-4 text-left text-sm font-semibold">Lugar</th>
                            <th className="px-6 py-4 text-left text-sm font-semibold">Fecha</th>
                            <th className="px-6 py-4 text-left text-sm font-semibold">Responsable</th>
                            <th className="px-6 py-4 text-left text-sm font-semibold">Pacientes</th>
                            <th className="px-6 py-4 text-center text-sm font-semibold">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} className="py-16 text-center">
                                <div className="animate-spin h-8 w-8 border-4 border-[#1a2a4a] border-t-transparent rounded-full mx-auto" />
                            </td></tr>
                        ) : brigades.length === 0 ? (
                            <tr><td colSpan={6} className="py-16 text-center">
                                <Shield size={48} className="mx-auto text-gray-300 mb-3" />
                                <p className="text-gray-500">Sin brigadas registradas</p>
                                <Link to="/brigadas/nueva"><Button className="mt-4" variant="secondary">Registrar primera brigada</Button></Link>
                            </td></tr>
                        ) : brigades.map((b, i) => (
                            <tr key={b.id} className={`border-t border-gray-100 hover:bg-blue-50/40 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                                <td className="px-6 py-4">
                                    <p className="font-medium text-gray-900">{b.nombre}</p>
                                    {b.observaciones && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{b.observaciones}</p>}
                                </td>
                                <td className="px-6 py-4 text-gray-700">
                                    <span className="flex items-center gap-1.5"><MapPin size={14} className="text-gray-400" />{b.lugar}</span>
                                </td>
                                <td className="px-6 py-4 text-gray-700">
                                    <span className="flex items-center gap-1.5"><Calendar size={14} className="text-gray-400" />
                                        {b.fecha ? format(new Date(b.fecha), "d MMM yyyy", { locale: es }) : '—'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-gray-700">{b.optometrista?.name || '—'}</td>
                                <td className="px-6 py-4">
                                    <span className="text-sm bg-[#1a2a4a]/10 text-[#1a2a4a] px-2 py-0.5 rounded-full font-medium">
                                        {b.patients_count ?? b.patients?.length ?? 0}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center justify-center gap-2">
                                        <button onClick={() => navigate(`/brigadas/${b.id}`)}
                                            className="p-2 rounded-lg hover:bg-blue-100 text-blue-600" title="Ver detalle">
                                            <Shield size={18} />
                                        </button>
                                        <button onClick={() => navigate(`/brigadas/${b.id}/editar`)}
                                            className="p-2 rounded-lg hover:bg-yellow-100 text-yellow-600" title="Editar">
                                            <Edit2 size={18} />
                                        </button>
                                        <button onClick={() => askDelete(b)}
                                            className="p-2 rounded-lg hover:bg-red-100 text-red-500" title="Eliminar">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <ConfirmModal
                open={confirmOpen}
                title={`¿Eliminar brigada "${toDelete?.nombre}"?`}
                message="Se perderá el registro de esta brigada y su relación con pacientes."
                confirmLabel="Eliminar"
                onConfirm={handleDelete}
                onCancel={() => { setConfirmOpen(false); setToDelete(null); }}
            />
        </div>
    );
}
