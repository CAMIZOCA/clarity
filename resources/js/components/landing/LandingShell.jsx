import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Eye, LockKeyhole, Send } from 'lucide-react';
import { landingContent } from '../../data/landingContent';

function Logo({ inverse = false }) {
    return (
        <a href="/" className="flex items-center gap-3" aria-label="Clarity inicio">
            <span className={`grid h-11 w-11 place-items-center rounded-xl ${inverse ? 'bg-white/12 text-white' : 'bg-[var(--landing-navy)] text-white'}`}>
                <Eye size={24} />
            </span>
            <span>
                <span className={`block text-xl font-black leading-none ${inverse ? 'text-white' : 'text-[var(--landing-ink)]'}`}>Clarity</span>
                <span className={`block text-xs font-bold uppercase tracking-[0.18em] ${inverse ? 'text-white/60' : 'text-[var(--landing-muted)]'}`}>Opticas</span>
            </span>
        </a>
    );
}

export function LandingNavbar() {
    const [scrolled, setScrolled] = useState(false);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 16);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const linkClass = 'rounded-lg px-3 py-2 text-sm font-bold text-[var(--landing-muted)] transition hover:bg-[var(--landing-soft)] hover:text-[var(--landing-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--landing-cyan)]';

    return (
        <header className={`fixed inset-x-0 top-0 z-50 pt-[env(safe-area-inset-top)] transition ${scrolled ? 'border-b border-[var(--landing-line)] bg-white/92 shadow-sm backdrop-blur-xl' : 'bg-transparent'}`}>
            <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8" aria-label="Principal">
                <Logo />
                <div className="hidden items-center gap-1 lg:flex">
                    {landingContent.nav.map((item) => (
                        <a key={item.href} href={item.href} className={linkClass}>{item.label}</a>
                    ))}
                </div>
                <div className="hidden items-center gap-3 lg:flex">
                    <Link to="/login" className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-black text-[var(--landing-ink)] transition hover:bg-[var(--landing-soft)]">
                        <LockKeyhole size={16} />
                        Iniciar sesion
                    </Link>
                    <a href="#demo" className="inline-flex items-center gap-2 rounded-lg bg-[var(--landing-navy)] px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-slate-900/10 transition hover:-translate-y-0.5 hover:bg-[var(--landing-blue)]">
                        <Send size={16} />
                        Solicitar demostracion
                    </a>
                </div>
                <button
                    type="button"
                    onClick={() => setOpen((value) => !value)}
                    className="grid h-11 w-11 place-items-center rounded-lg border border-[var(--landing-line)] bg-white text-[var(--landing-ink)] lg:hidden"
                    aria-expanded={open}
                    aria-controls="landing-mobile-menu"
                    aria-label={open ? 'Cerrar menu' : 'Abrir menu'}
                >
                    {open ? <X size={22} /> : <Menu size={22} />}
                </button>
            </nav>
            {open && (
                <div id="landing-mobile-menu" className="border-t border-[var(--landing-line)] bg-white px-5 py-4 shadow-xl lg:hidden">
                    <div className="grid gap-1">
                        {landingContent.nav.map((item) => (
                            <a key={item.href} href={item.href} onClick={() => setOpen(false)} className={linkClass}>{item.label}</a>
                        ))}
                        <Link to="/login" className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--landing-line)] px-4 py-3 font-black text-[var(--landing-ink)]">
                            <LockKeyhole size={16} />
                            Iniciar sesion
                        </Link>
                        <a href="#demo" onClick={() => setOpen(false)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--landing-navy)] px-4 py-3 font-black text-white">
                            <Send size={16} />
                            Solicitar demostracion
                        </a>
                    </div>
                </div>
            )}
        </header>
    );
}

export function LandingFooter() {
    const year = new Date().getFullYear();

    return (
        <footer className="bg-[var(--landing-ink)] px-5 py-10 text-white lg:px-8">
            <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.1fr_1fr_1fr]">
                <div>
                    <Logo inverse />
                    <p className="mt-4 max-w-md text-sm leading-7 text-white/68">
                        {landingContent.product.descriptor}. Centraliza atencion, ventas, inventario y reportes sin reemplazar los flujos criticos del panel administrativo.
                    </p>
                </div>
                <div>
                    <p className="font-black">Navegacion</p>
                    <div className="mt-4 grid gap-2 text-sm text-white/68">
                        {landingContent.nav.map((item) => <a key={item.href} href={item.href} className="hover:text-white">{item.label}</a>)}
                        <Link to="/login" className="hover:text-white">Acceso al sistema</Link>
                    </div>
                </div>
                <div>
                    <p className="font-black">Contacto</p>
                    <div className="mt-4 grid gap-2 text-sm text-white/68">
                        <a href={`mailto:${landingContent.product.demoEmail}`} className="hover:text-white">{landingContent.product.demoEmail}</a>
                        <span>Politica de privacidad y terminos disponibles bajo solicitud.</span>
                        <span>Derechos reservados {year}</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
