import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, FileText } from 'lucide-react';
import client from '../../api/client';
import Button from '../../components/ui/Button';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/Toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ReferenceListPage() {
    const [refs, setRefs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [toDelete, setToDelete] = useState(null);
    const { addToast } = useToast();
    const navigate = useNavigate();

    const fetch = async () => {
        setLoading(true);
        try {
            const res = await client.get('/ophthalmology-references');
            setRefs(res.data.data ?? res.data);
        } catch { addToast('Error al cargar referencias', 'error'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetch(); }, []);

    const askDelete = (r) => { setToDelete(r); setConfirmOpen(true); };

    const handleDelete = async () => {
        try {
            await client.delete(`/ophthalmology-references/${toDelete.id}`);
            addToast('Referencia eliminada', 'success');
            setConfirmOpen(false);
            setToDelete(null);
            fetch();
        } catch { addToast('Error al eliminar', 'error'); }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Referencias Oftalmológicas</h1>
                    <p className="text-gray-500 mt-1">Remisiones y seguimiento de casos</p>
                </div>
                <Link to="/referencias/nueva">
                    <Button size="lg"><Plus size={20} /> Nueva Referencia</Button>
                </Link>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-[#1a2a4a] text-white">
                            <th className="px-6 py-4 text-left text-sm font-semibold">Paciente</th>
                            <th className="px-6 py-4 text-left text-sm font-semibold">Motivo</th>
                            <th className="px-6 py-4 text-left text-sm font-semibold">Médico referido</th>
                            <th className="px-6 py-4 text-left text-sm font-semibold">Especialidad</th>
                            <th className="px-6 py-4 text-left text-sm font-semibold">Fecha</th>
                            <th className="px-6 py-4 text-center text-sm font-semibold">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} className="py-16 text-center">
                                <div className="animate-spin h-8 w-8 border-4 border-[#1a2a4a] border-t-transparent rounded-full mx-auto" />
                            </td></tr>
                        ) : refs.length === 0 ? (
                            <tr><td colSpan={6} className="py-16 text-center">
                                <FileText size={48} className="mx-auto text-gray-300 mb-3" />
                                <p className="text-gray-500">Sin referencias registradas</p>
                            </td></tr>
                        ) : refs.map((r, i) => (
                            <tr key={r.id} className={`border-t border-gray-100 hover:bg-blue-50/40 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                                <td className="px-6 py-4">
                                    <Link to={`/pacientes/${r.patient_id}`} className="font-medium text-gray-900 hover:text-[#1a2a4a]">
                                        {r.patient?.nombre || '—'}
                                    </Link>
                                    <p className="text-xs text-gray-500">{r.patient?.cedula}</p>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-700 max-w-[200px] truncate">{r.motivo}</td>
                                <td className="px-6 py-4 text-sm text-gray-700">{r.medico_referido}</td>
                                <td className="px-6 py-4 text-sm text-gray-700">{r.especialidad || '—'}</td>
                                <td className="px-6 py-4 text-sm text-gray-700">
                                    {r.fecha ? format(new Date(r.fecha), 'd MMM yyyy', { locale: es }) : '—'}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center justify-center gap-2">
                                        <button onClick={() => navigate(`/referencias/${r.id}/editar`)}
                                            className="p-2 rounded-lg hover:bg-yellow-100 text-yellow-600" title="Editar">
                                            <Edit2 size={18} />
                                        </button>
                                        <button onClick={() => askDelete(r)}
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
                title="¿Eliminar esta referencia?"
                message="Se eliminará el registro de remisión del paciente."
                confirmLabel="Eliminar"
                onConfirm={handleDelete}
                onCancel={() => { setConfirmOpen(false); setToDelete(null); }}
            />
        </div>
    );
}
