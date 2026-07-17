import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

/**
 * Sección colapsable reutilizable. El estado abierto/cerrado se persiste por
 * usuario en localStorage.
 *
 * @param {string} title       - Título de la sección.
 * @param {string} [subtitle]   - Resumen que se muestra cuando está colapsada.
 * @param {string} [sectionKey] - Clave estable para persistir el estado (recomendado).
 * @param {boolean} [defaultOpen=true] - Estado inicial si no hay preferencia guardada.
 * @param {'default'|'advanced'} [variant='default'] - 'advanced' aplica un estilo atenuado.
 */
export default function CollapsibleSection({
    title,
    subtitle,
    children,
    sectionKey,
    defaultOpen = true,
    variant = 'default',
}) {
    const storageKey = `section_open_${sectionKey ?? title}`;
    const [open, setOpen] = useState(() => {
        try {
            const stored = localStorage.getItem(storageKey);
            if (stored === null) return defaultOpen;
            return stored !== 'false';
        } catch {
            return defaultOpen;
        }
    });

    const toggle = () => {
        const next = !open;
        setOpen(next);
        try { localStorage.setItem(storageKey, String(next)); } catch {}
    };

    const advanced = variant === 'advanced';

    return (
        <section className={`mb-6 overflow-hidden rounded-2xl border shadow-sm ${advanced ? 'border-slate-200 bg-slate-50/70' : 'border-slate-200 bg-white'}`}>
            <button
                type="button"
                onClick={toggle}
                className={`w-full flex items-center justify-between border-b border-slate-200 px-5 py-4 text-white transition-colors ${advanced ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-900 hover:bg-slate-800'}`}
            >
                <div className="text-left">
                    <div className="flex items-center gap-2">
                        {advanced && (
                            <span className="inline-flex items-center rounded-full bg-slate-500/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-100">
                                Avanzado
                            </span>
                        )}
                        <h2 className="text-base font-semibold">{title}</h2>
                    </div>
                    {subtitle && !open && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
                </div>
                {open ? <ChevronDown size={18} className="text-slate-400 shrink-0" /> : <ChevronRight size={18} className="text-slate-400 shrink-0" />}
            </button>
            {open && (
                <>
                    {subtitle && <div className="border-b border-slate-100 bg-slate-50 px-5 py-2 text-xs text-slate-500">{subtitle}</div>}
                    <div className="p-5">{children}</div>
                </>
            )}
        </section>
    );
}
