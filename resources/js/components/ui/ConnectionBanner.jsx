import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { motionTransition, SPRING_MOVE } from '../../utils/motion';

/**
 * Aviso global de conexion perdida.
 *
 * Sin el, al caerse la red los datos dejaban de cargarse y de guardarse sin
 * ninguna senal visible: el usuario seguia escribiendo y perdia el trabajo.
 */
export default function ConnectionBanner() {
    const online = useOnlineStatus();

    return (
        <AnimatePresence>
            {!online && (
                <motion.div
                    role="alert"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={motionTransition(SPRING_MOVE)}
                    className="sticky top-0 z-[90] overflow-hidden bg-amber-500 text-amber-950 shadow"
                >
                    <div className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium">
                        <WifiOff size={16} className="flex-shrink-0" />
                        <span>Sin conexión. Los cambios no se están guardando; no cierre esta ventana.</span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
