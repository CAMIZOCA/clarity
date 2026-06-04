import React from 'react';

const colors = {
    pendiente: 'bg-yellow-100 text-yellow-800',
    atendido: 'bg-green-100 text-green-800',
    cancelado: 'bg-red-100 text-red-800',
    borrador: 'bg-gray-100 text-gray-700',
    completada: 'bg-blue-100 text-blue-800',
    completado: 'bg-green-100 text-green-800',
    admin: 'bg-purple-100 text-purple-800',
    optometra: 'bg-blue-100 text-blue-800',
    recepcionista: 'bg-green-100 text-green-800',
    esclerales: 'bg-indigo-100 text-indigo-800',
    ortoqueratologia: 'bg-cyan-100 text-cyan-800',
    queratocono: 'bg-rose-100 text-rose-800',
    default: 'bg-gray-100 text-gray-700',
};

export default function Badge({ label, color }) {
    const key = color ?? (typeof label === 'string' ? label.toLowerCase() : null);
    const cls = colors[key] ?? colors.default;
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
            {label}
        </span>
    );
}
