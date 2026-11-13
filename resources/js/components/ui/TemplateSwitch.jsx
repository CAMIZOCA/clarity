import React from 'react';
import { useUiTemplate } from '../../contexts/UiTemplateContext';

const OPTIONS = [
    { value: 'clasico', label: 'Clásico' },
    { value: 'compacto', label: 'Compacto' },
];

/**
 * Control segmentado "Clásico / Compacto". Guarda la elección del usuario
 * (PATCH /me/preferences) y la pantalla cambia al instante, sin recargar.
 * Con `value`/`onChange` sirve tambien para elegir el defecto de la optica.
 */
export default function TemplateSwitch({ value, onChange, label = 'Diseño de pantalla', tone = 'light', className = '' }) {
    const { template, setTemplate } = useUiTemplate();
    const current = value ?? template;
    const pick = onChange ?? setTemplate;
    const dark = tone === 'dark';

    return (
        <div className={className}>
            {label && (
                <p className={`mb-1 text-xs font-medium ${dark ? 'text-slate-300' : 'text-gray-500'}`}>{label}</p>
            )}
            <div
                role="radiogroup"
                aria-label={label || 'Diseño de pantalla'}
                className={`inline-flex w-full rounded-lg p-0.5 ${dark ? 'bg-white/10' : 'bg-gray-900/5'}`}
            >
                {OPTIONS.map((option) => {
                    const selected = current === option.value;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => pick(option.value)}
                            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                                selected
                                    ? dark ? 'bg-white text-navy shadow-sm' : 'bg-white text-gray-900 shadow-sm'
                                    : dark ? 'text-slate-200 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            {option.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
