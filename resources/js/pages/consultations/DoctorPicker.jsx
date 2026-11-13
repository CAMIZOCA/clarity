import React from 'react';
import { AlertTriangle, CheckCircle, Stethoscope } from 'lucide-react';
import { useUiTemplate } from '../../contexts/UiTemplateContext';

/**
 * Medico de la consulta como tarjetas a la vista, en lugar de un <select>.
 *
 * En la optica todos entran con la misma cuenta, y el <select> cerrado con un
 * medico ya puesto pasaba inadvertido: las consultas quedaban a nombre de otro.
 * Cada tarjeta es un <input type="radio"> visualmente oculto, asi que el
 * teclado (flechas), `fieldset disabled` (solo lectura) y `goToField` funcionan
 * como en cualquier campo.
 *
 * `extraDoctor` es el medico ya guardado en la consulta que no esta en la lista
 * (p. ej. la cuenta Administrador en consultas antiguas): se muestra para no
 * perder el valor.
 */
export default function DoctorPicker({ name, label, register, onChange, options, value, extraDoctor, error }) {
    const doctors = extraDoctor ? [...options, { ...extraDoctor, unavailable: true }] : options;
    const selected = doctors.find((doctor) => String(doctor.id) === String(value ?? ''));
    // Compacto: tarjetas de una linea, cuatro por fila en pantallas anchas.
    const { isCompact } = useUiTemplate();
    const { onChange: registerOnChange, ...field } = register(name);

    const handleChange = (event) => {
        registerOnChange(event);
        onChange?.(event);
    };

    const tone = error
        ? 'border-red-300 bg-red-50'
        : selected
            ? 'border-slate-200 bg-white'
            : 'border-amber-300 bg-amber-50';

    return (
        <div role="radiogroup" aria-labelledby={`${name}-label`} className={`rounded-2xl border p-3 ${tone}`}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span id={`${name}-label`} className={`flex items-center gap-1.5 text-sm font-medium ${error ? 'text-red-600' : 'text-slate-700'}`}>
                    <Stethoscope size={16} className="shrink-0" />
                    {label}
                    <span className="text-red-500" title="Obligatorio para completar la consulta">*</span>
                </span>
                {!selected && !error && (
                    <span className="flex items-center gap-1 text-xs font-medium text-amber-800">
                        <AlertTriangle size={14} /> Elija el médico que atiende
                    </span>
                )}
            </div>

            {doctors.length === 0 ? (
                <p className="text-sm text-slate-500">
                    No hay usuarios con rol Optometrista. Créelos en Administración &gt; Usuarios.
                </p>
            ) : (
                <div className={isCompact ? 'grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-4' : 'grid grid-cols-1 gap-2 sm:grid-cols-2'}>
                    {doctors.map((doctor, index) => {
                        const checked = String(doctor.id) === String(value ?? '');
                        // `goToField` busca por id: la tarjeta marcada o, sin ninguna, la primera.
                        const fieldId = checked || (!selected && index === 0) ? name : undefined;

                        return (
                            <label
                                key={doctor.id}
                                className={`relative flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-navy has-[:disabled]:cursor-default ${
                                    checked
                                        ? 'border-navy bg-navy text-white shadow-sm'
                                        : 'border-slate-300 bg-white text-slate-700 hover:border-navy/60 hover:bg-slate-50'
                                }`}
                            >
                                <input
                                    type="radio"
                                    id={fieldId}
                                    value={String(doctor.id)}
                                    className="sr-only"
                                    {...field}
                                    // El id llega como numero y el `value` del radio es texto:
                                    // react-hook-form no lo marcaba solo.
                                    checked={checked}
                                    onChange={handleChange}
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate font-semibold">{doctor.name ?? doctor.label}</span>
                                    <span className={`block truncate text-xs ${checked ? 'text-blue-200' : 'text-slate-500'}`}>
                                        {[doctor.codigo ?? doctor.code, doctor.registro_senescyt && `SENESCYT ${doctor.registro_senescyt}`]
                                            .filter(Boolean)
                                            .join(' · ') || '—'}
                                        {doctor.unavailable && ' · ya no figura como médico'}
                                    </span>
                                </span>
                                {checked && <CheckCircle size={18} className="shrink-0" aria-hidden="true" />}
                            </label>
                        );
                    })}
                </div>
            )}

            {error && <p id={`${name}-error`} className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
    );
}
