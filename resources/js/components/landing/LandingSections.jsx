import React from 'react';
import { ArrowRight, Check, Minus, Plus, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { landingContent } from '../../data/landingContent';
import { HeroMockup, ModuleMockup } from './Mockups';

export function HeroSection() {
    const [keyword, ...restWords] = landingContent.hero.title.split(' ');
    return (
        <section className="relative isolate overflow-hidden bg-[var(--landing-bg)] px-5 pb-20 pt-32 lg:px-8 lg:pt-36">
            <div className="landing-grid-dark" />
            <div
                className="pointer-events-none absolute -top-32 right-[-10%] h-[32rem] w-[32rem] rounded-full opacity-60 blur-3xl"
                style={{ background: 'radial-gradient(closest-side, rgba(37,99,235,0.35), rgba(99,102,241,0.15), transparent 75%)' }}
            />
            <div
                className="pointer-events-none absolute bottom-[-20%] left-[-10%] h-[26rem] w-[26rem] rounded-full opacity-50 blur-3xl"
                style={{ background: 'radial-gradient(closest-side, rgba(34,211,238,0.28), transparent 75%)' }}
            />
            <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="landing-reveal">
                    <p className="inline-flex items-center gap-2 rounded-full border border-[var(--landing-on-dark-line)] bg-white/8 px-4 py-2 text-sm font-black text-white/85 backdrop-blur">
                        <Sparkles size={16} className="text-[var(--landing-cyan)]" />
                        {landingContent.hero.eyebrow}
                    </p>
                    <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[0.98] text-white sm:text-6xl lg:text-7xl">
                        <span className="landing-gradient-text">{keyword}</span> {restWords.join(' ')}
                    </h1>
                    <p className="mt-6 max-w-2xl text-lg leading-8 text-white/68 sm:text-xl">
                        {landingContent.hero.subtitle}
                    </p>
                    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                        <a href="#demo" className="landing-gradient-cta inline-flex items-center justify-center gap-2 rounded-full px-6 py-4 font-black text-white shadow-xl shadow-blue-900/30 transition hover:-translate-y-0.5">
                            {landingContent.hero.primaryCta}
                            <ArrowRight size={19} />
                        </a>
                        <Link to="/login" className="inline-flex items-center justify-center rounded-full border border-[var(--landing-on-dark-line)] bg-white/5 px-6 py-4 font-black text-white transition hover:-translate-y-0.5 hover:border-[var(--landing-cyan)] hover:bg-white/10">
                            {landingContent.hero.secondaryCta}
                        </Link>
                    </div>
                    <p className="mt-5 max-w-xl text-sm font-semibold leading-6 text-white/50">{landingContent.hero.trust}</p>
                </div>
                <HeroMockup />
            </div>
        </section>
    );
}

export function TrustBar() {
    return (
        <section className="border-y border-[var(--landing-on-dark-line)] bg-[var(--landing-bg-soft)] px-5 py-10 lg:px-8">
            <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_1.4fr] lg:items-center">
                <div className="grid grid-cols-3 gap-6 border-b border-[var(--landing-on-dark-line)] pb-8 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-8">
                    <div>
                        <span className="landing-stat-number">{landingContent.modules.length}</span>
                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-white/50">Modulos</p>
                    </div>
                    <div>
                        <span className="landing-stat-number">{landingContent.roleBenefits.length}</span>
                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-white/50">Roles cubiertos</p>
                    </div>
                    <div>
                        <span className="landing-stat-number">{landingContent.platformCards.length}</span>
                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-white/50">Areas clave</p>
                    </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    {landingContent.trustItems.map(({ icon: Icon, title, text }) => (
                        <div key={title} className="flex gap-3">
                            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/8 text-[var(--landing-cyan)]"><Icon size={21} /></span>
                            <span>
                                <span className="block font-black text-white">{title}</span>
                                <span className="block text-sm leading-6 text-white/60">{text}</span>
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

export function ProblemsSection() {
    return (
        <section id="beneficios" className="px-5 py-20 lg:px-8">
            <div className="mx-auto max-w-7xl">
                <div className="max-w-3xl">
                    <p className="landing-eyebrow">Problemas que resuelve</p>
                    <h2 className="landing-title">Deja de operar con informacion dispersa.</h2>
                    <p className="landing-subtitle">Clarity conecta los puntos criticos de la optica para reducir errores administrativos y acelerar la atencion.</p>
                </div>
                <div className="mt-10 grid gap-5 lg:grid-cols-2">
                    {landingContent.problems.map((item) => (
                        <article key={item.problem} className="landing-glow rounded-3xl border border-[var(--landing-line)] bg-white p-6 shadow-lg shadow-indigo-900/5 transition hover:-translate-y-1 hover:border-[var(--landing-cyan)]">
                            <div className="grid gap-4 sm:grid-cols-[0.85fr_1.15fr]">
                                <div className="rounded-2xl bg-red-50 p-4">
                                    <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-red-700"><Minus size={16} /> Antes</p>
                                    <p className="mt-3 font-black text-[var(--landing-ink)]">{item.problem}</p>
                                </div>
                                <div className="rounded-2xl bg-emerald-50 p-4">
                                    <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-emerald-700"><Plus size={16} /> Con Clarity</p>
                                    <p className="mt-3 leading-7 text-[var(--landing-muted)]">{item.solution}</p>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}

export function PlatformSection() {
    return (
        <section id="funciones" className="bg-[var(--landing-soft)] px-5 py-20 lg:px-8">
            <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                <div>
                    <p className="landing-eyebrow">Una plataforma para toda tu optica</p>
                    <h2 className="landing-title">Del examen visual al cierre de caja, todo queda conectado.</h2>
                    <p className="landing-subtitle">La landing usa un mockup demostrativo creado a partir de pantallas y rutas reales del proyecto, sin datos de pacientes reales.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    {landingContent.platformCards.map(({ icon: Icon, label, text }) => (
                        <article key={label} className="landing-glow rounded-2xl bg-white p-5 shadow-lg shadow-indigo-900/5 transition hover:-translate-y-1">
                            <span className="landing-gradient-bg grid h-11 w-11 place-items-center rounded-xl text-white">
                                <Icon size={22} />
                            </span>
                            <h3 className="mt-4 text-xl font-black text-[var(--landing-ink)]">{label}</h3>
                            <p className="mt-2 leading-7 text-[var(--landing-muted)]">{text}</p>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}

export function ModulesSection() {
    return (
        <section id="modulos" className="px-5 py-20 lg:px-8">
            <div className="mx-auto max-w-7xl">
                <div className="max-w-3xl">
                    <p className="landing-eyebrow">Modulos principales verificados</p>
                    <h2 className="landing-title">Funciones reales explicadas por el beneficio que generan.</h2>
                    <p className="landing-subtitle">Cada modulo incluido tiene evidencia en rutas, modelos, controladores o pantallas del sistema.</p>
                </div>
                <div className="mt-12 space-y-12">
                    {landingContent.modules.map((module, index) => {
                        const Icon = module.icon;
                        const textOrder = index % 2 ? 'lg:order-2' : '';
                        const mockupOrder = index % 2 ? 'lg:order-1' : '';
                        return (
                            <article className="landing-glow grid gap-8 rounded-[2rem] border border-[var(--landing-line)] bg-white p-5 shadow-xl shadow-indigo-900/6 lg:grid-cols-2 lg:p-8" key={module.id}>
                                <div className={`flex flex-col justify-center ${textOrder}`}>
                                    <span className="landing-gradient-bg grid h-12 w-12 place-items-center rounded-xl text-white"><Icon size={25} /></span>
                                    <h3 className="mt-5 text-3xl font-black text-[var(--landing-ink)]">{module.title}</h3>
                                    <p className="mt-4 font-bold leading-7 text-[var(--landing-ink)]">{module.problem}</p>
                                    <p className="mt-3 leading-7 text-[var(--landing-muted)]">{module.benefit}</p>
                                    <div className="mt-6 flex flex-wrap gap-2">
                                        {module.functions.map((item) => (
                                            <span key={item} className="rounded-full bg-[var(--landing-soft)] px-3 py-1.5 text-sm font-bold text-[var(--landing-blue)]">{item}</span>
                                        ))}
                                    </div>
                                    <a href="#demo" className="landing-gradient-cta mt-7 inline-flex w-fit items-center gap-2 rounded-full px-5 py-3 font-black text-white transition hover:-translate-y-0.5">
                                        Ver este modulo en demo
                                        <ArrowRight size={18} />
                                    </a>
                                </div>
                                <div className={mockupOrder}>
                                    <ModuleMockup type={module.mockup} />
                                </div>
                            </article>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

export function WorkflowSection() {
    return (
        <section id="como-funciona" className="bg-[var(--landing-bg-soft)] px-5 py-20 text-white lg:px-8">
            <div className="mx-auto max-w-7xl">
                <div className="max-w-3xl">
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-[var(--landing-cyan)]">Como funciona</p>
                    <h2 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">Implementa, opera y mide con un flujo ordenado.</h2>
                </div>
                <div className="mt-12 grid gap-5 lg:grid-cols-4">
                    {landingContent.workflow.map((step, index) => (
                        <article key={step.title} className="rounded-3xl border border-[var(--landing-on-dark-line)] bg-white/6 p-6 transition hover:border-[var(--landing-cyan)]">
                            <span className="landing-gradient-text text-5xl font-black">{String(index + 1).padStart(2, '0')}</span>
                            <h3 className="mt-5 text-xl font-black">{step.title}</h3>
                            <p className="mt-3 leading-7 text-white/68">{step.text}</p>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}

export function RolesAndComparisonSection() {
    return (
        <section className="px-5 py-20 lg:px-8">
            <div className="mx-auto max-w-7xl">
                <div className="grid gap-12 lg:grid-cols-[1fr_0.9fr]">
                    <div>
                        <p className="landing-eyebrow">Beneficios por usuario</p>
                        <h2 className="landing-title">Cada rol ve valor en su propio flujo.</h2>
                        <div className="mt-8 grid gap-4 sm:grid-cols-2">
                            {landingContent.roleBenefits.map(({ role, icon: Icon, benefits }) => (
                                <article key={role} className="landing-glow rounded-2xl border border-[var(--landing-line)] bg-white p-5">
                                    <Icon className="text-[var(--landing-blue)]" size={25} />
                                    <h3 className="mt-4 font-black text-[var(--landing-ink)]">{role}</h3>
                                    <div className="mt-3 space-y-2">
                                        {benefits.map((item) => (
                                            <p key={item} className="flex gap-2 text-sm font-semibold text-[var(--landing-muted)]"><Check size={16} className="mt-0.5 shrink-0 text-emerald-600" />{item}</p>
                                        ))}
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                    <div className="rounded-[2rem] bg-[var(--landing-soft)] p-6">
                        <p className="landing-eyebrow">Antes y despues</p>
                        <h3 className="mt-3 text-3xl font-black text-[var(--landing-ink)]">Cambia desorden por trazabilidad.</h3>
                        <div className="mt-7 grid gap-4">
                            <div className="rounded-2xl bg-white p-5">
                                <p className="font-black text-red-700">Antes del sistema</p>
                                {landingContent.beforeAfter.before.map((item) => <p key={item} className="mt-3 text-[var(--landing-muted)]">- {item}</p>)}
                            </div>
                            <div className="rounded-2xl bg-[var(--landing-navy)] p-5 text-white">
                                <p className="font-black text-cyan-100">Con Clarity</p>
                                {landingContent.beforeAfter.after.map((item) => <p key={item} className="mt-3 text-white/72">- {item}</p>)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

export function GalleryAndExtrasSection() {
    return (
        <section className="bg-white px-5 py-20 lg:px-8">
            <div className="mx-auto max-w-7xl">
                <div className="max-w-3xl">
                    <p className="landing-eyebrow">Galeria del sistema</p>
                    <h2 className="landing-title">Mockups con datos ficticios, basados en pantallas reales.</h2>
                </div>
                <div className="mt-10 grid gap-5 lg:grid-cols-3">
                    {landingContent.gallery.map((item) => (
                        <article key={item.label} className="landing-glow rounded-3xl border border-[var(--landing-line)] bg-[var(--landing-soft)] p-5">
                            <div className="h-36 rounded-2xl bg-white p-4 shadow-inner">
                                <div className="h-3 w-24 rounded-full bg-cyan-200" />
                                <div className="mt-5 grid gap-2">
                                    <span className="h-3 rounded-full bg-slate-200" />
                                    <span className="h-3 w-4/5 rounded-full bg-slate-200" />
                                    <span className="landing-gradient-bg h-14 rounded-xl" />
                                </div>
                            </div>
                            <h3 className="mt-5 text-xl font-black text-[var(--landing-ink)]">{item.label}</h3>
                            <p className="mt-2 leading-7 text-[var(--landing-muted)]">{item.caption}</p>
                        </article>
                    ))}
                </div>
                <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {landingContent.additionalFeatures.map(({ icon: Icon, title, text }) => (
                        <article key={title} className="landing-glow rounded-2xl border border-[var(--landing-line)] bg-white p-5 shadow-sm">
                            <Icon className="text-[var(--landing-blue)]" size={24} />
                            <h3 className="mt-4 font-black text-[var(--landing-ink)]">{title}</h3>
                            <p className="mt-2 text-sm leading-6 text-[var(--landing-muted)]">{text}</p>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}

export function FaqSection() {
    return (
        <section id="faq" className="bg-[var(--landing-soft)] px-5 py-20 lg:px-8">
            <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.7fr_1.3fr]">
                <div>
                    <p className="landing-eyebrow">Preguntas frecuentes</p>
                    <h2 className="landing-title">Respuestas claras, sin promesas no verificadas.</h2>
                </div>
                <div className="grid gap-4">
                    {landingContent.faq.map((item) => (
                        <details key={item.question} className="group rounded-2xl bg-white p-5 shadow-sm transition open:shadow-md open:shadow-indigo-900/5">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-black text-[var(--landing-ink)]">
                                {item.question}
                                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--landing-soft)] text-[var(--landing-blue)] transition group-open:rotate-45">
                                    <Plus size={18} />
                                </span>
                            </summary>
                            <p className="mt-4 leading-7 text-[var(--landing-muted)]">{item.answer}</p>
                        </details>
                    ))}
                </div>
            </div>
        </section>
    );
}
