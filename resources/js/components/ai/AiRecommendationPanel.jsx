import React, { useState, useEffect } from 'react';
import { Sparkles, X, Loader2 } from 'lucide-react';
import client from '../../api/client';

/**
 * Panel flotante de recomendaciones IA.
 * Se muestra en el POS cuando hay un paciente seleccionado con consulta.
 */
const AiRecommendationPanel = ({ patient, prescriptionData, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState(null);
  const [summary, setSummary] = useState(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (patient?.id) {
      fetchSummary();
    }
    // Reset on patient change
    setRecommendation(null);
    setSummary(null);
    setHidden(false);
  }, [patient?.id]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await client.get(`/ai/patient/${patient.id}/summary`);
      const insights = res.data?.insights;
      if (!insights || insights.length === 0) {
        // No insights — hide panel silently
        setHidden(true);
        return;
      }
      setSummary(insights);
    } catch {
      // IA no disponible o deshabilitada — ocultar sin ruido
      setHidden(true);
    } finally {
      setLoading(false);
    }
  };

  const getProductRec = async () => {
    setLoading(true);
    try {
      const res = await client.post('/ai/product-recommendation', {
        patient_id: patient.id,
      });
      setRecommendation(res.data?.recommendation);
    } catch {
      setRecommendation('No se pudo obtener recomendación en este momento.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setHidden(true);
    onClose?.();
  };

  if (hidden) return null;

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 relative">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1 text-purple-700 text-sm font-medium">
          <Sparkles size={14} />
          <span>Asistente IA</span>
        </div>
        <button
          onClick={handleClose}
          className="text-purple-400 hover:text-purple-600 transition-colors"
          aria-label="Cerrar panel de IA"
        >
          <X size={14} />
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-purple-600 text-xs">
          <Loader2 size={12} className="animate-spin" />
          <span>Analizando...</span>
        </div>
      )}

      {summary && summary.length > 0 && (
        <ul className="text-xs text-purple-800 space-y-1">
          {summary.map((insight, i) => (
            <li key={i} className="flex gap-1">
              <span className="text-purple-400 flex-shrink-0">•</span>
              <span>{insight}</span>
            </li>
          ))}
        </ul>
      )}

      {recommendation && (
        <div className="mt-2 text-xs text-purple-800 bg-purple-100 rounded p-2">
          <strong>Recomendación de lente:</strong> {recommendation}
        </div>
      )}

      {!recommendation && !loading && prescriptionData && (
        <button
          onClick={getProductRec}
          className="mt-2 text-xs text-purple-600 underline hover:text-purple-800 transition-colors"
        >
          Ver recomendación de lente &rarr;
        </button>
      )}

      <p className="text-xs text-purple-400 mt-2 italic">
        Sugerencia de IA — no es diagnóstico médico
      </p>
    </div>
  );
};

export default AiRecommendationPanel;
