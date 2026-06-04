import React, { useRef } from 'react';
import { Printer, Download, X } from 'lucide-react';

const CB = ({ checked }) => (
    <span style={{
        display: 'inline-block', width: 12, height: 12,
        border: '1px solid #555', marginRight: 3, verticalAlign: 'middle',
        background: checked ? '#222' : '#fff', flexShrink: 0,
        position: 'relative',
    }}>
        {checked && <span style={{ position: 'absolute', top: -1, left: 1, fontSize: 11, lineHeight: '12px', color: '#fff', fontWeight: 'bold' }}>✓</span>}
    </span>
);

const CBLabel = ({ checked, label, style = {} }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: 4, whiteSpace: 'nowrap', ...style }}>
        <CB checked={checked} /> <span style={{ fontSize: 9 }}>{label}</span>
    </span>
);

const Cell = ({ children, style = {}, colSpan, rowSpan }) => (
    <td colSpan={colSpan} rowSpan={rowSpan} style={{
        border: '1px solid #555', padding: '2px 4px',
        fontSize: 9, verticalAlign: 'middle', ...style
    }}>
        {children}
    </td>
);

const HCell = ({ children, style = {}, colSpan }) => (
    <td colSpan={colSpan} style={{
        border: '1px solid #555', padding: '2px 4px',
        fontSize: 8, fontWeight: 'bold', background: '#f0f0f0',
        verticalAlign: 'middle', ...style
    }}>
        {children}
    </td>
);

function LineField({ label, value, width = '100%' }) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 4, width }}>
            <span style={{ fontSize: 9, fontWeight: 'bold', marginRight: 4, whiteSpace: 'nowrap', minWidth: 0 }}>{label}:</span>
            <span style={{ flex: 1, borderBottom: '1px solid #555', minWidth: 30, fontSize: 10, paddingLeft: 2 }}>{value || ''}</span>
        </div>
    );
}

function formatRx(esfera, cilindro, eje) {
    const parts = [];
    if (esfera != null && esfera !== '') parts.push(parseFloat(esfera) >= 0 ? `+${parseFloat(esfera).toFixed(2)}` : parseFloat(esfera).toFixed(2));
    if (cilindro != null && cilindro !== '') parts.push(parseFloat(cilindro) >= 0 ? `+${parseFloat(cilindro).toFixed(2)}` : parseFloat(cilindro).toFixed(2));
    if (eje != null && eje !== '') parts.push(`x${eje}°`);
    return parts.join(' ') || '';
}

function PrintContent({ orden, paciente, consulta, settings }) {
    const sp = orden.specs || {};

    const rxOD = formatRx(consulta?.rx_final_esfera_od, consulta?.rx_final_cilindro_od, consulta?.rx_final_eje_od);
    const rxOI = formatRx(consulta?.rx_final_esfera_oi, consulta?.rx_final_cilindro_oi, consulta?.rx_final_eje_oi);
    const addOD = consulta?.rx_final_add_od ? `+${parseFloat(consulta.rx_final_add_od).toFixed(2)}` : '';
    const addOI = consulta?.rx_final_add_oi ? `+${parseFloat(consulta.rx_final_add_oi).toFixed(2)}` : '';

    const dnp = [consulta?.rx_final_dnp_od, consulta?.rx_final_dnp_oi].filter(Boolean).join('/') || orden.dnp || '';

    const clinicName = settings?.clinic_name || 'Sistema Clínico Optometría';

    return (
        <div id="orden-trabajo-content" style={{
            fontFamily: 'Arial, sans-serif', fontSize: 10, color: '#111',
            background: '#fff', padding: '12px 16px', maxWidth: 680,
            margin: '0 auto', boxSizing: 'border-box',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                    <div style={{ fontWeight: 'bold', fontSize: 18, color: '#1a2a4a' }}>{clinicName}</div>
                    {settings?.clinic_address && <div style={{ fontSize: 9, color: '#555' }}>{settings.clinic_address}</div>}
                    {settings?.clinic_phone && <div style={{ fontSize: 9, color: '#555' }}>Tel: {settings.clinic_phone}</div>}
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 'bold', color: '#c0392b', letterSpacing: 2 }}>
                        {String(orden.numero || '').padStart(7, '0')}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 'bold', letterSpacing: 1 }}>ORDEN DE TRABAJO</div>
                </div>
            </div>

            {/* Fecha + Datos paciente */}
            <div style={{ marginBottom: 6 }}>
                <LineField label="FECHA" value={orden.fecha} />
                <LineField label="CLIENTE" value={paciente?.nombre || orden.cliente} />
                <LineField label="TELF./CEL." value={paciente?.telefono || orden.telefono} />
            </div>

            {/* RX */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 6 }}>
                <tbody>
                    <tr>
                        <HCell style={{ width: 30 }}>O.D.</HCell>
                        <Cell style={{ width: '40%' }}>{orden.rx_od || rxOD}</Cell>
                        <HCell style={{ width: 35 }}>ADD.:</HCell>
                        <Cell>{orden.add_od || addOD}</Cell>
                        <HCell style={{ width: 40 }}>AV C.C.</HCell>
                        <Cell>{orden.avcc_od || consulta?.avcc_od || ''}</Cell>
                    </tr>
                    <tr>
                        <HCell>O.I.</HCell>
                        <Cell>{orden.rx_oi || rxOI}</Cell>
                        <HCell>ADD.:</HCell>
                        <Cell>{orden.add_oi || addOI}</Cell>
                        <HCell>AV C.C.</HCell>
                        <Cell>{orden.avcc_oi || consulta?.avcc_oi || ''}</Cell>
                    </tr>
                </tbody>
            </table>

            {/* Especificaciones de lentes */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 6 }}>
                <tbody>
                    {/* Fila 1: CRISTAL / BLANCO / ANTIRREFLEJO / LUZ AZUL */}
                    <tr>
                        <HCell style={{ width: 60 }}>CRISTAL</HCell>
                        <Cell><CB checked={sp.cristal} /></Cell>
                        <HCell style={{ width: 80 }}>BLANCO</HCell>
                        <Cell><CB checked={sp.blanco} /></Cell>
                        <HCell style={{ width: 70 }}>ANTIRREFLEJO</HCell>
                        <Cell><CB checked={sp.antirreflejo} /></Cell>
                        <HCell style={{ width: 50 }}>LUZ AZUL</HCell>
                        <Cell><CB checked={sp.luz_azul} /></Cell>
                    </tr>
                    {/* Fila 2: CR39 / FOTOCROMATICO / DELUXE / UV */}
                    <tr>
                        <HCell>CR 39</HCell>
                        <Cell><CB checked={sp.cr39} /></Cell>
                        <HCell>FOTOCROMATICO</HCell>
                        <Cell><CB checked={sp.fotocromático} /></Cell>
                        <HCell>DELUXE</HCell>
                        <Cell><CB checked={sp.deluxe} /></Cell>
                        <HCell>UV</HCell>
                        <Cell><CB checked={sp.uv} /></Cell>
                    </tr>
                    {/* Fila 3: POLY / TRANS/COLORM/FOTOC / OPTIFOG / ANTIRRAYAS */}
                    <tr>
                        <HCell>POLY</HCell>
                        <Cell><CB checked={sp.poly} /></Cell>
                        <Cell colSpan={1} style={{ border: '1px solid #555', padding: '2px 4px', fontSize: 9 }}>
                            <CBLabel checked={sp.trans} label="TRANS." />
                            <CBLabel checked={sp.colorm} label="COLORM." />
                            <CBLabel checked={sp.fotoc} label="FOTOC." />
                        </Cell>
                        <HCell>OPTIFOG</HCell>
                        <Cell><CB checked={sp.optifog} /></Cell>
                        <HCell>ANTIRRAYAS</HCell>
                        <Cell><CB checked={sp.antirrayas} /></Cell>
                    </tr>
                    {/* Fila 4: PHOENIX / GRIS/CAFE/VERDE / HIDROF / DURALEN */}
                    <tr>
                        <HCell>PHOENIX</HCell>
                        <Cell><CB checked={sp.phoenix} /></Cell>
                        <Cell colSpan={1} style={{ border: '1px solid #555', padding: '2px 4px', fontSize: 9 }}>
                            <CBLabel checked={sp.gris} label="GRIS" />
                            <CBLabel checked={sp.cafe} label="CAFÉ" />
                            <CBLabel checked={sp.verde} label="VERDE" />
                        </Cell>
                        <HCell>HIDROF.</HCell>
                        <Cell><CB checked={sp.hidrof} /></Cell>
                        <HCell>DURALEN</HCell>
                        <Cell><CB checked={sp.duralen} /></Cell>
                    </tr>
                    {/* Fila 5: MONOFOCAL / BIFOCAL / PROGRESIVOS */}
                    <tr>
                        <HCell>MONOFOCAL</HCell>
                        <Cell><CB checked={sp.monofocal} /></Cell>
                        <HCell colSpan={1}>BIFOCAL</HCell>
                        <Cell><CB checked={sp.bifocal} /></Cell>
                        <HCell colSpan={1}>PROGRESIVOS</HCell>
                        <Cell colSpan={2}><CB checked={sp.progresivos} /></Cell>
                    </tr>
                    {/* Fila 6: (vacío) / INVISIBLE/FLAPPTOP / CONV/DIG */}
                    <tr>
                        <Cell colSpan={2} style={{ border: '1px solid #555' }}></Cell>
                        <Cell colSpan={2} style={{ border: '1px solid #555', fontSize: 9 }}>
                            <CBLabel checked={sp.invisible} label="INVISIBLE" />
                            <CBLabel checked={sp.flapptop} label="FLAPPTOP" />
                        </Cell>
                        <Cell colSpan={3} style={{ border: '1px solid #555', fontSize: 9 }}>
                            <CBLabel checked={sp.conv} label="CONV" />
                            <CBLabel checked={sp.dig} label="DIG." />
                        </Cell>
                    </tr>
                    {/* Fila 7: GAFAS / OCUPACIONAL */}
                    <tr>
                        <HCell colSpan={2}>GAFAS</HCell>
                        <Cell><CB checked={sp.gafas} /></Cell>
                        <HCell colSpan={2}>OCUPACIONAL</HCell>
                        <Cell colSpan={2}><CB checked={sp.ocupacional} /></Cell>
                    </tr>
                    {/* Fila 8: Gafas sub / Ocupacional sub */}
                    <tr>
                        <Cell colSpan={3} style={{ border: '1px solid #555', fontSize: 9 }}>
                            <CBLabel checked={sp.color_uv} label="COLOR+UV" />
                            <CBLabel checked={sp.polarizado} label="POLARIZADO" />
                            <CBLabel checked={sp.espejados} label="ESPEJADOS" />
                        </Cell>
                        <Cell colSpan={4} style={{ border: '1px solid #555', fontSize: 9 }}>
                            <CBLabel checked={sp.comp_w} label="COMP & W" />
                            <CBLabel checked={sp.tac40} label="TAC40ITAC60" />
                        </Cell>
                    </tr>
                    {/* Fila 9: ÍNDICE */}
                    <tr>
                        <HCell>ÍNDICE</HCell>
                        <Cell style={{ fontSize: 9 }}><CBLabel checked={sp.n149} label="N 1.49" /></Cell>
                        <Cell style={{ fontSize: 9 }}><CBLabel checked={sp.n156} label="N 1.56" /></Cell>
                        <Cell style={{ fontSize: 9 }}><CBLabel checked={sp.n161} label="N 1.61" /></Cell>
                        <Cell style={{ fontSize: 9 }}><CBLabel checked={sp.n167} label="N 1.67" /></Cell>
                        <Cell colSpan={2} style={{ fontSize: 9 }}><CBLabel checked={sp.n174} label="N 1.74" /></Cell>
                    </tr>
                </tbody>
            </table>

            {/* OTRO/ESPECIF */}
            <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 'bold', marginRight: 4, whiteSpace: 'nowrap' }}>OTRO/ESPECIF.:</span>
                <span style={{ flex: 1, borderBottom: '1px solid #555', fontSize: 10, paddingLeft: 2 }}>{orden.especif || ''}</span>
            </div>

            {/* Sección inferior: lab + financiero */}
            <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                    <LineField label="LAB" value={orden.lab} />
                    <LineField label="ALT." value={orden.alt} />
                    <LineField label="D.P." value={orden.dnp || dnp} />
                    <LineField label="ARMAZÓN" value={orden.armazon} />
                    <LineField label="DR." value={orden.dr || consulta?.optometrista?.name} />
                    <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1 }}><LineField label="FAC." value={orden.fac} /></div>
                        <div style={{ flex: 1 }}><LineField label="R.C." value={orden.rc} /></div>
                    </div>
                    <LineField label="ENTREGA" value={orden.entrega} />
                    <div style={{ marginTop: 4 }}>
                        <div style={{ fontSize: 9, fontWeight: 'bold' }}>NOTA:</div>
                        <div style={{ borderBottom: '1px solid #555', minHeight: 16, fontSize: 10, paddingLeft: 2 }}>{orden.nota}</div>
                        <div style={{ borderBottom: '1px solid #555', minHeight: 16, marginTop: 2 }}></div>
                    </div>
                </div>
                <div style={{ width: 160, border: '1px solid #555', padding: 6 }}>
                    <LineField label="VALOR" value={orden.valor ? `$ ${orden.valor}` : ''} />
                    <LineField label="ABONO" value={orden.abono ? `$ ${orden.abono}` : ''} />
                    <LineField label="SALDO" value={orden.saldo ? `$ ${orden.saldo}` : ''} />
                    <div style={{ marginTop: 6 }}>
                        <div style={{ fontSize: 9, fontWeight: 'bold' }}>Forma de Pago:</div>
                        <div style={{ borderBottom: '1px solid #555', minHeight: 14, fontSize: 10, paddingLeft: 2 }}>{orden.forma_pago}</div>
                    </div>
                </div>
            </div>

            {/* Firma */}
            <div style={{ marginTop: 16, borderTop: '1px solid #ccc', paddingTop: 8, textAlign: 'right', fontSize: 9, color: '#555' }}>
                <div style={{ display: 'inline-block', borderTop: '1px solid #555', paddingTop: 2, minWidth: 160 }}>
                    Firma / Responsable
                </div>
            </div>
        </div>
    );
}

export default function OrdenTrabajoPdf({ orden, paciente, consulta, settings, onClose }) {
    const contentRef = useRef(null);

    const handlePrint = () => {
        const content = document.getElementById('orden-trabajo-content');
        if (!content) return;
        const win = window.open('', '_blank', 'width=800,height=900');
        win.document.write(`
            <html><head><title>Orden de Trabajo</title>
            <style>
                body { margin: 0; padding: 0; }
                @media print { body { margin: 0; } }
            </style>
            </head><body>${content.outerHTML}</body></html>
        `);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 400);
    };

    const handleDownload = async () => {
        const html2pdf = (await import('html2pdf.js')).default;
        const el = document.getElementById('orden-trabajo-content');
        html2pdf().set({
            margin: 6,
            filename: `orden-trabajo-${paciente?.nombre?.replace(/\s+/g, '-') || 'orden'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                // Tailwind CSS 4 usa oklch() que html2canvas no soporta;
                // el contenido usa solo estilos inline, así que eliminar
                // los stylesheets del clon es seguro.
                onclone: (clonedDoc) => {
                    clonedDoc.querySelectorAll('style, link[rel="stylesheet"]')
                        .forEach(el => el.remove());
                },
            },
            jsPDF: { unit: 'mm', format: 'a5', orientation: 'portrait' },
        }).from(el).save();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mt-4 mb-4">
                {/* Toolbar */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h2 className="text-lg font-bold text-gray-800">Vista Previa — Orden de Trabajo</h2>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-2 px-4 py-2 bg-[#1a2a4a] text-white rounded-lg hover:bg-[#243a6a] transition-colors text-sm font-medium"
                        >
                            <Download size={16} /> Descargar PDF
                        </button>
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                        >
                            <Printer size={16} /> Imprimir
                        </button>
                        <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-800 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>
                {/* Content */}
                <div ref={contentRef} className="p-4 bg-gray-50">
                    <div className="bg-white shadow rounded p-2">
                        <PrintContent orden={orden} paciente={paciente} consulta={consulta} settings={settings} />
                    </div>
                </div>
            </div>
        </div>
    );
}
