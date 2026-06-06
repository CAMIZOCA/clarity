import React from 'react';

const variants = {
    primary: 'bg-[#1a2a4a] text-white hover:bg-[#243660] focus:ring-[#1a2a4a]',
    secondary: 'bg-white text-[#1a2a4a] border border-[#1a2a4a] hover:bg-gray-50 focus:ring-[#1a2a4a]',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 focus:ring-gray-400',
};

const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
};

export default function Button({
    children, variant = 'primary', size = 'md',
    className = '', disabled, loading, type = 'button', onClick, ...props
}) {
    return (
        <button
            type={type}
            disabled={disabled || loading}
            onClick={onClick}
            className={`inline-flex items-center gap-2 font-medium rounded-lg transition-colors
                min-h-11 touch-manipulation focus:outline-none focus:ring-2 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed
                ${variants[variant]} ${sizes[size]} ${className}`}
            {...props}
        >
            {loading && (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
            )}
            {children}
        </button>
    );
}
