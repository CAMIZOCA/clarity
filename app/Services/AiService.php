<?php

namespace App\Services;

use App\Models\Patient;
use App\Models\Consultation;
use App\Models\Sale;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Servicio de Inteligencia Artificial para Clarity Óptica.
 * Usa la API de Claude (Anthropic) para análisis y recomendaciones.
 *
 * Activar con AI_FEATURES_ENABLED=true en .env
 * Requiere ANTHROPIC_API_KEY válida.
 */
class AiService
{
    private bool $enabled;
    private ?\Anthropic\Client $client = null;

    public function __construct()
    {
        $this->enabled = (bool) config('services.ai.enabled', false);
    }

    /**
     * Inicializar el cliente Anthropic (lazy).
     */
    private function getClient(): \Anthropic\Client
    {
        if (!$this->client) {
            if (!class_exists('\Anthropic\Client')) {
                throw new \Exception('SDK de Anthropic no instalado. Ejecutar: composer require anthropic-ai/sdk');
            }
            $apiKey = config('services.anthropic.api_key');
            if (!$apiKey) {
                throw new \Exception('ANTHROPIC_API_KEY no configurada en .env');
            }
            $this->client = new \Anthropic\Client(apiKey: $apiKey);
        }
        return $this->client;
    }

    /**
     * Verificar si la IA está habilitada.
     */
    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    /**
     * IA-1: Resumen inteligente del paciente para el vendedor.
     * Analiza historial clínico y comercial y genera 3 insights accionables.
     *
     * @return array{summary: string|null, insights: array, cached: bool}
     */
    public function patientSummary(Patient $patient): array
    {
        $cacheKey = "ai_patient_summary_{$patient->id}_" . ($patient->updated_at?->timestamp ?? 0);

        return Cache::remember($cacheKey, 1800, function () use ($patient) {
            $patient->load([
                'consultations' => fn($q) => $q->latest()->limit(3),
                'sales'         => fn($q) => $q->latest()->limit(5),
            ]);

            $lastConsultation = $patient->consultations->first();
            $salesHistory     = $patient->sales->where('status', '!=', 'cancelled');

            $context = [
                'nombre'          => $patient->nombre,
                'edad'            => $patient->fecha_nacimiento?->age,
                'ultima_consulta' => $lastConsultation?->fecha_consulta?->toDateString(),
                'od_esfera'       => $lastConsultation?->rx_final_esfera_od,
                'oi_esfera'       => $lastConsultation?->rx_final_esfera_oi,
                'diagnostico'     => $lastConsultation?->diagnostico_descripcion,
                'total_compras'   => $salesHistory->count(),
                'monto_total'     => $salesHistory->sum('total'),
                'ultima_compra'   => $salesHistory->first()?->created_at?->toDateString(),
                'saldo_pendiente' => $salesHistory->sum('balance'),
            ];

            $prompt = $this->buildPatientSummaryPrompt($context);

            try {
                $response = $this->callClaude($prompt, maxTokens: 400);
                return ['summary' => $response, 'insights' => $this->parseInsights($response), 'cached' => false];
            } catch (\Exception $e) {
                Log::warning("AI patientSummary failed: " . $e->getMessage());
                return ['summary' => null, 'insights' => [], 'cached' => false, 'error' => $e->getMessage()];
            }
        });
    }

    /**
     * IA-2: Recomendación de producto según receta e historial.
     * Sugiere armazón y luna más adecuados del inventario disponible.
     *
     * @param  array<int, array{name: string, price: numeric}> $availableProducts
     * @return array{recommendation: string|null, products: array}
     */
    public function productRecommendation(Patient $patient, array $availableProducts = []): array
    {
        $consultation = $patient->consultations()->latest()->first();
        if (!$consultation) {
            return [
                'recommendation' => 'No hay consulta reciente disponible para hacer recomendaciones.',
                'products'       => [],
            ];
        }

        $prescription = [
            'od_sphere'   => $consultation->rx_final_esfera_od,
            'od_cylinder' => $consultation->rx_final_cilindro_od,
            'od_axis'     => $consultation->rx_final_eje_od,
            'oi_sphere'   => $consultation->rx_final_esfera_oi,
            'oi_cylinder' => $consultation->rx_final_cilindro_oi,
            'oi_axis'     => $consultation->rx_final_eje_oi,
            'add'         => $consultation->rx_final_add_od,
        ];

        $historyNote = '';
        $lastSale    = $patient->sales()->where('status', 'paid')->latest()->first();
        if ($lastSale) {
            $historyNote = "Compró lentes hace " . $lastSale->created_at->diffInDays(now()) . " días.";
        }

        $productsContext = collect($availableProducts)
            ->take(10)
            ->map(fn($p) => "{$p['name']} - \${$p['price']}")
            ->join(', ');

        $prompt = "Eres un optómetra experto. Analiza esta receta y recomienda el tipo de lente más adecuado.

Receta del paciente:
- OD: Esfera {$prescription['od_sphere']}, Cilindro {$prescription['od_cylinder']}, Eje {$prescription['od_axis']}
- OI: Esfera {$prescription['oi_sphere']}, Cilindro {$prescription['oi_cylinder']}, Eje {$prescription['oi_axis']}
" . ($prescription['add'] ? "- Adición: {$prescription['add']} (requiere progresivos o bifocales)" : "") . "
{$historyNote}

Productos disponibles en inventario: {$productsContext}

Responde en español en máximo 3 líneas:
1. Tipo de lente recomendado y por qué
2. Índice de refracción sugerido según la prescripción
3. Tratamientos sugeridos (AR, UV, fotocromático, etc.)

NO des diagnósticos médicos. Solo recomendaciones de producto.";

        try {
            $response = $this->callClaude($prompt, maxTokens: 250);
            return ['recommendation' => $response, 'products' => []];
        } catch (\Exception $e) {
            Log::warning("AI productRecommendation failed: " . $e->getMessage());
            return ['recommendation' => null, 'error' => $e->getMessage()];
        }
    }

    /**
     * IA-3: Análisis de ventas en lenguaje natural.
     * Genera insights accionables del período analizado.
     *
     * @param  array<string, mixed> $salesData Datos del reporte de ventas
     * @return string Análisis en texto
     */
    public function analyzeSales(array $salesData): string
    {
        $summary = $salesData['summary'] ?? [];

        $prompt = "Eres un analista de negocios para ópticas. Analiza estos datos de ventas y genera exactamente 3 insights accionables en español.

Datos del período:
- Total ventas: \${$summary['total_amount']}
- Número de transacciones: {$summary['total_sales']}
- Ticket promedio: \${$summary['avg_ticket']}
- Margen bruto: {$summary['gross_margin_pct']}%
- Descuentos aplicados: \${$summary['total_discount']}
- Comparativo período anterior: " . ($salesData['vs_previous'] ?? 'N/D') . "

Formato de respuesta (sin markdown, solo texto plano):
INSIGHT 1: [descripción + acción concreta recomendada]
INSIGHT 2: [descripción + acción concreta recomendada]
INSIGHT 3: [descripción + acción concreta recomendada]";

        try {
            return $this->callClaude($prompt, maxTokens: 350);
        } catch (\Exception $e) {
            return "No se pudo generar el análisis: " . $e->getMessage();
        }
    }

    /**
     * IA-4: Generar mensaje de WhatsApp personalizado.
     * Crea un mensaje apropiado para el tipo de comunicación indicado.
     *
     * @param  string                 $type    birthday|lab_ready|reorder|reminder|campaign
     * @param  array<string, mixed>   $extra
     * @return string Mensaje generado
     */
    public function generateWhatsAppMessage(Patient $patient, string $type, array $extra = []): string
    {
        $nombre = explode(' ', $patient->nombre)[0]; // Primer nombre
        $optica = config('app.name', 'Clarity Óptica');

        $typeDescriptions = [
            'birthday'  => 'mensaje de felicitación de cumpleaños con oferta especial del 10%',
            'lab_ready' => 'aviso de que sus lentes están listos para retirar',
            'reorder'   => 'recordatorio para renovar lentes de contacto mensuales',
            'reminder'  => 'recordatorio de control visual anual',
            'campaign'  => $extra['campaign_description'] ?? 'mensaje promocional',
        ];

        $description = $typeDescriptions[$type] ?? 'mensaje personalizado';

        $prompt = "Escribe un mensaje de WhatsApp para una óptica llamada '{$optica}'.
El mensaje es un {$description} para el paciente llamado {$nombre}.
" . (!empty($extra['additional_info']) ? "Información adicional: {$extra['additional_info']}" : "") . "

Requisitos:
- Máximo 160 caracteres
- Tono amigable y profesional
- En español ecuatoriano (sin vosotros, con usted)
- Sin emojis excesivos (máximo 1)
- Incluir el nombre del paciente
- Sin asteriscos ni markdown

Solo responde con el mensaje, sin explicaciones.";

        try {
            return trim($this->callClaude($prompt, maxTokens: 100));
        } catch (\Exception $e) {
            // Fallback a mensajes predefinidos
            return $this->fallbackMessage($nombre, $type, $optica);
        }
    }

    /**
     * IA-5: Predicción de inventario — productos que se agotarán pronto.
     *
     * @param  array<int, array{sku: string, quantity: int, sales_30d: int}> $inventoryData
     * @return array<int, array{sku: string, days_remaining: int, urgency: string, reorder_quantity: int}>
     */
    public function predictStockouts(array $inventoryData): array
    {
        $productsInfo = collect($inventoryData)
            ->map(fn($item) => "{$item['sku']}: stock={$item['quantity']}, ventas_30d={$item['sales_30d']}")
            ->take(20)
            ->join("\n");

        $prompt = "Analiza este inventario de óptica y predice qué productos se agotarán en los próximos 15 días basándote en las ventas de los últimos 30 días.

Inventario:
{$productsInfo}

Responde en formato JSON con exactamente esta estructura:
{\"stockouts\": [{\"sku\": \"...\", \"days_remaining\": N, \"urgency\": \"alta|media\", \"reorder_quantity\": N}]}

Solo incluye productos con menos de 20 días de stock. Máximo 5 productos.";

        try {
            $response = $this->callClaude($prompt, maxTokens: 300);
            $json     = json_decode($response, true);
            return $json['stockouts'] ?? [];
        } catch (\Exception $e) {
            Log::warning("AI predictStockouts failed: " . $e->getMessage());
            return [];
        }
    }

    /**
     * IA-6: Asistente interno para empleados.
     * Responde preguntas sobre el sistema, productos y procesos.
     *
     * @param array<string, mixed> $context
     */
    public function assistantChat(string $userMessage, array $context = []): string
    {
        $systemPrompt = "Eres el asistente de Clarity Óptica, un sistema de gestión para ópticas.
Ayudas a vendedores, optómetras y cajeros con preguntas sobre:
- Cómo usar el sistema (POS, inventario, laboratorio, caja)
- Procesos de la óptica
- Información general sobre productos ópticos

Contexto del usuario: " . json_encode($context) . "

Reglas:
- Responde SIEMPRE en español
- Sé conciso (máximo 3 párrafos)
- No inventes datos específicos del negocio que no estén en el contexto
- Si no sabes algo, di que consulte con el administrador
- No des diagnósticos médicos";

        try {
            return $this->callClaude($userMessage, systemPrompt: $systemPrompt, maxTokens: 400);
        } catch (\Exception $e) {
            return "Lo siento, el asistente no está disponible en este momento. Por favor contacta al administrador.";
        }
    }

    // ─── Métodos privados ────────────────────────────────────────────────────

    private function callClaude(string $prompt, string $systemPrompt = '', int $maxTokens = 300): string
    {
        $client = $this->getClient();

        $messages = [['role' => 'user', 'content' => $prompt]];

        $response = $client->messages->create(
            maxTokens: $maxTokens,
            messages:  $messages,
            model:     'claude-haiku-4-5',
            system:    $systemPrompt ?: null,
        );

        return $response->content[0]->text ?? '';
    }

    private function buildPatientSummaryPrompt(array $context): string
    {
        return "Eres un asistente de óptica. Genera un resumen breve del paciente {$context['nombre']} para el vendedor.

Datos disponibles:
- Edad: {$context['edad']} años
- Última consulta: {$context['ultima_consulta']}
- Graduación OD: {$context['od_esfera']}, OI: {$context['oi_esfera']}
- Diagnóstico principal: {$context['diagnostico']}
- Total de compras: {$context['total_compras']}
- Monto total gastado: \${$context['monto_total']}
- Última compra: {$context['ultima_compra']}
- Saldo pendiente: \${$context['saldo_pendiente']}

Genera máximo 3 puntos breves y accionables para el vendedor. Formato:
• [punto 1]
• [punto 2]
• [punto 3]

IMPORTANTE: No incluyas datos médicos sensibles. Solo info útil para la atención.";
    }

    private function parseInsights(string $text): array
    {
        $lines = array_filter(
            explode("\n", $text),
            fn($l) => str_starts_with(trim($l), '•')
        );
        return array_values(
            array_map(fn($l) => trim(ltrim(trim($l), '• ')), $lines)
        );
    }

    private function fallbackMessage(string $nombre, string $type, string $optica): string
    {
        return match ($type) {
            'birthday'  => "¡Feliz cumpleaños {$nombre}! En {$optica} le obsequiamos un 10% en su próxima compra.",
            'lab_ready' => "Estimado/a {$nombre}, sus lentes están listos. Visítenos en {$optica}.",
            'reorder'   => "Hola {$nombre}, es momento de renovar sus lentes. Contáctenos en {$optica}.",
            default     => "Hola {$nombre}, le saluda {$optica}. ¿En qué podemos ayudarle?",
        };
    }
}
