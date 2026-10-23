import './bootstrap';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import { SettingsProvider } from './contexts/SettingsContext';
import { BranchProvider } from './contexts/BranchContext';
import PwaManager from './components/pwa/PwaManager';
import UpdateModal from './components/pwa/UpdateModal';
import MobileLaunchSplash from './components/pwa/MobileLaunchSplash';
import { router } from './router/index';

createRoot(document.getElementById('app')).render(
    <React.StrictMode>
        <AuthProvider>
            <SettingsProvider>
                <BranchProvider>
                    <ToastProvider>
                        <RouterProvider router={router} />
                        <MobileLaunchSplash />
                        <PwaManager />
                        <UpdateModal />
                    </ToastProvider>
                </BranchProvider>
            </SettingsProvider>
        </AuthProvider>
    </React.StrictMode>
);
