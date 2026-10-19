import React, { useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import useAppUpdate from '../../hooks/useAppUpdate';

export default function UpdateModal() {
    const { updateReady, applying, applyUpdate } = useAppUpdate();
    const buttonRef = useRef(null);

    useEffect(() => {
        if (updateReady) {
            buttonRef.current?.focus();
        }
    }, [updateReady]);

    if (!updateReady) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[200] grid place-items-center bg-slate-900/60 p-4 backdrop-blur-sm">
            <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="update-title"
                aria-describedby="update-text"
                className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl"
            >
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-cyan-600 text-white">
                    <RefreshCw size={30} className={applying ? 'animate-spin' : ''} />
                </div>
                <h2 id="update-title" className="mt-5 text-2xl font-black text-slate-900">
                    Hay una mejora disponible
                </h2>
                <p id="update-text" className="mt-3 text-lg leading-7 text-slate-600">
                    Hemos preparado mejoras para usted. Presione el boton para tenerlas ahora. Lo que ya
                    guardo no se pierde.
                </p>
                <button
                    ref={buttonRef}
                    type="button"
                    onClick={applyUpdate}
                    disabled={applying}
                    className="mt-6 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-[#1a2a4a] px-6 py-3 text-lg font-bold text-white transition hover:bg-[#243660] disabled:opacity-70"
                >
                    <RefreshCw size={20} />
                    {applying ? 'Actualizando...' : 'Actualizar ahora'}
                </button>
            </div>
        </div>
    );
}
