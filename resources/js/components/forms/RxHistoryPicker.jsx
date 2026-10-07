import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCopy, ExternalLink, History } from 'lucide-react';
import client from '../../api/client';
import { getList } from '../../api/response';
import { formatOpticalForInput } from '../../utils/opticalFormat';
import { toDisplayDate } from '../../utils/dates';

/**
 * RX final de las consultas anteriores del paciente, con un boton para copiar
 * cualquiera de ellas a "RX en uso".
 *
 * Antes la optometra abria la consulta anterior en otra pestana y copiaba la
 * receta a mano. Si el paciente no tiene recetas previas no se muestra nada.
 *
 * @param {number|string} patientId
 * @param {number|string|null} excludeId - consulta abierta, que no es "anterior"
 * @param {(row: object) => void} onUse - recibe la fila elegida del historial
 */
const EYES = ['od', 'oi'];

const dash = (value) => (value === null || value === undefined || value === '' ? '—' : value);

function sphere(row, eye) {
    if (row[`rx_final_esfera_${eye}_neutral`]) return 'N';
    return dash(formatOpticalForInput(row[`rx_final_esfera_${eye}`]));
}

export default function RxHistoryPicker({ patientId, excludeId = null, onUse }) {
    const [rows, setRows] = useState([]);

    useEffect(() => {
        if (!patientId) return undefined;

        let cancelled = false;
        client.get(`/patients/${patientId}/rx-history`, { params: excludeId ? { exclude: excludeId } : {} })
            .then((response) => { if (!cancelled) setRows(getList(response)); })
            // Es una ayuda: si falla, la receta en uso se sigue pudiendo escribir a mano.
            .catch(() => { if (!cancelled) setRows([]); });

        return () => { cancelled = true; };
    }, [patientId, excludeId]);

    if (!rows.length) return null;

    return (
        <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#1a2a4a]">
                <History size={16} /> RX final de consultas anteriores
            </div>
            <p className="mb-3 text-xs text-slate-600">
                Pulse «Usar» para copiar esa receta a RX en uso.
            </p>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                            <th className="px-2 py-1">Consulta</th>
                            <th className="px-2 py-1">Ojo</th>
                            <th className="px-2 py-1 text-center">Esfera</th>
                            <th className="px-2 py-1 text-center">Cilindro</th>
                            <th className="px-2 py-1 text-center">Eje</th>
                            <th className="px-2 py-1 text-center">ADD</th>
                            <th className="px-2 py-1 text-center">AV</th>
                            <th className="px-2 py-1" />
                        </tr>
                    </thead>
                    {rows.map((row) => (
                        <tbody key={row.id} className="border-t border-sky-200">
                            {EYES.map((eye, index) => (
                                <tr key={eye}>
                                    {index === 0 && (
                                        <td rowSpan={2} className="px-2 py-2 align-top">
                                            <div className="font-medium text-slate-800">{toDisplayDate(row.fecha_consulta, '—')}</div>
                                            <Link
                                                to={`/consulta/${row.id}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 text-xs text-sky-700 underline underline-offset-2 hover:text-sky-900"
                                            >
                                                Consulta #{row.numero_consulta} <ExternalLink size={12} />
                                            </Link>
                                            {row.optometrista && <div className="text-xs text-slate-500">{row.optometrista}</div>}
                                        </td>
                                    )}
                                    <td className="px-2 py-1">
                                        <span className={`inline-flex h-6 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white ${eye === 'od' ? 'bg-blue-600' : 'bg-green-600'}`}>
                                            {eye.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="px-2 py-1 text-center font-mono">{sphere(row, eye)}</td>
                                    <td className="px-2 py-1 text-center font-mono">{dash(formatOpticalForInput(row[`rx_final_cilindro_${eye}`]))}</td>
                                    <td className="px-2 py-1 text-center font-mono">{dash(row[`rx_final_eje_${eye}`])}</td>
                                    <td className="px-2 py-1 text-center font-mono">{dash(formatOpticalForInput(row[`rx_final_add_${eye}`]))}</td>
                                    <td className="px-2 py-1 text-center font-mono">{dash(row[`rx_final_av_${eye}`])}</td>
                                    {index === 0 && (
                                        <td rowSpan={2} className="px-2 py-2 text-right align-middle">
                                            <button
                                                type="button"
                                                onClick={() => onUse(row)}
                                                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[#1a2a4a] bg-white px-3 py-2 text-sm font-medium text-[#1a2a4a] transition hover:bg-[#1a2a4a] hover:text-white"
                                            >
                                                <ClipboardCopy size={15} /> Usar
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    ))}
                </table>
            </div>
        </div>
    );
}
