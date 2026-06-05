import React, { useState } from 'react';
import { Sparkles, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import client from '../../api/client';

/**
 * Botón "Analizar con IA" para el Dashboard Gerencial.
 * Llama a POST /api/ai/analyze-sales y muestra los insights en un panel expandible.
 *
 * Props:
 *   salesData  — objeto con summary y vs_previous del dashboard
 *   aiEnabled  — booleano, si false el botón aparece disabled
 */
const AiSalesAnalysis = ({ salesData, aiEnabled = false }) => {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError]     = useState(null);

  const handleAnalyze = async () => {
    if (!aiEnabled || loading) return;

    if (analysis) {
      // Toggle visibility if already loaded
      setOpen(prev => !prev);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await client.post('/ai/analyze-sales', { sales_data: salesData });
      setAnalysis(res.data?.analysis ?? 'Sin análisis disponible.');
      setOpen(true);
    } catch (e) {
      setError('No se pudo generar el análisis. Intente de nuevo más tarde.');
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const parseInsights = (text) => {
    if (!text) return [];
    return text
      .split('\n')
      .filter(line => line.trim().match(/^INSIGHT\s+\d+:/i))
      .map(line => line.replace(/^INSIGHT\s+\d+:\s*/i, '').trim());
  };

  const insights = parseInsights(analysis);

  return (
    <div className="mt-4">
      <button
        onClick={handleAnalyze}
        disabled={!aiEnabled || loading}
        title={!aiEnabled ? 'Activar IA en configuración (AI_FEATURES_ENABLED=true)' : 'Analizar ventas con IA'}
        className={`
          inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
          ${aiEnabled
            ? 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }
        `}
      >
        {loading ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Sparkles size={15} />
        )}
        {loading ? 'Analizando...' : 'Analizar con IA'}
        {analysis && !loading && (
          open ? <ChevronUp size={14} /> : <ChevronDown size={14} />
        )}
      </button>

      {open && (
        <div className="mt-3 bg-purple-50 border border-purple-200 rounded-xl p-4 relative">
          <button
            onClick={() => setOpen(false)}
            className="absolute top-3 right-3 text-purple-400 hover:text-purple-600"
            aria-label="Cerrar análisis"
          >
            <X size={14} />
          </button>

          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-purple-600" />
            <h3 className="text-sm font-semibold text-purple-800">Análisis de IA</h3>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          {insights.length > 0 ? (
            <ol className="space-y-2">
              {insights.map((insight, i) => (
                <li key={i} className="flex gap-2 text-sm text-purple-900">
                  <span className="font-bold text-purple-500 flex-shrink-0">
                    {i + 1}.
                  </span>
                  <span>{insight}</span>
                </li>
              ))}
            </ol>
          ) : analysis && !error ? (
            <p className="text-sm text-purple-800 whitespace-pre-line">{analysis}</p>
          ) : null}

          <p className="text-xs text-purple-400 mt-3 italic">
            Generado por IA — verificar antes de tomar decisiones
          </p>
        </div>
      )}
    </div>
  );
};

export default AiSalesAnalysis;
