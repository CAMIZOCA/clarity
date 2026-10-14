import React from 'react';
import { displaySphere, displaySigned } from '../../utils/opticalFormat';

const EMPTY = '—';

const RX_COLUMNS = [
    { key: 'esfera', label: 'Esfera' },
    { key: 'cilindro', label: 'Cilindro' },
    { key: 'eje', label: 'Eje' },
    { key: 'add', label: 'ADD' },
    { key: 'av', label: 'AV' },
    { key: 'dnp', label: 'DNP' },
];

function rxValue(eye, key) {
    if (key === 'esfera') {
        if (eye.neutra) return 'N';
        return eye.esfera === null && eye.esfera_texto ? eye.esfera_texto : displaySphere(eye.esfera, EMPTY);
    }
    if (key === 'cilindro' && eye.cilindro === null && eye.cilindro_texto) return eye.cilindro_texto;
    if (key === 'cilindro' || key === 'add') return displaySigned(eye[key], EMPTY);
    if (key === 'eje') return eye.eje === null || eye.eje === undefined || eye.eje === '' ? EMPTY : `${eye.eje}°`;
    return eye[key] || EMPTY;
}

const hasText = (value) => typeof value === 'string' && value.trim() !== '';

function Section({ title, children }) {
    return (
        <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">{title}</h4>
            {children}
        </div>
    );
}

function RxTable({ rx }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-xs text-gray-500">
                        <th className="text-left font-medium py-1 pr-3 w-10" />
                        {RX_COLUMNS.map(col => (
                            <th key={col.key} className="text-center font-medium py-1 px-2">{col.label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="font-mono text-gray-900">
                    {[['OD', rx.od], ['OI', rx.oi]].map(([label, eye]) => (
                        <tr key={label} className="border-t border-gray-100">
                            <td className="py-1.5 pr-3 font-sans font-semibold text-[#1a2a4a]">{label}</td>
                            {RX_COLUMNS.map(col => (
                                <td key={col.key} className="text-center py-1.5 px-2 tabular-nums">{rxValue(eye, col.key)}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            {hasText(rx.observaciones) && (
                <p className="mt-1 text-xs text-gray-600">{rx.observaciones}</p>
            )}
        </div>
    );
}

function diagnosisLabel(d) {
    const text = [d.code, d.description].filter(Boolean).join(' · ');
    return d.eye ? `${text} (${d.eye})` : text;
}

/**
 * Resumen de una consulta para el vendedor: medidas, lente recomendado,
 * recomendaciones, diagnostico y lo que el optometra anoto para vender.
 * Solo lectura; los datos ya llegan filtrados por `ReceptionFeedService`.
 */
export default function ConsultationSummary({ item }) {
    const lens = [item.lens?.material, item.lens?.espesor, item.lens?.proteccion].filter(hasText);
    const products = item.sale_items ?? [];

    return (
        <div className="space-y-4">
            {hasText(item.motivo) && (
                <Section title="Motivo">
                    <p className="text-sm text-gray-800">{item.motivo}</p>
                </Section>
            )}

            <Section title="Medidas finales">
                <RxTable rx={item.rx} />
            </Section>

            {(lens.length > 0 || hasText(item.lens?.observacion)) && (
                <Section title="Lente recomendado">
                    {lens.length > 0 && <p className="text-sm font-medium text-gray-900">{lens.join(' · ')}</p>}
                    {hasText(item.lens?.observacion) && <p className="text-sm text-gray-600">{item.lens.observacion}</p>}
                </Section>
            )}

            {item.recommendations?.length > 0 && (
                <Section title="Recomendaciones">
                    <ul className="list-disc pl-5 text-sm text-gray-800 space-y-0.5">
                        {item.recommendations.map((text, i) => <li key={i}>{text}</li>)}
                    </ul>
                </Section>
            )}

            {products.length > 0 && (
                <Section title="Anotado para la venta">
                    <ul className="text-sm text-gray-800 space-y-0.5">
                        {products.map((p, i) => (
                            <li key={i} className="flex justify-between gap-3">
                                <span>
                                    {p.descripcion || p.tipo}
                                    {hasText(p.nota) && <span className="text-gray-500"> — {p.nota}</span>}
                                </span>
                                {Number(p.total) > 0 && <span className="tabular-nums text-gray-600">${Number(p.total).toFixed(2)}</span>}
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {item.diagnoses?.length > 0 && (
                <Section title="Diagnóstico">
                    <ul className="text-sm text-gray-800 space-y-0.5">
                        {item.diagnoses.map((d, i) => <li key={i}>{diagnosisLabel(d)}</li>)}
                    </ul>
                </Section>
            )}

            {hasText(item.observaciones) && (
                <Section title="Observaciones">
                    <p className="text-sm text-gray-800 whitespace-pre-line">{item.observaciones}</p>
                </Section>
            )}
        </div>
    );
}
