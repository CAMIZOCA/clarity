import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, Eye } from 'lucide-react';
import client from '../../api/client';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/Toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const TIPO_LABELS = { esclerales: 'Esclerales', ortoqueratologia: 'Ortoqueratología', queratocono: 'Queratocono' };

export default function SpecialLensListPage() {
    const [lenses, setLenses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('');
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [toDelete, setToDelete] = useState(null);
    const { addToast } = useToast();
    const navigate = useNavigate();

    const fetch = async () => {
        setLoading(true);
        try {
            const params = filter ? { tipo: filter } : {};
            const res = await client.get('/special-contact-lenses', { params });
            setLenses(res.data.data ?? res.data);
        } catch { addToast('Error al cargar lentes', 'error'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetch(); }, [filter]);

    const askDelete = (l) => { setToDelete(l); setConfirmOpen(true); };

    const handleDelete = async () => {
        try {
            await client.delete(`/special-contact-lenses/${toDelete.id}`);
            addToast('Registro eliminado', 'success');
            setConfirmOpen(false);
            setToDelete(null);
            fetch();
        } catch { addToast('Error al eliminar', 'error'); }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Lentes Especiales</h1>
                    <p className="text-gray-500 mt-1">Esclerales, ortoqueratología y queratocono</p>
                </div>
                <Link to="/lentes-especiales/nuevo">
                    <Button size="lg"><Plus size={20} /> Nuevo registro</Button>
                </Link>
            </div>

            <div className="flex gap-2 mb-5">
                {['', 'esclerales', 'ortoqueratologia', 'queratocono'].map(t => (
                    <button key={t} onClick={() => setFilter(t)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === t ? 'bg-[#1a2a4a] text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                        {t ? TIPO_LABELS[t] : 'Todos'}
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-[#1a2a4a] text-white">
                            <th className="px-6 py-4 text-left text-sm font-semibold">Paciente</th>
                            <th className="px-6 py-4 text-left text-sm font-semibold">Tipo</th>
                            <th className="px-6 py-4 text-left text-sm font-semibold">Radio base OD/OI</th>
                            <th className="px-6 py-4 text-left text-sm font-semibold">Adaptación</th>
                            <th className="px-6 py-4 text-left text-sm font-semibold">Próx. revisión</th>
                            <th className="px-6 py-4 text-center text-sm font-semibold">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} className="py-16 text-center">
                                <div className="animate-spin h-8 w-8 border-4 border-[#1a2a4a] border-t-transparent rounded-full mx-auto" />
                            </td></tr>
                        ) : lenses.length === 0 ? (
                            <tr><td colSpan={6} className="py-16 text-center">
                                <Eye size={48} className="mx-auto text-gray-300 mb-3" />
                                <p className="text-gray-500">Sin registros de lentes especiales</p>
                            </td></tr>
                        ) : lenses.map((l, i) => (
                            <tr key={l.id} className={`border-t border-gray-100 hover:bg-blue-50/40 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                                <td className="px-6 py-4">
                                    <Link to={`/pacientes/${l.patient_id}`} className="font-medium text-gray-900 hover:text-[#1a2a4a]">
                                        {l.patient?.nombre || '—'}
                                    </Link>
                                    <p className="text-xs text-gray-500">{l.patient?.cedula}</p>
                                </td>
                                <td className="px-6 py-4"><Badge label={TIPO_LABELS[l.tipo] || l.tipo} /></td>
                                <td className="px-6 py-4 text-sm text-gray-700 font-mono">
                                    {l.radio_base_od || '—'} / {l.radio_base_oi || '—'}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-700">
                                    {l.fecha_adaptacion ? format(new Date(l.fecha_adaptacion), 'd MMM yyyy', { locale: es }) : '—'}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-700">
                                    {l.proxima_revision ? format(new Date(l.proxima_revision), 'd MMM yyyy', { locale: es }) : '—'}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center justify-center gap-2">
                                        <button onClick={() => navigate(`/lentes-especiales/${l.id}/editar`)}
                                            className="p-2 rounded-lg hover:bg-yellow-100 text-yellow-600" title="Editar">
                                            <Edit2 size={18} />
                                        </button>
                                        <button onClick={() => askDelete(l)}
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
                title="¿Eliminar este registro?"
                message="Se eliminará el registro de lente especial del paciente."
                confirmLabel="Eliminar"
                onConfirm={handleDelete}
                onCancel={() => { setConfirmOpen(false); setToDelete(null); }}
            />
        </div>
    );
}
