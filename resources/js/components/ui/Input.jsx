import React, { forwardRef } from 'react';

const Input = forwardRef(function Input({
    label, error, className = '', type = 'text',
    prefix, suffix, hint, required,
    inputMode,
    enterKeyHint,
    nextFieldId,
    autoAdvanceOnEnter = false,
    id,
    onKeyDown,
    ...props
}, ref) {
    const resolvedId = id ?? props.name;
    const resolvedInputMode =
        inputMode ?? (type === 'number' ? 'decimal' : type === 'tel' ? 'tel' : undefined);
    const resolvedEnterKeyHint =
        enterKeyHint ?? (nextFieldId || autoAdvanceOnEnter ? 'next' : undefined);

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' && !event.isComposing && nextFieldId) {
            const nextField = document.getElementById(nextFieldId);
            if (nextField && typeof nextField.focus === 'function') {
                event.preventDefault();
                nextField.focus({ preventScroll: true });
                if (typeof nextField.select === 'function') {
                    nextField.select();
                }
            }
        }

        onKeyDown?.(event);
    };

    return (
        <div className={`flex flex-col gap-1 ${className}`}>
            {label && (
                <label className="text-sm font-medium text-gray-700">
                    {label}{required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}
            <div className="relative flex items-center">
                {prefix && (
                    <span className="absolute left-3 text-gray-500 text-sm select-none">{prefix}</span>
                )}
                <input
                    ref={ref}
                    id={resolvedId}
                    type={type}
                    inputMode={resolvedInputMode}
                    enterKeyHint={resolvedEnterKeyHint}
                    onKeyDown={handleKeyDown}
                    className={`w-full rounded-lg border text-base py-2.5 transition-colors
                        min-h-11 touch-manipulation focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] focus:border-transparent
                        focus:bg-[#fef08a]/20
                        ${error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}
                        ${prefix ? 'pl-8' : 'pl-3'}
                        ${suffix ? 'pr-8' : 'pr-3'}`}
                    {...props}
                />
                {suffix && (
                    <span className="absolute right-3 text-gray-500 text-sm select-none">{suffix}</span>
                )}
            </div>
            {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
            {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
    );
});

export default Input;
