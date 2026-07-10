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
import {
    analyzeLegacyImport,
    createBackup,
    downloadBackup,
    getBackups,
    getLegacyImport,
    runLegacyImport,
    uploadLegacyImport,
} from '../../api/maintenance';

const ACTIVE_STATUSES = new Set(['pending', 'processing', 'queued_analysis', 'analyzing', 'queued_import', 'importing']);
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
    const [rewriteLegacy, setRewriteLegacy] = useState(true);
    const [confirmBackup, setConfirmBackup] = useState(false);

    const summary = importOperation?.summary || {};
    const stats = summary.stats || {};
    const sourceCounts = summary.source_counts || {};
    const canRunImport = importOperation?.status === 'analyzed'
        && Number(stats.errors || 0) === 0
        && confirmBackup;

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

        setUploading(true);
        try {
            const response = await uploadLegacyImport(file);
            setImportOperation(response.data.data);
            setConfirmBackup(false);
            addToast('Archivo SQLite validado', 'success');
        } catch (error) {
            addToast(error.response?.data?.message || 'Archivo invalido', 'error');
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

    return (
        <div className="min-h-full bg-slate-50 p-6">
            <div className="mx-auto max-w-6xl space-y-8">
                <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Administracion</p>
                        <h1 className="mt-2 text-3xl font-bold text-slate-950">Backups e importacion</h1>
                        <p className="mt-2 max-w-2xl text-sm text-slate-600">
                            Genera respaldos privados de la base actual y ejecuta importaciones legacy con analisis previo obligatorio.
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
                                <h2 className="text-lg font-semibold text-slate-950">Importar sistema anterior</h2>
                                <p className="mt-1 text-sm text-slate-500">Acepta archivos .sqlite, .sqlite3, .db o versiones .gz del backup Optica Andina.</p>
                            </div>
                            <input ref={fileRef} type="file" accept=".sqlite,.sqlite3,.db,.sqlite.gz,.sqlite3.gz,.db.gz,.gz" onChange={handleUpload} className="hidden" />
                            <Button variant="secondary" onClick={() => fileRef.current?.click()} loading={uploading}>
                                <Upload size={18} /> Subir SQLite
                            </Button>
                        </div>

                        {importOperation ? (
                            <div className="mt-6 space-y-5">
                                <div className="rounded-lg bg-slate-50 p-4">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <StatusPill status={importOperation.status} />
                                        <p className="text-sm font-medium text-slate-900">{importOperation.original_filename}</p>
                                        <p className="text-sm text-slate-500">{formatBytes(importOperation.file_size)}</p>
                                    </div>
                                    {importOperation.error_message && (
                                        <p className="mt-3 text-sm text-rose-600">{importOperation.error_message}</p>
                                    )}
                                </div>

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

                                {importOperation.status === 'completed' && (
                                    <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                                        <CheckCircle2 size={18} className="shrink-0" />
                                        Importacion completada. Se genero backup previo #{importOperation.backup_operation_id}.
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
                                <p className="mt-3 text-sm font-medium text-slate-800">Sube el backup SQLite del sistema anterior</p>
                                <p className="mt-1 text-sm text-slate-500">El sistema validara tablas antes de permitir el dry-run.</p>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
