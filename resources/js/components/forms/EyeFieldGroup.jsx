import React from 'react';
import { useRequiredErrors } from './RequiredErrorsContext';

/**
 * Tabla OD/OI reutilizable de las secciones de refraccion.
 *
 * Todos los campos son `type="text"`: con `type="number"` la rueda del mouse
 * sobre un input enfocado cambiaba el valor en silencio y aparecian los
 * steppers. Se conserva `inputMode` para que el movil siga abriendo el teclado
 * numerico. La validacion de rangos clinicos vive en el backend
 * (`App\Rules\ValidOpticalPrescription`).
 *
 * @param {string} prefix - ej. "rx_uso" -> genera rx_uso_esfera_od, rx_uso_esfera_oi...
 * @param {string} label - titulo de la seccion
 * @param {string[]} fields - columnas a mostrar, en orden
 * @param {object} register - register de react-hook-form
 * @param {object} labelOverrides - renombra encabezados solo en esta tabla
 * @param {string[]} tabOrder - recorrido de teclado como sufijos `campo_ojo`
 * @param {function} nameFor - (campo, ojo) => nombre del campo; permite usar la
 *   tabla dentro de un `useFieldArray` (ej. `rx_uso_entries.0.esfera_od`)
 * @param {React.ReactNode} footer - contenido bajo la tabla (ej. observaciones)
 * @param {object[]} extra - columnas adicionales no derivadas de `prefix`
 */

const FIELD_META = {
    esfera:    { label: 'Esfera',     placeholder: '±0.00', inputMode: 'decimal' },
    cilindro:  { label: 'Cilindro',   placeholder: '±0.00', inputMode: 'decimal' },
    eje:       { label: 'Eje (°)',    placeholder: '0–180', inputMode: 'numeric' },
    add:       { label: 'ADD',        placeholder: '0.00',  inputMode: 'decimal' },
    distancia: { label: 'Distancia',  placeholder: 'a 50cm', inputMode: 'text' },
    avcc:      { label: 'AV.CC',      placeholder: '20/20', inputMode: 'text' },
    avl:       { label: 'AVL',        placeholder: '20/20', inputMode: 'text' },
    av:        { label: 'AV',         placeholder: '20/20', inputMode: 'text' },
    prisma:    { label: 'Prisma',     placeholder: '3 BE',  inputMode: 'text' },
    base:      { label: 'Base',       placeholder: '—',     inputMode: 'text' },
    dnp:       { label: 'DNP/DP',     placeholder: 'mm',    inputMode: 'text' },
};

const EYES = ['od', 'oi'];

/**
 * Secuencia de recorrido con Tab/Enter.
 *
 * Por defecto va fila por fila (OD completo y luego OI). Si se pasa `tabOrder`,
 * ese recorrido manda y cualquier campo visible que no aparezca en el se agrega
 * al final, de modo que ocultar una columna nunca rompe la navegacion.
 */
function buildOrderedNames({ fields, extra, tabOrder, resolve }) {
    const rowOrder = EYES.flatMap((eye) => [
        ...fields.map((field) => resolve(field, eye)),
        ...extra.map((field) => `${field.name}_${eye}`),
    ]);

    if (!tabOrder?.length) return rowOrder;

    const available = new Set(rowOrder);
    const preferred = tabOrder
        .map((suffix) => {
            const separator = suffix.lastIndexOf('_');
            return resolve(suffix.slice(0, separator), suffix.slice(separator + 1));
        })
        .filter((name) => available.has(name));

    const seen = new Set(preferred);
    return [...preferred, ...rowOrder.filter((name) => !seen.has(name))];
}

export default function EyeFieldGroup({
    prefix,
    label,
    fields,
    register,
    labelOverrides = {},
    tabOrder = null,
    footer = null,
    extra = [],
    nameFor = null,
}) {
    const requiredErrors = useRequiredErrors();

    const resolve = nameFor ?? ((field, eye) => `${prefix}_${field}_${eye}`);
    const orderedNames = buildOrderedNames({ fields, extra, tabOrder, resolve });
    const nextByName = new Map(orderedNames.map((name, index) => [name, orderedNames[index + 1] ?? null]));
    const prevByName = new Map(orderedNames.map((name, index) => [name, orderedNames[index - 1] ?? null]));

    const focusField = (targetId) => {
        const target = document.getElementById(targetId);
        if (!target || typeof target.focus !== 'function') return false;

        target.focus({ preventScroll: true });
        if (typeof target.select === 'function') target.select();
        return true;
    };

    /** Enter y Tab siguen el mismo recorrido explicito; Shift+Tab lo recorre al reves. */
    const handleKeyDown = (event, name) => {
        if (event.isComposing) return;

        const goingBack = event.key === 'Tab' && event.shiftKey;
        const isAdvance = event.key === 'Enter' || (event.key === 'Tab' && !event.shiftKey);
        if (!isAdvance && !goingBack) return;

        const targetId = goingBack ? prevByName.get(name) : nextByName.get(name);
        if (!targetId) return;

        if (focusField(targetId)) event.preventDefault();
    };

    const headerLabel = (field) => labelOverrides[field] ?? FIELD_META[field]?.label ?? field;

    const inputCls = (name) =>
        `w-full min-h-11 px-2 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] focus:bg-[#fef08a]/20 touch-manipulation
        ${requiredErrors.has(name) ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}`;

    return (
        <div className="mb-6">
            {label && (
                <h3 className="text-sm font-semibold text-[#1a2a4a] uppercase tracking-wider mb-3 pb-1 border-b border-[#1a2a4a]/20">
                    {label}
                </h3>
            )}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="w-16 px-2 py-2 text-left text-xs font-medium text-gray-500">Ojo</th>
                            {fields.map(f => (
                                <th key={f} className="px-2 py-2 text-center text-xs font-medium text-gray-500">
                                    {headerLabel(f)}
                                </th>
                            ))}
                            {extra.map(e => (
                                <th key={e.name} className="px-2 py-2 text-center text-xs font-medium text-gray-500">{e.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {EYES.map(eye => (
                            <tr key={eye} className={`border-b ${eye === 'od' ? 'bg-blue-50/30' : 'bg-green-50/30'}`}>
                                <td className="px-2 py-2">
                                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold text-white ${eye === 'od' ? 'bg-blue-600' : 'bg-green-600'}`}>
                                        {eye.toUpperCase()}
                                    </span>
                                </td>
                                {fields.map(f => {
                                    const meta = FIELD_META[f] ?? { inputMode: 'text' };
                                    const name = resolve(f, eye);
                                    return (
                                        <td key={f} className="px-2 py-2">
                                            <input
                                                id={name}
                                                type="text"
                                                inputMode={meta.inputMode}
                                                enterKeyHint={nextByName.get(name) ? 'next' : 'done'}
                                                placeholder={meta.placeholder}
                                                className={inputCls(name)}
                                                onKeyDown={(event) => handleKeyDown(event, name)}
                                                {...register(name)}
                                            />
                                        </td>
                                    );
                                })}
                                {extra.map(e => {
                                    const name = `${e.name}_${eye}`;
                                    return (
                                        <td key={e.name} className="px-2 py-2">
                                            {e.type === 'select' ? (
                                                <select
                                                    id={name}
                                                    className={inputCls(name)}
                                                    enterKeyHint={nextByName.get(name) ? 'next' : 'done'}
                                                    onKeyDown={(event) => handleKeyDown(event, name)}
                                                    {...register(name)}
                                                >
                                                    <option value="">—</option>
                                                    {e.options?.map(o => <option key={o} value={o}>{o}</option>)}
                                                </select>
                                            ) : (
                                                <input
                                                    id={name}
                                                    type="text"
                                                    inputMode={e.inputMode ?? 'text'}
                                                    enterKeyHint={nextByName.get(name) ? 'next' : 'done'}
                                                    placeholder={e.placeholder ?? '—'}
                                                    className={inputCls(name)}
                                                    onKeyDown={(event) => handleKeyDown(event, name)}
                                                    {...register(name)}
                                                />
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {footer}
        </div>
    );
}
