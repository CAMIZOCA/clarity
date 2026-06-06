import React, { useState, useCallback } from 'react';
import { ClipboardList, Eye, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import PatientAutocomplete from '../../components/ui/PatientAutocomplete';
import OrdenTrabajoPdf from '../../components/pdf/OrdenTrabajoPdf';
import client from '../../api/client';
import { useSettings } from '../../contexts/SettingsContext';
import { format } from 'date-fns';

const SPECS_DEFAULT = {
    cristal: false, cr39: false, poly: false, phoenix: false,
    blanco: false, fotocromático: false, trans: false, colorm: false, fotoc: false,
    gris: false, cafe: false, verde: false,
    antirreflejo: false, luz_azul: false, deluxe: false, uv: false,
    optifog: false, antirrayas: false, hidrof: false, duralen: false,
    monofocal: false, bifocal: false, invisible: false, flapptop: false,
    progresivos: false, conv: false, dig: false,
    gafas: false, ocupacional: false,
    color_uv: false, polarizado: false, espejados: false,
    comp_w: false, tac40: false,
    n149: false, n156: false, n161: false, n167: false, n174: false,
};

function SpecCheckbox({ label, name, checked, onChange }) {
    return (
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
                type="checkbox"
                checked={checked}
                onChange={e => onChange(name, e.target.checked)}
                className="w-4 h-4 accent-[#1a2a4a] cursor-pointer"
            />
            <span className="text-sm text-gray-700">{label}</span>
        </label>
    );
}

function SpecGroup({ title, children }) {
    return (
        <div className="border rounded-lg overflow-hidden">
            <div className="bg-[#1a2a4a] text-white text-xs font-bold px-3 py-1.5">{title}</div>
            <div className="p-3 flex flex-wrap gap-3">{children}</div>
        </div>
    );
}

function focusNextField(nextFieldId) {
    if (!nextFieldId) {
        return;
    }

    const nextField = document.getElementById(nextFieldId);
    if (nextField && typeof nextField.focus === 'function') {
        nextField.focus({ preventScroll: true });
        if (typeof nextField.select === 'function') {
            nextField.select();
        }
    }
}

function Field({
    label,
    name,
    value,
    onChange,
    type = 'text',
    placeholder = '',
    inputMode,
    enterKeyHint,
    nextFieldId,
}) {
    return (
        <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
            <input
                id={name}
                type={type}
                name={name}
                value={value || ''}
                onChange={e => onChange(name, e.target.value)}
                placeholder={placeholder}
                inputMode={inputMode ?? (type === 'number' ? 'decimal' : undefined)}
                enterKeyHint={enterKeyHint ?? (nextFieldId ? 'next' : 'done')}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' && nextFieldId && !event.isComposing) {
                        event.preventDefault();
                        focusNextField(nextFieldId);
                    }
                }}
                className="w-full min-h-11 border border-gray-300 rounded-lg px-3 py-2 text-sm touch-manipulation focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
            />
        </div>
    );
}

function generateNumero() {
    const now = new Date();
    const year = now.getFullYear();
    const seq = String(now.getTime()).slice(-4);
    return `${year}${seq}`;
}

export default function OrdenTrabajoPage() {
    const { settings } = useSettings();
    const [paciente, setPaciente] = useState(null);
    const [consulta, setConsulta] = useState(null);
    const [loadingConsulta, setLoadingConsulta] = useState(false);
    const [noConsulta, setNoConsulta] = useState(false);
    const [showPdf, setShowPdf] = useState(false);

    const [specs, setSpecs] = useState({ ...SPECS_DEFAULT });
    const [orden, setOrden] = useState({
        numero: generateNumero(),
        fecha: format(new Date(), 'dd/MM/yyyy'),
        rx_od: '', rx_oi: '', add_od: '', add_oi: '', avcc_od: '', avcc_oi: '',
        dnp: '', especif: '', lab: '', alt: '', armazon: '',
        dr: '', fac: '', rc: '', entrega: '', nota: '',
        valor: '', abono: '', saldo: '', forma_pago: '',
        cliente: '', telefono: '',
    });

    const handlePatientSelect = useCallback(async (patient) => {
        setPaciente(patient);
        setConsulta(null);
        setNoConsulta(false);
        setLoadingConsulta(true);
        setOrden(prev => ({
            ...prev,
            cliente: patient.nombre,
            telefono: patient.telefono || '',
        }));

        try {
            const res = await client.get(`/patients/${patient.id}/last-consultation`);
            const c = res.data?.data;
            if (c) {
                setConsulta(c);
                const fmtRx = (esf, cil, eje) => {
                    const parts = [];
                    if (esf != null && esf !== '') parts.push(parseFloat(esf) >= 0 ? `+${parseFloat(esf).toFixed(2)}` : parseFloat(esf).toFixed(2));
                    if (cil != null && cil !== '') parts.push(parseFloat(cil) >= 0 ? `+${parseFloat(cil).toFixed(2)}` : parseFloat(cil).toFixed(2));
                    if (eje != null && eje !== '') parts.push(`x${eje}°`);
                    return parts.join(' ');
                };
                const fmtAdd = (v) => v ? (parseFloat(v) >= 0 ? `+${parseFloat(v).toFixed(2)}` : parseFloat(v).toFixed(2)) : '';
                const dnp = [c.rx_final_dnp_od, c.rx_final_dnp_oi].filter(Boolean).join('/');

                setOrden(prev => ({
                    ...prev,
                    rx_od: fmtRx(c.rx_final_esfera_od, c.rx_final_cilindro_od, c.rx_final_eje_od),
                    rx_oi: fmtRx(c.rx_final_esfera_oi, c.rx_final_cilindro_oi, c.rx_final_eje_oi),
                    add_od: fmtAdd(c.rx_final_add_od),
                    add_oi: fmtAdd(c.rx_final_add_oi),
                    avcc_od: c.avcc_od || '',
                    avcc_oi: c.avcc_oi || '',
                    dnp,
                    dr: c.optometrista?.name || '',
                }));

                if (c.luna_material || c.luna_espesor || c.luna_proteccion) {
                    const mat = (c.luna_material || '').toLowerCase();
                    const esp = (c.luna_espesor || '').toLowerCase();
                    const prot = (c.luna_proteccion || '').toLowerCase();
                    setSpecs(prev => ({
                        ...prev,
                        cristal: mat.includes('cristal'),
                        cr39: mat.includes('cr') || mat.includes('39'),
                        poly: mat.includes('poli') || mat.includes('poly'),
                        phoenix: mat.includes('phoenix'),
                        fotocromático: prot.includes('fotocrom'),
                        antirreflejo: prot.includes('antirreflejo') || prot.includes('ar'),
                        uv: prot.includes('uv'),
                        monofocal: esp.includes('monofocal'),
                        bifocal: esp.includes('bifocal'),
                        progresivos: esp.includes('progresivo'),
                    }));
                }
            } else {
                setNoConsulta(true);
            }
        } catch {
            setNoConsulta(true);
        } finally {
            setLoadingConsulta(false);
        }
    }, []);

    const handleSpecChange = (name, value) => {
        setSpecs(prev => ({ ...prev, [name]: value }));
    };

    const handleOrdenChange = (name, value) => {
        setOrden(prev => ({ ...prev, [name]: value }));
    };

    const ordenConSpecs = { ...orden, specs };

    return (
        <div className="max-w-5xl mx-auto px-4 py-6 pb-24">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-[#1a2a4a] rounded-xl flex items-center justify-center">
                    <ClipboardList size={20} className="text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Orden de Trabajo</h1>
                    <p className="text-gray-500 text-sm">Genera una orden de trabajo para el laboratorio óptico</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
                <h2 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-[#1a2a4a] text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                    Seleccionar paciente
                </h2>
                <PatientAutocomplete onSelect={handlePatientSelect} />

                {loadingConsulta && (
                    <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
                        <RefreshCw size={14} className="animate-spin" />
                        Cargando última consulta...
                    </div>
                )}

                {paciente && !loadingConsulta && consulta && (
                    <div className="flex items-center gap-2 mt-3 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                        <CheckCircle size={16} />
                        Datos cargados de la consulta del {consulta.fecha_consulta || '—'}
                    </div>
                )}

                {paciente && !loadingConsulta && noConsulta && (
                    <div className="flex items-center gap-2 mt-3 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                        <AlertCircle size={16} />
                        Este paciente no tiene consultas completadas. Puedes ingresar los datos manualmente.
                    </div>
                )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
                <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 bg-[#1a2a4a] text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                    Datos de la orden
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <Field label="N° Orden" name="numero" value={orden.numero} onChange={handleOrdenChange} nextFieldId="fecha" />
                    <Field label="Fecha" name="fecha" value={orden.fecha} onChange={handleOrdenChange} nextFieldId="cliente" />
                    <Field label="Cliente" name="cliente" value={orden.cliente} onChange={handleOrdenChange} nextFieldId="telefono" />
                    <Field label="Teléfono" name="telefono" value={orden.telefono} onChange={handleOrdenChange} type="tel" inputMode="tel" nextFieldId="rx_od" />
                </div>

                <h3 className="text-sm font-bold text-gray-700 mb-3 border-b pb-1">Prescripción</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    <Field label="O.D." name="rx_od" value={orden.rx_od} onChange={handleOrdenChange} placeholder="Ej: -3.50 -1.25 x12°" nextFieldId="add_od" />
                    <Field label="ADD O.D." name="add_od" value={orden.add_od} onChange={handleOrdenChange} placeholder="+2.50" inputMode="decimal" nextFieldId="avcc_od" />
                    <Field label="AV C.C. O.D." name="avcc_od" value={orden.avcc_od} onChange={handleOrdenChange} placeholder="20/20" nextFieldId="rx_oi" />
                    <Field label="O.I." name="rx_oi" value={orden.rx_oi} onChange={handleOrdenChange} placeholder="Ej: +0.25 -2.75 x10°" nextFieldId="add_oi" />
                    <Field label="ADD O.I." name="add_oi" value={orden.add_oi} onChange={handleOrdenChange} placeholder="+2.50" inputMode="decimal" nextFieldId="avcc_oi" />
                    <Field label="AV C.C. O.I." name="avcc_oi" value={orden.avcc_oi} onChange={handleOrdenChange} placeholder="20/20" nextFieldId="especif" />
                </div>

                <h3 className="text-sm font-bold text-gray-700 mb-3 border-b pb-1">Especificaciones de Lentes</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    <SpecGroup title="Material">
                        <SpecCheckbox label="CRISTAL" name="cristal" checked={specs.cristal} onChange={handleSpecChange} />
                        <SpecCheckbox label="CR 39" name="cr39" checked={specs.cr39} onChange={handleSpecChange} />
                        <SpecCheckbox label="POLY" name="poly" checked={specs.poly} onChange={handleSpecChange} />
                        <SpecCheckbox label="PHOENIX" name="phoenix" checked={specs.phoenix} onChange={handleSpecChange} />
                    </SpecGroup>
                    <SpecGroup title="Tipo / Color">
                        <SpecCheckbox label="BLANCO" name="blanco" checked={specs.blanco} onChange={handleSpecChange} />
                        <SpecCheckbox label="FOTOCROMATICO" name="fotocromático" checked={specs.fotocromático} onChange={handleSpecChange} />
                        <SpecCheckbox label="TRANS." name="trans" checked={specs.trans} onChange={handleSpecChange} />
                        <SpecCheckbox label="COLORM." name="colorm" checked={specs.colorm} onChange={handleSpecChange} />
                        <SpecCheckbox label="FOTOC." name="fotoc" checked={specs.fotoc} onChange={handleSpecChange} />
                        <SpecCheckbox label="GRIS" name="gris" checked={specs.gris} onChange={handleSpecChange} />
                        <SpecCheckbox label="CAFE" name="cafe" checked={specs.cafe} onChange={handleSpecChange} />
                        <SpecCheckbox label="VERDE" name="verde" checked={specs.verde} onChange={handleSpecChange} />
                    </SpecGroup>
                    <SpecGroup title="Tratamiento / Protección">
                        <SpecCheckbox label="ANTIRREFLEJO" name="antirreflejo" checked={specs.antirreflejo} onChange={handleSpecChange} />
                        <SpecCheckbox label="LUZ AZUL" name="luz_azul" checked={specs.luz_azul} onChange={handleSpecChange} />
                        <SpecCheckbox label="DELUXE" name="deluxe" checked={specs.deluxe} onChange={handleSpecChange} />
                        <SpecCheckbox label="UV" name="uv" checked={specs.uv} onChange={handleSpecChange} />
                        <SpecCheckbox label="OPTIFOG" name="optifog" checked={specs.optifog} onChange={handleSpecChange} />
                        <SpecCheckbox label="ANTIRRAYAS" name="antirrayas" checked={specs.antirrayas} onChange={handleSpecChange} />
                        <SpecCheckbox label="HIDROF." name="hidrof" checked={specs.hidrof} onChange={handleSpecChange} />
                        <SpecCheckbox label="DURALEN" name="duralen" checked={specs.duralen} onChange={handleSpecChange} />
                    </SpecGroup>
                    <SpecGroup title="Tipo de Luna">
                        <SpecCheckbox label="MONOFOCAL" name="monofocal" checked={specs.monofocal} onChange={handleSpecChange} />
                        <SpecCheckbox label="BIFOCAL" name="bifocal" checked={specs.bifocal} onChange={handleSpecChange} />
                        <SpecCheckbox label="INVISIBLE" name="invisible" checked={specs.invisible} onChange={handleSpecChange} />
                        <SpecCheckbox label="FLAPPTOP" name="flapptop" checked={specs.flapptop} onChange={handleSpecChange} />
                        <SpecCheckbox label="PROGRESIVOS" name="progresivos" checked={specs.progresivos} onChange={handleSpecChange} />
                        <SpecCheckbox label="CONV" name="conv" checked={specs.conv} onChange={handleSpecChange} />
                        <SpecCheckbox label="DIG." name="dig" checked={specs.dig} onChange={handleSpecChange} />
                    </SpecGroup>
                    <SpecGroup title="Categoría">
                        <SpecCheckbox label="GAFAS" name="gafas" checked={specs.gafas} onChange={handleSpecChange} />
                        <SpecCheckbox label="COLOR+UV" name="color_uv" checked={specs.color_uv} onChange={handleSpecChange} />
                        <SpecCheckbox label="POLARIZADO" name="polarizado" checked={specs.polarizado} onChange={handleSpecChange} />
                        <SpecCheckbox label="ESPEJADOS" name="espejados" checked={specs.espejados} onChange={handleSpecChange} />
                        <SpecCheckbox label="OCUPACIONAL" name="ocupacional" checked={specs.ocupacional} onChange={handleSpecChange} />
                        <SpecCheckbox label="COMP & W" name="comp_w" checked={specs.comp_w} onChange={handleSpecChange} />
                        <SpecCheckbox label="TAC40ITAC60" name="tac40" checked={specs.tac40} onChange={handleSpecChange} />
                    </SpecGroup>
                    <SpecGroup title="Índice de Refracción">
                        <SpecCheckbox label="N 1.49" name="n149" checked={specs.n149} onChange={handleSpecChange} />
                        <SpecCheckbox label="N 1.56" name="n156" checked={specs.n156} onChange={handleSpecChange} />
                        <SpecCheckbox label="N 1.61" name="n161" checked={specs.n161} onChange={handleSpecChange} />
                        <SpecCheckbox label="N 1.67" name="n167" checked={specs.n167} onChange={handleSpecChange} />
                        <SpecCheckbox label="N 1.74" name="n174" checked={specs.n174} onChange={handleSpecChange} />
                    </SpecGroup>
                </div>

                <div className="mb-6">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">OTRO / ESPECIF.</label>
                    <input
                        id="especif"
                        type="text"
                        value={orden.especif || ''}
                        onChange={e => handleOrdenChange('especif', e.target.value)}
                        placeholder="Ej: CR. Fotocromáticos Gris AR"
                        className="w-full min-h-11 border border-gray-300 rounded-lg px-3 py-2 text-sm touch-manipulation focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                    />
                </div>

                <h3 className="text-sm font-bold text-gray-700 mb-3 border-b pb-1">Laboratorio y Logística</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <Field label="LAB" name="lab" value={orden.lab} onChange={handleOrdenChange} placeholder="Nombre laboratorio" nextFieldId="alt" />
                    <Field label="ALT." name="alt" value={orden.alt} onChange={handleOrdenChange} type="number" inputMode="numeric" placeholder="24" nextFieldId="dnp" />
                    <Field label="D.P." name="dnp" value={orden.dnp} onChange={handleOrdenChange} placeholder="32/33" nextFieldId="dr" />
                    <Field label="DR." name="dr" value={orden.dr} onChange={handleOrdenChange} nextFieldId="armazon" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="md:col-span-2">
                        <Field label="ARMAZÓN" name="armazon" value={orden.armazon} onChange={handleOrdenChange} placeholder="Descripción del armazón" nextFieldId="fac" />
                    </div>
                    <Field label="FAC." name="fac" value={orden.fac} onChange={handleOrdenChange} nextFieldId="rc" />
                    <Field label="R.C." name="rc" value={orden.rc} onChange={handleOrdenChange} nextFieldId="entrega" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="md:col-span-2">
                        <Field label="ENTREGA" name="entrega" value={orden.entrega} onChange={handleOrdenChange} placeholder="Ej: Martes URG." nextFieldId="valor" />
                    </div>
                </div>
                <div className="mb-4">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">NOTA</label>
                    <textarea
                        value={orden.nota || ''}
                        onChange={e => handleOrdenChange('nota', e.target.value)}
                        rows={2}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] resize-none"
                    />
                </div>

                <h3 className="text-sm font-bold text-gray-700 mb-3 border-b pb-1">Información Financiera</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Field label="VALOR ($)" name="valor" value={orden.valor} onChange={handleOrdenChange} type="number" inputMode="decimal" placeholder="0.00" nextFieldId="abono" />
                    <Field label="ABONO ($)" name="abono" value={orden.abono} onChange={handleOrdenChange} type="number" inputMode="decimal" placeholder="0.00" nextFieldId="saldo" />
                    <Field label="SALDO ($)" name="saldo" value={orden.saldo} onChange={handleOrdenChange} type="number" inputMode="decimal" placeholder="0.00" nextFieldId="forma_pago" />
                    <Field label="Forma de Pago" name="forma_pago" value={orden.forma_pago} onChange={handleOrdenChange} placeholder="EFECTIVO / VISA" />
                </div>
            </div>

            <div className="mobile-sticky-actions -mx-4 px-4 py-4 md:static md:mx-0 md:px-0 md:py-0 md:bg-transparent md:border-0 md:backdrop-blur-0 md:shadow-none">
                <button
                    onClick={() => setShowPdf(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a2a4a] px-6 py-3 text-base font-semibold text-white shadow-lg transition-colors hover:bg-[#243a6a] md:w-auto"
                >
                    <Eye size={18} />
                    Vista Previa e Imprimir
                </button>
            </div>

            {showPdf && (
                <OrdenTrabajoPdf
                    orden={ordenConSpecs}
                    paciente={paciente}
                    consulta={consulta}
                    settings={settings}
                    onClose={() => setShowPdf(false)}
                />
            )}
        </div>
    );
}
