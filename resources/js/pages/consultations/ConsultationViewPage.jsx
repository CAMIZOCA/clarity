import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Printer, Eye } from 'lucide-react';
import client from '../../api/client';
import Button from '../../components/ui/Button';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import CertificadoPdf from '../../components/pdf/CertificadoPdf';
import { useToast } from '../../components/ui/Toast';
import { formatOpticalForInput } from '../../utils/opticalFormat';
import { toDisplayDate, getYear } from '../../utils/dates';
import { MOTOR_BINOCULAR_BLOCKS, buildMotorBinocularDefaults } from '../../data/motorBinocularSchema';
import {
    PRELIMINARY_ROWS, REFRACTION_TABLES, RX_USO_COLUMNS, KERATOMETRY_ROWS, TEXT_SECTIONS,
} from '../../data/consultationViewSchema';

/**
 * Ficha de solo lectura de una consulta, para quien no la puede editar
 * (Recepcion). No hay formulario: nada se guarda ni se autoguarda. Muestra
 * solo lo que se lleno; el rotulo de cada dato sale de `consultationViewSchema`.
 */

const EYES = [['od', 'OD'], ['oi', 'OI']];
const EYE_LABELS = { od: 'OD', oi: 'OI', ao: 'AO', ambos: 'AO', general: 'General' };

const isBlank = (value) => value === null || value === undefined || String(value).trim() === '';

const getPath = (source, path) => path.split('.').reduce((value, key) => value?.[key], source);

/** `medidas_notas` llega como objeto; un valor legacy puede venir en texto. */
function parseNotes(notes) {
    if (!notes) return {};
    if (typeof notes === 'string') {
        try { return JSON.parse(notes) ?? {}; } catch { return {}; }
    }
    return notes;
}

/**
 * Una medida como se ve en el formulario: signo y dos decimales, "N" si es
 * neutra y la nota unida ("20 CC"), o solo la nota si no hay numero ("COMP").
 */
function measure(source, field, { optical = false, notes = {} } = {}) {
    const raw = source?.[field];
    let value = source?.[`${field}_neutral`] ? 'N' : (optical ? formatOpticalForInput(raw) : (raw ?? ''));
    value = String(value ?? '').trim();
    const note = notes[field];
    if (isBlank(note)) return value;

    return value ? `${value} ${note}` : String(note);
}

function Section({ title, children }) {
    return (
        <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <h2 className="bg-slate-900 px-5 py-3 text-base font-semibold text-white">{title}</h2>
            <div className="p-5">{children}</div>
        </section>
    );
}

function FieldList({ items }) {
    const filled = items.filter((item) => !isBlank(item.value));
    if (filled.length === 0) return null;

    return (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {filled.map((item) => (
                <div key={item.label} className={String(item.value).length > 80 ? 'sm:col-span-2' : ''}>
                    <dt className="text-xs uppercase tracking-wide text-gray-500">{item.label}</dt>
                    <dd className="whitespace-pre-line text-base text-gray-900">{item.value}</dd>
                </div>
            ))}
        </dl>
    );
}

/** Tabla OD/OI con las columnas que tengan algun dato. */
function EyeTable({ columns, rows }) {
    const visible = columns.filter((column) => rows.some((row) => !isBlank(row.values[column.key])));
    if (visible.length === 0) return null;

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
                <thead>
                    <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                        <th className="py-2 pr-3 font-medium" />
                        {visible.map((column) => <th key={column.key} className="py-2 pr-3 font-medium">{column.label}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.label} className="border-b border-gray-50 last:border-0">
                            <th className="py-2 pr-3 text-left font-semibold text-[#1a2a4a]">{row.label}</th>
                            {visible.map((column) => (
                                <td key={column.key} className="py-2 pr-3 font-mono text-gray-900">{row.values[column.key] || '—'}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function rxUsoTables(consultation, notes) {
    const entries = consultation.rx_uso_entries ?? [];
    if (entries.length > 0) {
        return entries.map((entry) => {
            const entryNotes = parseNotes(entry.notas);
            return {
                observacion: entry.observacion,
                rows: EYES.map(([eye, label]) => ({
                    label,
                    values: Object.fromEntries(RX_USO_COLUMNS.map((column) => [
                        column.key,
                        measure(entry, `${column.key}_${eye}`, { optical: column.optical, notes: entryNotes }),
                    ])),
                })),
            };
        });
    }

    // Consulta importada: la RX en uso esta en las columnas planas.
    return [{
        rows: EYES.map(([eye, label]) => ({
            label,
            values: Object.fromEntries(RX_USO_COLUMNS.map((column) => [
                column.key,
                measure(consultation, `rx_uso_${column.key}_${eye}`, { optical: column.optical, notes }),
            ])),
        })),
    }];
}

const hasValues = (rows) => rows.some((row) => Object.values(row.values).some((value) => !isBlank(value)));

export default function ConsultationViewPage() {
    const { consultationId } = useParams();
    const { addToast } = useToast();
    const [consultation, setConsultation] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [pdfData, setPdfData] = useState(null);

    useEffect(() => {
        setLoadError(null);
        client.get(`/consultations/${consultationId}`)
            .then((r) => setConsultation(r.data))
            .catch((err) => setLoadError(err.response?.status === 403
                ? 'No tiene permiso para ver esta consulta.'
                : 'No se pudo cargar la consulta solicitada.'));
    }, [consultationId]);

    const view = useMemo(() => {
        if (!consultation) return null;
        const c = consultation;
        const notes = parseNotes(c.medidas_notas);
        const textItems = (key) => TEXT_SECTIONS[key].map((field) => ({ label: field.label, value: getPath(c, field.path) }));

        const preliminary = PRELIMINARY_ROWS
            .map((row) => ({ label: row.label, od: c[`${row.key}_od`], oi: c[`${row.key}_oi`] }))
            .filter((row) => !isBlank(row.od) || !isBlank(row.oi));

        const refraction = REFRACTION_TABLES.map((table) => ({
            ...table,
            rows: EYES.map(([eye, label]) => ({
                label,
                values: Object.fromEntries(table.columns.map((column) => [
                    column.key,
                    measure(c, `${table.key}_${column.key}_${eye}`, { optical: column.optical, notes }),
                ])),
            })),
            extraItems: (table.extra ?? []).map((field) => ({ label: field.label, value: c[field.key] })),
        }));

        const keratometry = KERATOMETRY_ROWS
            .map((row) => ({ label: row.label, od: c[`${row.key}_od`], oi: c[`${row.key}_oi`] }))
            .filter((row) => !isBlank(row.od) || !isBlank(row.oi));

        const diagnoses = (c.diagnoses ?? []).filter((d) => !isBlank(d.description) || !isBlank(d.code));
        const recommendations = (c.recommendations_list ?? [])
            .map((r) => r.text || r.catalog_item?.label)
            .filter((text) => !isBlank(text));

        const lens = c.lens_recommendation;
        const lensItems = [
            { label: 'Material', value: lens?.material?.label },
            { label: 'Espesor', value: lens?.thickness?.label },
            { label: 'Protección', value: lens?.protection?.label },
            { label: 'Observación', value: lens?.observation },
        ];
        // Texto que trajo la importacion del sistema anterior (gotcha 16).
        const legacyLensItems = [
            { label: 'Material', value: c.luna_material },
            { label: 'Espesor', value: c.luna_espesor },
            { label: 'Protección', value: c.luna_proteccion },
            { label: 'Observación', value: c.luna_observacion },
        ];

        const motor = buildMotorBinocularDefaults(c);
        const motorBlocks = MOTOR_BINOCULAR_BLOCKS.map((block) => ({
            title: block.title,
            rows: block.rows.map((row) => {
                const values = motor[block.key]?.[row.key] ?? {};
                const cells = row.cells
                    .map((cell, index) => cell && {
                        label: cell.label || block.columns?.[index] || '',
                        value: values[cell.key],
                    })
                    .filter((cell) => cell && !isBlank(cell.value));
                return { label: row.label, cells, observacion: values.observacion };
            }).filter((row) => row.cells.length > 0 || !isBlank(row.observacion)),
        })).filter((block) => block.rows.length > 0);

        return {
            notes, textItems, preliminary, refraction, keratometry, diagnoses, recommendations,
            lensItems, legacyLensItems, motorBlocks, rxUso: rxUsoTables(c, notes),
        };
    }, [consultation]);

    const handlePrint = async () => {
        try {
            const response = await client.get(`/consultations/${consultationId}/pdf-data`);
            setPdfData(response.data);
        } catch {
            addToast('Error al cargar la vista previa de impresión', 'error');
        }
    };

    if (loadError) return (
        <div className="p-6 max-w-3xl mx-auto">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
                <AlertTriangle size={28} className="mx-auto mb-3 text-red-600" />
                <p className="font-medium text-red-900">{loadError}</p>
            </div>
        </div>
    );

    if (!consultation || !view) return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-10 w-10 border-4 border-[#1a2a4a] border-t-transparent rounded-full" />
        </div>
    );

    const c = consultation;
    const patient = c.patient ?? {};
    const patientName = patient.nombre_completo || patient.nombre || '';
    const filled = (items) => items.some((item) => !isBlank(item.value));

    const headerItems = [
        { label: 'Fecha de consulta', value: toDisplayDate(c.fecha_consulta) },
        { label: 'Médico / Optometrista', value: c.optometrista?.name },
        { label: 'Registro SENESCYT', value: c.doctor_license },
        ...view.textItems('cabecera'),
    ];
    const diagnosisFallback = view.diagnoses.length === 0
        ? [{ label: 'Diagnóstico', value: [c.diagnostico_cie10, c.diagnostico_descripcion].filter(Boolean).join(' — ') }]
        : [];
    const hasDiagnosis = view.diagnoses.length > 0 || filled(diagnosisFallback) || !isBlank(c.diagnostico_adicional);
    const hasRecommendations = view.recommendations.length > 0 || !isBlank(c.recomendaciones);

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <Breadcrumbs items={[
                { label: 'Pacientes', to: '/pacientes' },
                patient.id && { label: patientName || 'Paciente', to: `/pacientes/${patient.id}` },
                { label: `Consulta #${c.numero_consulta ?? c.id}` },
            ].filter(Boolean)} />

            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Consulta #{c.numero_consulta ?? c.id}</h1>
                    <p className="mt-1 flex items-center gap-2 text-gray-500">
                        <Eye size={16} /> Ficha de solo lectura
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${c.estado === 'completada' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                            {c.estado === 'completada' ? 'Completada' : 'Borrador'}
                        </span>
                    </p>
                </div>
                <Button variant="secondary" onClick={handlePrint}>
                    <Printer size={18} /> Imprimir
                </Button>
            </div>

            <div className="bg-[#1a2a4a] rounded-2xl p-5 mb-6 text-white">
                <h2 className="text-xl font-semibold">{patientName}</h2>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                    {[
                        ['Cédula', patient.cedula || '—'],
                        ['Fecha nac.', toDisplayDate(patient.fecha_nacimiento, '—')],
                        ['Año', getYear(patient.fecha_nacimiento, '—')],
                        ['Edad', patient.edad != null ? `${patient.edad} años` : '—'],
                    ].map(([term, value]) => (
                        <div key={term}>
                            <dt className="text-[11px] uppercase tracking-wide text-blue-300">{term}</dt>
                            <dd className="text-sm font-medium text-white">{value}</dd>
                        </div>
                    ))}
                </dl>
            </div>

            {filled(headerItems) && (
                <Section title="Datos de la consulta"><FieldList items={headerItems} /></Section>
            )}

            {view.preliminary.length > 0 && (
                <Section title="Agudeza visual y refracción preliminar">
                    <EyeTable
                        columns={[{ key: 'od', label: 'OD' }, { key: 'oi', label: 'OI' }]}
                        rows={view.preliminary.map((row) => ({ label: row.label, values: { od: row.od, oi: row.oi } }))}
                    />
                </Section>
            )}

            {view.rxUso.some((table) => hasValues(table.rows) || !isBlank(table.observacion)) && (
                <Section title="RX en uso">
                    <div className="space-y-4">
                        {view.rxUso.filter((table) => hasValues(table.rows) || !isBlank(table.observacion)).map((table, index) => (
                            <div key={index}>
                                <EyeTable columns={RX_USO_COLUMNS} rows={table.rows} />
                                {!isBlank(table.observacion) && <p className="mt-2 text-sm text-gray-600">{table.observacion}</p>}
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {view.refraction.filter((table) => hasValues(table.rows) || filled(table.extraItems)).map((table) => (
                <Section key={table.key} title={table.title}>
                    <EyeTable columns={table.columns} rows={table.rows} />
                    {filled(table.extraItems) && <div className="mt-4"><FieldList items={table.extraItems} /></div>}
                </Section>
            ))}

            {(view.keratometry.length > 0 || filled(view.textItems('queratometria'))) && (
                <Section title="Queratometría y examen externo">
                    <EyeTable
                        columns={[{ key: 'od', label: 'OD' }, { key: 'oi', label: 'OI' }]}
                        rows={view.keratometry.map((row) => ({ label: row.label, values: { od: row.od, oi: row.oi } }))}
                    />
                    <div className="mt-4"><FieldList items={view.textItems('queratometria')} /></div>
                </Section>
            )}

            {hasDiagnosis && (
                <Section title="Diagnóstico">
                    {view.diagnoses.length > 0 && (
                        <ul className="space-y-2">
                            {view.diagnoses.map((d, index) => (
                                <li key={d.id ?? index} className="text-gray-900">
                                    {d.eye && <span className="mr-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold">{EYE_LABELS[d.eye] ?? d.eye}</span>}
                                    {d.code && <span className="mr-2 font-mono text-xs text-gray-500">{d.code}</span>}
                                    {d.description}
                                    {d.notes && <span className="block text-sm text-gray-600">{d.notes}</span>}
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className={view.diagnoses.length > 0 ? 'mt-4' : ''}>
                        <FieldList items={[...diagnosisFallback, { label: 'Diagnóstico adicional', value: c.diagnostico_adicional }]} />
                    </div>
                </Section>
            )}

            {hasRecommendations && (
                <Section title="Recomendaciones">
                    {view.recommendations.length > 0 ? (
                        <ul className="list-disc space-y-1 pl-5 text-gray-900">
                            {view.recommendations.map((text, index) => <li key={index}>{text}</li>)}
                        </ul>
                    ) : (
                        <p className="whitespace-pre-line text-gray-900">{c.recomendaciones}</p>
                    )}
                </Section>
            )}

            {(filled(view.lensItems) || filled(view.legacyLensItems)) && (
                <Section title="Recomendación de lunas">
                    <FieldList items={view.lensItems} />
                    {filled(view.legacyLensItems) && (
                        <div className={filled(view.lensItems) ? 'mt-4 border-t border-gray-100 pt-4' : ''}>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Registro del sistema anterior</p>
                            <FieldList items={view.legacyLensItems} />
                        </div>
                    )}
                </Section>
            )}

            {filled(view.textItems('contactLens')) && (
                <Section title="Lentes de contacto"><FieldList items={view.textItems('contactLens')} /></Section>
            )}

            {filled(view.textItems('ophthalmoscopy')) && (
                <Section title="Oftalmoscopia"><FieldList items={view.textItems('ophthalmoscopy')} /></Section>
            )}

            {view.motorBlocks.length > 0 && (
                <Section title="Terapia visual">
                    <div className="space-y-5">
                        {view.motorBlocks.map((block) => (
                            <div key={block.title}>
                                <h3 className="mb-2 text-sm font-semibold text-[#1a2a4a]">{block.title}</h3>
                                <ul className="space-y-1.5 text-sm text-gray-900">
                                    {block.rows.map((row) => (
                                        <li key={row.label}>
                                            <span className="font-medium">{row.label}: </span>
                                            {row.cells.map((cell) => `${cell.label ? `${cell.label} ` : ''}${cell.value}`).join(' · ')}
                                            {!isBlank(row.observacion) && <span className="text-gray-600">{row.cells.length > 0 ? ' — ' : ''}{row.observacion}</span>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {filled(view.textItems('treatment')) && (
                <Section title="Tratamiento"><FieldList items={view.textItems('treatment')} /></Section>
            )}

            {filled(view.textItems('observaciones')) && (
                <Section title="Observaciones"><FieldList items={view.textItems('observaciones')} /></Section>
            )}

            {pdfData && (
                <CertificadoPdf
                    data={pdfData}
                    onClose={() => setPdfData(null)}
                    consultationDoctor={c.optometrista ? { id: c.optometrista.id, name: c.optometrista.name } : undefined}
                />
            )}
        </div>
    );
}
