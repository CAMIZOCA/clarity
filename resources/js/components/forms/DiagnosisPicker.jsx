import React, { useMemo, useState } from 'react';
import { useWatch } from 'react-hook-form';
import { Lightbulb, Search } from 'lucide-react';
import { analyzeRefraction, DIAGNOSIS_CRITERIA, rankDiagnosisOptions } from '../../utils/diagnosisSuggestions';

const EYES = [
    { key: 'od', label: 'OD', title: 'Ojo derecho', badge: 'bg-blue-600', tint: 'border-blue-200 bg-blue-50/40' },
    { key: 'oi', label: 'OI', title: 'Ojo izquierdo', badge: 'bg-green-600', tint: 'border-green-200 bg-green-50/40' },
];

// Medidas que alimentan las sugerencias (ver utils/diagnosisSuggestions.js).
const MEASUREMENT_FIELDS = ['od', 'oi'].flatMap((eye) => [
    `rx_final_esfera_${eye}`, `rx_final_cilindro_${eye}`, `rx_final_eje_${eye}`, `rx_final_add_${eye}`, `rx_final_av_${eye}`,
    `subj_esfera_${eye}`, `subj_cilindro_${eye}`, `subj_eje_${eye}`, `subj_avl_${eye}`,
    `avcc_${eye}`,
]);

const LEVEL_STYLES = {
    alta: 'bg-emerald-100 text-emerald-800',
    media: 'bg-amber-100 text-amber-800',
};

const LEVEL_LABELS = { alta: 'Probable', media: 'Posible' };

const normalize = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** Llave de un diagnostico marcado desde el catalogo: ojo + item. */
const checklistKey = (eye, catalogItemId) => `${eye}:${catalogItemId}`;

/**
 * Posibles diagnosticos segun las medidas, antes de marcar nada.
 * Solo informa: ningun diagnostico se marca automaticamente.
 */
function SuggestionSummary({ analysis }) {
    return (
        <div className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 text-sm">
            <div className="mb-2 flex flex-wrap items-center gap-2">
                <Lightbulb size={16} className="text-indigo-700" />
                <h3 className="font-semibold text-indigo-900">Posibles diagnósticos según las medidas</h3>
                {analysis.source && (
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs text-indigo-700">Fuente: {analysis.source}</span>
                )}
            </div>
            {analysis.hasData ? (
                <>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {EYES.map((eye) => (
                            <div key={eye.key}>
                                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{eye.title}</div>
                                {analysis.eyes[eye.key].findings.length ? (
                                    <ul className="list-disc space-y-0.5 pl-5 text-slate-800">
                                        {analysis.eyes[eye.key].findings.map((finding) => <li key={finding}>{finding}</li>)}
                                    </ul>
                                ) : (
                                    <p className="text-slate-500">Sin medidas para este ojo.</p>
                                )}
                            </div>
                        ))}
                    </div>
                    {analysis.general.length > 0 && (
                        <ul className="mt-3 list-disc space-y-0.5 border-t border-indigo-100 pt-2 pl-5 text-slate-800">
                            {analysis.general.map((finding) => <li key={finding}>{finding}</li>)}
                        </ul>
                    )}
                </>
            ) : (
                <p className="text-slate-600">Complete RX Final o Subjetivo para ver sugerencias.</p>
            )}
            <details className="mt-3 text-xs text-slate-600">
                <summary className="cursor-pointer select-none font-medium text-indigo-800">Criterios de referencia</summary>
                <table className="mt-2 w-full">
                    <tbody>
                        {DIAGNOSIS_CRITERIA.map((criterion) => (
                            <tr key={criterion.label} className="border-t border-indigo-100 align-top">
                                <td className="py-1 pr-3 font-medium text-slate-700 whitespace-nowrap">{criterion.label}</td>
                                <td className="py-1">{criterion.rule}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </details>
            <p className="mt-2 text-xs text-slate-500">
                Orientativo: el catálogo se ordena por probabilidad, pero ningún diagnóstico se marca solo.
            </p>
        </div>
    );
}

function EyeChecklist({ eye, ranked, checkedIndex, fields, register, onToggle }) {
    const [query, setQuery] = useState('');
    const selectedCount = ranked.filter(({ option }) => checkedIndex.has(checklistKey(eye.key, option.id))).length;
    const visible = query.trim()
        ? ranked.filter(({ option }) => normalize(`${option.code ?? ''} ${option.label}`).includes(normalize(query.trim())))
        : ranked;

    return (
        <div className={`rounded-2xl border p-3 ${eye.tint}`}>
            <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${eye.badge}`}>{eye.label}</span>
                    <h3 className="text-sm font-semibold text-slate-800">{eye.title}</h3>
                </div>
                <span className="text-xs text-slate-500">{selectedCount} seleccionado(s)</span>
            </div>
            {ranked.length > 8 && (
                <label className="relative mb-2 block">
                    <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Filtrar diagnósticos..."
                        className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                </label>
            )}
            <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {visible.map(({ option, level }) => {
                    const index = checkedIndex.get(checklistKey(eye.key, option.id));
                    const checked = index !== undefined;
                    const inputId = `dx-${eye.key}-${option.id}`;
                    return (
                        <li key={option.id} className={checked ? 'bg-slate-50' : ''}>
                            <label htmlFor={inputId} className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2">
                                <input
                                    id={inputId}
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(event) => onToggle(eye.key, option, event.target.checked)}
                                    className="h-4 w-4 shrink-0 accent-[#1a2a4a]"
                                />
                                <span className="min-w-0 flex-1 text-sm text-slate-800">
                                    {option.label}
                                    {option.code && <span className="ml-2 text-xs text-slate-400">{option.code}</span>}
                                </span>
                                {LEVEL_STYLES[level] && (
                                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${LEVEL_STYLES[level]}`}>
                                        {LEVEL_LABELS[level]}
                                    </span>
                                )}
                            </label>
                            {checked && (
                                <div className="px-3 pb-3 pl-10">
                                    <textarea
                                        key={fields[index]?.id}
                                        id={`diagnoses.${index}.notes`}
                                        rows={1}
                                        placeholder="Recomendaciones (opcional)"
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                                        {...register(`diagnoses.${index}.notes`)}
                                    />
                                </div>
                            )}
                        </li>
                    );
                })}
                {visible.length === 0 && (
                    <li className="px-3 py-3 text-sm text-slate-500">
                        {ranked.length ? 'Ningún diagnóstico coincide con el filtro.' : 'El catálogo de diagnósticos está vacío.'}
                    </li>
                )}
            </ul>
        </div>
    );
}

/**
 * Diagnosticos por ojo como lista de seleccion multiple.
 *
 * El estado vive en el mismo array `diagnoses` de react-hook-form que ya
 * guarda la API: marcar un item agrega la fila {eye, catalog_item_id, code,
 * description}; desmarcarlo la quita. Las filas que no son del catalogo
 * (texto libre, ojo "general" o items desactivados) las pinta el formulario
 * aparte para que el historico no se pierda.
 */
export default function DiagnosisPicker({ control, register, options, fieldArray, patientAge }) {
    const diagnoses = useWatch({ control, name: 'diagnoses' }) ?? [];
    const measurementValues = useWatch({ control, name: MEASUREMENT_FIELDS });

    const analysis = useMemo(() => {
        const values = Object.fromEntries(MEASUREMENT_FIELDS.map((name, index) => [name, measurementValues?.[index]]));
        return analyzeRefraction(values, patientAge);
    }, [measurementValues, patientAge]);

    const rankedByEye = useMemo(() => Object.fromEntries(
        EYES.map((eye) => [eye.key, rankDiagnosisOptions(options, analysis.eyes[eye.key].tags)])
    ), [options, analysis]);

    const checkedIndex = useMemo(() => {
        const map = new Map();
        diagnoses.forEach((row, index) => {
            if (!row?.catalog_item_id || !['od', 'oi'].includes(row.eye)) return;
            const key = checklistKey(row.eye, row.catalog_item_id);
            if (!map.has(key)) map.set(key, index);
        });
        return map;
    }, [diagnoses]);

    const handleToggle = (eye, option, checked) => {
        const key = checklistKey(eye, option.id);
        if (checked) {
            if (checkedIndex.has(key)) return;
            fieldArray.append({
                eye,
                catalog_item_id: option.id,
                code: option.code ?? '',
                description: option.label ?? '',
                notes: '',
            }, { shouldFocus: false });
        } else if (checkedIndex.has(key)) {
            fieldArray.remove(checkedIndex.get(key));
        }
    };

    return (
        <>
            <SuggestionSummary analysis={analysis} />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {EYES.map((eye) => (
                    <EyeChecklist
                        key={eye.key}
                        eye={eye}
                        ranked={rankedByEye[eye.key]}
                        checkedIndex={checkedIndex}
                        fields={fieldArray.fields}
                        register={register}
                        onToggle={handleToggle}
                    />
                ))}
            </div>
        </>
    );
}

/** Indice de las filas de `diagnoses` que el checklist ya representa. */
export function checklistRowIndexes(diagnoses, options) {
    const optionIds = new Set(options.map((option) => String(option.id)));
    const seen = new Set();
    const indexes = new Set();
    (diagnoses ?? []).forEach((row, index) => {
        if (!row?.catalog_item_id || !['od', 'oi'].includes(row.eye) || !optionIds.has(String(row.catalog_item_id))) return;
        const key = checklistKey(row.eye, row.catalog_item_id);
        if (seen.has(key)) return;
        seen.add(key);
        indexes.add(index);
    });
    return indexes;
}
