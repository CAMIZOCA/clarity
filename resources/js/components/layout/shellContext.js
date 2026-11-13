import { createContext, useContext, useEffect } from 'react';

/**
 * Comunicacion entre una pagina y el marco (AppShell) en la plantilla Compacto.
 * `focusMode` pide ocultar la barra lateral en pantallas de laptop (< 1600 px)
 * para dar ancho al formulario; el usuario puede volver a mostrarla.
 */
export const ShellContext = createContext({ setFocusMode: () => {} });

export const useShell = () => useContext(ShellContext);

/** Activa el modo enfoque mientras la pagina este montada. */
export function useFocusMode(enabled = true) {
    const { setFocusMode } = useShell();
    useEffect(() => {
        if (!enabled) return undefined;
        setFocusMode(true);
        return () => setFocusMode(false);
    }, [enabled, setFocusMode]);
}
