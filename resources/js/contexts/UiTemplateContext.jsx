import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import client from '../api/client';
import { getPayload } from '../api/response';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';
import { useToast } from '../components/ui/Toast';

/**
 * Plantilla de pantalla: "clasico" (el diseño de siempre) o "compacto" (HIG).
 *
 * - La elige cada usuario (`users.ui_template`, viaja en /me y /login). `null`
 *   sigue el defecto de la optica (`settings.ui_template_default`).
 * - Se aplica como `<html data-ui="...">`. `app.blade.php` ya lo escribe desde el
 *   servidor para que el primer cuadro no parpadee; aqui solo se mantiene al dia.
 * - `resources/css/ui-compacto.css` cuelga todo de `[data-ui="compacto"] .ui-app`,
 *   asi que el login y la landing no cambian.
 */
export const UI_TEMPLATES = ['clasico', 'compacto'];
const STORAGE_KEY = 'clarity.ui.template.v1';

const valid = (value) => (UI_TEMPLATES.includes(value) ? value : null);

// Lo que resolvio el servidor (o el script del <head>) antes de que arrancara React.
const bootTemplate = valid(document.documentElement.dataset.ui) ?? 'clasico';

const UiTemplateContext = createContext({
    template: 'clasico',
    isCompact: false,
    setTemplate: () => {},
});

export function UiTemplateProvider({ children }) {
    const { user, updateUser } = useAuth();
    const { settings } = useSettings();
    const { addToast } = useToast() ?? {};
    const saving = useRef(0);

    const template = valid(user?.ui_template)
        ?? valid(settings?.ui_template_default)
        ?? bootTemplate;

    useEffect(() => {
        document.documentElement.dataset.ui = template;
        document.documentElement.dataset.uiSource = user ? 'server' : 'guest';
        try { localStorage.setItem(STORAGE_KEY, template); } catch { /* modo privado */ }
    }, [template, user]);

    const setTemplate = useCallback(async (next) => {
        if (!valid(next) || !user || next === template) return;
        const previous = user.ui_template ?? null;
        const ticket = ++saving.current;
        updateUser({ ui_template: next });
        try {
            const res = await client.patch('/me/preferences', { ui_template: next });
            const saved = getPayload(res);
            if (ticket === saving.current && saved && 'ui_template' in saved) {
                updateUser({ ui_template: saved.ui_template });
            }
        } catch {
            if (ticket === saving.current) updateUser({ ui_template: previous });
            addToast?.('No se pudo guardar el diseño elegido. Se mantiene el anterior.', 'error');
        }
    }, [user, template, updateUser, addToast]);

    const value = useMemo(() => ({
        template,
        isCompact: template === 'compacto',
        setTemplate,
    }), [template, setTemplate]);

    return <UiTemplateContext.Provider value={value}>{children}</UiTemplateContext.Provider>;
}

export const useUiTemplate = () => useContext(UiTemplateContext);
