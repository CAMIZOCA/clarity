import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { motionTransition, SPRING_SHEET, REDUCED_MOTION_TRANSITION } from '../../utils/motion';

const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-6xl',
};

export default function Modal({ open, onClose, title, children, size = 'md' }) {
    useEffect(() => {
        if (open) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = '';
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    useEffect(() => {
        if (!open) return undefined;
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        className="material-scrim absolute inset-0"
                        onClick={onClose}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={REDUCED_MOTION_TRANSITION}
                    />
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={title ? 'modal-title' : undefined}
                        className={`material-sheet relative flex w-full max-h-[90vh] flex-col rounded-xl shadow-2xl ${sizes[size]}`}
                        initial={{ opacity: 0, scale: 0.94, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 8 }}
                        transition={motionTransition(SPRING_SHEET)}
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                            <h2 id="modal-title" className="text-heading text-xl font-semibold text-gray-900">{title}</h2>
                            <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Cerrar">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="overflow-y-auto flex-1 px-6 py-4">
                            {children}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
