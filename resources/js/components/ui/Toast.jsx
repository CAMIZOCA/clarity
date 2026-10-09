import React, { createContext, useContext, useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { prefersReducedMotion } from '../../utils/motion';

const ToastContext = createContext(null);

let toastId = 0;

/** Los errores permanecen mucho mas tiempo: hay que poder leerlos y actuar. */
const DEFAULT_DURATION = { success: 5000, info: 5000, warning: 5000, error: 12000 };

/** Titulo e icono por tipo; el color sale de `--toast-accent` en app.css. */
const TOAST_TYPES = {
    success: { title: 'Listo', Icon: CheckCircle },
    error: { title: 'Error', Icon: XCircle },
    warning: { title: 'Atención', Icon: AlertTriangle },
    info: { title: 'Aviso', Icon: Info },
};

/** Al superar este numero, el aviso mas antiguo se cierra solo. */
const MAX_VISIBLE = 5;

/** Debe coincidir con la transicion de `.toast-card.is-leaving` en app.css. */
const EXIT_MS = 300;

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

function ToastItem({ toast, onDismiss, onExited }) {
    const { id, type, title, message, action, duration, leaving } = toast;
    const { Icon } = TOAST_TYPES[type];
    const cardRef = useRef(null);
    const timerRef = useRef(null);
    const remainingRef = useRef(duration);
    const startedAtRef = useRef(0);

    const startTimer = useCallback(() => {
        clearTimeout(timerRef.current);
        startedAtRef.current = Date.now();
        timerRef.current = setTimeout(() => onDismiss(id), remainingRef.current);
    }, [id, onDismiss]);

    // Pasar el raton por encima congela la cuenta; la barra se pausa por CSS (:hover).
    const pauseTimer = () => {
        clearTimeout(timerRef.current);
        remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAtRef.current));
    };

    useEffect(() => {
        startTimer();
        return () => clearTimeout(timerRef.current);
    }, [startTimer]);

    useLayoutEffect(() => {
        if (!leaving) return undefined;
        clearTimeout(timerRef.current);

        if (prefersReducedMotion()) {
            onExited(id);
            return undefined;
        }

        // max-height no transiciona desde `auto`: se fija la altura real y luego se colapsa.
        const card = cardRef.current;
        card.style.maxHeight = `${card.offsetHeight}px`;
        void card.offsetHeight;
        card.classList.add('is-leaving');
        card.style.maxHeight = '0px';

        const exitTimer = setTimeout(() => onExited(id), EXIT_MS);
        return () => clearTimeout(exitTimer);
    }, [leaving, id, onExited]);

    const body = (
        <>
            <span className="toast-title">{title}</span>
            <span className="toast-message">{message}</span>
        </>
    );

    return (
        <div
            ref={cardRef}
            role={type === 'error' ? 'alert' : 'status'}
            data-type={type}
            className="toast-card"
            onMouseEnter={leaving ? undefined : pauseTimer}
            onMouseLeave={leaving ? undefined : startTimer}
        >
            <div className="toast-content">
                <span className="toast-icon"><Icon size={18} /></span>
                {action ? (
                    <button
                        type="button"
                        onClick={() => { action.onClick(); onDismiss(id); }}
                        className="toast-body text-left"
                    >
                        {body}
                        <span className="toast-action">{action.label}</span>
                    </button>
                ) : (
                    <div className="toast-body">{body}</div>
                )}
                <button
                    type="button"
                    onClick={() => onDismiss(id)}
                    aria-label="Cerrar aviso"
                    className="toast-close"
                >
                    <X size={14} />
                </button>
            </div>
            <span className="toast-progress" style={{ animationDuration: `${duration}ms` }} />
        </div>
    );
}

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    // Marca el aviso para salir; `ToastItem` anima y despues avisa con `dropToast`.
    const removeToast = useCallback((id) => {
        setToasts(prev => prev.map(t => (t.id === id ? { ...t, leaving: true } : t)));
    }, []);

    const dropToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // `action` ({ label, onClick }) vuelve el aviso clicable: lo usa el formulario
    // de consulta para llevar al campo que provoco el error.
    const addToast = useCallback((message, type = 'info', duration = null, action = null, title = null) => {
        const id = ++toastId;
        const kind = TOAST_TYPES[type] ? type : 'info';
        const toast = {
            id,
            message,
            type: kind,
            action,
            title: title ?? TOAST_TYPES[kind].title,
            duration: duration ?? DEFAULT_DURATION[kind],
            leaving: false,
        };

        // El mas nuevo va arriba; los que pasan del limite salen empezando por el mas antiguo.
        setToasts(prev => {
            const next = [toast, ...prev];
            const overflow = new Set(next.filter(t => !t.leaving).slice(MAX_VISIBLE).map(t => t.id));
            return overflow.size ? next.map(t => (overflow.has(t.id) ? { ...t, leaving: true } : t)) : next;
        });

        if (kind === 'error') {
            playErrorSound();
        }

        return id;
    }, []);

    useEffect(() => {
        externalAddToast = addToast;
        return () => { externalAddToast = null; };
    }, [addToast]);

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            <div className="toast-stack" role="log" aria-live="polite" aria-label="Notificaciones">
                {toasts.map(t => (
                    <ToastItem key={t.id} toast={t} onDismiss={removeToast} onExited={dropToast} />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export const useToast = () => useContext(ToastContext);
