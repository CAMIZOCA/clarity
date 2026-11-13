import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { OPEN_SECTION_EVENT, SectionLayoutContext } from '../../components/forms/CollapsibleSection';

/**
 * Pestañas de la consulta en la plantilla Compacto.
 *
 * No duplica campos: agrupa las mismas `CollapsibleSection` de ConsultationForm
 * por `sectionKey`. Una seccion nueva necesita su `sectionKey` en CONSULTATION_TABS
 * (y su regla en FIELD_SECTION_RULES): sin eso no se ve en el diseño Compacto.
 * Lo vigila el inventario de campos descrito en CLAUDE.md ("Dos plantillas").
 *
 * Abrir una seccion desde fuera (`openCollapsibleSection`, que usa `goToField`
 * para llevar a un error) cambia a su pestaña con el mismo evento de siempre.
 */
export const MODULE_SECTIONS = [
    { key: 'motor_binocular', label: 'Terapia visual' },
    { key: 'lentes_contacto', label: 'Lentes de contacto' },
    { key: 'oftalmoscopia', label: 'Oftalmoscopia' },
    { key: 'tratamiento', label: 'Tratamiento' },
];

export const CONSULTATION_TABS = [
    { id: 'motivo', label: 'Motivo y médico', short: 'Motivo', sections: ['cabecera'] },
    { id: 'refraccion', label: 'Refracción', short: 'Refracción', sections: ['refraccion'] },
    { id: 'diagnostico', label: 'Diagnóstico y observaciones', short: 'Diagnóstico', sections: ['diagnostico', 'observaciones'] },
    { id: 'lunas', label: 'Lunas y recomendaciones', short: 'Lunas', sections: ['recomendaciones'] },
    { id: 'venta', label: 'Venta', short: 'Venta', sections: ['venta'] },
    { id: 'modulos', label: 'Módulos', short: 'Módulos', sections: MODULE_SECTIONS.map((m) => m.key), sub: true },
];

const tabForSection = (sectionKey) =>
    CONSULTATION_TABS.find((tab) => tab.sections.includes(sectionKey)) ?? CONSULTATION_TABS[CONSULTATION_TABS.length - 1];

const TabsContext = createContext(null);
const STORAGE_PREFIX = 'consulta:pestana:';

/**
 * Estado de las pestañas. Envuelve todo el contenido del <form> para que la
 * barra de acciones (`ConsultationTabBar`) y los paneles lo compartan.
 *
 * @param {boolean} enabled - false en la plantilla Clasico: no hace nada.
 * @param {string|number|null} storageId - id de la consulta (recuerda la pestaña al reabrir).
 * @param {object} errorsBySection - `{ sectionKey: cantidad }` de errores (rojo).
 * @param {object} warningsBySection - `{ sectionKey: cantidad }` de avisos (ambar).
 */
export function ConsultationTabsProvider({ enabled, storageId = null, errorsBySection = {}, warningsBySection = {}, children }) {
    const storageKey = `${STORAGE_PREFIX}${storageId ?? 'nueva'}`;
    const [active, setActive] = useState(() => {
        try {
            const saved = sessionStorage.getItem(storageKey);
            if (CONSULTATION_TABS.some((tab) => tab.id === saved)) return saved;
        } catch { /* sin almacenamiento */ }
        return storageId ? 'refraccion' : 'motivo';
    });
    const [activeModule, setActiveModule] = useState(MODULE_SECTIONS[0].key);

    const select = useCallback((id) => {
        setActive(id);
        try { sessionStorage.setItem(storageKey, id); } catch { /* sin almacenamiento */ }
    }, [storageKey]);

    // `goToField` -> openCollapsibleSection(key) -> esta pestaña. Se ejecuta dentro
    // del `flushSync` de goToField, asi que el panel ya esta montado al enfocar.
    useEffect(() => {
        if (!enabled) return undefined;
        const handleOpen = (event) => {
            const tab = tabForSection(event.detail);
            if (tab.sub) setActiveModule(event.detail);
            select(tab.id);
        };
        window.addEventListener(OPEN_SECTION_EVENT, handleOpen);
        return () => window.removeEventListener(OPEN_SECTION_EVENT, handleOpen);
    }, [enabled, select]);

    // Alt+1 ... Alt+6 abre cada pestaña (Ctrl+PgDn y Alt+flechas son del navegador).
    useEffect(() => {
        if (!enabled) return undefined;
        const onKey = (event) => {
            if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
            const index = Number(event.key) - 1;
            if (!Number.isInteger(index) || index < 0 || index >= CONSULTATION_TABS.length) return;
            event.preventDefault();
            select(CONSULTATION_TABS[index].id);
            requestAnimationFrame(() => focusFirstField(CONSULTATION_TABS[index].id));
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [enabled, select]);

    const count = (map, tab) => tab.sections.reduce((sum, key) => sum + (map[key] ?? 0), 0);

    const value = useMemo(() => {
        const tab = CONSULTATION_TABS.find((item) => item.id === active) ?? CONSULTATION_TABS[1];
        const activeKeys = new Set(tab.sub ? [activeModule] : tab.sections);
        return {
            enabled,
            active: tab.id,
            activeTab: tab,
            activeKeys,
            activeModule,
            setActiveModule,
            select,
            tabs: CONSULTATION_TABS.map((item) => ({
                ...item,
                errors: count(errorsBySection, item),
                warnings: count(warningsBySection, item),
            })),
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, active, activeModule, select, errorsBySection, warningsBySection]);

    return <TabsContext.Provider value={value}>{children}</TabsContext.Provider>;
}

export const useConsultationTabs = () => useContext(TabsContext);

function focusFirstField(tabId) {
    const tab = CONSULTATION_TABS.find((item) => item.id === tabId);
    if (!tab) return;
    const selector = tab.sections.map((key) => `[data-section-key="${key}"]`).join(',');
    const panel = document.querySelector(selector);
    const field = panel?.querySelector('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not(:disabled), select:not(:disabled), textarea:not(:disabled)');
    field?.focus();
}

/** Control segmentado con las 6 pestañas y su estado (errores, avisos). */
export function ConsultationTabBar() {
    const ctx = useConsultationTabs();
    if (!ctx?.enabled) return null;

    const onKeyDown = (event) => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        event.preventDefault();
        event.stopPropagation();
        const index = CONSULTATION_TABS.findIndex((tab) => tab.id === ctx.active);
        const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + CONSULTATION_TABS.length) % CONSULTATION_TABS.length;
        ctx.select(CONSULTATION_TABS[next].id);
        requestAnimationFrame(() => document.getElementById(`consulta-tab-${CONSULTATION_TABS[next].id}`)?.focus());
    };

    return (
        <div role="tablist" aria-label="Secciones de la consulta" onKeyDown={onKeyDown}
            className="flex max-w-full gap-0.5 overflow-x-auto rounded-lg bg-gray-900/5 p-0.5 [scrollbar-width:none]">
            {ctx.tabs.map((tab, index) => {
                const selected = tab.id === ctx.active;
                const state = tab.errors ? 'bg-red-500' : tab.warnings ? 'bg-amber-500' : 'bg-gray-400/50';
                return (
                    <button
                        key={tab.id}
                        id={`consulta-tab-${tab.id}`}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        tabIndex={selected ? 0 : -1}
                        title={`${tab.label} (Alt+${index + 1})`}
                        onClick={() => ctx.select(tab.id)}
                        className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] transition-colors ${
                            selected ? 'bg-white font-semibold text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        <span className={`h-1.5 w-1.5 rounded-full ${state}`} aria-hidden="true" />
                        <span className="xl:hidden">{tab.short}</span>
                        <span className="hidden xl:inline">{tab.label}</span>
                        {tab.errors > 0 && (
                            <span className="rounded-full bg-red-500 px-1.5 text-[10.5px] font-bold leading-4 text-white" aria-label={`${tab.errors} con error`}>
                                {tab.errors}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

/**
 * Zona de paneles: decide que secciones se montan, pone las sub-pestañas de
 * Módulos y los botones Anterior / Siguiente (Enter en el ultimo campo llega a
 * "Siguiente", ver `fieldNavigation.js`).
 */
export function ConsultationTabPanels({ children, availableModules = MODULE_SECTIONS.map((m) => m.key) }) {
    const ctx = useConsultationTabs();
    const layout = useMemo(
        () => (ctx?.enabled
            ? { mode: 'tabs', activeKeys: ctx.activeKeys, showTitles: ctx.activeTab.sections.length > 1 && !ctx.activeTab.sub }
            : { mode: 'stack', activeKeys: null, showTitles: true }),
        [ctx?.enabled, ctx?.activeKeys, ctx?.activeTab],
    );

    if (!ctx?.enabled) {
        return <SectionLayoutContext.Provider value={layout}>{children}</SectionLayoutContext.Provider>;
    }

    const index = CONSULTATION_TABS.findIndex((tab) => tab.id === ctx.active);
    const prev = CONSULTATION_TABS[index - 1];
    const next = CONSULTATION_TABS[index + 1];
    const modules = MODULE_SECTIONS.filter((m) => availableModules.includes(m.key));
    const gridCls = ctx.active === 'diagnostico' ? 'grid gap-3 min-[1500px]:grid-cols-2 items-start' : 'grid gap-3';

    const go = (tab) => {
        ctx.select(tab.id);
        window.scrollTo({ top: 0 });
        requestAnimationFrame(() => focusFirstField(tab.id));
    };

    return (
        <SectionLayoutContext.Provider value={layout}>
            <div role="tabpanel" aria-labelledby={`consulta-tab-${ctx.active}`} className="min-w-0">
                {ctx.activeTab.sub && (
                    <div role="group" aria-label="Módulo" className="mb-3 flex flex-wrap gap-1.5">
                        {modules.map((module) => (
                            <button
                                key={module.key}
                                type="button"
                                aria-pressed={ctx.activeModule === module.key}
                                onClick={() => ctx.setActiveModule(module.key)}
                                className={`rounded-full px-3 py-1 text-[13px] transition-colors ${
                                    ctx.activeModule === module.key ? 'bg-gray-800 font-semibold text-white' : 'bg-white text-gray-700 shadow-sm hover:bg-gray-50'
                                }`}
                            >
                                {module.label}
                            </button>
                        ))}
                    </div>
                )}
                <div className={gridCls}>{children}</div>
                <div className="mt-2 flex items-center justify-between gap-3">
                    {prev ? (
                        <button type="button" onClick={() => go(prev)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] text-gray-600 hover:bg-gray-900/5">
                            <ArrowLeft size={15} /> {prev.label}
                        </button>
                    ) : <span />}
                    {next && (
                        <button type="button" data-next-tab={next.id} onClick={() => go(next)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold text-navy shadow-sm hover:bg-gray-50">
                            Siguiente: {next.label} <ArrowRight size={15} />
                        </button>
                    )}
                </div>
            </div>
        </SectionLayoutContext.Provider>
    );
}
