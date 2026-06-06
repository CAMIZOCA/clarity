import React, { useState, useRef, useEffect } from 'react';
import { Search, User } from 'lucide-react';
import { usePatientSearch } from '../../hooks/usePatientSearch';

export default function PatientAutocomplete({ onSelect, placeholder = 'Buscar paciente por nombre o cédula...' }) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const { results, loading, search } = usePatientSearch();
    const wrapperRef = useRef(null);

    useEffect(() => {
        search(query);
        setOpen(query.length >= 2);
    }, [query]);

    useEffect(() => {
        const handleClick = (e) => {
            if (!wrapperRef.current?.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleSelect = (patient) => {
        onSelect(patient);
        setQuery(patient.nombre);
        setOpen(false);
    };

    return (
        <div ref={wrapperRef} className="relative">
            <div className="relative flex items-center">
                <Search className="absolute left-3 text-gray-400" size={18} />
                <input
                    type="text"
                    inputMode="search"
                    enterKeyHint="search"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder={placeholder}
                    className="w-full min-h-11 pl-10 pr-4 py-3 text-lg rounded-xl border border-gray-300 touch-manipulation focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] focus:bg-[#fef08a]/20"
                />
                {loading && (
                    <div className="absolute right-3 animate-spin text-gray-400">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                    </div>
                )}
            </div>

            {open && results.length > 0 && (
                <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-xl mt-1 overflow-hidden">
                    {results.map(p => (
                        <li key={p.id}
                            onClick={() => handleSelect(p)}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 cursor-pointer border-b last:border-0">
                            <div className="w-9 h-9 rounded-full bg-[#1a2a4a]/10 flex items-center justify-center">
                                <User size={18} className="text-[#1a2a4a]" />
                            </div>
                            <div>
                                <p className="font-medium text-gray-900">{p.nombre}</p>
                                <p className="text-sm text-gray-500">CI: {p.cedula} · {p.edad} años</p>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            {open && query.length >= 2 && results.length === 0 && !loading && (
                <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-xl mt-1 p-4 text-center text-gray-500">
                    No se encontraron pacientes
                </div>
            )}
        </div>
    );
}
