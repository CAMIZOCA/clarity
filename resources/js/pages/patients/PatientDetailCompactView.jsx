import React from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, Award, CheckCircle2, ChevronLeft, ChevronRight, Download, Edit2, FileText, Plus, Send, ShieldCheck } from 'lucide-react';
import Button from '../../components/ui/Button';
import { consultationUrl } from '../../utils/consultationLinks';
import { toDisplayDate } from '../../utils/dates';

/**
 * Ficha del paciente en la plantilla Compacto (HIG). Solo presentacion: los
 * datos, permisos y acciones vienen de PatientDetailPage (los mismos del Clasico).
 *
 * Paridad con el Clasico: volver; Nueva consulta (consultations.create),
 * Informe de garantia (guarantee_reports.manage), Editar (patients.edit);
 * los 11 datos del paciente (`facts`) y los antecedentes; Contifico con
 * "Enviar a Contifico"; certificados con su PDF; historial de consultas y
 * garantias con estado, fecha, medico, diagnostico, observaciones y "Ver".
 */
const yearOf = (item) => (item._date ? String(item._date).slice(0, 4) : 'Sin fecha');

function groupByYear(history) {
    const groups = [];
    for (const item of history) {
        const year = yearOf(item);
        const last = groups[groups.length - 1];
        if (last && last.year === year) last.items.push(item);
        else groups.push({ year, items: [item] });
    }
    return groups;
}

const STATE_PILL = {
    completada: 'bg-emerald-50 text-emerald-700',
    borrador: 'bg-amber-50 text-amber-800',
    completado: 'bg-emerald-50 text-emerald-700',
};

function Pill({ children, tone }) {
    return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${STATE_PILL[tone] ?? 'bg-gray-900/5 text-gray-600'}`}>{children}</span>;
}

export default function PatientDetailCompactView({
    id, patient, history, certificates, facts, consultaCount, garantiaCount,
    can, contificoEnabled, sendingContifico, onSendToContifico, onBack,
}) {
    const name = patient.nombre_completo || patient.nombre;
    const groups = groupByYear(history);

    return (
        <div className="mx-auto max-w-[112rem] space-y-4 px-4 py-4 lg:px-6">
            <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={onBack} className="inline-flex items-center rounded-md py-1 pr-2 text-sm text-navy hover:bg-navy/10" aria-label="Volver">
                    <ChevronLeft size={18} /> Volver
                </button>
                <div className="flex-1" />
                {can('consultations.create') && (
                    <Link to={`/consulta?paciente=${id}`}>
                        <Button size="sm"><Plus size={16} /> Nueva consulta</Button>
                    </Link>
                )}
                {can('guarantee_reports.manage') && (
                    <Link to={`/informes-garantia/nuevo?paciente=${id}`}>
                        <Button size="sm" variant="secondary"><ShieldCheck size={16} /> Informe de garantía</Button>
                    </Link>
                )}
                {can('patients.edit') && (
                    <Link to={`/pacientes/${id}/editar`}>
                        <Button size="sm" variant="secondary"><Edit2 size={16} /> Editar</Button>
                    </Link>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand text-xl font-semibold text-white">{name?.[0]}</div>
                <div className="min-w-0 flex-1">
                    <h1 className="text-[26px] font-bold leading-tight tracking-tight text-gray-900">{name}</h1>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[12.5px]">
                        <span className="rounded-full bg-gray-900/5 px-2 py-0.5 text-gray-700">C.I. {patient.cedula}</span>
                        {patient.edad != null && <span className="rounded-full bg-gray-900/5 px-2 py-0.5 text-gray-700">{patient.edad} años</span>}
                        {patient.telefono && <span className="rounded-full bg-gray-900/5 px-2 py-0.5 tabular-nums text-gray-700">{patient.telefono}</span>}
                    </div>
                </div>
            </div>

            {patient.antecedentes && (
                <div className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                    <p className="min-w-0 whitespace-pre-line break-words"><span className="font-semibold">Antecedentes: </span>{patient.antecedentes}</p>
                </div>
            )}

            <div className="grid items-start gap-4 lg:grid-cols-3">
                <section className="min-w-0 lg:col-span-2" aria-labelledby="ficha-historial">
                    <div className="mb-1.5 flex items-baseline justify-between px-1">
                        <h2 id="ficha-historial" className="text-[13px] font-semibold text-gray-600">Historial</h2>
                        <span className="text-xs text-gray-500">{consultaCount} consultas · {garantiaCount} garantías</span>
                    </div>
                    {history.length === 0 ? (
                        <div className="rounded-xl bg-white py-10 text-center text-sm text-gray-500 shadow-sm">
                            <FileText size={32} className="mx-auto mb-2 text-gray-300" />
                            Sin registros en el historial
                        </div>
                    ) : groups.map((group) => (
                        <div key={group.year} className="mb-3">
                            <p className="mb-1 px-1 text-xs font-semibold text-gray-500">{group.year}</p>
                            <ul className="overflow-hidden rounded-xl bg-white shadow-sm">
                                {group.items.map((item) => (
                                    item._type === 'consulta'
                                        ? <ConsultationRow key={`c-${item.id}`} item={item} can={can} />
                                        : <GuaranteeRow key={`g-${item.id}`} item={item} />
                                ))}
                            </ul>
                        </div>
                    ))}
                </section>

                <aside className="min-w-0 space-y-4">
                    <section aria-labelledby="ficha-datos">
                        <h2 id="ficha-datos" className="mb-1.5 px-1 text-[13px] font-semibold text-gray-600">Datos del paciente</h2>
                        <div className="rounded-xl bg-white p-3 shadow-sm">
                            <dl className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px]">
                                {facts.map(([label, value]) => (
                                    <React.Fragment key={label}>
                                        <dt className="text-gray-500">{label}</dt>
                                        <dd className="break-words text-gray-900">{value}</dd>
                                    </React.Fragment>
                                ))}
                            </dl>
                            {(contificoEnabled || patient.contifico_synced_at) && (
                                <div className="mt-3 border-t border-gray-100 pt-3 text-[13px]">
                                    <p className="mb-1 text-gray-500">Contífico</p>
                                    {patient.contifico_synced_at ? (
                                        <p className="flex items-center gap-1.5 text-emerald-700">
                                            <CheckCircle2 size={15} /> Cliente en Contífico desde {toDisplayDate(patient.contifico_synced_at)}
                                        </p>
                                    ) : (
                                        <>
                                            <p className="mb-2 text-gray-600">Todavía no está en Contífico.</p>
                                            {can('patients.edit') && (
                                                <Button variant="secondary" size="sm" onClick={onSendToContifico} loading={sendingContifico}>
                                                    <Send size={14} /> Enviar a Contífico
                                                </Button>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>

                    <section aria-labelledby="ficha-certificados">
                        <h2 id="ficha-certificados" className="mb-1.5 flex items-center gap-1.5 px-1 text-[13px] font-semibold text-gray-600">
                            <Award size={14} /> Certificados emitidos
                        </h2>
                        <div className="rounded-xl bg-white shadow-sm">
                            {certificates.length === 0 ? (
                                <p className="px-3 py-3 text-sm text-gray-500">Sin certificados generados</p>
                            ) : (
                                <ul className="divide-y divide-gray-100">
                                    {certificates.map((cert) => (
                                        <li key={cert.id} className="flex items-center justify-between gap-2 px-3 py-2 text-[13px]">
                                            <div className="min-w-0">
                                                <p className="truncate text-gray-900">
                                                    Consulta #{cert.numero_consulta}
                                                    {cert.tipo === 'escolar_vehicular' && ' · Escolar / Vehicular'}
                                                    {cert.certifying_doctor?.nombre && ` · ${cert.certifying_doctor.nombre}`}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {cert.created_at ? format(new Date(cert.created_at), 'dd/MM/yyyy HH:mm') : ''}
                                                    {cert.status === 'enviado' && ` · enviado a ${cert.recipient_email}`}
                                                    {cert.status === 'error' && ' · error al enviar'}
                                                </p>
                                            </div>
                                            {cert.pdf_url && (
                                                <a href={cert.pdf_url} target="_blank" rel="noreferrer" className="shrink-0 rounded-md p-1.5 text-gray-500 hover:bg-gray-900/5 hover:text-navy" title="Descargar PDF">
                                                    <Download size={16} />
                                                </a>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </section>
                </aside>
            </div>
        </div>
    );
}

function ConsultationRow({ item, can }) {
    const date = item.fecha_consulta ? format(parseISO(item.fecha_consulta), "d 'de' MMMM yyyy", { locale: es }) : '';
    const body = (
        <>
            <FileText size={16} className="mt-0.5 shrink-0 text-navy" />
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-gray-900">Consulta #{item.numero_consulta}</span>
                    <Pill tone={item.estado}>{item.estado}</Pill>
                    <span className="text-[12.5px] text-gray-500">{date}{item.optometrista && ` · Dr. ${item.optometrista.name}`}</span>
                </div>
                {item.diagnostico_descripcion && (
                    <p className="mt-0.5 text-[13px] text-gray-700">
                        {item.diagnostico_cie10 && <span className="mr-1.5 rounded bg-gray-900/5 px-1 font-mono text-[11px]">{item.diagnostico_cie10}</span>}
                        {item.diagnostico_descripcion}
                    </p>
                )}
                {item.observaciones?.trim() && (
                    <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-[12.5px] text-gray-600" title={item.observaciones}>
                        <span className="font-medium text-gray-700">Observaciones: </span>{item.observaciones}
                    </p>
                )}
            </div>
            {can('consultations.view') && <span className="flex shrink-0 items-center gap-0.5 text-[13px] text-navy">Ver <ChevronRight size={15} /></span>}
        </>
    );

    return (
        <li className="border-b border-gray-100 last:border-0">
            {can('consultations.view') ? (
                <Link to={consultationUrl(can, item.id)} className="flex items-start gap-3 px-3 py-2.5 hover:bg-gray-900/[0.03]">{body}</Link>
            ) : (
                <div className="flex items-start gap-3 px-3 py-2.5">{body}</div>
            )}
        </li>
    );
}

function GuaranteeRow({ item }) {
    const date = item.fecha_informe ? format(new Date(`${item.fecha_informe}T12:00`), "d 'de' MMMM yyyy", { locale: es }) : '';
    return (
        <li className="border-b border-gray-100 last:border-0">
            <Link to={`/informes-garantia/${item.id}/editar`} className="flex items-start gap-3 bg-amber-50/40 px-3 py-2.5 hover:bg-amber-50">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-amber-600" />
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-gray-900">Informe de garantía {item.numero_informe}</span>
                        <Pill tone={item.estado}>{item.estado}</Pill>
                        <span className="text-[12.5px] text-gray-500">{date}{item.optometrista && ` · Dr. ${item.optometrista.name}`}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[13px] text-gray-700">{item.motivo}</p>
                </div>
                <span className="flex shrink-0 items-center gap-0.5 text-[13px] text-navy">Ver <ChevronRight size={15} /></span>
            </Link>
        </li>
    );
}
