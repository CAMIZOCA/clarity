import React from 'react';
import { Users, RefreshCw } from 'lucide-react';
import Button from '../ui/Button';

const segmentOptions = [
    { key: 'no_purchase_days', label: 'Sin compra en X días', type: 'number', placeholder: 'Ej: 90' },
    { key: 'birthday_month', label: 'Cumpleaños este mes', type: 'checkbox' },
    { key: 'has_balance', label: 'Tiene saldo pendiente', type: 'checkbox' },
    { key: 'prescription_expired', label: 'Receta vencida (+12 meses)', type: 'checkbox' },
    { key: 'contact_lens_reorder', label: 'Reorden lentes de contacto', type: 'checkbox' },
];

export default function SegmentBuilder({ criteria, onChange, preview, onCalculate, calculating }) {
    const handleToggle = (key) => {
        const updated = { ...criteria };
        if (updated[key]) {
            delete updated[key];
        } else {
            updated[key] = true;
        }
        onChange(updated);
    };

    const handleNumberChange = (key, value) => {
        const updated = { ...criteria };
        if (value === '' || value === null) {
            delete updated[key];
        } else {
            updated[key] = parseInt(value, 10);
        }
        onChange(updated);
    };

    const hasAnyCriteria = Object.keys(criteria).length > 0;

    return (
        <div className="space-y-4">
            <p className="text-sm text-gray-500">
                Selecciona los criterios para definir quiénes recibirán esta campaña.
            </p>

            <div className="space-y-3">
                {segmentOptions.map((opt) => (
                    <div
                        key={opt.key}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer
                            ${criteria[opt.key] !== undefined
                                ? 'border-[#1a2a4a] bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                        onClick={() => opt.type === 'checkbox' && handleToggle(opt.key)}
                    >
                        {opt.type === 'checkbox' ? (
                            <>
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
                                    ${criteria[opt.key]
                                        ? 'bg-[#1a2a4a] border-[#1a2a4a]'
                                        : 'border-gray-300'
                                    }`}>
                                    {criteria[opt.key] && (
                                        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    )}
                                </div>
                                <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                            </>
                        ) : (
                            <>
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
                                    ${criteria[opt.key] !== undefined
                                        ? 'bg-[#1a2a4a] border-[#1a2a4a]'
                                        : 'border-gray-300'
                                    }`}>
                                    {criteria[opt.key] !== undefined && (
                                        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    )}
                                </div>
                                <span className="text-sm font-medium text-gray-700 flex-1">{opt.label}</span>
                                <input
                                    type="number"
                                    min="1"
                                    placeholder={opt.placeholder}
                                    value={criteria[opt.key] ?? ''}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => handleNumberChange(opt.key, e.target.value)}
                                    className="w-24 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]"
                                />
                            </>
                        )}
                    </div>
                ))}
            </div>

            <div className="flex items-center justify-between pt-2">
                <Button
                    variant="secondary"
                    size="sm"
                    disabled={!hasAnyCriteria || calculating}
                    loading={calculating}
                    onClick={onCalculate}
                    className="gap-2"
                >
                    <RefreshCw size={14} />
                    Calcular destinatarios
                </Button>

                {preview && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Users size={16} className="text-[#1a2a4a]" />
                        <span>
                            <strong className="text-[#1a2a4a]">{preview.count}</strong> destinatarios
                            {preview.sample && preview.sample.length > 0 && (
                                <span className="text-gray-400 ml-1">
                                    ({preview.sample.join(', ')}{preview.count > preview.sample.length ? '...' : ''})
                                </span>
                            )}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
