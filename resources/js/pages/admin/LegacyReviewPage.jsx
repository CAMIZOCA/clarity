import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { AlertTriangle, ArrowRight, ExternalLink, History, Loader2, RefreshCw, Search, Undo2, Wand2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import ConfirmModal from '../../components/ui/ConfirmModal';
import DateInput from '../../components/ui/DateInput';
import { useToast } from '../../components/ui/Toast';
import { getList, getPagination, getPayload } from '../../api/response';
import {
    applyLegacyReview,
    getLegacyReviewBatches,
    getLegacyReviewCases,
    getLegacyReviewRows,
    previewLegacyReview,
    revertLegacyReviewBatch,
} from '../../api/legacyReview';
import { toDisplayDate, toDisplayDateTime } from '../../utils/dates';

/**
 * Revision de datos heredados: consultas importadas del sistema anterior con
 * un dato en el campo equivocado. La optica ve lo que hay y lo que se propone,
 * elige y aplica; cada aplicacion es un lote que se puede deshacer.
 *
 * La seleccion empieza en "todas las preseleccionadas que cumplen el filtro"
 * para no cargar miles de filas: se guardan solo las excepciones (`except`) y
 * las no preseleccionadas marcadas a mano (`include`). El servidor vuelve a
 * evaluar todo al aplicar.
 *
 * Todo lo propio de un caso (estados, avisos, filtros, contadores, columnas)
 * viene del servidor (`LegacyReviewCase`); aqui solo se pinta.
 */

/** Clases por tono: `badge` para el estado de un ojo, `pill` para un aviso, `text` para un contador. */
const TONES = {
    ok: { badge: 'bg-emerald-100 text-emerald-800', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', text: 'text-emerald-700' },
    warn: { badge: 'bg-amber-100 text-amber-800', pill: 'bg-amber-50 text-amber-800 border-amber-200', text: 'text-amber-700' },
    danger: { badge: 'bg-red-100 text-red-800', pill: 'bg-red-50 text-red-700 border-red-200', text: 'text-red-700' },
    muted: { badge: 'bg-slate-100 text-slate-600', pill: 'bg-slate-50 text-slate-600 border-slate-200', text: 'text-slate-500' },
    default: { badge: 'bg-slate-100 text-slate-700', pill: 'bg-slate-50 text-slate-700 border-slate-200', text: 'text-slate-900' },
};

const tone = (name) => TONES[name] ?? TONES.default;

/** Numero de un contador segun su `match` (`['all']`, `['status', x]`, `['flag', y]`...). */
function cardValue(summary, match = []) {
    if (!summary) return 0;
    switch (match[0]) {
        case 'preselected': return summary.preselected;
        case 'applied': return summary.applied;
        case 'status': return summary.statuses?.[match[1]] ?? 0;
        case 'flag': return summary.flags?.[match[1]] ?? 0;
        default: return summary.candidates;
    }
}

const emptySelection = (mode = 'all') => ({ mode, except: new Set(), include: new Set(), ids: new Set() });

function useDebounced(value, delay) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(id);
    }, [value, delay]);
    return debounced;
}

function errorMessage(error, fallback) {
    return error?.response?.data?.message || fallback;
}

function formatNumber(value) {
    return Number(value ?? 0).toLocaleString('es-EC');
}

function isChecked(row, selection) {
    if (!row.selectable) return false;
    if (selection.mode === 'manual') return selection.ids.has(row.id);
    if (selection.except.has(row.id)) return false;
    return row.preselected || selection.include.has(row.id);
}

function selectionPayload(selection, filters) {
    if (selection.mode === 'manual') return { ids: [...selection.ids] };
    return { all: true, filters, except: [...selection.except], include: [...selection.include] };
}

function selectedCount(selection, pagination) {
    if (selection.mode === 'manual') return selection.ids.size;
    // Aproximado: las excepciones pueden incluir filas que ya no cumplen el filtro.
    return Math.max(0, (pagination?.preselected_total ?? 0) - selection.except.size + selection.include.size);
}

function Pill({ className, title, children }) {
    return (
        <span title={title} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${className}`}>
            {children}
        </span>
    );
}

function ValueChange({ current, proposed }) {
    const changes = (current ?? null) !== (proposed ?? null);
    if (!changes) {
        return <span className={current ? 'text-slate-900' : 'text-slate-300'}>{current || '—'}</span>;
    }
    return (
        <span className="inline-flex flex-wrap items-center gap-1">
            <span className={current ? 'text-slate-400 line-through' : 'text-slate-300'}>{current || 'vacío'}</span>
            <ArrowRight size={12} className="text-slate-400" />
            <span className={proposed ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>{proposed || 'vacío'}</span>
        </span>
    );
}

function PreviewModal({ open, preview, loading, applying, caseInfo, onCancel, onConfirm }) {
    const caseLabel = caseInfo?.label;
    const columns = caseInfo?.columns ?? [];
    const rowColumns = caseInfo?.row_columns ?? [];
    const flagStyles = caseInfo?.flags ?? {};
    const [understood, setUnderstood] = useState(false);
    useEffect(() => { if (open) setUnderstood(false); }, [open]);

    return (
        <Modal open={open} onClose={applying ? () => {} : onCancel} title="Revisar antes de aplicar" size="lg">
            {loading || !preview ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                    <Loader2 size={18} className="animate-spin" /> Calculando cambios...
                </div>
            ) : (
                <div className="space-y-4 text-sm">
                    <p className="text-slate-600">{caseLabel}</p>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-slate-200 p-3">
                            <p className="text-xs text-slate-500">Consultas a corregir</p>
                            <p className="text-2xl font-bold text-slate-900">{formatNumber(preview.consultations)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 p-3">
                            <p className="text-xs text-slate-500">Valores que cambian</p>
                            <p className="text-2xl font-bold text-slate-900">{formatNumber(preview.changes)}</p>
                        </div>
                    </div>

                    {Object.keys(preview.flags ?? {}).length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(preview.flags).map(([flag, count]) => {
                                const style = flagStyles[flag];
                                return style ? <Pill key={flag} className={tone(style.tone).pill} title={style.title}>{style.label}: {formatNumber(count)}</Pill> : null;
                            })}
                        </div>
                    )}

                    {preview.examples?.length > 0 && (
                        <div className="max-h-56 overflow-auto rounded-lg border border-slate-200">
                            <table className="w-full text-xs">
                                <thead className="sticky top-0 bg-slate-50 text-slate-500">
                                    <tr>
                                        <th className="px-2 py-1.5 text-left">Paciente</th>
                                        <th className="px-2 py-1.5 text-left">Ojo</th>
                                        {columns.map(column => <th key={column.key} className="px-2 py-1.5 text-left">{column.label}</th>)}
                                        {rowColumns.map(column => <th key={column.key} className="px-2 py-1.5 text-left">{column.label}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {preview.examples.flatMap(row => ['od', 'oi'].map((eye, index) => (
                                        <tr key={`${row.id}-${eye}`} className="border-t border-slate-100 align-top">
                                            <td className="px-2 py-1">{index === 0 ? row.patient?.nombre_completo : ''}</td>
                                            <td className="px-2 py-1 font-semibold uppercase">{eye}</td>
                                            {columns.map(column => (
                                                <td key={column.key} className="px-2 py-1">
                                                    <ValueChange current={row.eyes?.[eye]?.current?.[column.key]} proposed={row.eyes?.[eye]?.proposed?.[column.key]} />
                                                </td>
                                            ))}
                                            {rowColumns.map(column => (
                                                <td key={column.key} className="px-2 py-1">
                                                    {index === 0 && <ValueChange current={row.fields?.[column.key]?.current} proposed={row.fields?.[column.key]?.proposed} />}
                                                </td>
                                            ))}
                                        </tr>
                                    )))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                        Antes de escribir se genera un backup de la base de datos. Cada cambio queda registrado
                        y el lote completo se puede deshacer desde "Cambios aplicados".
                    </div>

                    <label className="flex items-start gap-2 text-slate-700">
                        <input type="checkbox" className="mt-1 h-4 w-4 accent-navy" checked={understood} onChange={e => setUnderstood(e.target.checked)} />
                        <span>Revisé los cambios y quiero corregir {formatNumber(preview.consultations)} consultas.</span>
                    </label>

                    <div className="flex justify-end gap-2 pt-1">
                        <Button variant="secondary" onClick={onCancel} disabled={applying}>Cancelar</Button>
                        <Button variant="success" onClick={onConfirm} loading={applying} disabled={!understood || preview.consultations === 0}>
                            <Wand2 size={16} /> Aplicar corrección
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}

function BatchesPanel({ batches, loading, onRevert }) {
    return (
        <section className="rounded-xl border border-slate-200 bg-white">
            <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                <History size={18} className="text-slate-500" />
                <h2 className="font-semibold text-slate-900">Cambios aplicados</h2>
            </header>
            {loading ? (
                <p className="px-4 py-6 text-sm text-slate-500">Cargando...</p>
            ) : batches.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500">Todavía no se aplicó ninguna corrección.</p>
            ) : (
                <ul className="divide-y divide-slate-100">
                    {batches.map(batch => (
                        <li key={batch.id} className="flex flex-col gap-2 px-4 py-3 text-sm md:flex-row md:items-center md:justify-between">
                            <div>
                                <p className="font-medium text-slate-900">
                                    Lote #{batch.id} · {formatNumber(batch.consultations)} consultas · {formatNumber(batch.changes)} valores
                                </p>
                                <p className="text-xs text-slate-500">
                                    {batch.case_label} · {toDisplayDateTime(batch.created_at)} · {batch.user || 'Usuario eliminado'}
                                </p>
                                {batch.reverted_at && (
                                    <p className="text-xs text-amber-700">
                                        Deshecho el {toDisplayDateTime(batch.reverted_at)} por {batch.reverted_by || '—'}
                                        {batch.revert_summary?.skipped_consultations > 0 &&
                                            ` · ${formatNumber(batch.revert_summary.skipped_consultations)} consultas se dejaron porque se editaron después`}
                                    </p>
                                )}
                            </div>
                            {!batch.reverted_at && (
                                <Button size="sm" variant="secondary" onClick={() => onRevert(batch)}>
                                    <Undo2 size={14} /> Deshacer
                                </Button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

export default function LegacyReviewPage() {
    const { addToast } = useToast();
    const [cases, setCases] = useState([]);
    const [caseKey, setCaseKey] = useState(null);
    const caseInfo = useMemo(() => cases.find(item => item.key === caseKey) ?? null, [cases, caseKey]);

    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounced(search, 350);
    const [status, setStatus] = useState('todas');
    const { control, watch } = useForm({ defaultValues: { from: '', to: '' } });
    const from = watch('from');
    const to = watch('to');
    const [page, setPage] = useState(1);

    const [rows, setRows] = useState([]);
    const [pagination, setPagination] = useState(null);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const requestId = useRef(0);

    const [selection, setSelection] = useState(emptySelection);

    const [previewOpen, setPreviewOpen] = useState(false);
    const [preview, setPreview] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [applying, setApplying] = useState(false);

    const [batches, setBatches] = useState([]);
    const [batchesLoading, setBatchesLoading] = useState(true);
    const [revertTarget, setRevertTarget] = useState(null);

    const filters = useMemo(() => {
        const value = { status };
        if (debouncedSearch.trim()) value.search = debouncedSearch.trim();
        if (from) value.from = from;
        if (to) value.to = to;
        return value;
    }, [status, debouncedSearch, from, to]);

    useEffect(() => {
        getLegacyReviewCases()
            .then(r => {
                const list = getList(r);
                setCases(list);
                setCaseKey(current => current ?? list[0]?.key ?? null);
            })
            .catch(e => {
                setLoading(false);
                setLoadError(errorMessage(e, 'No se pudieron cargar los casos de revisión.'));
            });
    }, []);

    const loadBatches = useCallback(() => {
        setBatchesLoading(true);
        getLegacyReviewBatches()
            .then(r => setBatches(getList(r)))
            .catch(() => setBatches([]))
            .finally(() => setBatchesLoading(false));
    }, []);

    useEffect(() => { loadBatches(); }, [loadBatches]);

    // Otro caso tiene otras columnas y otros filtros: se limpia lo del anterior.
    const changeCase = (key) => {
        setCaseKey(key);
        setStatus('todas');
        setRows([]);
        setSummary(null);
        setPagination(null);
    };

    // Cambiar filtros o caso vuelve a la pagina 1 y a la seleccion por defecto.
    useEffect(() => {
        setPage(1);
        setSelection(emptySelection());
    }, [filters, caseKey]);

    const loadRows = useCallback(() => {
        if (!caseKey) return;
        const id = ++requestId.current;
        setLoading(true);
        setLoadError(null);
        getLegacyReviewRows(caseKey, { ...filters, page, per_page: 25 })
            .then(r => {
                if (id !== requestId.current) return;
                setRows(getList(r));
                setPagination(getPagination(r));
                setSummary(r.data?.summary ?? null);
            })
            .catch(e => {
                if (id !== requestId.current) return;
                setLoadError(errorMessage(e, 'No se pudieron cargar las consultas.'));
            })
            .finally(() => {
                if (id === requestId.current) setLoading(false);
            });
    }, [caseKey, filters, page]);

    useEffect(() => { loadRows(); }, [loadRows]);

    const toggleRow = (row) => {
        if (!row.selectable) return;
        setSelection(current => {
            const next = { ...current, except: new Set(current.except), include: new Set(current.include), ids: new Set(current.ids) };
            const checked = isChecked(row, current);
            if (current.mode === 'manual') {
                checked ? next.ids.delete(row.id) : next.ids.add(row.id);
            } else if (row.preselected) {
                checked ? next.except.add(row.id) : next.except.delete(row.id);
            } else {
                checked ? next.include.delete(row.id) : next.include.add(row.id);
            }
            return next;
        });
    };

    const pageSelectable = rows.filter(row => row.selectable);
    const pageAllChecked = pageSelectable.length > 0 && pageSelectable.every(row => isChecked(row, selection));

    const togglePage = () => {
        setSelection(current => {
            const next = { ...current, except: new Set(current.except), include: new Set(current.include), ids: new Set(current.ids) };
            pageSelectable.forEach(row => {
                if (current.mode === 'manual') {
                    pageAllChecked ? next.ids.delete(row.id) : next.ids.add(row.id);
                } else if (row.preselected) {
                    pageAllChecked ? next.except.add(row.id) : next.except.delete(row.id);
                } else {
                    pageAllChecked ? next.include.delete(row.id) : next.include.add(row.id);
                }
            });
            return next;
        });
    };

    const count = selectedCount(selection, pagination);

    const openPreview = () => {
        setPreviewOpen(true);
        setPreview(null);
        setPreviewLoading(true);
        previewLegacyReview(caseKey, selectionPayload(selection, filters))
            .then(r => setPreview(getPayload(r)))
            .catch(e => {
                setPreviewOpen(false);
                addToast(errorMessage(e, 'No se pudo calcular la vista previa.'), 'error');
            })
            .finally(() => setPreviewLoading(false));
    };

    const revert = (batch) => {
        revertLegacyReviewBatch(batch.id)
            .then(r => {
                const summaryData = getPayload(r)?.revert_summary ?? {};
                const skipped = summaryData.skipped_consultations ?? 0;
                addToast(
                    skipped > 0
                        ? `Se deshizo el lote. ${formatNumber(skipped)} consultas se dejaron porque se editaron después.`
                        : 'Se deshizo el lote.',
                    skipped > 0 ? 'warning' : 'success',
                );
                loadRows();
                loadBatches();
            })
            .catch(e => addToast(errorMessage(e, 'No se pudo deshacer el lote.'), 'error'));
    };

    const apply = () => {
        setApplying(true);
        applyLegacyReview(caseKey, selectionPayload(selection, filters))
            .then(r => {
                const batch = getPayload(r);
                setPreviewOpen(false);
                addToast(
                    `Se corrigieron ${formatNumber(batch.consultations)} consultas (${formatNumber(batch.changes)} valores).`,
                    'success',
                    10000,
                    { label: 'Deshacer', onClick: () => revert(batch) },
                );
                setSelection(emptySelection());
                loadRows();
                loadBatches();
            })
            .catch(e => addToast(errorMessage(e, 'No se pudo aplicar la corrección.'), 'error'))
            .finally(() => setApplying(false));
    };

    const columns = caseInfo?.columns ?? [];
    const rowColumns = caseInfo?.row_columns ?? [];
    const statusStyles = caseInfo?.statuses ?? {};
    const flagStyles = caseInfo?.flags ?? {};
    const cards = caseInfo?.cards ?? [];

    return (
        <div className="min-h-full bg-slate-50 px-4 py-6 md:px-8">
            <div className="mx-auto max-w-7xl space-y-6">
                <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Administracion</p>
                        <h1 className="mt-2 text-3xl font-bold text-slate-950">Revisión de datos heredados</h1>
                        <p className="mt-2 max-w-3xl text-sm text-slate-600">
                            Consultas importadas del sistema anterior con un dato guardado en otro campo. Revise lo que hay,
                            lo que se propone, y aplique la corrección. Cada corrección se puede deshacer.
                        </p>
                    </div>
                    <Button variant="secondary" onClick={() => { loadRows(); loadBatches(); }} disabled={loading}>
                        <RefreshCw size={16} /> Actualizar
                    </Button>
                </header>

                <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                        <label className="text-sm font-medium text-slate-700" htmlFor="legacy-case">Problema</label>
                        <select
                            id="legacy-case"
                            value={caseKey ?? ''}
                            onChange={e => changeCase(e.target.value)}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:min-w-[28rem]"
                        >
                            {cases.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
                        </select>
                    </div>
                    {caseInfo?.description && <p className="text-sm text-slate-600">{caseInfo.description}</p>}

                    {summary && (
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
                            {cards.map(card => (
                                <button
                                    key={card.label}
                                    type="button"
                                    disabled={!card.filter}
                                    onClick={() => card.filter && setStatus(card.filter)}
                                    className={`rounded-lg border p-3 text-left transition-colors ${card.filter && status === card.filter ? 'border-navy bg-slate-50' : 'border-slate-200 hover:bg-slate-50'} disabled:cursor-default disabled:hover:bg-white`}
                                >
                                    <p className="text-xs text-slate-500">{card.label}</p>
                                    <p className={`text-2xl font-bold ${tone(card.tone).text}`}>{formatNumber(cardValue(summary, card.match))}</p>
                                </button>
                            ))}
                        </div>
                    )}
                    {summary?.ok > 0 && (
                        <p className="text-xs text-slate-500">
                            {formatNumber(summary.ok)} consultas ya están correctas y no se listan.
                        </p>
                    )}
                </section>

                <section className="rounded-xl border border-slate-200 bg-white">
                    <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-[1fr_14rem_10rem_10rem] md:items-end">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="legacy-search">Buscar</label>
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    id="legacy-search"
                                    type="search"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Paciente, cédula, código o N° del Access"
                                    className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="legacy-status">Estado</label>
                            <select
                                id="legacy-status"
                                value={status}
                                onChange={e => setStatus(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            >
                                {(caseInfo?.filters ?? []).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                        </div>
                        <DateInput control={control} name="from" label="Desde" />
                        <DateInput control={control} name="to" label="Hasta" />
                    </div>

                    <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 md:flex-row md:items-center md:justify-between">
                        <div className="text-sm text-slate-700">
                            <span className="font-semibold">{formatNumber(count)}</span> seleccionadas
                            {selection.mode === 'all' && <span className="text-slate-500"> · todas las preseleccionadas del filtro</span>}
                            <span className="ml-3 inline-flex gap-2">
                                <button type="button" className="text-navy underline" onClick={() => setSelection(emptySelection())}>
                                    Preseleccionadas
                                </button>
                                <button type="button" className="text-navy underline" onClick={() => setSelection(emptySelection('manual'))}>
                                    Ninguna
                                </button>
                            </span>
                        </div>
                        <Button variant="success" onClick={openPreview} disabled={count === 0 || loading || !caseKey}>
                            <Wand2 size={16} /> Revisar y aplicar
                        </Button>
                    </div>

                    {loadError ? (
                        <div className="flex items-center gap-2 px-4 py-8 text-sm text-red-700">
                            <AlertTriangle size={18} /> {loadError}
                        </div>
                    ) : (
                        <div className="relative overflow-x-auto">
                            {loading && (
                                <div className="absolute inset-0 z-10 flex items-start justify-center bg-white/60 pt-16">
                                    <Loader2 size={24} className="animate-spin text-slate-500" />
                                </div>
                            )}
                            <table className="w-full min-w-[60rem] text-sm">
                                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="w-10 px-3 py-2">
                                            <input
                                                type="checkbox"
                                                aria-label="Seleccionar la página"
                                                className="h-4 w-4 accent-navy"
                                                checked={pageAllChecked}
                                                disabled={pageSelectable.length === 0}
                                                onChange={togglePage}
                                            />
                                        </th>
                                        <th className="px-3 py-2 text-left">Paciente</th>
                                        <th className="px-3 py-2 text-left">Consulta</th>
                                        <th className="px-3 py-2 text-left">Ojo</th>
                                        {columns.map(column => <th key={column.key} className="px-3 py-2 text-left">{column.label}</th>)}
                                        {rowColumns.map(column => <th key={column.key} className="px-3 py-2 text-left">{column.label}</th>)}
                                        <th className="px-3 py-2 text-left">Avisos</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {!loading && rows.length === 0 && (
                                        <tr>
                                            <td colSpan={5 + columns.length + rowColumns.length} className="px-4 py-10 text-center text-slate-500">
                                                No hay consultas para revisar con estos filtros.
                                            </td>
                                        </tr>
                                    )}
                                    {rows.map(row => ['od', 'oi'].map((eye, index) => {
                                        const eyeData = row.eyes?.[eye] ?? {};
                                        const statusStyle = statusStyles[eyeData.status] ?? { label: eyeData.status ?? '—', tone: 'muted' };
                                        const checked = isChecked(row, selection);
                                        return (
                                            <tr
                                                key={`${row.id}-${eye}`}
                                                className={`${index === 0 ? 'border-t border-slate-200' : ''} ${checked ? 'bg-emerald-50/40' : ''}`}
                                            >
                                                {index === 0 && (
                                                    <>
                                                        <td rowSpan={2} className="px-3 py-2 align-top">
                                                            <input
                                                                type="checkbox"
                                                                aria-label={`Seleccionar la consulta de ${row.patient?.nombre_completo}`}
                                                                className="h-4 w-4 accent-navy"
                                                                checked={checked}
                                                                disabled={!row.selectable}
                                                                title={row.selectable ? '' : 'Esta consulta no tiene nada que se pueda mover'}
                                                                onChange={() => toggleRow(row)}
                                                            />
                                                        </td>
                                                        <td rowSpan={2} className="px-3 py-2 align-top">
                                                            <p className="font-medium text-slate-900">{row.patient?.nombre_completo}</p>
                                                            <p className="text-xs text-slate-500">
                                                                {[row.patient?.codigo_interno, row.patient?.cedula].filter(Boolean).join(' · ')}
                                                            </p>
                                                        </td>
                                                        <td rowSpan={2} className="px-3 py-2 align-top">
                                                            <p className="text-slate-900">{toDisplayDate(row.fecha_consulta)}</p>
                                                            <p className="text-xs text-slate-500">{row.legacy_id ? `N° Access ${row.legacy_id}` : 'Sistema nuevo'}</p>
                                                            <a
                                                                href={`/consulta/${row.id}/ver`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="mt-1 inline-flex items-center gap-1 text-xs text-navy underline"
                                                            >
                                                                Ver consulta <ExternalLink size={12} />
                                                            </a>
                                                        </td>
                                                    </>
                                                )}
                                                <td className="px-3 py-1.5">
                                                    <span className="mr-2 font-semibold uppercase text-slate-700">{eye}</span>
                                                    <span className={`rounded px-1.5 py-0.5 text-[11px] ${tone(statusStyle.tone).badge}`}>{statusStyle.label}</span>
                                                </td>
                                                {columns.map(column => (
                                                    <td key={column.key} className="px-3 py-1.5">
                                                        <ValueChange current={eyeData.current?.[column.key]} proposed={eyeData.proposed?.[column.key]} />
                                                    </td>
                                                ))}
                                                {index === 0 && (
                                                    <>
                                                        {rowColumns.map(column => (
                                                            <td key={column.key} rowSpan={2} className="max-w-[18rem] px-3 py-2 align-top text-xs text-slate-600">
                                                                <ValueChange current={row.fields?.[column.key]?.current} proposed={row.fields?.[column.key]?.proposed} />
                                                            </td>
                                                        ))}
                                                        <td rowSpan={2} className="px-3 py-2 align-top">
                                                            <div className="flex flex-wrap gap-1">
                                                                {(row.flags ?? []).map(flag => {
                                                                    const style = flagStyles[flag];
                                                                    return style ? <Pill key={flag} className={tone(style.tone).pill} title={style.title}>{style.label}</Pill> : null;
                                                                })}
                                                            </div>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        );
                                    }))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {pagination && pagination.last_page > 1 && (
                        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
                            <span>{formatNumber(pagination.total)} consultas</span>
                            <div className="flex items-center gap-2">
                                <Button size="sm" variant="ghost" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                                <span>Página {pagination.current_page} de {pagination.last_page}</span>
                                <Button size="sm" variant="ghost" disabled={page >= pagination.last_page || loading} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
                            </div>
                        </div>
                    )}
                </section>

                <BatchesPanel batches={batches} loading={batchesLoading} onRevert={setRevertTarget} />
            </div>

            <PreviewModal
                open={previewOpen}
                preview={preview}
                loading={previewLoading}
                applying={applying}
                caseInfo={caseInfo}
                onCancel={() => setPreviewOpen(false)}
                onConfirm={apply}
            />

            <ConfirmModal
                open={revertTarget !== null}
                title="Deshacer corrección"
                message={revertTarget
                    ? `Se devolverán los valores del lote #${revertTarget.id} (${formatNumber(revertTarget.consultations)} consultas). Lo que se haya editado después se deja como está.`
                    : ''}
                confirmLabel="Deshacer"
                variant="primary"
                onCancel={() => setRevertTarget(null)}
                onConfirm={() => { const batch = revertTarget; setRevertTarget(null); revert(batch); }}
            />
        </div>
    );
}
