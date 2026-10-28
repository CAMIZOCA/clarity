import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ServerCrash, WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
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

    const banner = !online
        ? { key: 'offline', Icon: WifiOff, text: 'Sin conexión. Los cambios no se están guardando; no cierre esta ventana.' }
        : serverDown
            ? { key: 'server', Icon: ServerCrash, text: 'No hay comunicación con el servidor. Los cambios no se están guardando; no cierre esta ventana.' }
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
