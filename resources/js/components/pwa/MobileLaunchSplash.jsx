import React, { useEffect, useState } from 'react';

const SPLASH_SEEN_KEY = 'clarity.mobile.launch-splash.seen.v1';
const SPLASH_MIN_DURATION = 1100;

function isMobileViewport() {
    if (typeof window === 'undefined') {
        return false;
    }

    return window.matchMedia('(max-width: 767px)').matches;
}

export default function MobileLaunchSplash() {
    const [visible, setVisible] = useState(() => {
        if (typeof window === 'undefined') {
            return false;
        }

        return isMobileViewport() && window.sessionStorage.getItem(SPLASH_SEEN_KEY) !== '1';
    });

    useEffect(() => {
        if (!visible || typeof window === 'undefined') {
            return undefined;
        }

        window.sessionStorage.setItem(SPLASH_SEEN_KEY, '1');

        const bodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const timer = window.setTimeout(() => {
            setVisible(false);
            document.body.style.overflow = bodyOverflow;
        }, SPLASH_MIN_DURATION);

        return () => {
            window.clearTimeout(timer);
            document.body.style.overflow = bodyOverflow;
        };
    }, [visible]);

    if (!visible) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#173054_0%,#0b1220_55%,#050814_100%)] text-white lg:hidden"
            role="status"
            aria-live="polite"
            aria-label="Cargando la aplicación"
        >
            <div className="absolute inset-0 opacity-40">
                <div className="absolute left-1/2 top-10 h-64 w-64 -translate-x-1/2 rounded-full bg-cyan-400/20 blur-3xl" />
                <div className="absolute bottom-[-8rem] right-[-6rem] h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" />
            </div>

            <div className="relative flex flex-col items-center px-8 text-center">
                <div className="relative grid h-20 w-20 place-items-center rounded-[1.75rem] border border-white/15 bg-white/10 shadow-2xl shadow-slate-950/35 backdrop-blur-xl">
                    <div className="absolute inset-[-0.4rem] rounded-[2rem] border border-cyan-300/30" />
                    <div className="absolute inset-3 rounded-[1.2rem] border border-white/20" />
                    <div className="absolute inset-[-0.8rem] rounded-[2.2rem] border border-cyan-300/15 animate-pulse" />
                    <span className="relative text-2xl font-black tracking-tight text-white">C</span>
                </div>

                <div className="mt-6">
                    <p className="text-[0.7rem] font-black uppercase tracking-[0.45em] text-cyan-200/80">
                        Clarity
                    </p>
                    <h1 className="mt-3 text-2xl font-black tracking-tight text-white">
                        Preparando la app
                    </h1>
                    <p className="mt-3 max-w-xs text-sm leading-6 text-slate-300">
                        Cargando tus datos, sucursal y acceso seguro para que entres sin fricción.
                    </p>
                </div>

                <div className="mt-7 flex items-center gap-2" aria-hidden="true">
                    <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-cyan-300 [animation-delay:-0.2s]" />
                    <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-white/80 [animation-delay:-0.1s]" />
                    <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-cyan-300" />
                </div>
            </div>
        </div>
    );
}
