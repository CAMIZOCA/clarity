import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye } from 'lucide-react';
import client from '../../api/client';
import Button from '../../components/ui/Button';
import PatientAutocomplete from '../../components/ui/PatientAutocomplete';
import Input from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';

function EyeField({ label, fieldOD, fieldOI, form, set }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
                label={`${label} OD`}
                value={form[fieldOD]}
                onChange={e => set(fieldOD, e.target.value)}
            />
            <Input
                label={`${label} OI`}
                value={form[fieldOI]}
                onChange={e => set(fieldOI, e.target.value)}
            />
        </div>
    );
}

export default function SpecialLensFormPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const isEdit = Boolean(id);
    const [saving, setSaving] = useState(false);
    const [patient, setPatient] = useState(null);
    const [form, setForm] = useState({
        patient_id: '',
        tipo: 'esclerales',
        radio_base_od: '',
        radio_base_oi: '',
        diametro_od: '',
        diametro_oi: '',
        potencia_od: '',
        potencia_oi: '',
        material_od: '',
        material_oi: '',
        fecha_adaptacion: '',
        seguimiento: '',
        proxima_revision: '',
    });

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    useEffect(() => {
        if (!isEdit) return;

        client.get(`/special-contact-lenses/${id}`).then(r => {
            const l = r.data;
            setPatient(l.patient);
            setForm({
                patient_id: l.patient_id,
                tipo: l.tipo,
                radio_base_od: l.radio_base_od || '',
                radio_base_oi: l.radio_base_oi || '',
                diametro_od: l.diametro_od || '',
                diametro_oi: l.diametro_oi || '',
                potencia_od: l.potencia_od || '',
                potencia_oi: l.potencia_oi || '',
                material_od: l.material_od || '',
                material_oi: l.material_oi || '',
                fecha_adaptacion: l.fecha_adaptacion?.slice(0, 10) || '',
                seguimiento: l.seguimiento || '',
                proxima_revision: l.proxima_revision?.slice(0, 10) || '',
            });
        }).catch(() => navigate('/lentes-especiales'));
    }, [id, isEdit, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.patient_id) { addToast('Seleccione un paciente', 'error'); return; }
        setSaving(true);
        try {
            if (isEdit) { await client.put(`/special-contact-lenses/${id}`, form); addToast('Registro actualizado', 'success'); }
            else { await client.post('/special-contact-lenses', form); addToast('Registro creado', 'success'); }
            navigate('/lentes-especiales');
        } catch (err) { addToast(err.response?.data?.message || 'Error al guardar', 'error'); }
        finally { setSaving(false); }
    };

    return (
        <div className="p-4 sm:p-6 max-w-3xl mx-auto pb-24">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft size={24} /></button>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Eye size={24} className="text-[#1a2a4a]" /> {isEdit ? 'Editar Lente Especial' : 'Nuevo Lente Especial'}
                </h1>
            </div>
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-6 space-y-5">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Paciente <span className="text-red-500">*</span></label>
                    <PatientAutocomplete value={patient} onChange={p => { setPatient(p); set('patient_id', p?.id || ''); }} />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Tipo de lente <span className="text-red-500">*</span></label>
                    <select
                        value={form.tipo}
                        onChange={e => set('tipo', e.target.value)}
                        className="min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm touch-manipulation focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                    >
                        <option value="esclerales">Esclerales</option>
                        <option value="ortoqueratologia">Ortoqueratología</option>
                        <option value="queratocono">Queratocono</option>
                    </select>
                </div>

                <div className="border-t border-gray-100 pt-4 space-y-3">
                    <p className="text-sm font-semibold text-gray-700">Parámetros técnicos</p>
                    <EyeField label="Radio base" fieldOD="radio_base_od" fieldOI="radio_base_oi" form={form} set={set} />
                    <EyeField label="Diámetro" fieldOD="diametro_od" fieldOI="diametro_oi" form={form} set={set} />
                    <EyeField label="Potencia" fieldOD="potencia_od" fieldOI="potencia_oi" form={form} set={set} />
                    <EyeField label="Material" fieldOD="material_od" fieldOI="material_oi" form={form} set={set} />
                </div>

                <div className="border-t border-gray-100 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="Fecha de adaptación" type="date" value={form.fecha_adaptacion} onChange={e => set('fecha_adaptacion', e.target.value)} />
                    <Input label="Próxima revisión" type="date" value={form.proxima_revision} onChange={e => set('proxima_revision', e.target.value)} />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Seguimiento / Observaciones</label>
                    <textarea
                        value={form.seguimiento}
                        onChange={e => set('seguimiento', e.target.value)}
                        rows={3}
                        className="w-full min-h-11 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm touch-manipulation focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                    />
                </div>

                <div className="mobile-sticky-actions -mx-5 px-5 py-4 sm:-mx-6 sm:px-6">
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Button variant="secondary" type="button" onClick={() => navigate(-1)} className="w-full justify-center sm:flex-1">Cancelar</Button>
                        <Button type="submit" loading={saving} className="w-full justify-center sm:flex-1">{isEdit ? 'Guardar cambios' : 'Crear registro'}</Button>
                    </div>
                </div>
            </form>
        </div>
    );
}
