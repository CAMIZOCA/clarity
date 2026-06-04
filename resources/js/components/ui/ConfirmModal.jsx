import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

export default function ConfirmModal({ open, title, message, confirmLabel = 'Eliminar', onConfirm, onCancel, variant = 'danger' }) {
    return (
        <Modal open={open} onClose={onCancel} title={title} size="sm">
            <div className="flex flex-col items-center text-center gap-4 py-2">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${variant === 'danger' ? 'bg-red-100' : 'bg-yellow-100'}`}>
                    <AlertTriangle size={28} className={variant === 'danger' ? 'text-red-500' : 'text-yellow-500'} />
                </div>
                {message && <p className="text-gray-600 text-sm">{message}</p>}
                <div className="flex gap-3 w-full mt-2">
                    <Button variant="secondary" className="flex-1" onClick={onCancel}>Cancelar</Button>
                    <Button variant={variant} className="flex-1" onClick={onConfirm}>{confirmLabel}</Button>
                </div>
            </div>
        </Modal>
    );
}
