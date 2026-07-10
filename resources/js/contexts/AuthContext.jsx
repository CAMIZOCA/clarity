import React, { createContext, useContext, useState, useEffect } from 'react';
import client, { initCsrf, webClient } from '../api/client';
import { invalidateAll } from '../api/cache';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        webClient.get('/me')
            .then(r => setUser(r.data))
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    const login = async (email, password) => {
        console.groupCollapsed('[Auth Debug] login start');
        console.log({
            email,
            host: window.location.host,
            origin: window.location.origin,
            hasXsrfCookieBefore: document.cookie.includes('XSRF-TOKEN='),
        });
        console.groupEnd();

        await initCsrf();

        const res = await webClient.post('/login', { email, password });

        console.groupCollapsed('[Auth Debug] login success');
        console.log({
            status: res.status,
            user: res.data?.user,
            hasXsrfCookieAfter: document.cookie.includes('XSRF-TOKEN='),
        });
        console.groupEnd();

        setUser(res.data.user);
        return res.data.user;
    };

    const logout = async () => {
        await webClient.post('/logout', {});
        invalidateAll();
        setUser(null);
    };

    const isAdmin = () => user?.roles?.includes('admin');
    const isOptometra = () => user?.roles?.includes('optometra') || user?.roles?.includes('admin');
    const can = (permission) => isAdmin() || user?.permissions?.includes(permission);

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isOptometra, can }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
