import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

/**
 * Aviso global de conexion perdida.
 *
 * Sin el, al caerse la red los datos dejaban de cargarse y de guardarse sin
 * ninguna senal visible: el usuario seguia escribiendo y perdia el trabajo.
 */
export default function ConnectionBanner() {
    const online = useOnlineStatus();

    if (online) return null;

    return (
        <div
            role="alert"
            className="sticky top-0 z-[90] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950 shadow"
        >
            <WifiOff size={16} className="flex-shrink-0" />
            <span>Sin conexión. Los cambios no se están guardando; no cierre esta ventana.</span>
        </div>
    );
}
