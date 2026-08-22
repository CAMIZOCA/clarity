import React, { useEffect, useState } from 'react';
import { useController } from 'react-hook-form';
import { Calendar } from 'lucide-react';
import { toDisplayDate, toIsoDate } from '../../utils/dates';

/**
 * Campo de fecha en formato latino DD/MM/AAAA.
 *
 * `<input type="date">` se renderiza segun el locale del navegador y no es
 * controlable, por eso aqui se usa un input de texto con mascara. Hacia
 * react-hook-form siempre emite `YYYY-MM-DD`, que es lo que espera la API.
 */

/** Inserta las barras a medida que se escribe: `12051990` -> `12/05/1990`. */
function applyMask(raw) {
    const digits = String(raw).replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Valida que la fecha exista de verdad (rechaza 31/02/2026). */
function isRealDate(display) {
    const match = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return false;

    const [, day, month, year] = match.map(Number);
    if (month < 1 || month > 12 || day < 1) return false;

    const date = new Date(year, month - 1, day, 12, 0, 0);
    return date.getFullYear() === year
        && date.getMonth() === month - 1
        && date.getDate() === day;
}

export default function DateInput({
    control,
    name,
    label,
    required,
    hint,
    className = '',
    nextFieldId,
    disabled,
    rules,
    ...props
}) {
    const { field, fieldState } = useController({ control, name, rules });
    const [display, setDisplay] = useState(() => toDisplayDate(field.value));
    const [touched, setTouched] = useState(false);

    // Resincronizar cuando el valor cambia desde fuera (reset, carga de datos).
    useEffect(() => {
        const next = toDisplayDate(field.value);
        setDisplay((current) => (toIsoDate(current) === toIsoDate(field.value) ? current : next));
    }, [field.value]);

    const handleChange = (event) => {
        const masked = applyMask(event.target.value);
        setDisplay(masked);

        if (masked === '') {
            field.onChange('');
        } else if (isRealDate(masked)) {
            field.onChange(toIsoDate(masked));
        }
    };

    const handleBlur = () => {
        setTouched(true);
        // Una fecha incompleta o inexistente no se envia: se limpia el valor.
        if (display !== '' && !isRealDate(display)) {
            field.onChange('');
        }
        field.onBlur();
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' && !event.isComposing && nextFieldId) {
            const nextField = document.getElementById(nextFieldId);
            if (nextField && typeof nextField.focus === 'function') {
                event.preventDefault();
                nextField.focus({ preventScroll: true });
            }
        }
    };

    const invalid = Boolean(fieldState.error)
        || (touched && display !== '' && !isRealDate(display));
    const errorText = fieldState.error?.message
        ?? (touched && display !== '' && !isRealDate(display) ? 'Fecha invalida' : null);

    return (
        <div className={`flex flex-col gap-1 ${className}`}>
            {label && (
                <label htmlFor={name} className={`text-sm font-medium ${invalid ? 'text-red-600' : 'text-gray-700'}`}>
                    {label}{required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}
            <div className="relative flex items-center">
                <input
                    id={name}
                    ref={field.ref}
                    name={field.name}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="DD/MM/AAAA"
                    maxLength={10}
                    disabled={disabled}
                    value={display}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    enterKeyHint={nextFieldId ? 'next' : 'done'}
                    className={`w-full rounded-lg border text-base py-2.5 pl-3 pr-10 transition-colors
                        min-h-11 touch-manipulation focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]
                        focus:border-transparent focus:bg-[#fef08a]/20 disabled:bg-gray-100
                        ${invalid ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}`}
                    {...props}
                />
                <Calendar size={16} className="pointer-events-none absolute right-3 text-gray-400" />
            </div>
            {hint && !errorText && <p className="text-xs text-gray-500">{hint}</p>}
            {errorText && <p className="text-xs text-red-500">{errorText}</p>}
        </div>
    );
}
