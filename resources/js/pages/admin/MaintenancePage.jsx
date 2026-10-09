import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    Database,
    Download,
    FileArchive,
    Loader2,
    Play,
    RefreshCw,
    Upload,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { prefersReducedMotion } from '../../utils/motion';
import {
    analyzeLegacyImport,
    createBackup,
    downloadBackup,
    getBackups,
    getLegacyImport,
    restoreSystemBackup,
    runLegacyImport,
    uploadLegacyImport,
} from '../../api/maintenance';

const ACTIVE_STATUSES = new Set(['pending', 'processing', 'queued_analysis', 'analyzing', 'queued_import', 'importing', 'restoring']);
const DOWNLOADABLE_STATUSES = new Set(['completed']);

function formatDate(value) {
    if (!value) return 'Pendiente';
    return new Date(value).toLocaleString();
}

function formatBytes(value) {
    if (!value) return '-';
    if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function uploadErrorMessage(error) {
    if (error.response?.status === 413) {
        return 'El servidor rechazo el archivo por tamano. Aumenta client_max_body_size en Forge/Nginx y upload_max_filesize/post_max_size en PHP.';
    }

    return error.response?.data?.message || 'Archivo invalido';
}

const PROCESS_RATE_KEY = 'maintenance.processMsPerMb';
const DEFAULT_PROCESS_MS_PER_MB = 4000;
const MIN_PROCESS_ESTIMATE_MS = 3000;
const MEGABYTE = 1024 * 1024;

function formatDuration(ms) {
    const seconds = Math.max(1, Math.round(ms / 1000));
    if (seconds < 60) return `${seconds} s`;
    return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

/**
 * El servidor no informa avance mientras procesa el archivo, asi que el
 * estimado sale de lo que tardo la carga anterior en este navegador.
 */
function estimateProcessMs(fileSize) {
    let rate = DEFAULT_PROCESS_MS_PER_MB;
    try {
        const stored = Number(window.localStorage.getItem(PROCESS_RATE_KEY));
        if (stored > 0) rate = stored;
    } catch {
        // sin almacenamiento local se usa el valor por defecto
    }

    return Math.max(MIN_PROCESS_ESTIMATE_MS, rate * (fileSize / MEGABYTE));
}

function rememberProcessRate(durationMs, fileSize) {
    try {
        window.localStorage.setItem(PROCESS_RATE_KEY, String(durationMs / Math.max(fileSize / MEGABYTE, 0.1)));
    } catch {
        // el estimado es una ayuda, no un requisito
    }
}

/**
 * Avance de una subida o restauracion. El envio del archivo se mide en bytes;
 * la etapa del servidor solo puede mostrarse por tiempo transcurrido.
 */
function OperationProgress({ progress }) {
    const { kind, phase, fileName, fileSize, loaded, total, startedAt, phaseStartedAt, finishedAt, estimateMs, message } = progress;
    const active = phase === 'uploading' || phase === 'processing';
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        if (!active) return undefined;
        const timer = setInterval(() => setNow(Date.now()), 500);
        return () => clearInterval(timer);
    }, [active]);

    const isUpload = kind === 'upload';
    let label;
    let detail;
    let percent = 100;
    let barClass = 'bg-[#1a2a4a]';
    let Icon = Loader2;
    let iconClass = 'animate-spin text-slate-500';

    if (phase === 'uploading') {
        const elapsed = now - startedAt;
        percent = total > 0 ? Math.min(100, (loaded / total) * 100) : 0;
        label = 'Paso 1 de 2 · Enviando archivo';
        detail = `${Math.round(percent)}%`;
        if (loaded > 0 && loaded < total && elapsed > 0) {
            detail += ` · quedan ~${formatDuration((elapsed * (total - loaded)) / loaded)}`;
        }
    } else if (phase === 'processing') {
        const elapsed = Math.max(0, now - phaseStartedAt);
        label = isUpload ? 'Paso 2 de 2 · Procesando en el servidor' : 'Restaurando base de datos';
        detail = `Transcurrido ${formatDuration(elapsed)}`;
        if (estimateMs) {
            percent = Math.min(95, (elapsed / estimateMs) * 95);
            detail += elapsed > estimateMs
                ? ' · esta tardando mas de lo habitual, sigue en proceso'
                : ` · estimado ~${formatDuration(estimateMs)}`;
        } else {
            barClass += ' animate-pulse';
        }
    } else if (phase === 'done') {
        label = isUpload ? 'Carga completada' : 'Restauracion completada';
        detail = `Termino en ${formatDuration(finishedAt - startedAt)}`;
        barClass = 'bg-emerald-500';
        Icon = CheckCircle2;
        iconClass = 'text-emerald-600';
    } else {
        label = isUpload ? 'La carga fallo' : 'La restauracion fallo';
        detail = message;
        barClass = 'bg-rose-500';
        Icon = AlertTriangle;
        iconClass = 'text-rose-600';
    }

    return (
        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4" role="status" aria-live="polite">
            <div className="flex items-start gap-3">
                <Icon size={18} className={`mt-0.5 shrink-0 ${iconClass}`} />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{label}</p>
                    <p className="truncate text-xs text-slate-500">
                        {fileName}{fileSize ? ` · ${formatBytes(fileSize)}` : ''}
                    </p>
                </div>
            </div>
            <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(percent)}
                aria-label={label}
                className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"
            >
                <div
                    className={`h-full rounded-full ${barClass} ${prefersReducedMotion() ? '' : 'transition-[width] duration-500 ease-out'}`}
                    style={{ width: `${percent}%` }}
                />
            </div>
            <p className={`mt-2 text-xs ${phase === 'failed' ? 'text-rose-700' : 'text-slate-600'}`}>{detail}</p>
        </div>
    );
}

function StatusPill({ status }) {
    const styles = {
        completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        analyzed: 'bg-blue-50 text-blue-700 border-blue-200',
        failed: 'bg-rose-50 text-rose-700 border-rose-200',
        uploaded: 'bg-slate-50 text-slate-700 border-slate-200',
    };

    return (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[status] || 'bg-amber-50 text-amber-700 border-amber-200'}`}>
            {status}
        </span>
    );
}

function Stat({ label, value }) {
    return (
        <div className="border-l border-slate-200 pl-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{value ?? 0}</p>
        </div>
    );
}

export default function MaintenancePage() {
    const { addToast } = useToast();
    const fileRef = useRef(null);
    const [backups, setBackups] = useState([]);
    const [backupBusy, setBackupBusy] = useState(false);
    const [importOperation, setImportOperation] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [importing, setImporting] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [rewriteLegacy, setRewriteLegacy] = useState(true);
    const [confirmBackup, setConfirmBackup] = useState(false);
    const [confirmRestore, setConfirmRestore] = useState(false);
    const [progress, setProgress] = useState(null);

    // El resultado correcto se retira solo: debajo ya queda el resumen. El
    // fallido se queda hasta el siguiente intento, porque el toast desaparece.
    useEffect(() => {
        if (progress?.phase !== 'done') return undefined;
        const timer = setTimeout(() => setProgress(null), 8000);
        return () => clearTimeout(timer);
    }, [progress?.phase]);

    const summary = importOperation?.summary || {};
    const stats = summary.stats || {};
    const sourceCounts = summary.source_counts || {};
    const isSystemRestore = importOperation?.type === 'system_restore';
    const isLegacyImport = importOperation?.type === 'legacy_import';
    const canRunImport = importOperation?.status === 'analyzed'
        && isLegacyImport
        && Number(stats.errors || 0) === 0
        && confirmBackup;
    const canRestoreSystem = isSystemRestore
        && importOperation?.status === 'uploaded'
        && confirmRestore;

    const activeImport = importOperation && ACTIVE_STATUSES.has(importOperation.status);
    const activeBackup = useMemo(() => backups.some((backup) => ACTIVE_STATUSES.has(backup.status)), [backups]);

    const loadBackups = async () => {
        const response = await getBackups();
        setBackups(response.data.data || []);
    };

    useEffect(() => {
        loadBackups().catch(() => {});
    }, []);

    useEffect(() => {
        if (!activeImport && !activeBackup) return undefined;

        const timer = setInterval(async () => {
            try {
                await loadBackups();
                if (importOperation?.id) {
                    const response = await getLegacyImport(importOperation.id);
                    setImportOperation(response.data.data);
                }
            } catch {
                // polling silencioso
            }
        }, 4000);

        return () => clearInterval(timer);
    }, [activeImport, activeBackup, importOperation?.id]);

    const handleCreateBackup = async () => {
        setBackupBusy(true);
        try {
            const response = await createBackup();
            await loadBackups();
            addToast(response.data.data?.status === 'completed' ? 'Backup listo para descargar' : 'Backup en cola', 'success');
        } catch {
            addToast('No se pudo generar el backup', 'error');
        } finally {
            setBackupBusy(false);
        }
    };

    const handleDownloadBackup = async (backup) => {
        try {
            const response = await downloadBackup(backup.id);
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.download = backup.original_filename || `backup-${backup.id}.gz`;
            link.click();
            window.URL.revokeObjectURL(url);
        } catch {
            addToast('No se pudo descargar el backup', 'error');
        }
    };

    const handleUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const startedAt = Date.now();
        let processingStartedAt = null;

        setUploading(true);
        setProgress({
            kind: 'upload',
            phase: 'uploading',
            fileName: file.name,
            fileSize: file.size,
            loaded: 0,
            total: file.size,
            startedAt,
            estimateMs: estimateProcessMs(file.size),
        });
        addToast(`Subiendo ${file.name} (${formatBytes(file.size)}). No cierres esta pagina.`, 'info', null, null, 'Carga iniciada');

        try {
            const response = await uploadLegacyImport(file, {
                onUploadProgress: (event) => {
                    const total = event.total || file.size;
                    const sent = event.loaded >= total;
                    if (sent && processingStartedAt === null) processingStartedAt = Date.now();

                    setProgress((current) => (current?.phase === 'uploading' ? {
                        ...current,
                        loaded: event.loaded,
                        total,
                        ...(sent ? { phase: 'processing', phaseStartedAt: processingStartedAt } : {}),
                    } : current));
                },
            });
            const finishedAt = Date.now();

            if (processingStartedAt !== null) rememberProcessRate(finishedAt - processingStartedAt, file.size);
            setImportOperation(response.data.data);
            setConfirmBackup(false);
            setConfirmRestore(false);
            setProgress((current) => current && { ...current, phase: 'done', finishedAt });
            addToast(
                `${response.data.data?.type === 'system_restore' ? 'Backup del sistema validado' : 'Archivo legacy validado'} en ${formatDuration(finishedAt - startedAt)}`,
                'success',
            );
        } catch (error) {
            const message = uploadErrorMessage(error);
            setProgress((current) => current && { ...current, phase: 'failed', message });
            addToast(message, 'error');
        } finally {
            setUploading(false);
            event.target.value = '';
        }
    };

    const handleAnalyze = async () => {
        if (!importOperation?.id) return;
        setAnalyzing(true);
        try {
            const response = await analyzeLegacyImport(importOperation.id);
            setImportOperation(response.data.data);
            addToast('Analisis en cola', 'success');
        } catch (error) {
            addToast(error.response?.data?.message || 'No se pudo analizar', 'error');
        } finally {
            setAnalyzing(false);
        }
    };

    const handleRunImport = async () => {
        if (!importOperation?.id) return;
        setImporting(true);
        try {
            const response = await runLegacyImport(importOperation.id, {
                rewrite_legacy: rewriteLegacy,
                confirm_backup: confirmBackup,
            });
            setImportOperation(response.data.data);
            addToast('Importacion en cola', 'success');
        } catch (error) {
            addToast(error.response?.data?.message || 'No se pudo importar', 'error');
        } finally {
            setImporting(false);
        }
    };

    const handleRestoreSystem = async () => {
        if (!importOperation?.id) return;
        const startedAt = Date.now();

        setRestoring(true);
        setProgress({
            kind: 'restore',
            phase: 'processing',
            fileName: importOperation.original_filename,
            fileSize: importOperation.file_size,
            startedAt,
            phaseStartedAt: startedAt,
        });
        addToast('Restaurando la base de datos. No cierres esta pagina.', 'info', null, null, 'Restauracion iniciada');

        try {
            const response = await restoreSystemBackup(importOperation.id, {
                confirm_restore: confirmRestore,
            });
            const finishedAt = Date.now();
            setImportOperation(response.data.data);
            setProgress((current) => current && { ...current, phase: 'done', finishedAt });
            addToast(`Backup restaurado en ${formatDuration(finishedAt - startedAt)}`, 'success');
        } catch (error) {
            const message = error.response?.data?.message || 'No se pudo restaurar';
            setProgress((current) => current && { ...current, phase: 'failed', message });
            addToast(message, 'error');
        } finally {
            setRestoring(false);
        }
    };

    return (
        <div className="min-h-full bg-slate-50 p-6">
            <div className="mx-auto max-w-6xl space-y-8">
                <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Administracion</p>
                        <h1 className="mt-2 text-3xl font-bold text-slate-950">Backups e importacion</h1>
                        <p className="mt-2 max-w-2xl text-sm text-slate-600">
                            Genera respaldos privados, restaura ambientes desde backups del sistema y ejecuta importaciones legacy con analisis previo.
                        </p>
                    </div>
                    <Button onClick={handleCreateBackup} loading={backupBusy || activeBackup}>
                        <Database size={18} /> Generar backup
                    </Button>
                </header>

                <section className="grid gap-4 md:grid-cols-4">
                    <Stat label="Backups visibles" value={backups.length} />
                    <Stat label="Clientes fuente" value={sourceCounts.CLIENTES} />
                    <Stat label="Historias fuente" value={sourceCounts['HISTORIAL OPTAMOLOGIA']} />
                    <Stat label="Errores dry-run" value={stats.errors} />
                </section>

                <section className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
                    <div className="rounded-lg border border-slate-200 bg-white p-5">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-950">Backups recientes</h2>
                                <p className="mt-1 text-sm text-slate-500">Retencion automatica: 7 dias.</p>
                            </div>
                            <button
                                type="button"
                                onClick={loadBackups}
                                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            >
                                <RefreshCw size={18} />
                            </button>
                        </div>

                        <div className="mt-5 divide-y divide-slate-100">
                            {backups.length === 0 && (
                                <p className="py-8 text-sm text-slate-500">Todavia no hay backups generados desde el panel.</p>
                            )}
                            {backups.map((backup) => (
                                <div key={backup.id} className="flex items-center gap-3 py-3">
                                    <FileArchive size={18} className="text-slate-400" />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-slate-900">{backup.original_filename || `Backup #${backup.id}`}</p>
                                        <p className="text-xs text-slate-500">{formatDate(backup.created_at)} · {formatBytes(backup.file_size)}</p>
                                    </div>
                                    <StatusPill status={backup.status} />
                                    <button
                                        type="button"
                                        disabled={!DOWNLOADABLE_STATUSES.has(backup.status)}
                                        onClick={() => handleDownloadBackup(backup)}
                                        title={DOWNLOADABLE_STATUSES.has(backup.status) ? 'Descargar backup' : 'Disponible cuando el backup termine'}
                                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <Download size={17} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-5">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-950">Importar o restaurar backup</h2>
                                <p className="mt-1 text-sm text-slate-500">Acepta backups del sistema (.sqlite.gz o .sql.gz de MySQL/MariaDB), restaurables en cualquiera de los tres motores, y archivos legacy Optica Andina.</p>
                            </div>
                            <input ref={fileRef} type="file" accept=".sqlite,.sqlite3,.db,.sql,.gz" onChange={handleUpload} className="hidden" />
                            <Button variant="secondary" onClick={() => fileRef.current?.click()} loading={uploading}>
                                <Upload size={18} /> Subir backup
                            </Button>
                        </div>

                        {progress && <OperationProgress progress={progress} />}

                        {importOperation ? (
                            <div className="mt-6 space-y-5">
                                <div className="rounded-lg bg-slate-50 p-4">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <StatusPill status={importOperation.status} />
                                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                                            {isSystemRestore ? 'Backup del sistema' : 'Legacy Optica Andina'}
                                        </span>
                                        <p className="text-sm font-medium text-slate-900">{importOperation.original_filename}</p>
                                        <p className="text-sm text-slate-500">{formatBytes(importOperation.file_size)}</p>
                                    </div>
                                    {importOperation.error_message && (
                                        <p className="mt-3 text-sm text-rose-600">{importOperation.error_message}</p>
                                    )}
                                </div>

                                {isSystemRestore ? (
                                    <div className="space-y-5">
                                        <div className="grid gap-4 sm:grid-cols-3">
                                            <Stat label="Tablas backup" value={summary.tables} />
                                            <Stat label="Pacientes backup" value={summary.patients} />
                                            <Stat label="Historias backup" value={summary.consultations} />
                                        </div>

                                        {summary.converted_from && (
                                            <p className="text-sm text-slate-600">
                                                Backup de MySQL/MariaDB convertido: {summary.converted_from.loaded_rows} filas en {summary.converted_from.loaded_tables} tablas.
                                                {summary.converted_from.pending_migrations_applied?.length > 0
                                                    && ` Se aplicaron ${summary.converted_from.pending_migrations_applied.length} migraciones que el backup no traia.`}
                                            </p>
                                        )}

                                        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                                            <AlertTriangle size={18} className="shrink-0" />
                                            Esta accion reemplaza toda la base de datos actual por el backup subido. Antes de restaurar se generara un backup de seguridad del ambiente actual.
                                        </div>

                                        <div className="space-y-3 border-t border-slate-100 pt-5">
                                            <label className="flex items-start gap-3 text-sm text-slate-700">
                                                <input
                                                    type="checkbox"
                                                    checked={confirmRestore}
                                                    onChange={(event) => setConfirmRestore(event.target.checked)}
                                                    className="mt-1 h-4 w-4 accent-[#1a2a4a]"
                                                />
                                                <span>Entiendo que se reemplazara toda la base de datos actual con este backup.</span>
                                            </label>
                                            <Button onClick={handleRestoreSystem} disabled={!canRestoreSystem} loading={restoring || importOperation.status === 'restoring'}>
                                                <Database size={18} /> Restaurar sistema
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="grid gap-4 sm:grid-cols-3">
                                            <Stat label="Pacientes crear" value={stats.patients_created} />
                                            <Stat label="Historias crear" value={stats.consultations_created} />
                                            <Stat label="Placeholders" value={stats.placeholder_patients_created} />
                                        </div>

                                        {stats.errors > 0 && (
                                            <div className="flex gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                                                <AlertTriangle size={18} className="shrink-0" />
                                                El dry-run reporto errores. Revisa el log antes de intentar importar.
                                            </div>
                                        )}

                                        <div className="flex flex-wrap gap-3">
                                            <Button variant="secondary" onClick={handleAnalyze} loading={analyzing || ['queued_analysis', 'analyzing'].includes(importOperation.status)}>
                                                <Loader2 size={18} /> Analizar dry-run
                                            </Button>
                                        </div>

                                        <div className="space-y-3 border-t border-slate-100 pt-5">
                                            <label className="flex items-start gap-3 text-sm text-slate-700">
                                                <input
                                                    type="checkbox"
                                                    checked={rewriteLegacy}
                                                    onChange={(event) => setRewriteLegacy(event.target.checked)}
                                                    className="mt-1 h-4 w-4 accent-[#1a2a4a]"
                                                />
                                                <span>Reescribir datos legacy importados anteriormente y podar placeholders vacios.</span>
                                            </label>
                                            <label className="flex items-start gap-3 text-sm text-slate-700">
                                                <input
                                                    type="checkbox"
                                                    checked={confirmBackup}
                                                    onChange={(event) => setConfirmBackup(event.target.checked)}
                                                    className="mt-1 h-4 w-4 accent-[#1a2a4a]"
                                                />
                                                <span>Entiendo que se reemplazaran datos legacy y que el sistema generara un backup previo automatico.</span>
                                            </label>
                                            <Button onClick={handleRunImport} disabled={!canRunImport} loading={importing || ['queued_import', 'importing'].includes(importOperation.status)}>
                                                <Play size={18} /> Importar ahora
                                            </Button>
                                        </div>
                                    </>
                                )}

                                {importOperation.status === 'completed' && (
                                    <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                                        <CheckCircle2 size={18} className="shrink-0" />
                                        {isSystemRestore ? 'Restauracion completada.' : `Importacion completada. Se genero backup previo #${importOperation.backup_operation_id}.`}
                                    </div>
                                )}

                                {importOperation.log && (
                                    <details className="rounded-lg border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100">
                                        <summary className="cursor-pointer text-sm font-semibold text-white">Ver log tecnico</summary>
                                        <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap">{importOperation.log}</pre>
                                    </details>
                                )}
                            </div>
                        ) : (
                            <div className="mt-6 rounded-lg border border-dashed border-slate-300 p-8 text-center">
                                <Upload className="mx-auto text-slate-400" size={30} />
                                <p className="mt-3 text-sm font-medium text-slate-800">Sube un backup SQLite o MySQL/MariaDB</p>
                                <p className="mt-1 text-sm text-slate-500">El sistema detectara si es restauracion completa o importacion legacy.</p>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
