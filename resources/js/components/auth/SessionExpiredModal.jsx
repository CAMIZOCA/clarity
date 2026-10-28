import React, { useEffect, useRef, useState } from 'react';
import { LogIn } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';
import {
    SESSION_EXPIRED_EVENT,
    fetchSessionCheck,
    markSessionRestored,
} from '../../utils/connectionDiagnosis';

/**
 * Sesion vencida: se vuelve a entrar en un modal, sin salir de la pantalla.
 *
 * Antes un 401 no hacia nada (cada busqueda fallaba con "Error al cargar") y
 * mandar a /login habria desmontado la consulta o la venta a medio llenar.
 */
export default function SessionExpiredModal() {
    const { user, login } = useAuth();
    const { addToast } = useToast();
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [cookiesBlocked, setCookiesBlocked] = useState(false);
    const passwordRef = useRef(null);
    const userId = user?.id ?? null;
    const userIdRef = useRef(userId);
    userIdRef.current = userId;

    useEffect(() => {
        const onExpired = () => {
            // Sin nadie dentro (ya se cerro sesion) un 401 es lo esperado, no una sesion vencida.
            if (!userIdRef.current) return;
            setOpen(true);
            setPassword('');
            setError('');
            setCookiesBlocked(false);
        };
        window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
        return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
    }, []);

    // Al salir o al entrar con otro usuario, nada de la sesion anterior sigue abierto. Antes
    // un 401 que llegaba mientras se pulsaba "Salir" dejaba el modal abierto, y aparecia
    // "Su sesion se cerro" justo despues del siguiente login correcto.
    useEffect(() => {
        setOpen(false);
        setEmail('');
        setPassword('');
        setError('');
        setCookiesBlocked(false);
        if (!userId) markSessionRestored();
    }, [userId]);

    useEffect(() => {
        if (open) {
            setEmail((current) => current || user?.email || '');
            setTimeout(() => passwordRef.current?.focus(), 50);
        }
    }, [open, user]);

    if (!user) return null;

    const close = () => {
        setOpen(false);
        markSessionRestored();
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(email, password);
            // El login respondio bien pero la cookie no quedo: el navegador la rechaza.
            const check = await fetchSessionCheck();
            if (check?.body && !check.body.authenticated) {
                setCookiesBlocked(true);
                return;
            }
            setOpen(false);
            setPassword('');
            markSessionRestored();
            addToast('Sesión restablecida. Vuelva a intentar lo que estaba haciendo.', 'success');
        } catch (e) {
            const status = e.response?.status;
            if (status === 422 || status === 401) {
                setError(e.response?.data?.message || 'Correo o contraseña incorrectos.');
            } else if (!status) {
                setError('No hay comunicación con el servidor. Revise la conexión y vuelva a intentar.');
            } else {
                setError(`El servidor respondió con error ${status}. Vuelva a intentar en un momento.`);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal open={open} onClose={close} title="Su sesión se cerró" size="sm">
            {cookiesBlocked ? (
                <div className="space-y-3 text-sm text-gray-700">
                    <p className="font-semibold text-gray-900">La contraseña es correcta, pero el navegador no guarda la sesión.</p>
                    <ol className="list-decimal space-y-1 pl-5">
                        <li>iPad / iPhone con Safari: Ajustes &gt; Safari &gt; desactive "Bloquear todas las cookies".</li>
                        <li>No use navegación privada o incógnito para el sistema.</li>
                        <li>Si pasa en todos los equipos, avise al administrador.</li>
                    </ol>
                    <div className="flex justify-end">
                        <Button onClick={() => setCookiesBlocked(false)}>Volver a intentar</Button>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Por seguridad, vuelva a ingresar su contraseña. Lo que estaba escribiendo en esta pantalla no se pierde.
                    </p>
                    <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                        Correo
                        <input
                            type="email"
                            autoComplete="username"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="rounded-lg border border-gray-300 px-3 py-2 text-base font-normal"
                            required
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                        Contraseña
                        <input
                            ref={passwordRef}
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="rounded-lg border border-gray-300 px-3 py-2 text-base font-normal"
                            required
                        />
                    </label>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                            type="button"
                            onClick={() => window.location.assign('/login')}
                            className="text-sm text-gray-500 underline underline-offset-2"
                        >
                            Ir a la pantalla de ingreso
                        </button>
                        <Button type="submit" loading={loading}>
                            <LogIn size={16} />
                            Ingresar
                        </Button>
                    </div>
                </form>
            )}
        </Modal>
    );
}
