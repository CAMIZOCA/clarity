import React, { useMemo, useState } from 'react';
import { X, Download, Printer, Mail } from 'lucide-react';
import Button from '../ui/Button';
import client from '../../api/client';
import { useToast } from '../ui/Toast';
import { useSettings } from '../../contexts/SettingsContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const RX_COLS = [
    { key: 'rx_final_esfera', label: 'ESFERA' },
    { key: 'rx_final_cilindro', label: 'CILINDRO' },
    { key: 'rx_final_eje', label: 'EJE' },
    { key: 'rx_final_add', label: 'ADD' },
    { key: 'rx_final_avl', label: 'AVL' },
    { key: 'rx_final_prisma', label: 'PRISMA' },
    { key: 'rx_final_base', label: 'BASE' },
    { key: 'rx_final_dnp', label: 'DNP/DP' },
];

const NAVY = '#1a2a4a';
const BLUE = '#2f6db5';

function val(v) {
    return v === null || v === undefined || v === '' ? '' : String(v);
}

function PdfContent({ data, settings, logoUrl, doctor }) {
    const c = data?.consultation ?? data ?? {};
    const patient = data?.patient ?? c.patient ?? {};
    const diagnoses = c.diagnoses ?? data?.diagnoses ?? [];

    const cedula = patient.cedula || patient.company_ruc || '';
    const edad = patient.edad ?? '';

    const fechaRaw = c.fecha_consulta
        ? format(new Date(c.fecha_consulta), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })
        : '';
    const fecha = fechaRaw ? fechaRaw.charAt(0).toUpperCase() + fechaRaw.slice(1) : '';

    // Diagnóstico por ojo: campos de certificado con fallback a la relación diagnoses.
    const diagOd = c.certificado_diagnostico_od
        || diagnoses.filter(d => d.eye === 'od').map(d => [d.code, d.description].filter(Boolean).join(' ')).join(', ');
    const diagOi = c.certificado_diagnostico_oi
        || diagnoses.filter(d => d.eye === 'oi').map(d => [d.code, d.description].filter(Boolean).join(' ')).join(', ');

    const hasRx = RX_COLS.some(col => c[`${col.key}_od`] || c[`${col.key}_oi`]);
    const hasAv = c.avsc_od || c.avsc_oi || c.avcc_od || c.avcc_oi;

    // Recomendaciones del certificado: `certificado_nota` es el campo que usa la
    // clínica (ej. "USO PERMANENTE"); si está vacío se cae al texto libre y al catálogo.
    const recList = c.recommendations_list ?? data?.recommendations_list ?? [];
    const recomendaciones = val(c.certificado_nota)
        || val(c.recomendaciones)
        || recList.filter(r => r.text).map(r => r.text).join('\n');

    const th = { border: '1px solid #9db4d0', padding: '3px 6px', textAlign: 'center', fontSize: '10px' };
    const td = { border: '1px solid #9db4d0', padding: '3px 6px', textAlign: 'center', fontSize: '11px' };

    return (
        <div id="pdf-content" style={{ fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#111', background: '#fff', padding: '28px 34px', maxWidth: '820px', margin: '0 auto' }}>
            {/* Encabezado con logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '6px' }}>
                {logoUrl && (
                    <img src={logoUrl} alt="Logo" style={{ height: '70px', objectFit: 'contain' }} crossOrigin="anonymous" />
                )}
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: NAVY }}>{settings.clinic_name}</div>
                    {settings.clinic_tagline && <div style={{ fontSize: '11px', color: '#666' }}>{settings.clinic_tagline}</div>}
                </div>
            </div>

            {/* Título */}
            <h1 style={{ textAlign: 'center', fontSize: '22px', fontWeight: 'bold', color: NAVY, letterSpacing: '1px', margin: '10px 0 4px', textDecoration: 'underline' }}>
                CERTIFICADO VISUAL
            </h1>
            <div style={{ textAlign: 'right', color: BLUE, fontWeight: 'bold', fontSize: '12px', marginBottom: '10px' }}>
                {fecha}
            </div>

            {/* Narrativa + datos del paciente */}
            <div style={{ fontSize: '12.5px', lineHeight: 1.7, marginBottom: '14px' }}>
                <div>
                    Por medio de la presente certifico haber examinado al paciente{' '}
                    <strong style={{ textTransform: 'uppercase' }}>{patient.nombre}</strong>
                </div>
                <div>De <strong>{edad}</strong> Años de edad, con Cédula ID: <strong>{cedula}</strong></div>
                {fecha && <div>Asistió a consulta, el día: {fecha}</div>}
                {c.numero_consulta && <div>Consulta No: <strong>{c.numero_consulta}</strong></div>}
            </div>

            {/* Agudeza visual + visión de colores */}
            {(hasAv || c.vision_colores) && (
                <div style={{ display: 'flex', gap: '18px', alignItems: 'flex-start', marginBottom: '16px' }}>
                    {hasAv && (
                        <div style={{ display: 'flex', gap: '14px' }}>
                            {[{ label: 'AV.SC', od: c.avsc_od, oi: c.avsc_oi }, { label: 'AV.CC', od: c.avcc_od, oi: c.avcc_oi }].map(t => (
                                <table key={t.label} style={{ borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr><th colSpan={2} style={{ ...th, background: BLUE, color: '#fff', border: '1px solid ' + BLUE }}>{t.label}</th></tr>
                                        <tr><th colSpan={2} style={{ ...th, fontWeight: 'bold' }}>LEJOS</th></tr>
                                    </thead>
                                    <tbody>
                                        <tr><td style={{ ...td, fontWeight: 'bold' }}>O.D</td><td style={{ ...td, minWidth: '54px' }}>{val(t.od)}</td></tr>
                                        <tr><td style={{ ...td, fontWeight: 'bold' }}>O.I</td><td style={{ ...td, minWidth: '54px' }}>{val(t.oi)}</td></tr>
                                    </tbody>
                                </table>
                            ))}
                        </div>
                    )}
                    {c.vision_colores && (
                        <div style={{ marginLeft: 'auto', minWidth: '220px' }}>
                            <div style={{ ...th, background: BLUE, color: '#fff', border: '1px solid ' + BLUE, fontWeight: 'bold' }}>VISIÓN DE COLORES</div>
                            <div style={{ border: '1px solid #9db4d0', borderTop: 'none', padding: '10px 8px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                                {c.vision_colores}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Diagnóstico */}
            {(diagOd || diagOi) && (
                <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontWeight: 'bold', color: NAVY, fontSize: '13px', marginBottom: '6px' }}>DIAGNÓSTICO:</div>
                    {diagOd && <div style={{ fontSize: '12px', marginBottom: '3px' }}><strong>O.D</strong>&nbsp;&nbsp;&nbsp;{diagOd}</div>}
                    {diagOi && <div style={{ fontSize: '12px' }}><strong>O.I</strong>&nbsp;&nbsp;&nbsp;&nbsp;{diagOi}</div>}
                </div>
            )}

            {/* RX Final */}
            {hasRx && (
                <div style={{ marginBottom: '16px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr><th colSpan={RX_COLS.length + 1} style={{ ...th, background: BLUE, color: '#fff', border: '1px solid ' + BLUE }}>RX FINAL</th></tr>
                            <tr>
                                <th style={{ ...th }}></th>
                                {RX_COLS.map(col => <th key={col.key} style={th}>{col.label}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {['od', 'oi'].map(eye => (
                                <tr key={eye}>
                                    <td style={{ ...td, fontWeight: 'bold' }}>{eye === 'od' ? 'O.D' : 'O.I'}</td>
                                    {RX_COLS.map(col => <td key={col.key} style={td}>{val(c[`${col.key}_${eye}`])}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Recomendaciones */}
            {recomendaciones && (
                <div style={{ marginBottom: '18px' }}>
                    <div style={{ fontWeight: 'bold', color: NAVY, fontSize: '13px', marginBottom: '4px' }}>RECOMENDACIONES:</div>
                    <div style={{ fontSize: '12px', whiteSpace: 'pre-line', textTransform: 'uppercase' }}>{recomendaciones}</div>
                </div>
            )}

            <div style={{ fontSize: '12px', margin: '18px 0 26px' }}>Es todo cuanto puedo certificar.</div>

            {/* Firma */}
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
                {doctor?.nombre && <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{doctor.nombre}</div>}
                {doctor?.titulo && <div style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px' }}>{doctor.titulo}</div>}
                {doctor?.registro_senescyt && (
                    <div style={{ fontSize: '10px' }}>
                        REG. SENESCYT<br />{doctor.registro_senescyt}
                    </div>
                )}
                {doctor?.firma_url && (
                    <img src={doctor.firma_url} alt="Firma" crossOrigin="anonymous"
                        style={{ height: '70px', objectFit: 'contain', margin: '4px auto', display: 'block' }} />
                )}
                {doctor?.nombre && (
                    <div style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', borderTop: doctor?.firma_url ? 'none' : '1px solid #333', paddingTop: '2px', display: 'inline-block', minWidth: '220px' }}>
                        {doctor.nombre}
                    </div>
                )}
                {doctor?.titulo && <div style={{ fontSize: '11px', color: '#333' }}>{doctor.titulo.charAt(0) + doctor.titulo.slice(1).toLowerCase()}</div>}
            </div>

            {/* Pie de página */}
            <div style={{ marginTop: '30px', paddingTop: '10px', borderTop: '1px solid #bcd0e6', textAlign: 'center', fontSize: '10px', color: '#555' }}>
                {settings.clinic_address && <div>Dirección: {settings.clinic_address}{settings.clinic_phone ? ` · Telf.: ${settings.clinic_phone}` : ''}</div>}
                {(settings.clinic_email || settings.clinic_website) && (
                    <div>
                        {settings.clinic_email ? `Email: ${settings.clinic_email}` : ''}
                        {settings.clinic_email && settings.clinic_website ? ' / ' : ''}
                        {settings.clinic_website || ''}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function CertificadoPdf({ data, onClose }) {
    const { settings, logoUrl } = useSettings();
    const { addToast } = useToast();

    const doctors = data?.certifying_doctors ?? [];
    const defaultDoctorId = useMemo(() => {
        const def = doctors.find(d => d.is_default) ?? doctors[0];
        return def ? String(def.id) : '';
    }, [doctors]);

    const [doctorId, setDoctorId] = useState(defaultDoctorId);
    const selectedDoctor = doctors.find(d => String(d.id) === String(doctorId)) ?? null;

    const patient = data?.patient ?? data?.consultation?.patient ?? {};
    const [email, setEmail] = useState(patient.email || '');
    const [sending, setSending] = useState(false);
    const [downloading, setDownloading] = useState(false);

    const consultationId = data?.consultation?.id ?? data?.consultation_id ?? null;
    const numero = data?.consultation?.numero_consulta || 'consulta';

    const pdfOptions = () => ({
        margin: 8,
        filename: `certificado_${numero}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    });

    // Genera el PDF como Blob para subirlo al backend (persistencia / correo).
    const generateBlob = async () => {
        const content = document.getElementById('pdf-content');
        if (!content) throw new Error('No hay contenido');
        const html2pdf = (await import('html2pdf.js')).default;
        return await html2pdf().set(pdfOptions()).from(content).outputPdf('blob');
    };

    // Sube el PDF al backend para guardarlo (y opcionalmente enviarlo).
    const persist = async (blob, send) => {
        if (!consultationId) return;
        const fd = new FormData();
        fd.append('consultation_id', consultationId);
        fd.append('pdf', blob, `certificado_${numero}.pdf`);
        if (selectedDoctor) fd.append('certifying_doctor_id', selectedDoctor.id);
        if (email) fd.append('recipient_email', email);
        fd.append('send', send ? '1' : '0');
        await client.post('/certificates', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    };

    const handlePrint = () => {
        const content = document.getElementById('pdf-content');
        if (!content) return;
        const win = window.open('', '_blank');
        win.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Certificado - ${settings.clinic_name}</title>
                <style>
                    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
                    @media print { body { margin: 0; padding: 10px; } }
                </style>
            </head>
            <body>${content.innerHTML}</body>
            </html>
        `);
        win.document.close();
        win.focus();
        win.print();
    };

    const handleDownloadPdf = async () => {
        setDownloading(true);
        try {
            const blob = await generateBlob();
            // Descargar en el navegador.
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `certificado_${numero}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            // Guardar copia en la base de datos.
            try { await persist(blob, false); } catch { /* la descarga no debe fallar por esto */ }
            addToast('Certificado descargado', 'success');
        } catch {
            handlePrint();
        } finally { setDownloading(false); }
    };

    const handleSendEmail = async () => {
        if (!email.trim()) { addToast('Indica un correo destinatario', 'error'); return; }
        if (!consultationId) { addToast('Guarda la consulta antes de enviar', 'error'); return; }
        setSending(true);
        try {
            const blob = await generateBlob();
            await persist(blob, true);
            addToast('Certificado enviado por correo', 'success');
        } catch (e) {
            addToast(e.response?.data?.message || 'No se pudo enviar el certificado', 'error');
        } finally { setSending(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
            <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col max-h-[95vh]">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4 shrink-0">
                    <h2 className="text-lg font-semibold text-gray-900">Certificado visual</h2>
                    <div className="flex flex-wrap items-center gap-2">
                        {doctors.length > 0 && (
                            <select
                                value={doctorId}
                                onChange={e => setDoctorId(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                            >
                                {doctors.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                            </select>
                        )}
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="correo del paciente"
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-52 focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                        />
                        <Button variant="secondary" size="sm" onClick={handleSendEmail} loading={sending}>
                            <Mail size={16} /> Enviar
                        </Button>
                        <Button variant="secondary" size="sm" onClick={handleDownloadPdf} loading={downloading}>
                            <Download size={16} /> Descargar
                        </Button>
                        <Button size="sm" onClick={handlePrint}>
                            <Printer size={16} /> Imprimir
                        </Button>
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {doctors.length === 0 && (
                    <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 text-xs text-amber-800">
                        No hay doctores certificadores configurados. Agrégalos en Configuración → Doctores para que aparezca la firma.
                    </div>
                )}

                {/* Preview */}
                <div className="flex-1 overflow-y-auto bg-gray-100 p-4">
                    <div className="shadow-lg">
                        <PdfContent data={data} settings={settings} logoUrl={logoUrl} doctor={selectedDoctor} />
                    </div>
                </div>
            </div>
        </div>
    );
}
