import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { motionTransition, SPRING_MOVE } from '../../utils/motion';

const ToastContext = createContext(null);

let toastId = 0;

/** Los errores permanecen mucho mas tiempo: hay que poder leerlos y actuar. */
const DEFAULT_DURATION = { success: 3000, info: 3000, error: 12000 };

/**
 * Aviso sonoro corto para los errores, generado con Web Audio API.
 *
 * Se sintetiza en el momento para no depender de ningun archivo de audio ni de
 * una libreria externa. Si el navegador bloquea el audio (por ejemplo, si el
 * usuario todavia no interactuo con la pagina) simplemente no suena.
 */
function playErrorSound() {
    try {
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtor) return;

        const ctx = new AudioCtor();
        const now = ctx.currentTime;

        // Dos tonos descendentes: se distingue del resto de sonidos del sistema.
        [880, 620].forEach((frequency, index) => {
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();
            const start = now + index * 0.16;

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(frequency, start);

            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);

            oscillator.connect(gain).connect(ctx.destination);
            oscillator.start(start);
            oscillator.stop(start + 0.16);
        });

        setTimeout(() => ctx.close?.(), 600);
    } catch {
        // El audio es un refuerzo, nunca un requisito.
    }
}

/**
 * Puente para avisar desde fuera de React (el interceptor de axios en api/client.js).
 *
 * Se registra al montar el provider y se limpia al desmontarlo, asi que si no
 * hay provider montado la llamada simplemente no hace nada.
 */
let externalAddToast = null;

export function notifyToast(message, type = 'info', duration = null) {
    externalAddToast?.(message, type, duration);
}

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const timersRef = useRef(new Map());

    const removeToast = useCallback((id) => {
        const timer = timersRef.current.get(id);
        if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(id);
        }
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const addToast = useCallback((message, type = 'info', duration = null) => {
        const id = ++toastId;
        const ttl = duration ?? DEFAULT_DURATION[type] ?? DEFAULT_DURATION.info;

        setToasts(prev => [...prev, { id, message, type }]);

        if (type === 'error') {
            playErrorSound();
        }

        const timer = setTimeout(() => {
            timersRef.current.delete(id);
            setToasts(prev => prev.filter(t => t.id !== id));
        }, ttl);
        timersRef.current.set(id, timer);

        return id;
    }, []);

    useEffect(() => {
        externalAddToast = addToast;
        return () => { externalAddToast = null; };
    }, [addToast]);

    useEffect(() => {
        const timers = timersRef.current;
        return () => {
            timers.forEach(clearTimeout);
            timers.clear();
        };
    }, []);

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
                <AnimatePresence initial={false}>
                    {toasts.map(t => (
                        <motion.div key={t.id}
                            role={t.type === 'error' ? 'alert' : 'status'}
                            aria-live={t.type === 'error' ? 'assertive' : 'polite'}
                            layout
                            initial={{ opacity: 0, x: 24, scale: 0.95 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.12 } }}
                            transition={motionTransition(SPRING_MOVE)}
                            className={`flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg text-white text-sm max-w-sm
                                ${t.type === 'success' ? 'bg-green-600' : t.type === 'error' ? 'bg-red-600' : 'bg-[#1a2a4a]'}`}>
                            <span className="mt-0.5 flex-shrink-0">
                                {t.type === 'success' && <CheckCircle size={18} />}
                                {t.type === 'error' && <XCircle size={18} />}
                                {t.type === 'info' && <Info size={18} />}
                            </span>
                            <span className="flex-1 whitespace-pre-line">{t.message}</span>
                            <button
                                type="button"
                                onClick={() => removeToast(t.id)}
                                aria-label="Cerrar aviso"
                                className="mt-0.5 flex-shrink-0 opacity-70 hover:opacity-100"
                            >
                                <X size={16} />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}

export const useToast = () => useContext(ToastContext);
