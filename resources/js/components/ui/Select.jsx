import React, { forwardRef } from 'react';

const Select = forwardRef(function Select({
    label, error, options = [], className = '', required, placeholder, ...props
}, ref) {
    return (
        <div className={`flex flex-col gap-1 ${className}`}>
            {label && (
                <label className="text-sm font-medium text-gray-700">
                    {label}{required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}
            <select
                ref={ref}
                className={`w-full rounded-lg border text-base py-2.5 px-3 bg-white transition-colors
                    focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] focus:border-transparent
                    focus:bg-[#fef08a]/20
                    ${error ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                {...props}
            >
                {placeholder && <option value="">{placeholder}</option>}
                {options.map(opt => (
                    <option key={opt.value ?? opt} value={opt.value ?? opt}>
                        {opt.label ?? opt}
                    </option>
                ))}
            </select>
            {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
    );
});

export default Select;
