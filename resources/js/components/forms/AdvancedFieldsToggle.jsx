import { useCallback, useState } from 'react';
import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';

/**
 * Estado (persistido por usuario) para revelar/ocultar los campos avanzados de
 * una sección. Devuelve `{ open, toggle }`.
 *
 * @param {string} storageKey - clave estable, ej. 'consulta:refraccion'.
 */
export function useAdvancedToggle(storageKey) {
    const key = `adv_open_${storageKey}`;
    const [open, setOpen] = useState(() => {
        try { return localStorage.getItem(key) === 'true'; } catch { return false; }
    });

    const toggle = useCallback(() => {
        setOpen((prev) => {
            const next = !prev;
            try { localStorage.setItem(key, String(next)); } catch {}
            return next;
        });
    }, [key]);

    return { open, toggle };
}

/**
 * Botón "Mostrar / Ocultar campos avanzados" para colocar dentro de una sección
 * núcleo, junto a los campos poco usados que revela.
 */
export function AdvancedToggleButton({ open, onToggle, className = '' }) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className={`inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 ${className}`}
        >
            <SlidersHorizontal size={16} />
            {open ? 'Ocultar campos avanzados' : 'Mostrar campos avanzados'}
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
    );
}
