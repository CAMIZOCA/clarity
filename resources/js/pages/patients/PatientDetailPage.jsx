import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit2, Plus, FileText, Eye, ShieldCheck, Award, Download } from 'lucide-react';
import client from '../../api/client';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function PatientDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [patient, setPatient] = useState(null);
    const [history, setHistory] = useState([]);
    const [certificates, setCertificates] = useState([]);

    useEffect(() => {
        client.get('/certificates', { params: { patient_id: id } })
            .then(r => setCertificates(r.data.data ?? []))
            .catch(() => setCertificates([]));

        Promise.all([
            client.get(`/patients/${id}`),
            client.get(`/patients/${id}/consultations`),
            client.get(`/guarantee-reports`, { params: { patient_id: id } }),
        ]).then(([pRes, cRes, gRes]) => {
            setPatient(pRes.data);
            const consultations = cRes.data.map(c => ({ ...c, _type: 'consulta', _date: c.fecha_consulta }));
            const guarantees = gRes.data.map(g => ({ ...g, _type: 'garantia', _date: g.fecha_informe }));
            const merged = [...consultations, ...guarantees].sort((a, b) => {
                if (!a._date) return 1;
                if (!b._date) return -1;
                return new Date(b._date) - new Date(a._date);
            });
            setHistory(merged);
        });
    }, [id]);

    if (!patient) return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-10 w-10 border-4 border-[#1a2a4a] border-t-transparent rounded-full" />
        </div>
    );

    const consultaCount = history.filter(h => h._type === 'consulta').length;
    const garantiaCount = history.filter(h => h._type === 'garantia').length;

    return (
        <div className="p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100">
                    <ArrowLeft size={24} />
                </button>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold text-gray-900">{patient.nombre}</h1>
                    <p className="text-gray-500">CI: {patient.cedula} · {patient.edad} años</p>
                </div>
                <div className="flex gap-3">
                    <Link to={`/consulta?paciente=${id}`}>
                        <Button><Plus size={18} /> Nueva Consulta</Button>
                    </Link>
                    <Link to={`/informes-garantia/nuevo?paciente=${id}`}>
                        <Button variant="secondary"><ShieldCheck size={18} /> Informe de Garantía</Button>
                    </Link>
                    <Link to={`/pacientes/${id}/editar`}>
                        <Button variant="secondary"><Edit2 size={18} /> Editar</Button>
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Patient info */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <h2 className="font-semibold text-gray-900 text-lg mb-4 flex items-center gap-2">
                        <Eye size={20} className="text-[#1a2a4a]" /> Datos del Paciente
                    </h2>
                    <dl className="space-y-3">
                        {[
                            ['Nombre', patient.nombre],
                            ['Cédula', patient.cedula],
                            ['Fecha nac.', patient.fecha_nacimiento ? format(new Date(patient.fecha_nacimiento), 'dd/MM/yyyy') : '—'],
                            ['Edad', `${patient.edad} años`],
                            ['Ocupación', patient.ocupacion || '—'],
                            ['Teléfono', patient.telefono || '—'],
                            ['Email', patient.email || '—'],
                        ].map(([label, value]) => (
                            <div key={label}>
                                <dt className="text-xs text-gray-500 uppercase tracking-wide">{label}</dt>
                                <dd className="text-base text-gray-900 font-medium">{value}</dd>
                            </div>
                        ))}
                    </dl>
                    {patient.antecedentes && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <dt className="text-xs text-gray-500 uppercase tracking-wide mb-1">Antecedentes</dt>
                            <dd className="text-sm text-gray-700 leading-relaxed">{patient.antecedentes}</dd>
                        </div>
                    )}

                    {/* Certificados emitidos */}
                    <div className="mt-6 pt-4 border-t border-gray-100">
                        <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
                            <Award size={16} className="text-[#1a2a4a]" /> Certificados emitidos
                        </h3>
                        {certificates.length === 0 ? (
                            <p className="text-sm text-gray-400">Sin certificados generados</p>
                        ) : (
                            <ul className="space-y-2">
                                {certificates.map(cert => (
                                    <li key={cert.id} className="flex items-center justify-between gap-2 text-sm">
                                        <div className="min-w-0">
                                            <div className="text-gray-800 truncate">
                                                Consulta #{cert.numero_consulta}
                                                {cert.certifying_doctor?.nombre && ` · ${cert.certifying_doctor.nombre}`}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {cert.created_at ? format(new Date(cert.created_at), 'dd/MM/yyyy HH:mm') : ''}
                                                {cert.status === 'enviado' && ` · enviado a ${cert.recipient_email}`}
                                                {cert.status === 'error' && ' · error al enviar'}
                                            </div>
                                        </div>
                                        {cert.pdf_url && (
                                            <a href={cert.pdf_url} target="_blank" rel="noreferrer"
                                                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 shrink-0" title="Descargar PDF">
                                                <Download size={16} />
                                            </a>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Unified history */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                            <h2 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
                                <FileText size={20} className="text-[#1a2a4a]" /> Historial
                            </h2>
                            <div className="flex gap-3 text-sm text-gray-500">
                                <span>{consultaCount} consultas</span>
                                <span>·</span>
                                <span>{garantiaCount} garantías</span>
                            </div>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {history.length === 0 ? (
                                <div className="py-12 text-center text-gray-400">
                                    <FileText size={40} className="mx-auto mb-3 opacity-40" />
                                    <p>Sin registros en el historial</p>
                                </div>
                            ) : history.map(item => (
                                item._type === 'consulta' ? (
                                    <div key={`c-${item.id}`} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <FileText size={16} className="text-blue-500 shrink-0" />
                                                    <span className="font-semibold text-gray-900">
                                                        Consulta #{item.numero_consulta}
                                                    </span>
                                                    <Badge label={item.estado} />
                                                </div>
                                                <p className="text-sm text-gray-500 ml-6">
                                                    {item.fecha_consulta ? format(new Date(item.fecha_consulta), "d 'de' MMMM yyyy", { locale: es }) : ''}
                                                    {item.optometrista && ` · Dr. ${item.optometrista.name}`}
                                                </p>
                                                {item.diagnostico_descripcion && (
                                                    <p className="text-sm text-gray-700 mt-1 ml-6">
                                                        <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded mr-2">{item.diagnostico_cie10}</span>
                                                        {item.diagnostico_descripcion}
                                                    </p>
                                                )}
                                            </div>
                                            <Link to={`/consulta/${item.id}`}>
                                                <Button variant="ghost" size="sm">
                                                    <Eye size={16} /> Ver
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                ) : (
                                    <div key={`g-${item.id}`} className="px-6 py-4 hover:bg-amber-50/50 transition-colors border-l-4 border-amber-400">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <ShieldCheck size={16} className="text-amber-500 shrink-0" />
                                                    <span className="font-semibold text-gray-900">
                                                        Informe de Garantía {item.numero_informe}
                                                    </span>
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.estado === 'completado' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                                                        {item.estado}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-500 ml-6">
                                                    {item.fecha_informe ? format(new Date(item.fecha_informe + 'T12:00'), "d 'de' MMMM yyyy", { locale: es }) : ''}
                                                    {item.optometrista && ` · Dr. ${item.optometrista.name}`}
                                                </p>
                                                <p className="text-sm text-gray-700 mt-1 ml-6 line-clamp-2">{item.motivo}</p>
                                            </div>
                                            <Link to={`/informes-garantia/${item.id}/editar`}>
                                                <Button variant="ghost" size="sm">
                                                    <Eye size={16} /> Ver
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                )
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
