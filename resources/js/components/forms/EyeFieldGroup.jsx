import React from 'react';

/**
 * Reusable OD/OI field group.
 * @param {string} prefix - e.g. "rx_uso" → generates rx_uso_esfera_od, rx_uso_esfera_oi ...
 * @param {string} label - Section label
 * @param {string[]} fields - Array of field names: ['esfera','cilindro','eje','add','avcc'] etc.
 * @param {object} register - react-hook-form register
 * @param {object} errors - react-hook-form errors
 * @param {object} extraCols - additional columns not doubled: {name, label, type?}
 */
export default function EyeFieldGroup({ prefix, label, fields, register, errors, extra = [] }) {
    const fieldMeta = {
        esfera:   { label: 'Esfera',    type: 'number', step: '0.25', min: '-30', max: '30', placeholder: '±0.00', inputMode: 'decimal' },
        cilindro: { label: 'Cilindro',  type: 'number', step: '0.25', min: '-10', max: '10', placeholder: '±0.00', inputMode: 'decimal' },
        eje:      { label: 'Eje (°)',   type: 'number', step: '1',    min: '0',   max: '180', placeholder: '0–180', inputMode: 'numeric' },
        add:      { label: 'ADD',       type: 'number', step: '0.25', min: '0',   max: '5',  placeholder: '0.00', inputMode: 'decimal' },
        avcc:     { label: 'AV.CC',     type: 'text',   placeholder: '20/20', inputMode: 'text' },
        avl:      { label: 'AVL',       type: 'text',   placeholder: '20/20', inputMode: 'text' },
        av:       { label: 'AV',        type: 'text',   placeholder: '20/20', inputMode: 'text' },
        prisma:   { label: 'Prisma',    type: 'text',   placeholder: '—', inputMode: 'text' },
        base:     { label: 'Base',      type: 'text',   placeholder: '—', inputMode: 'text' },
        dnp:      { label: 'DNP/DP',    type: 'text',   placeholder: 'mm', inputMode: 'text' },
    };

    const orderedNames = ['od', 'oi'].flatMap((eye) => [
        ...fields.map((field) => `${prefix}_${field}_${eye}`),
        ...extra.map((field) => `${field.name}_${eye}`),
    ]);
    const nextByName = new Map(orderedNames.map((name, index) => [name, orderedNames[index + 1] ?? null]));

    const focusNextField = (event, nextFieldId) => {
        if (event.key !== 'Enter' || event.isComposing || !nextFieldId) {
            return;
        }

        const nextField = document.getElementById(nextFieldId);
        if (!nextField || typeof nextField.focus !== 'function') {
            return;
        }

        event.preventDefault();
        nextField.focus({ preventScroll: true });
        if (typeof nextField.select === 'function') {
            nextField.select();
        }
    };

    const inputCls = (name) =>
        `w-full min-h-11 px-2 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] focus:bg-[#fef08a]/20 touch-manipulation
        ${errors?.[name] ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}`;

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
                                    {fieldMeta[f]?.label ?? f}
                                </th>
                            ))}
                            {extra.map(e => (
                                <th key={e.name} className="px-2 py-2 text-center text-xs font-medium text-gray-500">{e.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {['od', 'oi'].map(eye => (
                            <tr key={eye} className={`border-b ${eye === 'od' ? 'bg-blue-50/30' : 'bg-green-50/30'}`}>
                                <td className="px-2 py-2">
                                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold text-white ${eye === 'od' ? 'bg-blue-600' : 'bg-green-600'}`}>
                                        {eye.toUpperCase()}
                                    </span>
                                </td>
                                {fields.map(f => {
                                    const m = fieldMeta[f] ?? { type: 'text' };
                                    const name = `${prefix}_${f}_${eye}`;
                                    const nextFieldId = nextByName.get(name);
                                    return (
                                        <td key={f} className="px-2 py-2">
                                            <input
                                                id={name}
                                                type={m.type}
                                                step={m.step}
                                                min={m.min}
                                                max={m.max}
                                                inputMode={m.inputMode}
                                                enterKeyHint={nextFieldId ? 'next' : 'done'}
                                                placeholder={m.placeholder}
                                                className={inputCls(name)}
                                                onKeyDown={(event) => focusNextField(event, nextFieldId)}
                                                {...register(name)}
                                            />
                                        </td>
                                    );
                                })}
                                {extra.map(e => (
                                    <td key={e.name} className="px-2 py-2">
                                        {e.type === 'select' ? (
                                            <select
                                                id={`${e.name}_${eye}`}
                                                className={inputCls(`${e.name}_${eye}`)}
                                                enterKeyHint={nextByName.get(`${e.name}_${eye}`) ? 'next' : 'done'}
                                                onKeyDown={(event) => focusNextField(event, nextByName.get(`${e.name}_${eye}`))}
                                                {...register(`${e.name}_${eye}`)}
                                            >
                                                <option value="">—</option>
                                                {e.options?.map(o => <option key={o} value={o}>{o}</option>)}
                                            </select>
                                        ) : (
                                            <input
                                                id={`${e.name}_${eye}`}
                                                type="text"
                                                inputMode={e.inputMode ?? 'text'}
                                                enterKeyHint={nextByName.get(`${e.name}_${eye}`) ? 'next' : 'done'}
                                                placeholder={e.placeholder ?? '—'}
                                                className={inputCls(`${e.name}_${eye}`)}
                                                onKeyDown={(event) => focusNextField(event, nextByName.get(`${e.name}_${eye}`))}
                                                {...register(`${e.name}_${eye}`)}
                                            />
                                        )}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
