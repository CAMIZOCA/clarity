import React from 'react';
import { MOTOR_BINOCULAR_BLOCKS } from '../../data/motorBinocularSchema';

// Colores por bloque (`tone` del esquema). Clases literales para que Tailwind las detecte.
const TONES = {
    sky: { bar: 'border-sky-200 bg-sky-50 text-sky-900' },
    emerald: { bar: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
    pink: { bar: 'border-pink-200 bg-pink-50 text-pink-900' },
    amber: { bar: 'border-amber-200 bg-amber-50 text-amber-900' },
};

const INPUT_CLASS = 'w-full rounded-xl border border-slate-300 px-3 py-2';
const TH_CLASS = 'px-3 py-2 text-center text-xs font-semibold uppercase text-slate-500';

/**
 * Examen motor, binocular y acomodativo (Terapia visual). Los bloques, filas y
 * campos salen de `MOTOR_BINOCULAR_BLOCKS`; cada input se registra como
 * `motor_binocular_data.bloque.prueba.campo` y su id es ese mismo nombre para
 * que `goToField` lo encuentre.
 */
export default function MotorBinocularSection({ register }) {
    const renderInput = (name, placeholder) => (
        <input id={name} className={INPUT_CLASS} placeholder={placeholder} {...register(name)} />
    );

    return (
        <div className="space-y-6">
            {MOTOR_BINOCULAR_BLOCKS.map((block) => {
                const tone = TONES[block.tone] ?? TONES.sky;
                // Binocularidad: una sola columna que reparte todas las celdas en linea.
                const inline = block.columns.length === 1;
                const minWidth = inline ? 'min-w-[820px]' : 'min-w-[720px]';

                return (
                    <div key={block.key} className="overflow-hidden rounded-2xl border border-slate-200">
                        <div className={`border-b px-4 py-2 text-sm font-semibold ${tone.bar}`}>{block.title}</div>
                        <div className="overflow-x-auto">
                            <table className={`w-full ${minWidth} text-sm`}>
                                <thead>
                                    <tr className="bg-slate-100">
                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Prueba</th>
                                        {block.columns.map((column) => (
                                            <th key={column} className={TH_CLASS}>{column}</th>
                                        ))}
                                        <th className={TH_CLASS}>Observación</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {block.rows.map((row) => {
                                        const fieldName = (cell) => `motor_binocular_data.${block.key}.${row.key}.${cell}`;
                                        const cellBox = (cell) => (
                                            <div key={cell.key} className="min-w-0 flex-1 basis-40">
                                                {cell.label && (
                                                    <span className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">{cell.label}</span>
                                                )}
                                                {renderInput(fieldName(cell.key), cell.placeholder)}
                                            </div>
                                        );

                                        return (
                                            <tr key={row.key} className="border-b border-slate-200 align-top">
                                                <td className="px-3 py-3 text-slate-700">
                                                    <span className="font-bold">{row.label}</span>
                                                    {row.hint && <span className="ml-1 text-xs font-normal text-slate-500">{row.hint}</span>}
                                                </td>
                                                {inline ? (
                                                    <td className="px-2 py-2">
                                                        <div className="flex flex-wrap gap-2">{row.cells.filter(Boolean).map(cellBox)}</div>
                                                    </td>
                                                ) : row.cells.map((cell, index) => (
                                                    <td key={block.columns[index]} className="px-2 py-2">
                                                        {cell ? (
                                                            <>
                                                                {cell.label && (
                                                                    <span className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">{cell.label}</span>
                                                                )}
                                                                {renderInput(fieldName(cell.key), cell.placeholder)}
                                                            </>
                                                        ) : (
                                                            <div className="py-2 text-center text-slate-400">—</div>
                                                        )}
                                                    </td>
                                                ))}
                                                <td className="px-2 py-2">{renderInput(fieldName('observacion'), row.observacion)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
