import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { LayoutPanelTop, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useUiTemplate } from '../../contexts/UiTemplateContext';
import { isEditing } from '../../hooks/useAppUpdate';

const SEEN_KEY = 'clarity.ui.whatsnew-seen.v1';

const readSeen = () => {
    try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return true; }
};
const markSeen = () => {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* sin almacenamiento */ }
};

/**
 * Aviso unico (por equipo) que presenta el diseño Compacto a quien sigue en el
 * Clasico. No interrumpe una pantalla de edicion (EDITING_PATHS de useAppUpdate):
 * espera a que el usuario este en otra pantalla. Nunca cambia el diseño solo.
 */
export default function WhatsNewModal() {
    const { user } = useAuth();
    const { template, setTemplate } = useUiTemplate();
    const location = useLocation();
    const [open, setOpen] = useState(false);
    const primaryRef = useRef(null);

    useEffect(() => {
        if (!user || template !== 'clasico' || readSeen() || isEditing(location.pathname)) return;
        if (location.pathname === '/login' || location.pathname === '/') return;
        setOpen(true);
    }, [user, template, location.pathname]);

    useEffect(() => {
        if (open) primaryRef.current?.focus();
    }, [open]);

    if (!open) return null;

    const close = () => {
        markSeen();
        setOpen(false);
    };

    return (
        <div className="fixed inset-0 z-[190] grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="whatsnew-title"
                aria-describedby="whatsnew-text"
                className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl"
                onKeyDown={(event) => { if (event.key === 'Escape') close(); }}
            >
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-navy text-white">
                    <Sparkles size={24} />
                </div>
                <h2 id="whatsnew-title" className="mt-4 text-2xl font-bold text-slate-900">Nuevo diseño compacto</h2>
                <div id="whatsnew-text" className="mt-2 space-y-2 text-[15px] leading-6 text-slate-600">
                    <p>Hay una nueva forma de ver el sistema, pensada para ver más datos sin hacer scroll:</p>
                    <ul className="list-disc space-y-1 pl-5">
                        <li>La consulta se divide en pestañas: Motivo, Refracción, Diagnóstico, Lunas, Venta y Módulos.</li>
                        <li>Campos más pequeños y la refracción completa en una sola pantalla.</li>
                        <li>Buscador de pacientes siempre arriba (Ctrl + K).</li>
                    </ul>
                    <p className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                        <LayoutPanelTop size={16} className="mt-0.5 shrink-0 text-navy" />
                        Los datos son los mismos. Puede volver al diseño clásico cuando quiera desde
                        «Diseño de pantalla», al pie del menú.
                    </p>
                </div>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
                    <button
                        ref={primaryRef}
                        type="button"
                        onClick={() => { close(); setTemplate('compacto'); }}
                        className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-navy px-5 text-[15px] font-semibold text-white hover:bg-navy-light"
                    >
                        Probar el diseño compacto
                    </button>
                    <button
                        type="button"
                        onClick={close}
                        className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-slate-300 px-5 text-[15px] font-medium text-slate-700 hover:bg-slate-50"
                    >
                        Seguir con el clásico
                    </button>
                </div>
            </div>
        </div>
    );
}
