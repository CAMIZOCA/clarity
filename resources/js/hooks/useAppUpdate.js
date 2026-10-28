import { useCallback, useEffect, useState } from 'react';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const TRIED_KEY = 'clarity.update.tried.v1';

// Pantallas donde se escribe y un reinicio podria perder lo tecleado.
const EDITING_PATHS = [/^\/consulta/, /^\/pacientes\/nuevo/, /\/editar$/, /\/nueva?$/, /^\/pos/];

const currentBuild = () => document.querySelector('meta[name="app-build"]')?.content || 'dev';

export const isEditing = () => EDITING_PATHS.some((rule) => rule.test(window.location.pathname));

export async function clearCaches() {
    try {
        const registration = await navigator.serviceWorker?.getRegistration('/sw.js');
        registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
        await registration?.update();
    } catch {
        // sin service worker no hay nada que limpiar
    }
    try {
        const keys = await window.caches?.keys();
        await Promise.all((keys || []).map((key) => window.caches.delete(key)));
    } catch {
        // idem
    }
}

/**
 * Detecta un despliegue nuevo comparando el build con el que cargo la pestana.
 * Recarga sola si no hay nada que perder; si no, expone `updateReady` para el aviso.
 */
export default function useAppUpdate() {
    const [updateReady, setUpdateReady] = useState(false);
    const [applying, setApplying] = useState(false);

    const applyUpdate = useCallback(async (latest) => {
        setApplying(true);
        try {
            window.sessionStorage.setItem(TRIED_KEY, latest || 'x');
        } catch {
            // sessionStorage bloqueado: se arriesga un reintento
        }
        await clearCaches();
        window.location.reload();
    }, []);

    useEffect(() => {
        const build = currentBuild();
        if (build === 'dev') {
            return undefined;
        }

        let latest = null;
        let stopped = false;

        const alreadyTried = (version) => {
            try {
                return window.sessionStorage.getItem(TRIED_KEY) === version;
            } catch {
                return false;
            }
        };

        const handleNewVersion = (version) => {
            // Ya se recargo por esta version y sigue distinta: no entrar en bucle.
            if (stopped || alreadyTried(version)) {
                return;
            }
            latest = version;
            if (isEditing()) {
                setUpdateReady(true);
            } else {
                applyUpdate(version);
            }
        };

        const check = async () => {
            if (document.visibilityState === 'hidden') {
                return;
            }
            try {
                const response = await fetch('/app-version.json', { cache: 'no-store' });
                if (!response.ok) {
                    return;
                }
                const { version } = await response.json();
                if (version && version !== 'dev' && version !== build) {
                    handleNewVersion(version);
                }
            } catch {
                // sin red: se vuelve a intentar en el siguiente evento
            }
        };

        const onPreloadError = (event) => {
            event.preventDefault();
            handleNewVersion(latest || 'chunk');
        };

        const timer = window.setInterval(check, CHECK_INTERVAL_MS);
        document.addEventListener('visibilitychange', check);
        window.addEventListener('focus', check);
        window.addEventListener('online', check);
        window.addEventListener('vite:preloadError', onPreloadError);
        check();

        return () => {
            stopped = true;
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', check);
            window.removeEventListener('focus', check);
            window.removeEventListener('online', check);
            window.removeEventListener('vite:preloadError', onPreloadError);
        };
    }, [applyUpdate]);

    return { updateReady, applying, applyUpdate: () => applyUpdate(null) };
}
