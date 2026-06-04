import React, { useEffect, useRef, useState } from 'react';
import { Settings, Upload, Save, Database, CheckSquare } from 'lucide-react';
import client from '../../api/client';
import Button from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { useSettings } from '../../contexts/SettingsContext';

const REQUIRED_FIELD_OPTIONS = [
    { key: 'optometrista_id', label: 'Médico / Optometrista' },
    { key: 'motivo_consulta', label: 'Motivo de consulta' },
    { key: 'fecha_consulta', label: 'Fecha de consulta' },
    { key: 'avsc_od', label: 'AV SC (Ojo derecho)' },
    { key: 'avsc_oi', label: 'AV SC (Ojo izquierdo)' },
    { key: 'rx_final_esfera_od', label: 'RX Final esfera OD' },
    { key: 'rx_final_esfera_oi', label: 'RX Final esfera OI' },
    { key: 'diagnostico_descripcion', label: 'Diagnóstico principal' },
    { key: 'lente_anterior', label: 'Lente anterior' },
    { key: 'observaciones', label: 'Observaciones clínicas' },
    { key: 'print_template_key', label: 'Plantilla de impresión' },
    { key: 'doctor_license', label: 'Registro / Licencia del doctor' },
];

function Tab({ active, onClick, icon: Icon, label }) {
    return (
        <button onClick={onClick}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${active ? 'border-[#1a2a4a] text-[#1a2a4a]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <Icon size={16} />{label}
        </button>
    );
}

export default function SettingsPage() {
    const { settings, logoUrl, refresh } = useSettings();
    const { addToast } = useToast();
    const [tab, setTab] = useState('general');
    const [saving, setSaving] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const fileRef = useRef(null);

    const [form, setForm] = useState({
        clinic_name: '',
        clinic_tagline: '',
        clinic_address: '',
        clinic_phone: '',
        required_fields: [],
    });

    useEffect(() => {
        setForm({
            clinic_name: settings.clinic_name || '',
            clinic_tagline: settings.clinic_tagline || '',
            clinic_address: settings.clinic_address || '',
            clinic_phone: settings.clinic_phone || '',
            required_fields: Array.isArray(settings.required_fields) ? settings.required_fields : [],
        });
    }, [settings]);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const toggleRequired = (key) => {
        setForm(f => ({
            ...f,
            required_fields: f.required_fields.includes(key)
                ? f.required_fields.filter(k => k !== key)
                : [...f.required_fields, key],
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await client.post('/settings', form);
            refresh();
            addToast('Configuración guardada', 'success');
        } catch { addToast('Error al guardar', 'error'); }
        finally { setSaving(false); }
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingLogo(true);
        try {
            const fd = new FormData();
            fd.append('logo', file);
            await client.post('/settings/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            refresh();
            addToast('Logo actualizado', 'success');
        } catch { addToast('Error al subir logo', 'error'); }
        finally { setUploadingLogo(false); }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <Settings size={28} className="text-[#1a2a4a]" /> Configuración
                </h1>
                <p className="text-gray-500 mt-1">Personaliza el sistema según las necesidades de tu clínica</p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-6">
                <Tab active={tab === 'general'} onClick={() => setTab('general')} icon={Settings} label="General" />
                <Tab active={tab === 'required'} onClick={() => setTab('required')} icon={CheckSquare} label="Campos obligatorios" />
            </div>

            {tab === 'general' && (
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <h2 className="font-semibold text-gray-900 mb-5">Identidad de la clínica</h2>
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la clínica <span className="text-red-500">*</span></label>
                                <input type="text" value={form.clinic_name} onChange={e => set('clinic_name', e.target.value)} required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Slogan / Tagline</label>
                                <input type="text" value={form.clinic_tagline} onChange={e => set('clinic_tagline', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                                <input type="text" value={form.clinic_address} onChange={e => set('clinic_address', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                                <input type="text" value={form.clinic_phone} onChange={e => set('clinic_phone', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                            </div>
                        </div>
                    </div>

                    {/* Logo */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <h2 className="font-semibold text-gray-900 mb-4">Logo de la clínica</h2>
                        <p className="text-sm text-gray-500 mb-4">El logo aparecerá en los certificados e informes de impresión.</p>
                        <div className="flex items-center gap-6">
                            <div className="w-32 h-24 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center bg-gray-50">
                                {logoUrl ? (
                                    <img src={logoUrl} alt="Logo" className="max-h-20 max-w-28 object-contain" />
                                ) : (
                                    <span className="text-xs text-gray-400 text-center px-2">Sin logo<br/>cargado</span>
                                )}
                            </div>
                            <div>
                                <input type="file" ref={fileRef} accept="image/*" onChange={handleLogoUpload} className="hidden" />
                                <Button variant="secondary" onClick={() => fileRef.current?.click()} loading={uploadingLogo}>
                                    <Upload size={16} /> {logoUrl ? 'Cambiar logo' : 'Subir logo'}
                                </Button>
                                <p className="text-xs text-gray-400 mt-2">PNG o JPG, máximo 2 MB. Recomendado: 300×100 px.</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <Button onClick={handleSave} loading={saving} size="lg">
                            <Save size={18} /> Guardar configuración
                        </Button>
                    </div>
                </div>
            )}

            {tab === 'required' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <h2 className="font-semibold text-gray-900 mb-2">Campos obligatorios en consulta</h2>
                    <p className="text-sm text-gray-500 mb-6">
                        Marca los campos que deben estar completos al guardar o completar una consulta.
                        Los campos incompletos se resaltarán en rojo y se mostrará un aviso.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {REQUIRED_FIELD_OPTIONS.map(({ key, label }) => (
                            <label key={key} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${form.required_fields.includes(key) ? 'border-[#1a2a4a] bg-[#1a2a4a]/5' : 'border-gray-200 hover:bg-gray-50'}`}>
                                <input
                                    type="checkbox"
                                    checked={form.required_fields.includes(key)}
                                    onChange={() => toggleRequired(key)}
                                    className="w-4 h-4 accent-[#1a2a4a]"
                                />
                                <span className="text-sm text-gray-800">{label}</span>
                            </label>
                        ))}
                    </div>
                    <div className="flex justify-end mt-6">
                        <Button onClick={handleSave} loading={saving} size="lg">
                            <Save size={18} /> Guardar configuración
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
