<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Los reportes comerciales devolvian 500 por dos causas distintas que se veian
 * igual en pantalla ("$0.00" sin aviso):
 *
 *  1. `whereDate('created_at', ...)` sin calificar sobre un query que despues
 *     hace join con `users` o `lab_suppliers` — ambas tablas tienen su propio
 *     `created_at`, asi que el motor rechaza la columna por ambigua.
 *  2. El closure de `Cache::remember()` devolvia Collections; con el store de
 *     base de datos volvian como `__PHP_Incomplete_Class`.
 *
 * Cada endpoint se llama dos veces a proposito: la primera calcula, la segunda
 * lee de cache, que es donde aparecia la corrupcion.
 */
class CommercialReportsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['cache.default' => 'database']);
        Cache::store('database')->clear();

        Sanctum::actingAs(User::factory()->create());
    }

    public static function reportEndpoints(): array
    {
        return [
            'ventas' => ['/api/reports/sales'],
            'inventario' => ['/api/reports/inventory'],
            'laboratorio' => ['/api/reports/lab'],
            'caja' => ['/api/reports/cash'],
            'sucursales' => ['/api/reports/branch-comparison'],
            'dashboard' => ['/api/reports/dashboard-commercial'],
        ];
    }

    #[DataProvider('reportEndpoints')]
    public function test_report_responds_ok_fresh_and_cached(string $endpoint): void
    {
        $fresh = $this->getJson($endpoint)->assertOk()->json();

        $cached = $this->getJson($endpoint)->assertOk()->json();

        $this->assertSame(
            $fresh,
            $cached,
            "La respuesta cacheada de {$endpoint} no coincide con la recien calculada."
        );
        $this->assertStringNotContainsString('__PHP_Incomplete_Class', json_encode($cached));
    }

    /** Los nombres que consume CommercialReportsPage deben existir en el payload. */
    public function test_sales_report_exposes_the_keys_the_page_reads(): void
    {
        $this->getJson('/api/reports/sales')
            ->assertOk()
            ->assertJsonStructure([
                'summary' => [
                    'total_sales', 'total_amount', 'total_discount',
                    'avg_ticket', 'total_cost', 'gross_margin', 'gross_margin_pct',
                ],
                'by_period',
                'by_payment_method',
                'by_seller',
            ]);
    }

    public function test_inventory_report_exposes_the_keys_the_page_reads(): void
    {
        $this->getJson('/api/reports/inventory')
            ->assertOk()
            ->assertJsonStructure([
                'valuation' => ['total_cost_value', 'total_sale_value'],
                'by_category',
                'low_stock',
                'no_movement_30d',
            ]);
    }

    /** El Dashboard Gerencial leia un contrato que la API nunca devolvio. */
    public function test_commercial_dashboard_exposes_the_keys_the_page_reads(): void
    {
        $this->getJson('/api/reports/dashboard-commercial')
            ->assertOk()
            ->assertJsonStructure([
                'today' => ['sales_count', 'sales_amount', 'avg_ticket', 'new_patients', 'sales_delta_pct', 'avg_ticket_delta_pct'],
                'month' => ['sales_amount', 'sales_count', 'avg_ticket', 'new_patients'],
                'pending' => ['lab_orders_ready', 'lab_orders_overdue', 'sales_with_balance'],
                'inventory' => ['low_stock_count', 'out_of_stock_count'],
                'financial' => ['gross', 'discounts', 'cost_of_sales', 'gross_margin', 'gross_margin_pct'],
                'top_sellers_week',
                'sales_by_day',
                'sales_by_hour_today',
            ]);
    }

    /**
     * El controlador importaba `Maatwebsite\Excel`, un paquete que no esta
     * instalado (y cuyo 3.1 exige phpspreadsheet ^1.x, incompatible con el ^2.0
     * que usan los comandos de importacion). Ahora escribe con PhpSpreadsheet.
     */
    public function test_excel_exports_produce_a_spreadsheet(): void
    {
        foreach (['/api/export/sales', '/api/export/inventory'] as $endpoint) {
            $response = $this->get($endpoint);

            $response->assertOk();
            $this->assertSame(
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                $response->headers->get('Content-Type'),
                "{$endpoint} no devolvio un .xlsx."
            );

            // Un .xlsx es un ZIP: los dos primeros bytes son "PK".
            $this->assertStringStartsWith('PK', $response->streamedContent());
        }
    }
}
