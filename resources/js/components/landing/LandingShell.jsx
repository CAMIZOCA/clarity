import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Popover, PopoverButton, PopoverPanel, Transition } from '@headlessui/react';
import { Menu, X, Eye, LockKeyhole, Send, ChevronDown, ArrowRight } from 'lucide-react';
import { landingContent } from '../../data/landingContent';

function Logo() {
    return (
        <a href="/" className="flex items-center gap-2.5" aria-label="Clarity inicio">
            <span className="landing-gradient-bg grid h-10 w-10 place-items-center rounded-xl text-white">
                <Eye size={22} />
            </span>
            <span>
                <span className="block text-lg font-black leading-none text-white">Clarity</span>
                <span className="block text-[0.65rem] font-bold uppercase tracking-[0.18em] text-white/60">Opticas</span>
            </span>
        </a>
    );
}

function scrollToSection(href) {
    const el = document.querySelector(href);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.replaceState(null, '', href);
}

export function LandingNavbar() {
    const [scrolled, setScrolled] = useState(false);
    const [open, setOpen] = useState(false);
    const navRef = useRef(null);
    const [headerHeight, setHeaderHeight] = useState(72);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 16);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        if (!navRef.current) return undefined;
        const measure = () => setHeaderHeight(navRef.current.offsetHeight);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(navRef.current);
        return () => observer.disconnect();
    }, []);

    // Locks body scroll with the position:fixed technique instead of overflow:hidden,
    // which avoids content bleeding through the mobile panel when combined with
    // scroll-behavior:smooth anchor jumps.
    useEffect(() => {
        if (!open) return undefined;
        const scrollY = window.scrollY;
        const { style } = document.body;
        style.position = 'fixed';
        style.top = `-${scrollY}px`;
        style.left = '0';
        style.right = '0';
        return () => {
            style.position = '';
            style.top = '';
            style.left = '';
            style.right = '';
            window.scrollTo(0, scrollY);
        };
    }, [open]);

    const goToSection = (href) => (event) => {
        event.preventDefault();
        setOpen(false);
        window.setTimeout(() => scrollToSection(href), 20);
    };

    const linkClass = 'rounded-full px-4 py-2 text-sm font-bold text-white/78 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--landing-cyan)]';
    const otherNav = landingContent.nav.filter((item) => item.href !== '#funciones');

    return (
        <header className={`fixed inset-x-0 top-0 z-50 pt-[env(safe-area-inset-top)] transition ${scrolled || open ? 'border-b border-[var(--landing-on-dark-line)] bg-[var(--landing-bg-translucent)] shadow-lg shadow-black/20 backdrop-blur-xl' : 'bg-transparent'}`}>
            <nav ref={navRef} className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 lg:px-8" aria-label="Principal">
                <Logo />
                <div className="hidden items-center gap-1 lg:flex">
                    <Popover className="relative">
                        <PopoverButton className="flex items-center gap-1 rounded-full px-4 py-2 text-sm font-bold text-white/78 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--landing-cyan)] data-[open]:bg-white/10 data-[open]:text-white">
                            Producto
                            <ChevronDown size={16} />
                        </PopoverButton>
                        <Transition
                            enter="transition duration-150 ease-out"
                            enterFrom="opacity-0 translate-y-1"
                            enterTo="opacity-100 translate-y-0"
                            leave="transition duration-100 ease-in"
                            leaveFrom="opacity-100 translate-y-0"
                            leaveTo="opacity-0 translate-y-1"
                        >
                            <PopoverPanel anchor="bottom start" className="z-50 mt-3 w-[36rem] rounded-2xl border border-[var(--landing-line)] bg-white p-4 shadow-2xl shadow-black/20">
                                {({ close }) => (
                                    <>
                                        <div className="grid grid-cols-2 gap-1">
                                            {landingContent.platformCards.map((card) => (
                                                <a
                                                    key={card.label}
                                                    href="#funciones"
                                                    onClick={() => close()}
                                                    className="flex items-start gap-3 rounded-xl p-3 transition hover:bg-[var(--landing-soft)]"
                                                >
                                                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--landing-soft)] text-[var(--landing-blue)]">
                                                        <card.icon size={20} />
                                                    </span>
                                                    <span>
                                                        <span className="block text-sm font-black text-[var(--landing-ink)]">{card.label}</span>
                                                        <span className="block text-xs leading-5 text-[var(--landing-muted)]">{card.text}</span>
                                                    </span>
                                                </a>
                                            ))}
                                        </div>
                                        <a
                                            href="#modulos"
                                            onClick={() => close()}
                                            className="mt-2 flex items-center justify-between rounded-xl bg-[var(--landing-soft)] px-4 py-3 text-sm font-black text-[var(--landing-blue)] transition hover:bg-[var(--landing-line)]"
                                        >
                                            Ver todos los modulos
                                            <ArrowRight size={16} />
                                        </a>
                                    </>
                                )}
                            </PopoverPanel>
                        </Transition>
                    </Popover>
                    {otherNav.map((item) => (
                        <a key={item.href} href={item.href} className={linkClass}>{item.label}</a>
                    ))}
                </div>
                <div className="hidden items-center gap-3 lg:flex">
                    <Link to="/login" className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-black text-white/85 transition hover:bg-white/10">
                        <LockKeyhole size={16} />
                        Iniciar sesion
                    </Link>
                    <a href="#demo" className="landing-gradient-cta inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5">
                        <Send size={16} />
                        Solicitar demostracion
                    </a>
                </div>
                <button
                    type="button"
                    onClick={() => setOpen((value) => !value)}
                    className="grid h-10 w-10 place-items-center rounded-full border border-[var(--landing-on-dark-line)] bg-white/10 text-white lg:hidden"
                    aria-expanded={open}
                    aria-controls="landing-mobile-menu"
                    aria-label={open ? 'Cerrar menu' : 'Abrir menu'}
                >
                    {open ? <X size={20} /> : <Menu size={20} />}
                </button>
            </nav>
            {open && (
                <div
                    id="landing-mobile-menu"
                    style={{ top: headerHeight }}
                    className="fixed inset-x-0 bottom-0 z-40 flex flex-col overflow-y-auto bg-[var(--landing-bg)] px-5 py-3 lg:hidden"
                >
                    <p className="px-2 pb-1.5 text-[0.65rem] font-black uppercase tracking-[0.18em] text-white/50">Modulos</p>
                    <div className="grid grid-cols-3 gap-1.5">
                        {landingContent.platformCards.map((card) => (
                            <a
                                key={card.label}
                                href="#funciones"
                                onClick={goToSection('#funciones')}
                                className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--landing-on-dark-line)] bg-white/5 p-2 text-center"
                            >
                                <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-[var(--landing-cyan)]">
                                    <card.icon size={16} />
                                </span>
                                <span className="text-xs font-black leading-tight text-white">{card.label}</span>
                            </a>
                        ))}
                    </div>
                    <p className="mt-3 px-2 pb-1.5 text-[0.65rem] font-black uppercase tracking-[0.18em] text-white/50">Navegacion</p>
                    <div className="grid gap-0.5">
                        {landingContent.nav.map((item) => (
                            <a
                                key={item.href}
                                href={item.href}
                                onClick={goToSection(item.href)}
                                className="rounded-lg px-3 py-2 text-sm font-bold text-white/78 hover:bg-white/10 hover:text-white"
                            >
                                {item.label}
                            </a>
                        ))}
                    </div>
                    <div className="sticky bottom-0 -mx-5 mt-auto grid gap-2 border-t border-[var(--landing-on-dark-line)] bg-[var(--landing-bg)] px-5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
                        <a
                            href="#demo"
                            onClick={goToSection('#demo')}
                            className="landing-gradient-cta inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-4 py-3 font-black text-white"
                        >
                            <Send size={16} />
                            Solicitar demostracion
                        </a>
                        <Link
                            to="/login"
                            onClick={() => setOpen(false)}
                            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-[var(--landing-on-dark-line)] px-4 py-3 font-black text-white"
                        >
                            <LockKeyhole size={16} />
                            Iniciar sesion
                        </Link>
                    </div>
                </div>
            )}
        </header>
    );
}

export function LandingFooter() {
    const year = new Date().getFullYear();

    return (
        <footer className="bg-[var(--landing-bg)] px-5 py-10 text-white lg:px-8">
            <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.1fr_1fr_1fr]">
                <div>
                    <Logo />
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
