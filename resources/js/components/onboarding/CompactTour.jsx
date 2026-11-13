import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Lightbulb, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useUiTemplate } from '../../contexts/UiTemplateContext';

/**
 * Recorrido breve la primera vez que se usa el diseño Compacto en cada pantalla.
 * Es una tarjeta flotante con pasos (no tapa el formulario ni bloquea nada) y se
 * recuerda por pantalla y equipo: `clarity.ui.tour.<pantalla>.v1`.
 */
const TOURS = [
    {
        key: 'consulta',
        match: (path) => path.startsWith('/consulta') && !path.endsWith('/ver'),
        steps: [
            ['Pestañas', 'La consulta está dividida en seis pestañas. Los datos son los mismos de siempre, solo están agrupados.'],
            ['Estado de cada pestaña', 'Un punto rojo con número indica errores por corregir; un punto ámbar, medidas para revisar.'],
            ['Teclado', 'Enter pasa al siguiente campo y, al final de la pestaña, a «Siguiente». Alt + 1…6 abre cada pestaña.'],
            ['Datos del paciente', 'En laptop están en la franja de arriba («Más datos»); en monitor grande, a la derecha.'],
        ],
    },
    {
        key: 'pacientes',
        match: (path) => path === '/pacientes',
        steps: [
            ['Lista de pacientes', 'Pulse cualquier fila para abrir la ficha. Ver, Editar y Eliminar siguen al final de cada fila.'],
        ],
    },
    {
        key: 'ficha',
        match: (path) => /^\/pacientes\/\d+$/.test(path),
        steps: [
            ['Ficha del paciente', 'El historial está agrupado por año; los datos del paciente y los certificados están a la derecha.'],
        ],
    },
    {
        key: 'marco',
        match: () => true,
        steps: [
            ['Diseño compacto', 'Está usando el diseño compacto. El menú y las opciones son los mismos de siempre.'],
            ['Buscar paciente', 'El buscador está siempre arriba a la derecha. Ctrl + K lo abre desde cualquier pantalla.'],
            ['Volver al clásico', 'Puede regresar al diseño clásico cuando quiera desde «Diseño de pantalla», al pie del menú.'],
        ],
    },
];

const seenKey = (key) => `clarity.ui.tour.${key}.v1`;
const wasSeen = (key) => {
    try { return localStorage.getItem(seenKey(key)) === '1'; } catch { return true; }
};

export default function CompactTour() {
    const { user } = useAuth();
    const { isCompact } = useUiTemplate();
    const { pathname } = useLocation();
    const [tour, setTour] = useState(null);
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (!user || !isCompact) {
            setTour(null);
            return;
        }
        // Primero el recorrido de la pantalla; el general, cuando no haya uno propio pendiente.
        const pending = TOURS.find((item) => item.match(pathname) && !wasSeen(item.key));
        setTour((current) => (current && current.match(pathname) ? current : pending ?? null));
        setStep(0);
    }, [user, isCompact, pathname]);

    if (!tour) return null;

    const finish = () => {
        try { localStorage.setItem(seenKey(tour.key), '1'); } catch { /* sin almacenamiento */ }
        setTour(null);
    };
    const [title, text] = tour.steps[step];
    const last = step === tour.steps.length - 1;

    return (
        <div
            role="dialog"
            aria-labelledby="compact-tour-title"
            className="fixed bottom-20 right-4 z-[150] w-[min(22rem,calc(100vw-2rem))] rounded-2xl bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.18)] ring-1 ring-black/5"
        >
            <div className="flex items-start gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-navy/10 text-navy"><Lightbulb size={17} /></div>
                <div className="min-w-0 flex-1">
                    <p id="compact-tour-title" className="text-[14px] font-semibold text-gray-900">{title}</p>
                    <p className="mt-0.5 text-[13px] leading-5 text-gray-600">{text}</p>
                </div>
                <button type="button" onClick={finish} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Cerrar recorrido">
                    <X size={16} />
                </button>
            </div>
            <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-gray-400 tabular-nums">{step + 1} de {tour.steps.length}</span>
                <div className="flex gap-1.5">
                    {step > 0 && (
                        <button type="button" onClick={() => setStep((value) => value - 1)} className="rounded-lg px-2.5 py-1 text-[13px] text-gray-600 hover:bg-gray-100">Anterior</button>
                    )}
                    <button
                        type="button"
                        onClick={() => (last ? finish() : setStep((value) => value + 1))}
                        className="rounded-lg bg-navy px-3 py-1 text-[13px] font-semibold text-white hover:bg-navy-light"
                    >
                        {last ? 'Entendido' : 'Siguiente'}
                    </button>
                </div>
            </div>
        </div>
    );
}
