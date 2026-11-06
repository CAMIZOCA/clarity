import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ServerCrash, WifiOff } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { isEditing } from '../../hooks/useAppUpdate';
import { motionTransition, SPRING_MOVE } from '../../utils/motion';
import { SERVER_STATUS_EVENT, fetchSessionCheck, openDiagnosis } from '../../utils/connectionDiagnosis';

/** Solo mientras el servidor no responde; con el servidor bien no se consulta nada. */
const SERVER_RECHECK_MS = 15_000;

/**
 * Aviso global de conexion perdida.
 *
 * Sin el, al caerse la red los datos dejaban de cargarse y de guardarse sin
 * ninguna senal visible: el usuario seguia escribiendo y perdia el trabajo.
 * `navigator.onLine` no ve un servidor caido con la red bien: eso lo informa el
 * diagnostico (`SERVER_STATUS_EVENT`), y el aviso se quita solo cuando vuelve.
 */
export default function ConnectionBanner() {
    const online = useOnlineStatus();
    const [serverDown, setServerDown] = useState(false);
    const { pathname } = useLocation();

    useEffect(() => {
        const onStatus = (event) => setServerDown(Boolean(event.detail?.down));
        window.addEventListener(SERVER_STATUS_EVENT, onStatus);
        return () => window.removeEventListener(SERVER_STATUS_EVENT, onStatus);
    }, []);

    useEffect(() => {
        if (!serverDown || !online) return undefined;
        const timer = window.setInterval(async () => {
            const check = await fetchSessionCheck();
            if (check?.body?.database) setServerDown(false);
        }, SERVER_RECHECK_MS);
        return () => window.clearInterval(timer);
    }, [serverDown, online]);

    // La advertencia de no cerrar solo tiene sentido donde se escribe; en una ficha
    // de lectura asustaba sin motivo. `pathname` hace que se recalcule al navegar.
    const editing = isEditing(pathname) && !pathname.endsWith('/ver');
    const tail = editing
        ? 'Lo que escriba aún no se guarda; no cierre esta ventana.'
        : 'La información guardada no se ve afectada; se restablecerá sola.';

    const banner = !online
        ? { key: 'offline', Icon: WifiOff, text: `Este equipo no tiene internet. ${tail}` }
        : serverDown
            ? { key: 'server', Icon: ServerCrash, text: `Conexión con el servidor interrumpida. ${tail}` }
            : null;

    return (
        <AnimatePresence>
            {banner && (
                <motion.div
                    key={banner.key}
                    role="alert"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={motionTransition(SPRING_MOVE)}
                    className="sticky top-0 z-[90] overflow-hidden bg-amber-500 text-amber-950 shadow"
                >
                    <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-2 text-sm font-medium">
                        <banner.Icon size={16} className="flex-shrink-0" />
                        <span>{banner.text}</span>
                        <button
                            type="button"
                            onClick={openDiagnosis}
                            className="rounded-md bg-amber-950/10 px-2 py-0.5 font-semibold underline underline-offset-2 hover:bg-amber-950/20"
                        >
                            Revisar conexión
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
