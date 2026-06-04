import React, { useRef } from 'react';
import { X, Download, Printer } from 'lucide-react';
import Button from '../ui/Button';
import { useSettings } from '../../contexts/SettingsContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

function RxRow({ label, data, fields }) {
    if (!data) return null;
    const hasData = fields.some(f => data[`${f}_od`] || data[`${f}_oi`]);
    if (!hasData) return null;
    return (
        <tr>
            <td className="border border-gray-300 px-2 py-1 text-xs font-semibold bg-gray-50">{label}</td>
            {['od', 'oi'].map(eye => (
                <React.Fragment key={eye}>
                    {fields.map(f => (
                        <td key={f} className="border border-gray-300 px-2 py-1 text-xs text-center">
                            {data[`${f}_${eye}`] || ''}
                        </td>
                    ))}
                </React.Fragment>
            ))}
        </tr>
    );
}

function InfoRow({ label, value }) {
    if (!value) return null;
    return (
        <div className="flex gap-2 text-xs">
            <span className="font-semibold text-gray-600 shrink-0">{label}:</span>
            <span className="text-gray-800">{value}</span>
        </div>
    );
}

function PdfContent({ data, settings, logoUrl }) {
    const c = data?.consultation ?? data ?? {};
    const patient = data?.patient ?? c.patient ?? {};
    const optometrist = data?.optometrist ?? c.optometrista ?? {};
    const diagnoses = data?.diagnoses ?? c.diagnoses ?? [];
    const recommendations = data?.recommendations_list ?? c.recommendations_list ?? [];
    const lensRec = data?.lens_recommendation ?? c.lens_recommendation ?? {};

    const fecha = c.fecha_consulta
        ? format(new Date(c.fecha_consulta), "d 'de' MMMM yyyy", { locale: es })
        : '';

    return (
        <div id="pdf-content" style={{ fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#111', background: '#fff', padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', borderBottom: '2px solid #1a2a4a', paddingBottom: '12px', marginBottom: '16px' }}>
                {logoUrl && (
                    <img src={logoUrl} alt="Logo" style={{ height: '60px', marginRight: '16px', objectFit: 'contain' }} />
                )}
                <div style={{ flex: 1 }}>
                    <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#1a2a4a' }}>{settings.clinic_name}</h1>
                    {settings.clinic_tagline && <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#666' }}>{settings.clinic_tagline}</p>}
                    <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                        {settings.clinic_address && <span style={{ fontSize: '10px', color: '#666' }}>{settings.clinic_address}</span>}
                        {settings.clinic_phone && <span style={{ fontSize: '10px', color: '#666' }}>Tel: {settings.clinic_phone}</span>}
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', color: '#666' }}>Consulta N°</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1a2a4a' }}>{c.numero_consulta}</div>
                    <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>{fecha}</div>
                </div>
            </div>

            {/* Patient info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px', padding: '10px', background: '#f8f9fa', borderRadius: '6px' }}>
                <InfoRow label="Paciente" value={patient.nombre} />
                <InfoRow label="Cédula" value={patient.cedula} />
                <InfoRow label="Fecha nac." value={patient.fecha_nacimiento} />
                <InfoRow label="Edad" value={patient.edad ? `${patient.edad} años` : ''} />
                <InfoRow label="Ocupación" value={patient.ocupacion} />
                <InfoRow label="Teléfono" value={patient.telefono} />
            </div>

            {/* Doctor */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '10px', color: '#555' }}>
                <span>Optometrista: <strong>{optometrist.name || c.doctor_license}</strong></span>
                {c.doctor_license && <span>Reg.: {c.doctor_license}</span>}
                {c.motivo_consulta && <span>Motivo: {c.motivo_consulta}</span>}
            </div>

            {/* Examen visual */}
            {(c.avsc_od || c.avsc_oi || c.rx_final_esfera_od || c.rx_final_esfera_oi) && (
                <div style={{ marginBottom: '14px' }}>
                    <h3 style={{ fontSize: '12px', fontWeight: 'bold', color: '#1a2a4a', borderBottom: '1px solid #ddd', paddingBottom: '4px', marginBottom: '8px' }}>EXAMEN VISUAL Y REFRACCIÓN</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                        <thead>
                            <tr style={{ background: '#1a2a4a', color: '#fff' }}>
                                <th style={{ border: '1px solid #999', padding: '4px 6px', textAlign: 'left' }}>Rx</th>
                                <th colSpan={5} style={{ border: '1px solid #999', padding: '4px 6px', textAlign: 'center' }}>OD</th>
                                <th colSpan={5} style={{ border: '1px solid #999', padding: '4px 6px', textAlign: 'center' }}>OI</th>
                            </tr>
                            <tr style={{ background: '#e8eef5' }}>
                                <th style={{ border: '1px solid #ccc', padding: '3px 6px' }}></th>
                                {['Esf', 'Cil', 'Eje', 'Add', 'AVL'].map(h => (
                                    <React.Fragment key={h}>
                                        <th style={{ border: '1px solid #ccc', padding: '3px 4px', textAlign: 'center', fontSize: '9px' }}>{h}</th>
                                    </React.Fragment>
                                ))}
                                {['Esf', 'Cil', 'Eje', 'Add', 'AVL'].map(h => (
                                    <th key={`oi-${h}`} style={{ border: '1px solid #ccc', padding: '3px 4px', textAlign: 'center', fontSize: '9px' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {c.rx_final_esfera_od && (
                                <tr>
                                    <td style={{ border: '1px solid #ccc', padding: '3px 6px', fontWeight: 'bold', background: '#f5f5f5' }}>Rx Final</td>
                                    {['rx_final_esfera', 'rx_final_cilindro', 'rx_final_eje', 'rx_final_add', 'avcc'].map(f => (
                                        <td key={f} style={{ border: '1px solid #ccc', padding: '3px 4px', textAlign: 'center' }}>{c[`${f}_od`] || ''}</td>
                                    ))}
                                    {['rx_final_esfera', 'rx_final_cilindro', 'rx_final_eje', 'rx_final_add', 'avcc'].map(f => (
                                        <td key={`oi-${f}`} style={{ border: '1px solid #ccc', padding: '3px 4px', textAlign: 'center' }}>{c[`${f}_oi`] || ''}</td>
                                    ))}
                                </tr>
                            )}
                            {c.vc_esfera_od && (
                                <tr>
                                    <td style={{ border: '1px solid #ccc', padding: '3px 6px', fontWeight: 'bold', background: '#f5f5f5' }}>Visión Cerca</td>
                                    {['vc_esfera', 'vc_cilindro', 'vc_eje', '', 'vc_av'].map(f => (
                                        <td key={f} style={{ border: '1px solid #ccc', padding: '3px 4px', textAlign: 'center' }}>{f ? (c[`${f}_od`] || '') : ''}</td>
                                    ))}
                                    {['vc_esfera', 'vc_cilindro', 'vc_eje', '', 'vc_av'].map(f => (
                                        <td key={`oi-${f}`} style={{ border: '1px solid #ccc', padding: '3px 4px', textAlign: 'center' }}>{f ? (c[`${f}_oi`] || '') : ''}</td>
                                    ))}
                                </tr>
                            )}
                            <tr>
                                <td style={{ border: '1px solid #ccc', padding: '3px 6px', fontWeight: 'bold', background: '#f5f5f5' }}>AV SC</td>
                                <td colSpan={5} style={{ border: '1px solid #ccc', padding: '3px 4px', textAlign: 'center' }}>{c.avsc_od || ''}</td>
                                <td colSpan={5} style={{ border: '1px solid #ccc', padding: '3px 4px', textAlign: 'center' }}>{c.avsc_oi || ''}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            {/* Diagnóstico */}
            {diagnoses.length > 0 && diagnoses.some(d => d.description) && (
                <div style={{ marginBottom: '14px' }}>
                    <h3 style={{ fontSize: '12px', fontWeight: 'bold', color: '#1a2a4a', borderBottom: '1px solid #ddd', paddingBottom: '4px', marginBottom: '8px' }}>DIAGNÓSTICO CLÍNICO</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                        <thead>
                            <tr style={{ background: '#e8eef5' }}>
                                <th style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'left', width: '60px' }}>Ojo</th>
                                <th style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'left', width: '80px' }}>Código</th>
                                <th style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'left' }}>Descripción</th>
                                <th style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'left' }}>Notas</th>
                            </tr>
                        </thead>
                        <tbody>
                            {diagnoses.filter(d => d.description).map((d, i) => (
                                <tr key={i}>
                                    <td style={{ border: '1px solid #ccc', padding: '3px 6px', textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase' }}>{d.eye}</td>
                                    <td style={{ border: '1px solid #ccc', padding: '3px 6px', fontFamily: 'monospace', fontSize: '9px' }}>{d.code}</td>
                                    <td style={{ border: '1px solid #ccc', padding: '3px 6px' }}>{d.description}</td>
                                    <td style={{ border: '1px solid #ccc', padding: '3px 6px', color: '#555' }}>{d.notes}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {c.diagnostico_adicional && (
                        <p style={{ marginTop: '6px', fontSize: '10px', color: '#555', padding: '6px', background: '#fffbf0', borderRadius: '4px', border: '1px solid #f0e0a0' }}>
                            <strong>Notas adicionales:</strong> {c.diagnostico_adicional}
                        </p>
                    )}
                </div>
            )}

            {/* Recomendación de lunas */}
            {(lensRec?.material || lensRec?.material_item) && (
                <div style={{ marginBottom: '14px' }}>
                    <h3 style={{ fontSize: '12px', fontWeight: 'bold', color: '#1a2a4a', borderBottom: '1px solid #ddd', paddingBottom: '4px', marginBottom: '8px' }}>RECOMENDACIÓN DE LUNAS</h3>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '10px' }}>
                        {lensRec.material && <span><strong>Material:</strong> {lensRec.material}</span>}
                        {lensRec.thickness && <span><strong>Espesor:</strong> {lensRec.thickness}</span>}
                        {lensRec.protection && <span><strong>Protección:</strong> {lensRec.protection}</span>}
                    </div>
                    {lensRec.observation && <p style={{ marginTop: '4px', fontSize: '10px', color: '#555' }}>{lensRec.observation}</p>}
                </div>
            )}

            {/* Recomendaciones médicas */}
            {recommendations.length > 0 && recommendations.some(r => r.text) && (
                <div style={{ marginBottom: '14px' }}>
                    <h3 style={{ fontSize: '12px', fontWeight: 'bold', color: '#1a2a4a', borderBottom: '1px solid #ddd', paddingBottom: '4px', marginBottom: '8px' }}>RECOMENDACIONES</h3>
                    <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '10px' }}>
                        {recommendations.filter(r => r.text).map((r, i) => (
                            <li key={i} style={{ marginBottom: '3px' }}>{r.text}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Observaciones */}
            {c.observaciones && (
                <div style={{ marginBottom: '14px' }}>
                    <h3 style={{ fontSize: '12px', fontWeight: 'bold', color: '#1a2a4a', borderBottom: '1px solid #ddd', paddingBottom: '4px', marginBottom: '6px' }}>OBSERVACIONES</h3>
                    <p style={{ fontSize: '10px', color: '#555', margin: 0 }}>{c.observaciones}</p>
                </div>
            )}

            {/* Firma */}
            <div style={{ marginTop: '30px', paddingTop: '16px', borderTop: '1px solid #ddd', display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ textAlign: 'center', minWidth: '200px' }}>
                    <div style={{ borderBottom: '1px solid #333', marginBottom: '4px', height: '40px' }}></div>
                    <p style={{ margin: 0, fontSize: '10px', fontWeight: 'bold' }}>{optometrist.name || ''}</p>
                    {c.doctor_license && <p style={{ margin: 0, fontSize: '9px', color: '#666' }}>Reg.: {c.doctor_license}</p>}
                    <p style={{ margin: '2px 0 0', fontSize: '9px', color: '#666' }}>Optómetra</p>
                </div>
            </div>

            <p style={{ marginTop: '16px', fontSize: '9px', color: '#999', textAlign: 'center' }}>
                Documento generado el {format(new Date(), "d 'de' MMMM yyyy", { locale: es })} · {settings.clinic_name}
            </p>
        </div>
    );
}

export default function CertificadoPdf({ data, onClose }) {
    const { settings, logoUrl } = useSettings();
    const contentRef = useRef(null);

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
        const content = document.getElementById('pdf-content');
        if (!content) return;
        try {
            const html2pdf = (await import('html2pdf.js')).default;
            html2pdf()
                .set({
                    margin: 10,
                    filename: `certificado_${data?.consultation?.numero_consulta || 'consulta'}.pdf`,
                    html2canvas: { scale: 2, useCORS: true },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                })
                .from(content)
                .save();
        } catch {
            handlePrint();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
            <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col max-h-[95vh]">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 shrink-0">
                    <h2 className="text-lg font-semibold text-gray-900">Vista previa del certificado</h2>
                    <div className="flex items-center gap-3">
                        <Button variant="secondary" size="sm" onClick={handleDownloadPdf}>
                            <Download size={16} /> Descargar PDF
                        </Button>
                        <Button size="sm" onClick={handlePrint}>
                            <Printer size={16} /> Imprimir
                        </Button>
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Preview */}
                <div className="flex-1 overflow-y-auto bg-gray-100 p-4">
                    <div className="shadow-lg">
                        <PdfContent data={data} settings={settings} logoUrl={logoUrl} />
                    </div>
                </div>
            </div>
        </div>
    );
}
