import React from 'react';
import { Printer, Download, X } from 'lucide-react';

/**
 * Recibo (nota de venta) que se entrega al cliente para retirar su pedido.
 *
 * Antes se llenaba a mano al final de la atencion. Sale de la misma pantalla
 * de la orden de trabajo y lleva su mismo numero, para que cliente,
 * laboratorio y optica hablen del mismo pedido. No es una venta del POS ni una
 * factura: no tiene valor tributario y no toca ventas, inventario ni Contifico.
 *
 * Misma hoja A4 horizontal que `OrdenTrabajoPdf`: mitad CLIENTE y mitad OPTICA
 * (el talon que se coteja al retirar).
 */

const SHEET_ID = 'recibo-pdf-sheet';
const borderColor = '#555';

const sheetStyle = {
    width: '297mm',
    height: '210mm',
    background: '#fff',
    color: '#111',
    boxSizing: 'border-box',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10mm',
    padding: '10mm 8mm 8mm',
    position: 'relative',
    fontFamily: 'Arial, sans-serif',
};

const copyStyle = {
    minWidth: 0,
    overflow: 'hidden',
    boxSizing: 'border-box',
    fontSize: 10,
    lineHeight: 1.35,
    display: 'flex',
    flexDirection: 'column',
};

function money(value) {
    if (value === '' || value == null) return '';
    const number = Number(value);
    return Number.isFinite(number) ? `$ ${number.toFixed(2)}` : `$ ${value}`;
}

function LineField({ label, value, minLabelWidth = 62 }) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', minHeight: 20, marginBottom: 4 }}>
            <span style={{ fontSize: 9.5, fontWeight: 'bold', marginRight: 4, whiteSpace: 'nowrap', minWidth: minLabelWidth }}>
                {label}:
            </span>
            <span style={{
                flex: 1,
                borderBottom: `0.7px solid ${borderColor}`,
                minHeight: 15,
                fontSize: 10,
                paddingLeft: 3,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
            }}>
                {value || ''}
            </span>
        </div>
    );
}

function AmountRow({ label, value, strong = false }) {
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '4px 6px',
            borderBottom: `0.7px solid ${borderColor}`,
            fontWeight: strong ? 'bold' : 'normal',
            fontSize: strong ? 11 : 10,
        }}>
            <span>{label}</span>
            <span>{money(value)}</span>
        </div>
    );
}

function ReceiptCopy({ label, orden, paciente, detalle, settings }) {
    const clinicName = settings?.clinic_name || 'Sistema Clinico Optometria';
    const lines = String(detalle || '').split('\n').map((line) => line.trim()).filter(Boolean);
    // Renglones vacios hasta completar la tabla, como en el talonario impreso.
    const rows = [...lines, ...Array(Math.max(0, 6 - lines.length)).fill('')];

    return (
        <section style={copyStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: 15, color: '#1a2a4a', lineHeight: '21px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {clinicName}
                    </div>
                    {settings?.clinic_address && <div style={{ fontSize: 8.5, color: '#555' }}>{settings.clinic_address}</div>}
                    {settings?.clinic_phone && <div style={{ fontSize: 8.5, color: '#555' }}>Tel: {settings.clinic_phone}</div>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 0.7 }}>RECIBO</div>
                    <div style={{ fontSize: 17, fontWeight: 'bold', color: '#c0392b', letterSpacing: 1.3 }}>
                        N.º {String(orden.numero || '').padStart(7, '0')}
                    </div>
                    <div style={{ fontSize: 8.8, fontWeight: 'bold', color: '#555', marginTop: 2 }}>{label}</div>
                </div>
            </div>

            <div style={{ marginBottom: 8 }}>
                <LineField label="FECHA" value={orden.fecha} />
                <LineField label="CLIENTE" value={paciente?.nombre_completo || paciente?.nombre || orden.cliente} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <LineField label="CÉDULA" value={paciente?.cedula} minLabelWidth={44} />
                    <LineField label="TELF." value={paciente?.telefono || orden.telefono} minLabelWidth={34} />
                </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', marginBottom: 8 }}>
                <thead>
                    <tr>
                        <th style={{ border: `0.7px solid ${borderColor}`, background: '#f3f3f3', fontSize: 9, textAlign: 'left', padding: '3px 6px' }}>
                            DETALLE
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((line, index) => (
                        <tr key={index}>
                            <td style={{ border: `0.7px solid ${borderColor}`, height: 21, padding: '2px 6px', fontSize: 10, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                {line}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 52mm', gap: 10, alignItems: 'start' }}>
                <div style={{ minWidth: 0 }}>
                    <LineField label="ENTREGA" value={orden.entrega} />
                    <LineField label="FORMA DE PAGO" value={orden.forma_pago} minLabelWidth={86} />
                </div>
                <div style={{ border: `0.7px solid ${borderColor}` }}>
                    <AmountRow label="VALOR" value={orden.valor} />
                    <AmountRow label="ABONO" value={orden.abono} />
                    <AmountRow label="SALDO" value={orden.saldo} strong />
                </div>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: 10 }}>
                <p style={{ fontSize: 8.6, color: '#333', margin: '0 0 14px' }}>
                    Documento sin valor tributario. Presente este recibo para retirar su pedido.
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8.5, color: '#555' }}>
                    <span style={{ borderTop: `0.7px solid ${borderColor}`, paddingTop: 3, minWidth: 120, textAlign: 'center' }}>Recibí conforme</span>
                    <span style={{ borderTop: `0.7px solid ${borderColor}`, paddingTop: 3, minWidth: 120, textAlign: 'center' }}>Óptica</span>
                </div>
            </div>
        </section>
    );
}

function PrintSheet(props) {
    return (
        <div id={SHEET_ID} style={sheetStyle}>
            <div style={{
                position: 'absolute',
                top: '10mm',
                bottom: '8mm',
                left: '50%',
                width: 0,
                borderLeft: `0.8px dashed ${borderColor}`,
            }} />
            <ReceiptCopy label="CLIENTE" {...props} />
            <ReceiptCopy label="ÓPTICA" {...props} />
        </div>
    );
}

export default function ReciboPdf({ orden, paciente, detalle, settings, onClose }) {
    const handlePrint = () => {
        const content = document.getElementById(SHEET_ID);
        if (!content) return;
        const win = window.open('', '_blank', 'width=1200,height=850');
        win.document.write(`
            <html>
                <head>
                    <title>Recibo</title>
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
        const el = document.getElementById(SHEET_ID);
        html2pdf().set({
            margin: 0,
            filename: `recibo-${orden.numero || ''}-${(paciente?.nombre_completo || paciente?.nombre || 'cliente').replace(/\s+/g, '-')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                windowWidth: el?.scrollWidth || 1123,
                windowHeight: el?.scrollHeight || 794,
                onclone: (clonedDoc) => {
                    clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => node.remove());
                },
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
        }).from(el).save();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
            <div className="mt-4 mb-4 w-full max-w-7xl rounded-2xl bg-white shadow-2xl">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
                    <h2 className="text-lg font-bold text-gray-800">Vista Previa - Recibo</h2>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleDownload}
                            className="flex items-center gap-2 rounded-lg bg-[#1a2a4a] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#243a6a]"
                        >
                            <Download size={16} /> Descargar PDF
                        </button>
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
                        >
                            <Printer size={16} /> Imprimir
                        </button>
                        <button type="button" onClick={onClose} aria-label="Cerrar" className="p-2 text-gray-500 transition-colors hover:text-gray-800">
                            <X size={20} />
                        </button>
                    </div>
                </div>
                <div className="overflow-auto bg-gray-100 p-4">
                    <div className="mx-auto w-max bg-white shadow">
                        <PrintSheet orden={orden} paciente={paciente} detalle={detalle} settings={settings} />
                    </div>
                </div>
            </div>
        </div>
    );
}
