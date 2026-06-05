import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Send } from 'lucide-react';
import { webClient } from '../../api/client';
import { landingContent } from '../../data/landingContent';

const initialForm = {
    name: '',
    company: '',
    email: '',
    phone: '',
    city: '',
    branches_count: '',
    message: '',
    interests: [],
    privacy_accepted: false,
    website: '',
};

function FieldError({ message }) {
    if (!message) return null;
    return <p className="mt-1 text-sm font-semibold text-red-700">{message}</p>;
}

export default function DemoForm() {
    const [form, setForm] = useState(initialForm);
    const [errors, setErrors] = useState({});
    const [status, setStatus] = useState('idle');
    const [message, setMessage] = useState('');

    const selectedCount = useMemo(() => form.interests.length, [form.interests]);

    const update = (field, value) => {
        setForm((current) => ({ ...current, [field]: value }));
        setErrors((current) => ({ ...current, [field]: undefined }));
    };

    const toggleInterest = (interest) => {
        setForm((current) => ({
            ...current,
            interests: current.interests.includes(interest)
                ? current.interests.filter((item) => item !== interest)
                : [...current.interests, interest],
        }));
        setErrors((current) => ({ ...current, interests: undefined }));
    };

    const validate = () => {
        const nextErrors = {};
        if (form.name.trim().length < 2) nextErrors.name = 'Ingresa tu nombre.';
        if (form.company.trim().length < 2) nextErrors.company = 'Ingresa el nombre de la optica.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = 'Ingresa un correo valido.';
        if (form.phone.trim().length < 7) nextErrors.phone = 'Ingresa un telefono de contacto.';
        if (!form.privacy_accepted) nextErrors.privacy_accepted = 'Debes aceptar el uso de datos para ser contactado.';
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const submit = async (event) => {
        event.preventDefault();
        setMessage('');

        if (!validate()) return;

        setStatus('loading');
        try {
            await webClient.post('/demo-request', form);
            setStatus('success');
            setMessage('Solicitud enviada. El equipo comercial podra contactarte con la informacion registrada.');
            setForm(initialForm);
        } catch (error) {
            setStatus('error');
            setErrors(error.response?.data?.errors || {});
            setMessage(error.response?.data?.message || 'No se pudo enviar la solicitud. Intenta nuevamente.');
        }
    };

    return (
        <section id="demo" className="bg-[var(--landing-ink)] px-5 py-20 text-white lg:px-8">
            <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
                <div>
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-200">Solicita una demostracion</p>
                    <h2 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">
                        Mira como Clarity encaja en la operacion de tu optica.
                    </h2>
                    <p className="mt-5 max-w-xl text-lg leading-8 text-white/68">
                        Cuentanos que necesitas revisar y registraremos tu solicitud sin exponer datos sensibles. El formulario usa CSRF, validacion y limite de envios.
                    </p>
                    <div className="mt-8 rounded-3xl border border-white/12 bg-white/6 p-5">
                        <p className="font-black">Funciones de interes seleccionadas</p>
                        <p className="mt-2 text-4xl font-black text-cyan-200">{selectedCount}</p>
                        <p className="mt-2 text-sm leading-6 text-white/62">Puedes elegir varias areas para orientar la demostracion.</p>
                    </div>
                </div>

                <form onSubmit={submit} className="rounded-[2rem] bg-white p-5 text-[var(--landing-ink)] shadow-2xl shadow-black/20 sm:p-7" noValidate>
                    <input
                        type="text"
                        name="website"
                        value={form.website}
                        onChange={(event) => update('website', event.target.value)}
                        className="hidden"
                        tabIndex={-1}
                        autoComplete="off"
                        aria-hidden="true"
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="landing-field">
                            Nombre
                            <input value={form.name} onChange={(event) => update('name', event.target.value)} autoComplete="name" />
                            <FieldError message={errors.name?.[0] || errors.name} />
                        </label>
                        <label className="landing-field">
                            Empresa u optica
                            <input value={form.company} onChange={(event) => update('company', event.target.value)} autoComplete="organization" />
                            <FieldError message={errors.company?.[0] || errors.company} />
                        </label>
                        <label className="landing-field">
                            Correo
                            <input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} autoComplete="email" />
                            <FieldError message={errors.email?.[0] || errors.email} />
                        </label>
                        <label className="landing-field">
                            Telefono
                            <input value={form.phone} onChange={(event) => update('phone', event.target.value)} autoComplete="tel" />
                            <FieldError message={errors.phone?.[0] || errors.phone} />
                        </label>
                        <label className="landing-field">
                            Ciudad
                            <input value={form.city} onChange={(event) => update('city', event.target.value)} autoComplete="address-level2" />
                            <FieldError message={errors.city?.[0] || errors.city} />
                        </label>
                        <label className="landing-field">
                            Numero de sucursales
                            <select value={form.branches_count} onChange={(event) => update('branches_count', event.target.value)}>
                                <option value="">Selecciona</option>
                                <option value="1">1 sucursal</option>
                                <option value="2-3">2 a 3 sucursales</option>
                                <option value="4-9">4 a 9 sucursales</option>
                                <option value="10+">10 o mas</option>
                            </select>
                            <FieldError message={errors.branches_count?.[0] || errors.branches_count} />
                        </label>
                    </div>

                    <fieldset className="mt-5">
                        <legend className="text-sm font-black text-[var(--landing-ink)]">Funciones de interes</legend>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {landingContent.interestOptions.map((interest) => (
                                <button
                                    key={interest}
                                    type="button"
                                    onClick={() => toggleInterest(interest)}
                                    className={`rounded-full border px-3 py-2 text-sm font-bold transition ${
                                        form.interests.includes(interest)
                                            ? 'border-[var(--landing-blue)] bg-[var(--landing-blue)] text-white'
                                            : 'border-[var(--landing-line)] bg-white text-[var(--landing-muted)] hover:border-[var(--landing-cyan)]'
                                    }`}
                                >
                                    {interest}
                                </button>
                            ))}
                        </div>
                        <FieldError message={errors.interests?.[0] || errors.interests} />
                    </fieldset>

                    <label className="landing-field mt-5">
                        Mensaje
                        <textarea rows={4} value={form.message} onChange={(event) => update('message', event.target.value)} placeholder="Cuentanos que proceso quieres mejorar primero." />
                        <FieldError message={errors.message?.[0] || errors.message} />
                    </label>

                    <label className="mt-5 flex gap-3 text-sm font-semibold leading-6 text-[var(--landing-muted)]">
                        <input
                            type="checkbox"
                            checked={form.privacy_accepted}
                            onChange={(event) => update('privacy_accepted', event.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-[var(--landing-line)] text-[var(--landing-blue)] focus:ring-[var(--landing-cyan)]"
                        />
                        Acepto que mis datos sean usados para responder esta solicitud de demostracion.
                    </label>
                    <FieldError message={errors.privacy_accepted?.[0] || errors.privacy_accepted} />

                    {message && (
                        <div className={`mt-5 flex gap-3 rounded-2xl p-4 text-sm font-bold ${status === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                            {status === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                            {message}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={status === 'loading'}
                        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--landing-blue)] px-6 py-4 font-black text-white shadow-xl shadow-cyan-900/12 transition hover:bg-[var(--landing-navy)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {status === 'loading' ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                        Enviar solicitud
                    </button>
                </form>
            </div>
        </section>
    );
}
