import React from 'react';

export default function ModulePlaceholder({
    title,
    description,
}) {
    return (
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="max-w-3xl space-y-4">
                <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
                    Modulo en construccion
                </span>
                <div className="space-y-2">
                    <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
                    <p className="text-base leading-7 text-slate-600">{description}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-5 text-sm leading-6 text-slate-500">
                    Esta seccion ya esta enlazada en la aplicacion para que podamos avanzar por etapas.
                    Cuando quieras, continuamos con el flujo funcional y el modelo de datos de este modulo.
                </div>
            </div>
        </section>
    );
}
