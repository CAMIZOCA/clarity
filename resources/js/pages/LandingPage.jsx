import React from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    BarChart3,
    CalendarCheck,
    Check,
    ClipboardList,
    Eye,
    LockKeyhole,
    MessageCircle,
    PackageCheck,
    Sparkles,
} from 'lucide-react';

const features = [
    {
        icon: CalendarCheck,
        title: 'Agenda sin cruces',
        text: 'Citas, recordatorios y seguimiento para reducir ausencias y tiempos muertos.',
    },
    {
        icon: ClipboardList,
        title: 'Historia clinica clara',
        text: 'Consultas optometricas, diagnosticos, formulas y documentos en un solo flujo.',
    },
    {
        icon: PackageCheck,
        title: 'Inventario conectado',
        text: 'Control de productos, stock, bodegas, ventas y laboratorio sin hojas dispersas.',
    },
    {
        icon: BarChart3,
        title: 'Decisiones con datos',
        text: 'Reportes comerciales, caja, pacientes y rendimiento por sucursal en tiempo real.',
    },
];

const plans = [
    {
        name: 'Esencial',
        price: '$29',
        description: 'Para consultorios que necesitan ordenar citas, pacientes e historias.',
        items: ['Agenda y pacientes', 'Historia clinica optometrica', '1 usuario incluido'],
    },
    {
        name: 'Profesional',
        price: '$59',
        description: 'Para opticas que venden, atienden y necesitan controlar operacion diaria.',
        items: ['POS, caja e inventario', 'Laboratorio y ordenes', 'Reportes gerenciales'],
        highlighted: true,
    },
    {
        name: 'Multi-sede',
        price: '$99',
        description: 'Para equipos con varias sucursales, roles y control administrativo.',
        items: ['Sucursales y bodegas', 'CRM y campanas', 'Usuarios y permisos'],
    },
];

const painPoints = [
    'No mas historias clinicas perdidas.',
    'No mas ventas sin control de stock.',
    'No mas agenda separada del seguimiento.',
    'No mas reportes armados a mano al cierre.',
];

function ClarityMark({ inverse = false }) {
    return (
        <div className="flex items-center gap-3">
            <div className={`grid h-11 w-11 place-items-center rounded-lg text-white shadow-lg shadow-[#0e4f4f]/20 ${inverse ? 'bg-white/12' : 'bg-[#0e4f4f]'}`}>
                <Eye size={25} strokeWidth={2.3} />
            </div>
            <div>
                <p className={`text-xl font-black leading-none ${inverse ? 'text-white' : 'text-[#102022]'}`}>Clarity</p>
                <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${inverse ? 'text-white/58' : 'text-[#3f6f72]'}`}>Sistema clinico</p>
            </div>
        </div>
    );
}

function HeroVisual() {
    return (
        <div className="relative mx-auto mt-10 w-full max-w-5xl lg:mt-0">
            <div className="absolute -inset-8 bg-[#f1c24b]/25 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/50 bg-white/82 shadow-2xl shadow-[#0f2f33]/20 backdrop-blur">
                <div className="flex items-center justify-between border-b border-[#d8e4df] px-5 py-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#174145]">
                        <Sparkles size={18} />
                        Vista operativa de hoy
                    </div>
                    <div className="flex gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#ee6b5f]" />
                        <span className="h-2.5 w-2.5 rounded-full bg-[#f1c24b]" />
                        <span className="h-2.5 w-2.5 rounded-full bg-[#34a77b]" />
                    </div>
                </div>

                <div className="grid gap-0 md:grid-cols-[1.1fr_0.9fr]">
                    <div className="border-b border-[#d8e4df] p-5 md:border-b-0 md:border-r">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5e7d80]">Pacientes</p>
                            <span className="rounded-full bg-[#dff3e9] px-3 py-1 text-xs font-bold text-[#0e6d4f]">+18% retencion</span>
                        </div>
                        <div className="mt-5 space-y-3">
                            {['Ana Salazar', 'Carlos Medina', 'Maria Torres'].map((name, index) => (
                                <div key={name} className="flex items-center justify-between rounded-lg bg-[#f7fbf8] px-4 py-3">
                                    <div>
                                        <p className="font-semibold text-[#102022]">{name}</p>
                                        <p className="text-sm text-[#5e6f72]">{index === 0 ? 'Control visual' : index === 1 ? 'Entrega de lentes' : 'Consulta inicial'}</p>
                                    </div>
                                    <span className="text-sm font-bold text-[#0e4f4f]">{index === 0 ? '09:30' : index === 1 ? '11:00' : '15:20'}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-5">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5e7d80]">Flujo clinico</p>
                        <div className="mt-5 space-y-5">
                            {[
                                ['Historia', 'Completa'],
                                ['Formula', 'Validada'],
                                ['Orden', 'En laboratorio'],
                                ['Cobro', 'Pendiente'],
                            ].map(([label, status], index) => (
                                <div key={label} className="relative flex items-center gap-3">
                                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#0e4f4f] text-white">
                                        <Check size={17} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-[#102022]">{label}</p>
                                        <p className="text-sm text-[#5e6f72]">{status}</p>
                                    </div>
                                    {index < 3 && <span className="absolute left-4 top-9 h-5 w-px bg-[#bcd6cf]" />}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LandingPage() {
    return (
        <main className="min-h-screen bg-[#f5f0e6] text-[#102022]">
            <section className="relative isolate overflow-hidden bg-[linear-gradient(115deg,#f5f0e6_0%,#eaf4ef_54%,#cddfd8_100%)]">
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#f5f0e6] to-transparent" />
                <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
                    <ClarityMark />
                    <Link
                        to="/login"
                        className="inline-flex items-center gap-2 rounded-lg bg-[#102022] px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#102022]/15 transition hover:-translate-y-0.5 hover:bg-[#0e4f4f]"
                    >
                        Iniciar sesion
                        <LockKeyhole size={16} />
                    </Link>
                </header>

                <div className="relative z-10 mx-auto grid min-h-[calc(100svh-84px)] max-w-7xl items-center gap-10 px-5 pb-16 pt-4 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:px-10">
                    <div className="max-w-2xl animate-clarity-rise">
                        <p className="mb-4 text-sm font-black uppercase tracking-[0.22em] text-[#0e6d4f]">Optometria, ventas y seguimiento</p>
                        <h1 className="text-6xl font-black leading-[0.92] text-[#102022] sm:text-7xl lg:text-8xl">
                            Clarity
                        </h1>
                        <p className="mt-5 max-w-xl text-2xl font-semibold leading-tight text-[#174145] sm:text-3xl">
                            Gestion clara para clinicas y opticas que quieren atender mejor y perder menos tiempo.
                        </p>
                        <p className="mt-5 max-w-lg text-base leading-7 text-[#425f62]">
                            Unifica pacientes, agenda, consultas, inventario, caja, laboratorio y reportes para resolver los problemas diarios antes de que se vuelvan urgencias.
                        </p>
                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <Link
                                to="/login"
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0e4f4f] px-6 py-4 text-base font-black text-white shadow-xl shadow-[#0e4f4f]/20 transition hover:-translate-y-0.5 hover:bg-[#0b3f40]"
                            >
                                Entrar al sistema
                                <ArrowRight size={19} />
                            </Link>
                            <a
                                href="#precios"
                                className="inline-flex items-center justify-center rounded-lg border border-[#91aaa5] px-6 py-4 text-base font-bold text-[#174145] transition hover:border-[#0e4f4f] hover:bg-white/50"
                            >
                                Ver planes
                            </a>
                        </div>
                    </div>

                    <HeroVisual />
                </div>
            </section>

            <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10">
                <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr]">
                    <div>
                        <p className="text-sm font-black uppercase tracking-[0.2em] text-[#0e6d4f]">Por que Clarity</p>
                        <h2 className="mt-3 text-4xl font-black leading-tight text-[#102022]">Menos friccion en cada punto de la clinica.</h2>
                    </div>
                    <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
                        {features.map(({ icon: Icon, title, text }) => (
                            <article key={title} className="border-t border-[#cbd9d3] pt-5">
                                <Icon className="mb-4 text-[#0e4f4f]" size={27} />
                                <h3 className="text-xl font-black text-[#102022]">{title}</h3>
                                <p className="mt-2 leading-7 text-[#4f6668]">{text}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="bg-[#102022] px-5 py-14 text-white sm:px-8 lg:px-10">
                <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
                    <div>
                        <p className="text-sm font-black uppercase tracking-[0.2em] text-[#f1c24b]">Problemas comunes</p>
                        <h2 className="mt-3 text-4xl font-black leading-tight">Clarity ordena lo que mas cuesta sostener.</h2>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {painPoints.map((item) => (
                            <div key={item} className="flex items-center gap-3 border-t border-white/15 py-4">
                                <Check className="shrink-0 text-[#f1c24b]" size={20} />
                                <span className="font-semibold text-white/88">{item}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section id="precios" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10">
                <div className="max-w-3xl">
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-[#0e6d4f]">Suscripcion mensual</p>
                    <h2 className="mt-3 text-4xl font-black leading-tight text-[#102022]">Planes simples para empezar hoy.</h2>
                    <p className="mt-3 text-lg leading-8 text-[#4f6668]">
                        Promocion de lanzamiento: 20% de descuento durante los primeros 3 meses y configuracion inicial guiada.
                    </p>
                </div>

                <div className="mt-10 grid gap-5 lg:grid-cols-3">
                    {plans.map((plan) => (
                        <article
                            key={plan.name}
                            className={`rounded-lg border p-6 transition hover:-translate-y-1 ${
                                plan.highlighted
                                    ? 'border-[#0e4f4f] bg-[#0e4f4f] text-white shadow-2xl shadow-[#0e4f4f]/20'
                                    : 'border-[#cbd9d3] bg-white text-[#102022]'
                            }`}
                        >
                            {plan.highlighted && (
                                <span className="mb-5 inline-flex rounded-full bg-[#f1c24b] px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-[#102022]">
                                    Recomendado
                                </span>
                            )}
                            <h3 className="text-2xl font-black">{plan.name}</h3>
                            <div className="mt-4 flex items-end gap-1">
                                <span className="text-5xl font-black">{plan.price}</span>
                                <span className={`pb-2 font-semibold ${plan.highlighted ? 'text-white/70' : 'text-[#647779]'}`}>/ mes</span>
                            </div>
                            <p className={`mt-4 leading-7 ${plan.highlighted ? 'text-white/78' : 'text-[#4f6668]'}`}>{plan.description}</p>
                            <div className="mt-6 space-y-3">
                                {plan.items.map((item) => (
                                    <div key={item} className="flex items-center gap-3">
                                        <Check className={plan.highlighted ? 'text-[#f1c24b]' : 'text-[#0e6d4f]'} size={18} />
                                        <span className="font-semibold">{item}</span>
                                    </div>
                                ))}
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            <section className="bg-[#eaf4ef] px-5 py-16 sm:px-8 lg:px-10">
                <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
                    <div>
                        <p className="text-sm font-black uppercase tracking-[0.2em] text-[#0e6d4f]">Listo para operar</p>
                        <h2 className="mt-3 max-w-3xl text-4xl font-black leading-tight text-[#102022]">
                            Calidad visible, procesos claros y pacientes mejor atendidos.
                        </h2>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                        <Link
                            to="/login"
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#102022] px-6 py-4 text-base font-black text-white shadow-xl shadow-[#102022]/15 transition hover:-translate-y-0.5 hover:bg-[#0e4f4f]"
                        >
                            Ir al login
                            <ArrowRight size={19} />
                        </Link>
                        <a
                            href="mailto:ventas@clarity.local"
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#91aaa5] px-6 py-4 text-base font-bold text-[#174145] transition hover:border-[#0e4f4f] hover:bg-white"
                        >
                            <MessageCircle size={19} />
                            Solicitar demo
                        </a>
                    </div>
                </div>
            </section>

            <footer className="flex flex-col gap-4 bg-[#102022] px-5 py-8 text-sm text-white/70 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
                <ClarityMark inverse />
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                    <span>Historias clinicas</span>
                    <span>Agenda</span>
                    <span>Inventario</span>
                    <span>Reportes</span>
                </div>
            </footer>
        </main>
    );
}
