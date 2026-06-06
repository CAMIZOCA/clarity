import React, { useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, Smartphone, X } from 'lucide-react';

const INSTALL_DISMISS_KEY = 'clarity.pwa.install.dismissed.v1';
const UPDATE_DISMISS_KEY = 'clarity.pwa.update.dismissed.session.v1';

function isStandaloneMode() {
    if (typeof window === 'undefined') {
        return false;
    }

    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIosDevice() {
    if (typeof navigator === 'undefined') {
        return false;
    }

    return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export default function PwaManager() {
    const [installPrompt, setInstallPrompt] = useState(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [isIos, setIsIos] = useState(false);
    const [showInstallHint, setShowInstallHint] = useState(false);
    const [showUpdateBanner, setShowUpdateBanner] = useState(false);
    const [swReady, setSwReady] = useState(false);
    const reloadRequested = useRef(false);

    const [installDismissed, setInstallDismissed] = useState(() => {
        if (typeof window === 'undefined') {
            return false;
        }

        return window.localStorage.getItem(INSTALL_DISMISS_KEY) === '1';
    });
    const [updateDismissed, setUpdateDismissed] = useState(() => {
        if (typeof window === 'undefined') {
            return false;
        }

        return window.sessionStorage.getItem(UPDATE_DISMISS_KEY) === '1';
    });

    useEffect(() => {
        setIsIos(isIosDevice());
        setIsInstalled(isStandaloneMode());

        const onModeChange = () => setIsInstalled(isStandaloneMode());
        window.addEventListener('resize', onModeChange);
        window.addEventListener('orientationchange', onModeChange);

        return () => {
            window.removeEventListener('resize', onModeChange);
            window.removeEventListener('orientationchange', onModeChange);
        };
    }, []);

    useEffect(() => {
        if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !window.isSecureContext) {
            return undefined;
        }

        let mounted = true;
        let registration = null;

        const onControllerChange = () => {
            if (reloadRequested.current) {
                window.location.reload();
            }
        };

        navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

        navigator.serviceWorker.register('/sw.js').then((reg) => {
            if (!mounted) {
                return;
            }

            registration = reg;
            setSwReady(true);

            if (reg.waiting && !updateDismissed) {
                setShowUpdateBanner(true);
            }

            reg.addEventListener('updatefound', () => {
                const installingWorker = reg.installing;
                if (!installingWorker) {
                    return;
                }

                installingWorker.addEventListener('statechange', () => {
                    if (installingWorker.state === 'installed' && navigator.serviceWorker.controller && !updateDismissed) {
                        setShowUpdateBanner(true);
                    }
                });
            });
        });

        const onBeforeInstallPrompt = (event) => {
            event.preventDefault();
            setInstallPrompt(event);
            setShowInstallHint(true);
        };

        const onAppInstalled = () => {
            setIsInstalled(true);
            setShowInstallHint(false);
            setInstallPrompt(null);
        };

        window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
        window.addEventListener('appinstalled', onAppInstalled);

        return () => {
            mounted = false;
            navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
            window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
            window.removeEventListener('appinstalled', onAppInstalled);
            if (registration) {
                registration.update().catch(() => {});
            }
        };
    }, [updateDismissed]);

    useEffect(() => {
        if (isInstalled || installDismissed) {
            setShowInstallHint(false);
        }
    }, [installDismissed, isInstalled]);

    const dismissInstallHint = () => {
        window.localStorage.setItem(INSTALL_DISMISS_KEY, '1');
        setInstallDismissed(true);
        setShowInstallHint(false);
    };

    const dismissUpdateBanner = () => {
        window.sessionStorage.setItem(UPDATE_DISMISS_KEY, '1');
        setUpdateDismissed(true);
        setShowUpdateBanner(false);
    };

    const handleInstall = async () => {
        if (!installPrompt) {
            return;
        }

        installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        if (choice.outcome === 'accepted') {
            setShowInstallHint(false);
            window.localStorage.setItem(INSTALL_DISMISS_KEY, '1');
            setInstallDismissed(true);
        }

        setInstallPrompt(null);
    };

    const handleUpdate = () => {
        if (!('serviceWorker' in navigator)) {
            return;
        }

        reloadRequested.current = true;
        navigator.serviceWorker.getRegistration('/sw.js').then((reg) => {
            reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
        });
    };

    const showUpdates = swReady && showUpdateBanner && !updateDismissed;
    const showInstallBanner = !showUpdates && !isInstalled && !installDismissed && (isIos ? true : showInstallHint);

    if (!showInstallBanner && !showUpdates) {
        return null;
    }

    return (
        <>
            {showInstallBanner && (
                <section
                    className="fixed bottom-4 left-4 right-4 z-[90] mx-auto max-w-md rounded-3xl border border-slate-200 bg-white/96 p-4 shadow-2xl shadow-slate-900/10 backdrop-blur"
                    aria-label="Instalacion de la app"
                >
                    <div className="flex items-start gap-3">
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#1a2a4a] text-white">
                            <Smartphone size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-black text-slate-900">Usa Clarity como app</p>
                                    <p className="mt-1 text-sm leading-6 text-slate-600">
                                        {isIos
                                            ? 'En iPhone: toca Compartir y luego "Agregar a pantalla de inicio" para abrirla como una app.'
                                            : 'Instala la app para abrirla en pantalla completa y mantener acceso rapido al sistema.'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={dismissInstallHint}
                                    className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                                    aria-label="Cerrar aviso de instalacion"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="mt-4 flex items-center gap-2">
                                {isIos ? (
                                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                                        <Download size={14} />
                                        El instalador vive en Safari
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleInstall}
                                        className="inline-flex items-center gap-2 rounded-full bg-[#1a2a4a] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#243660]"
                                    >
                                        <Download size={15} />
                                        Instalar app
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={dismissInstallHint}
                                    className="rounded-full px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                                >
                                    Mas tarde
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {showUpdates && (
                <section
                    className="fixed bottom-4 left-4 right-4 z-[90] mx-auto max-w-md rounded-3xl border border-cyan-200 bg-cyan-50 p-4 shadow-2xl shadow-cyan-900/10 backdrop-blur"
                    aria-label="Actualizacion disponible"
                >
                    <div className="flex items-start gap-3">
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-600 text-white">
                            <RefreshCw size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-black text-slate-900">Nueva version lista</p>
                                    <p className="mt-1 text-sm leading-6 text-slate-600">
                                        Ya tenemos una actualizacion preparada. Recarga para aplicar los cambios sin perder el flujo.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={dismissUpdateBanner}
                                    className="rounded-full p-1 text-slate-400 transition hover:bg-white/70 hover:text-slate-600"
                                    aria-label="Cerrar aviso de actualizacion"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="mt-4 flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleUpdate}
                                    className="inline-flex items-center gap-2 rounded-full bg-[#1a2a4a] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#243660]"
                                >
                                    <RefreshCw size={15} />
                                    Actualizar ahora
                                </button>
                                <button
                                    type="button"
                                    onClick={dismissUpdateBanner}
                                    className="rounded-full px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white/70 hover:text-slate-800"
                                >
                                    Despues
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            )}
        </>
    );
}
