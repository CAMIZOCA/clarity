import React, { useRef } from 'react';
import { Printer, Download, X } from 'lucide-react';

const borderColor = '#555';

const sheetStyle = {
    width: '297mm',
    height: '210mm',
    background: '#fff',
    color: '#111',
    boxSizing: 'border-box',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '6mm',
    padding: '9mm 5mm 5mm',
    position: 'relative',
    fontFamily: 'Arial, sans-serif',
};

const copyStyle = {
    minWidth: 0,
    overflow: 'hidden',
    boxSizing: 'border-box',
    fontSize: 8.5,
    lineHeight: 1.2,
};

const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
};

const cellBase = {
    border: `0.7px solid ${borderColor}`,
    padding: '1.5px 2.5px',
    verticalAlign: 'middle',
    height: 17,
    boxSizing: 'border-box',
    overflow: 'hidden',
};

const headerCellBase = {
    ...cellBase,
    fontSize: 7.4,
    fontWeight: 'bold',
    background: '#f3f3f3',
};

const CB = ({ checked }) => (
    <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 10,
        height: 10,
        border: `0.7px solid ${borderColor}`,
        marginRight: 2,
        verticalAlign: 'middle',
        background: '#fff',
        flexShrink: 0,
        fontSize: 7,
        fontWeight: 'bold',
        lineHeight: '10px',
    }}>
        {checked ? 'X' : ''}
    </span>
);

const CBLabel = ({ checked, label }) => (
    <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        marginRight: 4,
        whiteSpace: 'nowrap',
        fontSize: 7.4,
    }}>
        <CB checked={checked} />
        {label}
    </span>
);

const Cell = ({ children, style = {}, colSpan }) => (
    <td colSpan={colSpan} style={{ ...cellBase, fontSize: 8, ...style }}>
        {children}
    </td>
);

const HCell = ({ children, style = {}, colSpan }) => (
    <td colSpan={colSpan} style={{ ...headerCellBase, ...style }}>
        {children}
    </td>
);

function LineField({ label, value, minLabelWidth = 34 }) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            width: '100%',
            minHeight: 14,
            marginBottom: 2,
        }}>
            <span style={{
                fontSize: 8,
                fontWeight: 'bold',
                marginRight: 3,
                whiteSpace: 'nowrap',
                minWidth: minLabelWidth,
            }}>
                {label}:
            </span>
            <span style={{
                flex: 1,
                borderBottom: `0.7px solid ${borderColor}`,
                minWidth: 20,
                minHeight: 12,
                fontSize: 8.2,
                paddingLeft: 2,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
            }}>
                {value || ''}
            </span>
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

function formatMoney(value) {
    return value ? `$ ${value}` : '';
}

function SpecsTable({ specs }) {
    const sp = specs || {};

    return (
        <table style={{ ...tableStyle, marginBottom: 4 }}>
            <colgroup>
                <col style={{ width: '15%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '17%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '17%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '7%' }} />
            </colgroup>
            <tbody>
                <tr>
                    <HCell>CRISTAL</HCell>
                    <Cell><CB checked={sp.cristal} /></Cell>
                    <HCell>BLANCO</HCell>
                    <Cell><CB checked={sp.blanco} /></Cell>
                    <HCell>ANTIRREFLEJO</HCell>
                    <Cell><CB checked={sp.antirreflejo} /></Cell>
                    <HCell>LUZ AZUL</HCell>
                    <Cell><CB checked={sp.luz_azul} /></Cell>
                </tr>
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
                <tr>
                    <HCell>POLY</HCell>
                    <Cell><CB checked={sp.poly} /></Cell>
                    <Cell colSpan={2}>
                        <CBLabel checked={sp.trans} label="TRANS." />
                        <CBLabel checked={sp.colorm} label="COLORM." />
                        <CBLabel checked={sp.fotoc} label="FOTOC." />
                    </Cell>
                    <HCell>OPTIFOG</HCell>
                    <Cell><CB checked={sp.optifog} /></Cell>
                    <HCell>ANTIRRAYAS</HCell>
                    <Cell><CB checked={sp.antirrayas} /></Cell>
                </tr>
                <tr>
                    <HCell>PHOENIX</HCell>
                    <Cell><CB checked={sp.phoenix} /></Cell>
                    <Cell colSpan={2}>
                        <CBLabel checked={sp.gris} label="GRIS" />
                        <CBLabel checked={sp.cafe} label="CAFE" />
                        <CBLabel checked={sp.verde} label="VERDE" />
                    </Cell>
                    <HCell>HIDROF.</HCell>
                    <Cell><CB checked={sp.hidrof} /></Cell>
                    <HCell>DURALEN</HCell>
                    <Cell><CB checked={sp.duralen} /></Cell>
                </tr>
                <tr>
                    <HCell>MONOFOCAL</HCell>
                    <Cell><CB checked={sp.monofocal} /></Cell>
                    <HCell>BIFOCAL</HCell>
                    <Cell><CB checked={sp.bifocal} /></Cell>
                    <HCell>PROGRESIVOS</HCell>
                    <Cell><CB checked={sp.progresivos} /></Cell>
                    <Cell colSpan={2}></Cell>
                </tr>
                <tr>
                    <Cell colSpan={2}></Cell>
                    <Cell colSpan={2}>
                        <CBLabel checked={sp.invisible} label="INVISIBLE" />
                        <CBLabel checked={sp.flapptop} label="FLAPPTOP" />
                    </Cell>
                    <Cell colSpan={4}>
                        <CBLabel checked={sp.conv} label="CONV" />
                        <CBLabel checked={sp.dig} label="DIG." />
                    </Cell>
                </tr>
                <tr>
                    <HCell colSpan={2}>GAFAS</HCell>
                    <Cell><CB checked={sp.gafas} /></Cell>
                    <HCell colSpan={2}>OCUPACIONAL</HCell>
                    <Cell><CB checked={sp.ocupacional} /></Cell>
                    <Cell colSpan={2}></Cell>
                </tr>
                <tr>
                    <Cell colSpan={4}>
                        <CBLabel checked={sp.color_uv} label="COLOR+UV" />
                        <CBLabel checked={sp.polarizado} label="POLARIZADO" />
                        <CBLabel checked={sp.espejados} label="ESPEJADOS" />
                    </Cell>
                    <Cell colSpan={4}>
                        <CBLabel checked={sp.comp_w} label="COMP & W" />
                        <CBLabel checked={sp.tac40} label="TAC40ITAC60" />
                    </Cell>
                </tr>
                <tr>
                    <HCell>INDICE</HCell>
                    <Cell colSpan={7}>
                        <CBLabel checked={sp.n149} label="N 1.49" />
                        <CBLabel checked={sp.n156} label="N 1.56" />
                        <CBLabel checked={sp.n161} label="N 1.61" />
                        <CBLabel checked={sp.n167} label="N 1.67" />
                        <CBLabel checked={sp.n174} label="N 1.74" />
                    </Cell>
                </tr>
            </tbody>
        </table>
    );
}

function OrderCopy({ label, orden, paciente, consulta, settings }) {
    const rxOD = formatRx(consulta?.rx_final_esfera_od, consulta?.rx_final_cilindro_od, consulta?.rx_final_eje_od);
    const rxOI = formatRx(consulta?.rx_final_esfera_oi, consulta?.rx_final_cilindro_oi, consulta?.rx_final_eje_oi);
    const addOD = consulta?.rx_final_add_od ? `+${parseFloat(consulta.rx_final_add_od).toFixed(2)}` : '';
    const addOI = consulta?.rx_final_add_oi ? `+${parseFloat(consulta.rx_final_add_oi).toFixed(2)}` : '';
    const dnp = [consulta?.rx_final_dnp_od, consulta?.rx_final_dnp_oi].filter(Boolean).join('/') || orden.dnp || '';
    const clinicName = settings?.clinic_name || 'Sistema Clinico Optometria';

    return (
        <section style={copyStyle}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 6,
                marginBottom: 5,
            }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                        fontWeight: 'bold',
                        fontSize: 13,
                        color: '#1a2a4a',
                        lineHeight: '18px',
                        minHeight: 18,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}>
                        {clinicName}
                    </div>
                    {settings?.clinic_address && <div style={{ fontSize: 7.5, color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{settings.clinic_address}</div>}
                    {settings?.clinic_phone && <div style={{ fontSize: 7.5, color: '#555' }}>Tel: {settings.clinic_phone}</div>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 'bold', color: '#c0392b', letterSpacing: 1.2 }}>
                        {String(orden.numero || '').padStart(7, '0')}
                    </div>
                    <div style={{ fontSize: 9.5, fontWeight: 'bold', letterSpacing: 0.7 }}>ORDEN DE TRABAJO</div>
                    <div style={{ fontSize: 7.8, fontWeight: 'bold', color: '#555', marginTop: 1 }}>{label}</div>
                </div>
            </div>

            <div style={{ marginBottom: 4 }}>
                <LineField label="FECHA" value={orden.fecha} />
                <LineField label="CLIENTE" value={paciente?.nombre || orden.cliente} />
                <LineField label="TELF./CEL." value={paciente?.telefono || orden.telefono} />
            </div>

            <table style={{ ...tableStyle, marginBottom: 4 }}>
                <colgroup>
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '43%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '13%' }} />
                </colgroup>
                <tbody>
                    <tr>
                        <HCell>O.D.</HCell>
                        <Cell>{orden.rx_od || rxOD}</Cell>
                        <HCell>ADD.:</HCell>
                        <Cell>{orden.add_od || addOD}</Cell>
                        <HCell>AV C.C.</HCell>
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

            <SpecsTable specs={orden.specs} />

            <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 3 }}>
                <span style={{ fontSize: 8, fontWeight: 'bold', marginRight: 3, whiteSpace: 'nowrap' }}>OTRO/ESPECIF.:</span>
                <span style={{
                    flex: 1,
                    borderBottom: `0.7px solid ${borderColor}`,
                    fontSize: 8.2,
                    minHeight: 12,
                    paddingLeft: 2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                }}>
                    {orden.especif || ''}
                </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 34mm', gap: 5 }}>
                <div style={{ minWidth: 0 }}>
                    <LineField label="LAB" value={orden.lab} />
                    <LineField label="ALT." value={orden.alt} />
                    <LineField label="D.P." value={orden.dnp || dnp} />
                    <LineField label="ARMAZON" value={orden.armazon} />
                    <LineField label="DR." value={orden.dr || consulta?.optometrista?.name} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                        <LineField label="FAC." value={orden.fac} minLabelWidth={20} />
                        <LineField label="R.C." value={orden.rc} minLabelWidth={20} />
                    </div>
                    <LineField label="ENTREGA" value={orden.entrega} />
                    <div style={{ marginTop: 2 }}>
                        <div style={{ fontSize: 8, fontWeight: 'bold' }}>NOTA:</div>
                        <div style={{
                            borderBottom: `0.7px solid ${borderColor}`,
                            minHeight: 16,
                            fontSize: 8.2,
                            paddingLeft: 2,
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                        }}>
                            {orden.nota}
                        </div>
                        <div style={{ borderBottom: `0.7px solid ${borderColor}`, minHeight: 11, marginTop: 1 }}></div>
                    </div>
                </div>
                <div style={{ border: `0.7px solid ${borderColor}`, padding: 4, minWidth: 0 }}>
                    <LineField label="VALOR" value={formatMoney(orden.valor)} minLabelWidth={28} />
                    <LineField label="ABONO" value={formatMoney(orden.abono)} minLabelWidth={28} />
                    <LineField label="SALDO" value={formatMoney(orden.saldo)} minLabelWidth={28} />
                    <div style={{ marginTop: 3 }}>
                        <div style={{ fontSize: 8, fontWeight: 'bold' }}>Forma de Pago:</div>
                        <div style={{
                            borderBottom: `0.7px solid ${borderColor}`,
                            minHeight: 14,
                            fontSize: 8.2,
                            paddingLeft: 2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}>
                            {orden.forma_pago}
                        </div>
                    </div>
                </div>
            </div>

            <div style={{
                marginTop: 8,
                borderTop: '0.7px solid #ccc',
                paddingTop: 5,
                textAlign: 'right',
                fontSize: 7.5,
                color: '#555',
            }}>
                <div style={{
                    display: 'inline-block',
                    borderTop: `0.7px solid ${borderColor}`,
                    paddingTop: 2,
                    minWidth: 90,
                }}>
                    Firma / Responsable
                </div>
            </div>
        </section>
    );
}

function PrintSheet({ orden, paciente, consulta, settings }) {
    return (
        <div id="orden-trabajo-pdf-sheet" style={sheetStyle}>
            <div style={{
                position: 'absolute',
                top: '9mm',
                bottom: '5mm',
                left: '50%',
                width: 0,
                borderLeft: `0.8px solid ${borderColor}`,
                transform: 'translateX(-0.4px)',
            }} />
            <OrderCopy label="ORIGINAL" orden={orden} paciente={paciente} consulta={consulta} settings={settings} />
            <OrderCopy label="COPIA" orden={orden} paciente={paciente} consulta={consulta} settings={settings} />
        </div>
    );
}

export default function OrdenTrabajoPdf({ orden, paciente, consulta, settings, onClose }) {
    const contentRef = useRef(null);

    const handlePrint = () => {
        const content = document.getElementById('orden-trabajo-pdf-sheet');
        if (!content) return;
        const win = window.open('', '_blank', 'width=1200,height=850');
        win.document.write(`
            <html>
                <head>
                    <title>Orden de Trabajo</title>
                    <style>
                        @page { size: A4 landscape; margin: 0; }
                        html, body { margin: 0; padding: 0; background: #fff; }
                        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    </style>
                </head>
                <body>${content.outerHTML}</body>
            </html>
        `);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 400);
    };

    const handleDownload = async () => {
        const html2pdf = (await import('html2pdf.js')).default;
        const el = document.getElementById('orden-trabajo-pdf-sheet');
        html2pdf().set({
            margin: 0,
            filename: `orden-trabajo-${paciente?.nombre?.replace(/\s+/g, '-') || 'orden'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                windowWidth: el?.scrollWidth || 1123,
                windowHeight: el?.scrollHeight || 794,
                onclone: (clonedDoc) => {
                    clonedDoc.querySelectorAll('style, link[rel="stylesheet"]')
                        .forEach((node) => node.remove());
                },
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
        }).from(el).save();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl mt-4 mb-4">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h2 className="text-lg font-bold text-gray-800">Vista Previa - Orden de Trabajo</h2>
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
                <div ref={contentRef} className="overflow-auto bg-gray-100 p-4">
                    <div className="mx-auto w-max bg-white shadow">
                        <PrintSheet orden={orden} paciente={paciente} consulta={consulta} settings={settings} />
                    </div>
                </div>
            </div>
        </div>
    );
}
