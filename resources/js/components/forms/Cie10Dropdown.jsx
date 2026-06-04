import React, { useState, useEffect, useRef } from 'react';
import client from '../../api/client';

export default function Cie10Dropdown({ value, onChange, onDescriptionChange }) {
    const [query, setQuery] = useState(value ?? '');
    const [results, setResults] = useState([]);
    const [open, setOpen] = useState(false);
    const timerRef = useRef(null);
    const wrapRef = useRef(null);

    useEffect(() => {
        const handleClick = (e) => {
            if (!wrapRef.current?.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleInput = (e) => {
        const q = e.target.value;
        setQuery(q);
        clearTimeout(timerRef.current);
        if (q.length < 2) { setResults([]); setOpen(false); return; }
        timerRef.current = setTimeout(async () => {
            const res = await client.get('/cie10', { params: { q } });
            setResults(res.data);
            setOpen(true);
        }, 300);
    };

    const handleSelect = (code) => {
        setQuery(`${code.code} — ${code.description}`);
        onChange(code.code);
        onDescriptionChange?.(code.description);
        setOpen(false);
    };

    return (
        <div ref={wrapRef} className="relative">
            <input
                type="text"
                value={query}
                onChange={handleInput}
                placeholder="Buscar código CIE-10 o descripción..."
                className="w-full px-3 py-2.5 text-base rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] focus:bg-[#fef08a]/20"
            />
            {open && results.length > 0 && (
                <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-xl mt-1 max-h-56 overflow-y-auto">
                    {results.map(c => (
                        <li key={c.code} onClick={() => handleSelect(c)}
                            className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b last:border-0">
                            <span className="font-mono text-sm font-semibold text-[#1a2a4a]">{c.code}</span>
                            <span className="text-gray-700 ml-3 text-sm">{c.description}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
