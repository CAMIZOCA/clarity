import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import client from '../../api/client';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';

export default function GuaranteeReportFormPage() {
    const navigate = useNavigate();
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const { addToast } = useToast();
    const { user } = useAuth();

    const patientIdFromQuery = searchParams.get('paciente');
    const isEdit = Boolean(id);

    const [patient, setPatient] = useState(null);
    const [optometristas, setOptometristas] = useState([]);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        patient_id: patientIdFromQuery || '',
        optometrista_id: '',
        fecha_informe: new Date().toISOString().slice(0, 10),
        motivo: '',
        cambios_realizados: '',
        soluciones_indicadas: '',
        estado: 'pendiente',
    });

    useEffect(() => {
        client.get('/users').then(r => {
            const list = r.data.data ?? r.data;
            setOptometristas(list.filter(u => u.roles?.includes('optometra') || u.roles?.includes('admin')));
        }).catch(() => {});
    }, []);

    useEffect(() => {
        if (patientIdFromQuery) {
            client.get(`/patients/${patientIdFromQuery}`).then(r => setPatient(r.data)).catch(() => {});
        }
    }, [patientIdFromQuery]);

    useEffect(() => {
        if (!isEdit) return;

        client.get(`/guarantee-reports/${id}`).then(r => {
            const data = r.data;
            setForm({
                patient_id: data.patient_id,
                optometrista_id: data.optometrista_id || '',
                fecha_informe: data.fecha_informe?.slice(0, 10) || '',
                motivo: data.motivo || '',
                cambios_realizados: data.cambios_realizados || '',
                soluciones_indicadas: data.soluciones_indicadas || '',
                estado: data.estado || 'pendiente',
            });
            setPatient(data.patient);
        }).catch(() => navigate(-1));
    }, [id, isEdit, navigate]);

    const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.motivo.trim()) {
            addToast('El motivo es requerido', 'error');
            return;
        }
        setSaving(true);
        try {
            const payload = { ...form, optometrista_id: form.optometrista_id || null };
            if (isEdit) {
                await client.put(`/guarantee-reports/${id}`, payload);
                addToast('Informe actualizado', 'success');
            } else {
                await client.post('/guarantee-reports', payload);
                addToast('Informe de garantía creado', 'success');
            }
            if (form.patient_id) {
                navigate(`/pacientes/${form.patient_id}`);
            } else {
                navigate(-1);
            }
        } catch (err) {
            addToast(err.response?.data?.message || 'Error al guardar', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 max-w-3xl mx-auto pb-24">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100">
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <ShieldCheck size={24} className="text-amber-500" />
                        {isEdit ? 'Editar Informe de Garantía' : 'Nuevo Informe de Garantía'}
                    </h1>
                    {patient && <p className="text-gray-500 text-sm mt-0.5">Paciente: {patient.nombre} · CI: {patient.cedula}</p>}
                </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Input
                        label="Fecha del informe"
                        type="date"
                        value={form.fecha_informe}
                        onChange={e => set('fecha_informe', e.target.value)}
                    />
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-gray-700">Estado</label>
                        <select
                            value={form.estado}
                            onChange={e => set('estado', e.target.value)}
                            className="min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm touch-manipulation focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                        >
                            <option value="pendiente">Pendiente</option>
                            <option value="completado">Completado</option>
                        </select>
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Optometrista responsable</label>
                    <select
                        value={form.optometrista_id}
                        onChange={e => set('optometrista_id', e.target.value)}
                        className="min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm touch-manipulation focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                    >
                        <option value="">— Seleccionar —</option>
                        {optometristas.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Motivo del informe <span className="text-red-500">*</span></label>
                    <textarea
                        value={form.motivo}
                        onChange={e => set('motivo', e.target.value)}
                        rows={3}
                        required
                        className="w-full min-h-11 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm touch-manipulation focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Cambios realizados</label>
                    <textarea
                        value={form.cambios_realizados}
                        onChange={e => set('cambios_realizados', e.target.value)}
                        rows={3}
                        className="w-full min-h-11 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm touch-manipulation focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Soluciones indicadas</label>
                    <textarea
                        value={form.soluciones_indicadas}
                        onChange={e => set('soluciones_indicadas', e.target.value)}
                        rows={3}
                        className="w-full min-h-11 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm touch-manipulation focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                    />
                </div>

                <div className="mobile-sticky-actions -mx-5 px-5 py-4 sm:-mx-6 sm:px-6">
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Button variant="secondary" type="button" onClick={() => navigate(-1)} className="w-full justify-center sm:flex-1">Cancelar</Button>
                        <Button type="submit" loading={saving} className="w-full justify-center sm:flex-1">
                            <ShieldCheck size={18} />
                            {isEdit ? 'Guardar cambios' : 'Crear informe'}
                        </Button>
                    </div>
                </div>
            </form>
        </div>
    );
}
