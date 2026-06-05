import './bootstrap';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import { SettingsProvider } from './contexts/SettingsContext';
import { BranchProvider } from './contexts/BranchContext';
import { router } from './router/index';

createRoot(document.getElementById('app')).render(
    <React.StrictMode>
        <AuthProvider>
            <SettingsProvider>
                <BranchProvider>
                    <ToastProvider>
                        <RouterProvider router={router} />
                    </ToastProvider>
                </BranchProvider>
            </SettingsProvider>
        </AuthProvider>
    </React.StrictMode>
);
