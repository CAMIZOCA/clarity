import React, { useState } from 'react';
import { BarChart2, Download, Search, Calendar } from 'lucide-react';
import client from '../../api/client';
import Button from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const today = new Date().toISOString().slice(0, 10);
const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

export default function ReportsPage() {
    const { addToast } = useToast();
    const [tab, setTab] = useState('consultations');
    const [from, setFrom] = useState(firstOfMonth);
    const [to, setTo] = useState(today);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);

    const fetchReport = async () => {
        setLoading(true);
        setData(null);
        try {
            const params = { from, to };
            const endpoint = {
                consultations: '/reports/consultations',
                diagnoses: '/reports/diagnoses',
                patients: '/reports/patients',
            }[tab];
            const res = await client.get(endpoint, { params });
            setData(res.data);
        } catch { addToast('Error al generar reporte', 'error'); }
        finally { setLoading(false); }
    };

    const exportCsv = async () => {
        try {
            const res = await client.get('/reports/export/csv', {
                params: { from, to },
                responseType: 'blob',
            });
            const url = URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `consultas_${from}_${to}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch { addToast('Error al exportar', 'error'); }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Reportes</h1>
                    <p className="text-gray-500 mt-1">Estadísticas y exportación de datos</p>
                </div>
                <Button variant="secondary" onClick={exportCsv}>
                    <Download size={18} /> Exportar CSV
                </Button>
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-6">
                <div className="flex flex-wrap items-end gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de reporte</label>
                        <select value={tab} onChange={e => { setTab(e.target.value); setData(null); }}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]">
                            <option value="consultations">Consultas por período</option>
                            <option value="diagnoses">Diagnósticos más frecuentes</option>
                            <option value="patients">Resumen de pacientes</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
                        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
                        <input type="date" value={to} onChange={e => setTo(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]" />
                    </div>
                    <Button onClick={fetchReport} loading={loading}>
                        <Search size={18} /> Generar reporte
                    </Button>
                </div>
            </div>

            {/* Resultados */}
            {loading && (
                <div className="flex justify-center py-16">
                    <div className="animate-spin h-10 w-10 border-4 border-[#1a2a4a] border-t-transparent rounded-full" />
                </div>
            )}

            {data && !loading && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    {tab === 'consultations' && <ConsultationsReport data={data} />}
                    {tab === 'diagnoses' && <DiagnosesReport data={data} />}
                    {tab === 'patients' && <PatientsReport data={data} />}
                </div>
            )}

            {!data && !loading && (
                <div className="text-center py-20 text-gray-400">
                    <BarChart2 size={60} className="mx-auto mb-4 opacity-30" />
                    <p className="text-lg">Selecciona un tipo de reporte y haz clic en "Generar"</p>
                </div>
            )}
        </div>
    );
}

function ConsultationsReport({ data }) {
    const maxVal = Math.max(...(data.porDia?.map(d => d.total) ?? [1]));
    return (
        <div>
            <div className="grid grid-cols-2 border-b border-gray-100">
                <div className="p-6 border-r border-gray-100 text-center">
                    <p className="text-4xl font-bold text-[#1a2a4a]">{data.total}</p>
                    <p className="text-sm text-gray-500 mt-1">Total consultas</p>
                </div>
                <div className="p-6 text-center">
                    <p className="text-4xl font-bold text-green-600">{data.completadas}</p>
                    <p className="text-sm text-gray-500 mt-1">Completadas</p>
                </div>
            </div>
            <div className="p-6">
                <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2"><Calendar size={16} /> Consultas por día</h3>
                {data.porDia?.length === 0 ? (
                    <p className="text-gray-400 text-center py-6">Sin datos en el período</p>
                ) : (
                    <div className="space-y-2">
                        {data.porDia?.map(d => (
                            <div key={d.dia} className="flex items-center gap-3">
                                <span className="w-28 text-sm text-gray-600 shrink-0">{format(new Date(d.dia + 'T12:00'), "d MMM", { locale: es })}</span>
                                <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                                    <div className="bg-[#1a2a4a] h-full rounded-full transition-all"
                                        style={{ width: `${(d.total / maxVal) * 100}%` }} />
                                </div>
                                <span className="w-6 text-sm font-semibold text-gray-700 text-right">{d.total}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function DiagnosesReport({ data }) {
    const max = Math.max(...(data?.map(d => d.total) ?? [1]));
    return (
        <div className="p-6">
            <h3 className="font-semibold text-gray-700 mb-4">Diagnósticos más frecuentes</h3>
            {data?.length === 0 ? <p className="text-gray-400 text-center py-6">Sin diagnósticos en el período</p> : (
                <table className="w-full text-sm">
                    <thead><tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="pb-2 font-medium">Código CIE-10</th>
                        <th className="pb-2 font-medium">Descripción</th>
                        <th className="pb-2 font-medium text-right">Total</th>
                        <th className="pb-2 w-32"></th>
                    </tr></thead>
                    <tbody>
                        {data?.map(d => (
                            <tr key={d.diagnostico_cie10} className="border-b border-gray-50">
                                <td className="py-2 font-mono text-xs">{d.diagnostico_cie10}</td>
                                <td className="py-2 text-gray-700">{d.diagnostico_descripcion || '—'}</td>
                                <td className="py-2 text-right font-semibold">{d.total}</td>
                                <td className="py-2 pl-3">
                                    <div className="bg-gray-100 rounded-full h-2">
                                        <div className="bg-[#1a2a4a] h-2 rounded-full" style={{ width: `${(d.total / max) * 100}%` }} />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

function PatientsReport({ data }) {
    return (
        <div className="grid grid-cols-3 divide-x divide-gray-100">
            {[['Pacientes nuevos', data.nuevos, 'text-blue-600'], ['Controles', data.controles, 'text-amber-600'], ['Con consulta', data.conConsulta, 'text-green-600']].map(([label, val, cls]) => (
                <div key={label} className="p-8 text-center">
                    <p className={`text-5xl font-bold ${cls}`}>{val ?? 0}</p>
                    <p className="text-sm text-gray-500 mt-2">{label}</p>
                </div>
            ))}
        </div>
    );
}
