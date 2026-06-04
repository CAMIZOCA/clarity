import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit2, MapPin, Calendar, Users, UserPlus, X } from 'lucide-react';
import client from '../../api/client';
import Button from '../../components/ui/Button';
import PatientAutocomplete from '../../components/ui/PatientAutocomplete';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/Toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function BrigadeDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [brigade, setBrigade] = useState(null);
    const [patients, setPatients] = useState([]);
    const [adding, setAdding] = useState(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [toRemove, setToRemove] = useState(null);
    const [showAdd, setShowAdd] = useState(false);

    const load = async () => {
        try {
            const res = await client.get(`/brigades/${id}`);
            setBrigade(res.data);
            setPatients(res.data.patients ?? []);
        } catch { navigate('/brigadas'); }
    };

    useEffect(() => { load(); }, [id]);

    const handleAddPatient = async (patient) => {
        if (!patient) return;
        setAdding(patient.id);
        try {
            await client.post(`/brigades/${id}/patients`, { patient_id: patient.id });
            addToast('Paciente agregado', 'success');
            setShowAdd(false);
            load();
        } catch (err) {
            addToast(err.response?.data?.message || 'Error al agregar', 'error');
        } finally { setAdding(null); }
    };

    const handleRemove = async () => {
        try {
            await client.delete(`/brigades/${id}/patients/${toRemove.id}`);
            addToast('Paciente retirado de la brigada', 'success');
            setConfirmOpen(false);
            setToRemove(null);
            load();
        } catch { addToast('Error al retirar paciente', 'error'); }
    };

    if (!brigade) return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-10 w-10 border-4 border-[#1a2a4a] border-t-transparent rounded-full" />
        </div>
    );

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft size={24} /></button>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold text-gray-900">{brigade.nombre}</h1>
                    <div className="flex items-center gap-4 text-gray-500 text-sm mt-1">
                        <span className="flex items-center gap-1"><MapPin size={14} />{brigade.lugar}</span>
                        <span className="flex items-center gap-1"><Calendar size={14} />{brigade.fecha ? format(new Date(brigade.fecha), "d 'de' MMMM yyyy", { locale: es }) : '—'}</span>
                        {brigade.optometrista && <span>Dr. {brigade.optometrista.name}</span>}
                    </div>
                </div>
                <Link to={`/brigadas/${id}/editar`}>
                    <Button variant="secondary"><Edit2 size={18} /> Editar</Button>
                </Link>
            </div>

            {brigade.observaciones && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-sm text-blue-800">{brigade.observaciones}</div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Users size={18} className="text-[#1a2a4a]" /> Pacientes ({patients.length})
                    </h2>
                    <Button size="sm" onClick={() => setShowAdd(v => !v)}>
                        <UserPlus size={16} /> Agregar paciente
                    </Button>
                </div>

                {showAdd && (
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                        <PatientAutocomplete value={null} onChange={handleAddPatient} placeholder="Buscar paciente para agregar..." />
                    </div>
                )}

                <div className="divide-y divide-gray-100">
                    {patients.length === 0 ? (
                        <div className="py-12 text-center text-gray-400">
                            <Users size={40} className="mx-auto mb-3 opacity-40" />
                            <p>Sin pacientes en esta brigada</p>
                        </div>
                    ) : patients.map(p => (
                        <div key={p.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-[#1a2a4a]/10 flex items-center justify-center">
                                    <span className="text-[#1a2a4a] font-semibold text-sm">{p.nombre[0]}</span>
                                </div>
                                <div>
                                    <Link to={`/pacientes/${p.id}`} className="font-medium text-gray-900 hover:text-[#1a2a4a]">{p.nombre}</Link>
                                    <p className="text-sm text-gray-500">CI: {p.cedula}</p>
                                </div>
                            </div>
                            <button onClick={() => { setToRemove(p); setConfirmOpen(true); }}
                                className="p-2 rounded-lg hover:bg-red-100 text-red-400" title="Quitar de brigada">
                                <X size={18} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <ConfirmModal
                open={confirmOpen}
                title={`¿Quitar a ${toRemove?.nombre} de esta brigada?`}
                message="El paciente no será eliminado, solo se retirará de esta brigada."
                confirmLabel="Quitar"
                onConfirm={handleRemove}
                onCancel={() => { setConfirmOpen(false); setToRemove(null); }}
            />
        </div>
    );
}
