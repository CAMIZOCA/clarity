<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ApiResponses;
use App\Http\Controllers\Controller;
use App\Models\Patient;
use App\Services\AiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AiController extends Controller
{
    use ApiResponses;

    public function __construct(private AiService $ai) {}

    /**
     * Verificar si la IA está habilitada.
     * GET /api/ai/status
     */
    public function status(): JsonResponse
    {
        return $this->ok([
            'enabled' => $this->ai->isEnabled(),
            'model'   => 'claude-haiku-4-5',
            'features' => [
                'patient_summary'        => true,
                'product_recommendation' => true,
                'sales_analysis'         => true,
                'whatsapp_generator'     => true,
                'stock_prediction'       => true,
                'assistant_chat'         => true,
            ],
        ]);
    }

    /**
     * Resumen inteligente del paciente.
     * GET /api/ai/patient/{patient}/summary
     */
    public function patientSummary(Request $request, Patient $patient): JsonResponse
    {
        if (!$this->ai->isEnabled()) {
            return response()->json(['message' => 'IA no habilitada. Configure AI_FEATURES_ENABLED=true'], 503);
        }

        $summary = $this->ai->patientSummary($patient);
        return $this->ok($summary);
    }

    /**
     * Recomendación de producto según receta.
     * POST /api/ai/product-recommendation
     */
    public function productRecommendation(Request $request): JsonResponse
    {
        if (!$this->ai->isEnabled()) {
            return response()->json(['message' => 'IA no habilitada'], 503);
        }

        $validated = $request->validate([
            'patient_id'         => ['required', 'integer', 'exists:patients,id'],
            'available_products' => ['nullable', 'array'],
        ]);

        $patient = Patient::find($validated['patient_id']);
        $result  = $this->ai->productRecommendation($patient, $validated['available_products'] ?? []);
        return $this->ok($result);
    }

    /**
     * Análisis de ventas con IA.
     * POST /api/ai/analyze-sales
     */
    public function analyzeSales(Request $request): JsonResponse
    {
        if (!$this->ai->isEnabled()) {
            return response()->json(['message' => 'IA no habilitada'], 503);
        }

        $validated = $request->validate([
            'sales_data' => ['required', 'array'],
        ]);

        $analysis = $this->ai->analyzeSales($validated['sales_data']);
        return $this->ok(['analysis' => $analysis]);
    }

    /**
     * Generar mensaje de WhatsApp personalizado.
     * POST /api/ai/generate-message
     */
    public function generateMessage(Request $request): JsonResponse
    {
        if (!$this->ai->isEnabled()) {
            return response()->json(['message' => 'IA no habilitada'], 503);
        }

        $validated = $request->validate([
            'patient_id' => ['required', 'integer', 'exists:patients,id'],
            'type'       => ['required', 'in:birthday,lab_ready,reorder,reminder,campaign'],
            'extra'      => ['nullable', 'array'],
        ]);

        $patient = Patient::find($validated['patient_id']);
        $message = $this->ai->generateWhatsAppMessage($patient, $validated['type'], $validated['extra'] ?? []);
        return $this->ok(['message' => $message]);
    }

    /**
     * Predicción de agotamiento de inventario.
     * POST /api/ai/predict-stockouts
     */
    public function predictStockouts(Request $request): JsonResponse
    {
        if (!$this->ai->isEnabled()) {
            return response()->json(['message' => 'IA no habilitada'], 503);
        }

        $validated = $request->validate([
            'inventory_data' => ['required', 'array'],
        ]);

        $predictions = $this->ai->predictStockouts($validated['inventory_data']);
        return $this->ok(['predictions' => $predictions]);
    }

    /**
     * Chat con el asistente de IA.
     * POST /api/ai/chat
     */
    public function chat(Request $request): JsonResponse
    {
        if (!$this->ai->isEnabled()) {
            return response()->json(['message' => 'IA no habilitada'], 503);
        }

        $validated = $request->validate([
            'message' => ['required', 'string', 'min:2', 'max:500'],
            'context' => ['nullable', 'array'],
        ]);

        $response = $this->ai->assistantChat($validated['message'], $validated['context'] ?? []);
        return $this->ok(['response' => $response]);
    }
}
