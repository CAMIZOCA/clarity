import React, { useEffect, useRef, useState } from 'react';
import { useController } from 'react-hook-form';
import { Calendar } from 'lucide-react';
import { toDisplayDate, toIsoDate } from '../../utils/dates';
import { focusField } from '../../utils/fieldNavigation';

/**
 * Campo de fecha en formato latino DD/MM/AAAA.
 *
 * `<input type="date">` se renderiza segun el locale del navegador y no es
 * controlable, por eso aqui se usa un input de texto con mascara. Hacia
 * react-hook-form siempre emite `YYYY-MM-DD`, que es lo que espera la API.
 *
 * El boton del calendario abre un `<input type="date">` nativo oculto, solo como
 * ayuda para elegir el dia: la fuente de verdad sigue siendo el texto con mascara.
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
    error,
    ...props
}) {
    const { field, fieldState } = useController({ control, name, rules });
    const [display, setDisplay] = useState(() => toDisplayDate(field.value));
    const [touched, setTouched] = useState(false);
    const textRef = useRef(null);
    const pickerRef = useRef(null);

    // Resincronizar cuando el valor cambia desde fuera (reset, carga de datos).
    // Lo escrito solo cuenta si es una fecha completa: `toIsoDate` cae en
    // `new Date(texto)`, que interpreta "12/05/199" como 5 de diciembre del
    // anio 199, y con eso una fecha a medio corregir se borraba al salir del
    // campo en vez de quedar marcada como invalida.
    useEffect(() => {
        const next = toDisplayDate(field.value);
        setDisplay((current) => {
            const typed = isRealDate(current) ? toIsoDate(current) : '';

            return typed === toIsoDate(field.value) ? current : next;
        });
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

    const openPicker = () => {
        const picker = pickerRef.current;
        if (!picker) return;

        try {
            if (typeof picker.showPicker === 'function') picker.showPicker();
            else picker.click();
        } catch {
            // Sin activacion de usuario o contexto no soportado: se sigue escribiendo.
        }
    };

    const handlePick = (event) => {
        const iso = event.target.value;
        if (!iso) return;

        setDisplay(toDisplayDate(iso));
        field.onChange(iso);
        setTouched(true);
        textRef.current?.focus({ preventScroll: true });
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' && !event.isComposing && nextFieldId) {
            const nextField = document.getElementById(nextFieldId);
            if (nextField && typeof nextField.focus === 'function') {
                event.preventDefault();
                focusField(nextField);
            }
        }
    };

    const unfinished = touched && display !== '' && !isRealDate(display);
    // `error` es un mensaje que viene de fuera del formulario (p. ej. un 422 de la API).
    const invalid = Boolean(fieldState.error) || unfinished || Boolean(error);
    // Lo escrito manda sobre el error del formulario: con el campo a medias el
    // valor esta vacio y el "Requerido" taparia el motivo real.
    const errorText = unfinished
        ? (/^\d{2}\/\d{2}\/\d{1,3}$/.test(display) ? 'Escriba el año con 4 dígitos' : 'Fecha invalida')
        : (fieldState.error?.message ?? error ?? null);

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
                    ref={(node) => {
                        textRef.current = node;
                        field.ref(node);
                    }}
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
                <button
                    type="button"
                    tabIndex={-1}
                    disabled={disabled}
                    onClick={openPicker}
                    aria-label="Abrir calendario"
                    className="absolute right-0 flex h-full min-w-11 items-center justify-center rounded-r-lg
                        text-gray-400 hover:text-[#1a2a4a] disabled:pointer-events-none"
                >
                    <Calendar size={16} />
                </button>
                <input
                    ref={pickerRef}
                    type="date"
                    tabIndex={-1}
                    aria-hidden="true"
                    disabled={disabled}
                    value={toIsoDate(field.value)}
                    onChange={handlePick}
                    className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
                />
            </div>
            {hint && !errorText && <p className="text-xs text-gray-500">{hint}</p>}
            {errorText && <p className="text-xs text-red-500">{errorText}</p>}
        </div>
    );
}
