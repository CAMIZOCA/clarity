import { useState, useCallback, useRef } from 'react';
import client from '../api/client';

export function usePatientSearch() {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const timerRef = useRef(null);

    const search = useCallback((q) => {
        clearTimeout(timerRef.current);
        if (!q || q.length < 2) {
            setResults([]);
            return;
        }
        timerRef.current = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await client.get('/patients/search', { params: { q } });
                setResults(res.data);
            } finally {
                setLoading(false);
            }
        }, 300);
    }, []);

    return { results, loading, search };
}
