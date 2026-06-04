import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye } from 'lucide-react';
import client from '../../api/client';
import Button from '../../components/ui/Button';
import PatientAutocomplete from '../../components/ui/PatientAutocomplete';
import { useToast } from '../../components/ui/Toast';

const eyeField = (label, fieldOD, fieldOI, form, set) => (
    <div className="grid grid-cols-2 gap-3">
        <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{label} OD</label>
            <input type="text" value={form[fieldOD]} onChange={e => set(fieldOD, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] text-sm" />
        </div>
        <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{label} OI</label>
            <input type="text" value={form[fieldOI]} onChange={e => set(fieldOI, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] text-sm" />
        </div>
    </div>
);

export default function SpecialLensFormPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const isEdit = Boolean(id);
    const [saving, setSaving] = useState(false);
    const [patient, setPatient] = useState(null);
    const [form, setForm] = useState({
        patient_id: '', tipo: 'esclerales',
        radio_base_od: '', radio_base_oi: '',
        diametro_od: '', diametro_oi: '',
        potencia_od: '', potencia_oi: '',
        material_od: '', material_oi: '',
        fecha_adaptacion: '', seguimiento: '', proxima_revision: '',
    });

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    useEffect(() => {
        if (isEdit) {
            client.get(`/special-contact-lenses/${id}`).then(r => {
                const l = r.data;
                setPatient(l.patient);
                setForm({
                    patient_id: l.patient_id, tipo: l.tipo,
                    radio_base_od: l.radio_base_od || '', radio_base_oi: l.radio_base_oi || '',
                    diametro_od: l.diametro_od || '', diametro_oi: l.diametro_oi || '',
                    potencia_od: l.potencia_od || '', potencia_oi: l.potencia_oi || '',
                    material_od: l.material_od || '', material_oi: l.material_oi || '',
                    fecha_adaptacion: l.fecha_adaptacion?.slice(0, 10) || '',
                    seguimiento: l.seguimiento || '', proxima_revision: l.proxima_revision?.slice(0, 10) || '',
                });
            }).catch(() => navigate('/lentes-especiales'));
        }
    }, [id, isEdit]);

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
        <div className="p-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft size={24} /></button>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Eye size={24} className="text-[#1a2a4a]" /> {isEdit ? 'Editar Lente Especial' : 'Nuevo Lente Especial'}
                </h1>
            </div>
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-5">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Paciente <span className="text-red-500">*</span></label>
                    <PatientAutocomplete value={patient} onChange={p => { setPatient(p); set('patient_id', p?.id || ''); }} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de lente <span className="text-red-500">*</span></label>
                    <select value={form.tipo} onChange={e => set('tipo', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]">
                        <option value="esclerales">Esclerales</option>
                        <option value="ortoqueratologia">Ortoqueratología</option>
                        <option value="queratocono">Queratocono</option>
                    </select>
                </div>

                <div className="border-t border-gray-100 pt-4">
                    <p className="text-sm font-semibold text-gray-700 mb-3">Parámetros técnicos</p>
                    <div className="space-y-3">
                        {eyeField('Radio base', 'radio_base_od', 'radio_base_oi', form, set)}
                        {eyeField('Diámetro', 'diametro_od', 'diametro_oi', form, set)}
                        {eyeField('Potencia', 'potencia_od', 'potencia_oi', form, set)}
                        {eyeField('Material', 'material_od', 'material_oi', form, set)}
                    </div>
                </div>

                <div className="border-t border-gray-100 pt-4 grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de adaptación</label>
                        <input type="date" value={form.fecha_adaptacion} onChange={e => set('fecha_adaptacion', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Próxima revisión</label>
                        <input type="date" value={form.proxima_revision} onChange={e => set('proxima_revision', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Seguimiento / Observaciones</label>
                    <textarea value={form.seguimiento} onChange={e => set('seguimiento', e.target.value)} rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] resize-none" />
                </div>
                <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                    <Button variant="secondary" type="button" onClick={() => navigate(-1)}>Cancelar</Button>
                    <Button type="submit" loading={saving}>{isEdit ? 'Guardar cambios' : 'Crear registro'}</Button>
                </div>
            </form>
        </div>
    );
}
