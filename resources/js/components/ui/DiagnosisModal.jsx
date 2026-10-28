import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle, XCircle, Loader2, Copy, RefreshCw, LogIn } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import { useAuth } from '../../contexts/AuthContext';
import { describeLastError } from '../../api/lastError';
import { clearCaches, isEditing } from '../../hooks/useAppUpdate';
import {
    DIAGNOSE_EVENT,
    SERVER_STATUS_EVENT,
    diagnose,
    diagnosisReport,
    markSessionExpired,
} from '../../utils/connectionDiagnosis';

/** Que decirle al usuario segun la causa, y que boton resuelve. */
const PROBLEMS = {
    offline: {
        title: 'El equipo no tiene internet',
        steps: ['Revise que el Wi-Fi esté encendido y conectado.', 'Cuando vuelva la señal, pulse "Reintentar".'],
        action: 'retry',
    },
    server_down: {
        title: 'El servidor no responde',
        steps: [
            'Revise que otras páginas carguen en este equipo.',
            'Si otras páginas sí cargan, el sistema puede estar reiniciándose: espere un minuto y reintente.',
            'Si sigue igual, copie el detalle y envíelo al administrador.',
        ],
        action: 'retry',
        copy: true,
    },
    server_error: {
        title: 'El servidor tuvo un error',
        steps: ['Espere un momento y reintente.', 'Si sigue igual, copie el detalle y envíelo al administrador.'],
        action: 'retry',
        copy: true,
    },
    database: {
        title: 'La base de datos no está disponible',
        steps: ['No es un problema de este equipo.', 'Copie el detalle y avise al administrador.'],
        action: 'retry',
        copy: true,
    },
    cookies: {
        title: 'El navegador no guarda la sesión',
        steps: [
            'iPad / iPhone con Safari: Ajustes > Safari > desactive "Bloquear todas las cookies".',
            'Chrome o Edge en iPad: use una pestaña normal, no de incógnito o InPrivate.',
            'Cierre esta pestaña, abra el sistema de nuevo e ingrese.',
            'Si pasa en todos los equipos, avise al administrador.',
        ],
        action: 'retry',
        copy: true,
    },
    session: {
        title: 'Su sesión se cerró',
        steps: ['Vuelva a ingresar su contraseña. Lo que estaba escribiendo en esta pantalla no se pierde.'],
        action: 'login',
    },
    outdated: {
        title: 'Hay una versión nueva del sistema',
        steps: ['Este equipo tiene guardada una versión anterior. Pulse "Actualizar".'],
        action: 'update',
    },
    ok: {
        title: 'La conexión está bien',
        steps: [
            'Fue un fallo puntual. Pulse "Reintentar" para volver a cargar la pantalla.',
            'Si vuelve a ocurrir, copie el detalle y envíelo al administrador.',
        ],
        action: 'reload',
        copy: true,
    },
};

/**
 * "Revisar conexion": se abre desde el boton de cualquier aviso de error de carga
 * (`openDiagnosis()`), revisa red, servidor, base de datos, cookies, sesion y
 * version, y ofrece el boton que lo resuelve.
 */
export default function DiagnosisModal() {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState(null);
    const [copied, setCopied] = useState(false);
    const runId = useRef(0);

    const run = useCallback(async () => {
        const id = ++runId.current;
        setRunning(true);
        setCopied(false);
        const outcome = await diagnose();
        if (id !== runId.current) return;
        setResult(outcome);
        setRunning(false);
        const down = ['server_down', 'server_error', 'database'].includes(outcome.problem);
        window.dispatchEvent(new CustomEvent(SERVER_STATUS_EVENT, { detail: { down } }));
    }, []);

    useEffect(() => {
        const onDiagnose = () => {
            setOpen(true);
            run();
        };
        window.addEventListener(DIAGNOSE_EVENT, onDiagnose);
        return () => window.removeEventListener(DIAGNOSE_EVENT, onDiagnose);
    }, [run]);

    if (!user) return null;

    const info = result ? PROBLEMS[result.problem ?? 'ok'] : null;
    const close = () => setOpen(false);

    const primary = () => {
        if (!info) return;
        if (info.action === 'login') {
            close();
            markSessionExpired();
        } else if (info.action === 'update') {
            if (isEditing() && !window.confirm('Se recargará la pantalla. Si no guardó los cambios, guárdelos antes. ¿Actualizar ahora?')) return;
            clearCaches().finally(() => window.location.reload());
        } else if (info.action === 'reload') {
            window.location.reload();
        } else {
            run();
        }
    };

    const primaryLabel = {
        login: 'Iniciar sesión',
        update: 'Actualizar',
        reload: 'Reintentar',
        retry: 'Reintentar',
    }[info?.action] ?? 'Reintentar';

    const copyDetail = async () => {
        try {
            await navigator.clipboard.writeText(diagnosisReport(result, describeLastError));
            setCopied(true);
        } catch {
            setCopied(false);
        }
    };

    return (
        <Modal open={open} onClose={close} title="Revisar conexión" size="md">
            <ul className="space-y-2">
                {(result?.checks ?? []).map((check) => (
                    <li key={check.key} className="flex items-center gap-3 text-sm">
                        {check.ok
                            ? <CheckCircle size={18} className="flex-shrink-0 text-green-600" />
                            : <XCircle size={18} className="flex-shrink-0 text-red-600" />}
                        <span className="font-medium text-gray-800">{check.label}</span>
                        <span className="ml-auto text-right text-gray-500">{check.detail}</span>
                    </li>
                ))}
                {running && (
                    <li className="flex items-center gap-3 text-sm text-gray-500">
                        <Loader2 size={18} className="animate-spin" />
                        Revisando...
                    </li>
                )}
            </ul>

            {info && !running && (
                <div className={`mt-4 rounded-xl border p-4 ${result.problem ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
                    <p className="font-semibold text-gray-900">{info.title}</p>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-700">
                        {info.steps.map((step) => <li key={step}>{step}</li>)}
                    </ol>
                </div>
            )}

            {result?.lastError && !running && (
                <p className="mt-3 text-xs text-gray-500">Último error: {describeLastError(result.lastError)}</p>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
                {info?.copy && (
                    <Button variant="ghost" onClick={copyDetail} disabled={running}>
                        <Copy size={16} />
                        {copied ? 'Copiado' : 'Copiar detalle'}
                    </Button>
                )}
                <Button onClick={primary} loading={running}>
                    {info?.action === 'login' ? <LogIn size={16} /> : <RefreshCw size={16} />}
                    {primaryLabel}
                </Button>
            </div>
        </Modal>
    );
}
