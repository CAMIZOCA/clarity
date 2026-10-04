import React, { useEffect, useState } from 'react';
import { PlugZap, Save, RefreshCw, Send, Trash2, CheckCircle2, XCircle, MinusCircle, Info, ExternalLink } from 'lucide-react';
import client from '../../api/client';
import { getList, getPayload } from '../../api/response';
import Button from '../../components/ui/Button';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/Toast';
import { useSettings } from '../../contexts/SettingsContext';
import { toDisplayDateTime } from '../../utils/dates';

const STATUS = {
    success: { label: 'Enviado', icon: CheckCircle2, className: 'text-green-700 bg-green-50 border-green-200' },
    failed: { label: 'Falló', icon: XCircle, className: 'text-red-700 bg-red-50 border-red-200' },
    skipped: { label: 'Omitido', icon: MinusCircle, className: 'text-gray-600 bg-gray-100 border-gray-200' },
};

const ACTION_LABEL = { create: 'Crear cliente', link: 'Enlazar existente' };

const EMPTY_STATUS = { enabled: false, has_api_key: false, has_api_token: false, last_success_at: null, last_test: null };

export default function ContificoTab() {
    const { addToast } = useToast();
    const { refresh } = useSettings();
    const [status, setStatus] = useState(EMPTY_STATUS);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [enabled, setEnabled] = useState(false);
    // Nunca se prellenan: el servidor no devuelve las credenciales, solo si existen.
    const [apiKey, setApiKey] = useState('');
    const [apiToken, setApiToken] = useState('');
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [retryingId, setRetryingId] = useState(null);
    const [confirmClear, setConfirmClear] = useState(false);

    const applyStatus = (next) => {
        setStatus({ ...EMPTY_STATUS, ...next });
        setEnabled(!!next?.enabled);
    };

    const loadLogs = () => client.get('/contifico/logs')
        .then(r => setLogs(getList(r)))
        .catch(() => addToast('No se pudo cargar el historial de Contífico', 'error'));

    useEffect(() => {
        Promise.all([
            client.get('/contifico/status').then(r => applyStatus(getPayload(r))),
            loadLogs(),
        ])
            .catch(() => addToast('No se pudo cargar la configuración de Contífico', 'error'))
            .finally(() => setLoading(false));
    }, []);

    const hasKey = status.has_api_key || apiKey.trim() !== '';
    const hasToken = status.has_api_token || apiToken.trim() !== '';
    const canEnable = hasKey && hasToken;

    /** Guarda y, si se esta activando o cambiaron credenciales, el servidor prueba la conexion. */
    const save = async (payload) => {
        try {
            const res = await client.put('/contifico/config', payload);
            applyStatus(getPayload(res));
            setApiKey('');
            setApiToken('');
            refresh();
            return res;
        } catch (err) {
            // El 422 trae el estado real (la conexion pudo quedar desactivada).
            if (err.response?.data && 'enabled' in err.response.data) {
                applyStatus(err.response.data);
                setApiKey('');
                setApiToken('');
                refresh();
            }
            throw err;
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await save({ enabled, api_key: apiKey, api_token: apiToken });
            addToast(res.data?.message || 'Configuración de Contífico guardada.', 'success');
        } catch (err) {
            addToast(err.response?.data?.message || 'No se pudo guardar la configuración de Contífico.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        setTesting(true);
        try {
            // Si hay credenciales nuevas sin guardar, la prueba debe usarlas.
            if (apiKey.trim() || apiToken.trim()) {
                await save({ api_key: apiKey, api_token: apiToken });
            }
            const res = await client.post('/contifico/test');
            addToast(res.data?.message || 'Conexión correcta con Contífico.', 'success');
        } catch (err) {
            addToast(err.response?.data?.message || 'No se pudo verificar la conexión con Contífico.', 'error');
        } finally {
            setTesting(false);
            client.get('/contifico/status').then(r => applyStatus(getPayload(r))).catch(() => {});
        }
    };

    const handleClear = async () => {
        setConfirmClear(false);
        setSaving(true);
        try {
            await save({ clear_credentials: true });
            addToast('Credenciales de Contífico eliminadas.', 'success');
        } catch (err) {
            addToast(err.response?.data?.message || 'No se pudieron eliminar las credenciales.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleRetry = async (log) => {
        setRetryingId(log.id);
        try {
            const res = await client.post(`/contifico/patients/${log.patient.id}/sync`);
            addToast(res.data?.message || 'Paciente enviado a Contífico.', 'success');
        } catch (err) {
            addToast(err.response?.data?.message || 'No se pudo enviar el paciente a Contífico.', 'error');
        } finally {
            setRetryingId(null);
            loadLogs();
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <p className="text-sm text-gray-400">Cargando…</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h2 className="font-semibold text-gray-900 mb-2">Contífico</h2>
                <p className="text-sm text-gray-500 mb-6">
                    Cada paciente nuevo se crea automáticamente en Contífico como cliente, para no digitarlo dos veces
                    al facturar. Solo se envían identificación y datos de contacto: nunca información clínica.
                </p>

                <label className={`flex items-start gap-3 rounded-xl border p-4 ${canEnable ? 'cursor-pointer border-gray-200' : 'border-gray-200 bg-gray-50'}`}>
                    <input
                        type="checkbox"
                        checked={enabled}
                        disabled={!canEnable}
                        onChange={e => setEnabled(e.target.checked)}
                        className="mt-1 w-4 h-4 accent-[#1a2a4a]"
                    />
                    <span>
                        <span className="block text-sm font-medium text-gray-900">Activar conexión con Contífico</span>
                        <span className="block text-xs text-gray-500 mt-0.5">
                            {canEnable
                                ? 'Al guardar se prueba la conexión; si Contífico rechaza la clave, queda desactivada.'
                                : 'Ingresa la API key y el API token para poder activarla.'}
                        </span>
                    </span>
                    <span className={`ml-auto shrink-0 text-[11px] rounded-full border px-2 py-0.5 ${status.enabled ? 'text-green-700 bg-green-50 border-green-200' : 'text-gray-600 bg-gray-100 border-gray-200'}`}>
                        {status.enabled ? 'Activa' : 'Inactiva'}
                    </span>
                </label>

                <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-[#1a2a4a]">
                        <Info size={16} /> Cómo obtener las credenciales
                    </h3>
                    <p className="text-sm text-gray-700 mt-2">
                        Las dos credenciales no se crean en este sistema: las emite Contífico para tu empresa
                        y aquí solo se pegan.
                    </p>
                    <ol className="list-decimal pl-5 mt-3 space-y-2 text-sm text-gray-700">
                        <li>
                            <strong>Confirma que tu plan incluye el API.</strong> Los planes que son solo de
                            facturación electrónica no lo traen; soporte de Contífico te indica si el tuyo aplica.
                        </li>
                        <li>
                            <strong>API key:</strong> entra a Contífico y ve a <em>Mi Compañía → API</em>; copia el
                            código que aparece como <em>API KEY</em>. Si no ves esa opción, solicítala a soporte
                            de Contífico.
                        </li>
                        <li>
                            <strong>API token (POS):</strong> no se muestra en pantalla. Pídelo a soporte de
                            Contífico indicando que es para una integración por API; es el que autoriza a crear
                            clientes.
                        </li>
                        <li>
                            <strong>Pégalas abajo,</strong> pulsa <em>Probar conexión</em> y, si responde bien,
                            marca <em>Activar conexión con Contífico</em> y guarda.
                        </li>
                    </ol>
                    <p className="text-xs text-gray-600 mt-3">
                        Son únicas por empresa y equivalen a una contraseña: no las compartas por correo ni chat.
                        Si se exponen, pide a soporte de Contífico que las regenere y reemplázalas aquí.{' '}
                        <a
                            href="https://contifico.github.io/"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-[#1a2a4a] underline"
                        >
                            Documentación oficial del API <ExternalLink size={12} />
                        </a>
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">API key</label>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={e => setApiKey(e.target.value)}
                            autoComplete="new-password"
                            placeholder={status.has_api_key ? '•••••••• (guardada)' : 'API key de Contífico'}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            {status.has_api_key ? 'Hay una clave guardada. Déjalo vacío para conservarla.' : 'Todavía no hay ninguna clave configurada.'}
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">API token (POS)</label>
                        <input
                            type="password"
                            value={apiToken}
                            onChange={e => setApiToken(e.target.value)}
                            autoComplete="new-password"
                            placeholder={status.has_api_token ? '•••••••• (guardado)' : 'API token de Contífico'}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            {status.has_api_token ? 'Hay un token guardado. Déjalo vacío para conservarlo.' : 'Todavía no hay ningún token configurado.'}
                        </p>
                    </div>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                    Ambas credenciales se guardan <strong>cifradas</strong> en la base de datos y nunca vuelven a mostrarse.
                </p>

                <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Verificar credenciales</label>
                    <Button variant="secondary" onClick={handleTest} loading={testing} disabled={!canEnable}>
                        <PlugZap size={16} /> Probar conexión
                    </Button>
                    <p className="text-xs text-gray-400 mt-2">
                        Consulta Contífico sin crear nada. Confirma la API key; el API token solo lo valida Contífico
                        en el primer envío real.
                    </p>
                    {status.last_test && (
                        <p className={`text-xs mt-2 ${status.last_test.ok ? 'text-green-700' : 'text-red-700'}`}>
                            Última prueba ({toDisplayDateTime(status.last_test.at, '—')}): {status.last_test.message}
                        </p>
                    )}
                </div>

                <div className="flex items-center justify-between gap-3 mt-6">
                    {(status.has_api_key || status.has_api_token) ? (
                        <Button variant="ghost" onClick={() => setConfirmClear(true)} disabled={saving}>
                            <Trash2 size={16} className="text-red-500" /> Eliminar credenciales
                        </Button>
                    ) : <span />}
                    <Button onClick={handleSave} loading={saving} size="lg">
                        <Save size={18} /> Guardar configuración
                    </Button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        <h2 className="font-semibold text-gray-900">Últimos 10 envíos</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            {status.last_success_at
                                ? `Último envío correcto: ${toDisplayDateTime(status.last_success_at)}`
                                : 'Todavía no se ha enviado ningún paciente.'}
                        </p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={loadLogs}>
                        <RefreshCw size={14} /> Actualizar
                    </Button>
                </div>

                {logs.length === 0 ? (
                    <p className="text-sm text-gray-400">Sin envíos registrados.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                                    <th className="py-2 pr-3 font-medium">Fecha</th>
                                    <th className="py-2 pr-3 font-medium">Paciente</th>
                                    <th className="py-2 pr-3 font-medium">Datos enviados</th>
                                    <th className="py-2 pr-3 font-medium">Resultado</th>
                                    <th className="py-2 font-medium" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {logs.map(log => {
                                    const meta = STATUS[log.status] ?? STATUS.skipped;
                                    const Icon = meta.icon;
                                    const sent = log.payload ?? {};
                                    return (
                                        <tr key={log.id} className="align-top">
                                            <td className="py-3 pr-3 whitespace-nowrap text-gray-600">
                                                {toDisplayDateTime(log.created_at, '—')}
                                            </td>
                                            <td className="py-3 pr-3">
                                                <div className="font-medium text-gray-900">{log.patient?.nombre_completo ?? 'Paciente eliminado'}</div>
                                                <div className="text-xs text-gray-500">{log.patient?.cedula || 'Sin cédula'}</div>
                                            </td>
                                            <td className="py-3 pr-3 text-xs text-gray-600">
                                                {log.payload ? (
                                                    <>
                                                        <div>{sent.razon_social}</div>
                                                        <div>{[sent.ruc || sent.cedula, sent.telefonos, sent.email].filter(Boolean).join(' · ')}</div>
                                                        {sent.direccion && <div className="text-gray-400">{sent.direccion}</div>}
                                                    </>
                                                ) : <span className="text-gray-400">No se envió nada</span>}
                                            </td>
                                            <td className="py-3 pr-3">
                                                <span className={`inline-flex items-center gap-1 text-[11px] rounded-full border px-2 py-0.5 ${meta.className}`}>
                                                    <Icon size={11} /> {meta.label}
                                                </span>
                                                <div className="text-xs text-gray-500 mt-1 max-w-xs">
                                                    {ACTION_LABEL[log.action] ?? log.action}
                                                    {log.attempt > 1 && ` · intento ${log.attempt}`}
                                                    {log.message && ` — ${log.message}`}
                                                </div>
                                            </td>
                                            <td className="py-3 text-right">
                                                {log.can_retry && status.enabled && (
                                                    <Button variant="secondary" size="sm" onClick={() => handleRetry(log)} loading={retryingId === log.id}>
                                                        <Send size={14} /> Reenviar
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <ConfirmModal
                open={confirmClear}
                onCancel={() => setConfirmClear(false)}
                onConfirm={handleClear}
                title="Eliminar credenciales"
                message="Se borrarán la API key y el API token de Contífico y la conexión quedará desactivada. Los pacientes ya enviados no se modifican."
                confirmLabel="Eliminar"
                variant="danger"
            />
        </div>
    );
}
