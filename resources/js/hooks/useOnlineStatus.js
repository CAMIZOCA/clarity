import { useEffect, useState } from 'react';

/**
 * Estado de conexion del navegador.
 *
 * `navigator.onLine` solo detecta la perdida de la interfaz de red, no que el
 * servidor deje de responder. Por eso el formulario de consulta ademas avisa
 * cuando falla un guardado: entre ambas senales se cubre la caida de red y la
 * caida del backend.
 */
export function useOnlineStatus() {
    const [online, setOnline] = useState(() =>
        typeof navigator === 'undefined' ? true : navigator.onLine !== false
    );

    useEffect(() => {
        const goOnline = () => setOnline(true);
        const goOffline = () => setOnline(false);

        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);

        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, []);

    return online;
}

export default useOnlineStatus;
