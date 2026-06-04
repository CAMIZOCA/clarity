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
        esfera:   { label: 'Esfera',    type: 'number', step: '0.25', min: '-30', max: '30', placeholder: '±0.00' },
        cilindro: { label: 'Cilindro',  type: 'number', step: '0.25', min: '-10', max: '10', placeholder: '±0.00' },
        eje:      { label: 'Eje (°)',   type: 'number', step: '1',    min: '0',   max: '180', placeholder: '0–180' },
        add:      { label: 'ADD',       type: 'number', step: '0.25', min: '0',   max: '5',  placeholder: '0.00' },
        avcc:     { label: 'AV.CC',     type: 'text',   placeholder: '20/20' },
        avl:      { label: 'AVL',       type: 'text',   placeholder: '20/20' },
        av:       { label: 'AV',        type: 'text',   placeholder: '20/20' },
        prisma:   { label: 'Prisma',    type: 'text',   placeholder: '—' },
        base:     { label: 'Base',      type: 'text',   placeholder: '—' },
        dnp:      { label: 'DNP/DP',    type: 'text',   placeholder: 'mm' },
    };

    const inputCls = (name) =>
        `w-full px-2 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] focus:bg-[#fef08a]/20
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
                                    return (
                                        <td key={f} className="px-2 py-2">
                                            <input
                                                type={m.type}
                                                step={m.step}
                                                min={m.min}
                                                max={m.max}
                                                placeholder={m.placeholder}
                                                className={inputCls(name)}
                                                {...register(name)}
                                            />
                                        </td>
                                    );
                                })}
                                {extra.map(e => (
                                    <td key={e.name} className="px-2 py-2">
                                        {e.type === 'select' ? (
                                            <select className={inputCls(`${e.name}_${eye}`)} {...register(`${e.name}_${eye}`)}>
                                                <option value="">—</option>
                                                {e.options?.map(o => <option key={o} value={o}>{o}</option>)}
                                            </select>
                                        ) : (
                                            <input type="text" placeholder={e.placeholder ?? '—'}
                                                className={inputCls(`${e.name}_${eye}`)} {...register(`${e.name}_${eye}`)} />
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
