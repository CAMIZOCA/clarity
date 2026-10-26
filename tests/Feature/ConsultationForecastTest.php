<?php

namespace Tests\Feature;

use App\Models\Consultation;
use App\Models\Patient;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission as SpatiePermission;
use Tests\TestCase;

/**
 * Pronostico de consultas del dashboard. "Hoy" queda fijo en 2026-10-23 para que
 * las ventanas de fechas no dependan del dia en que corre la prueba.
 */
class ConsultationForecastTest extends TestCase
{
    use RefreshDatabase;

    private Patient $patient;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-10-23 12:00:00');
        SpatiePermission::firstOrCreate(['name' => 'consultations.handoff', 'guard_name' => 'web']);
        Sanctum::actingAs(User::factory()->create()->givePermissionTo('consultations.handoff'));

        $this->patient = Patient::create([
            'nombre' => 'Violeta Almeida',
            'cedula' => '1760402469',
            'fecha_nacimiento' => '2021-01-15',
            'email' => 'paciente@correo.com',
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /** Crea `$count` consultas en la fecha indicada. */
    private function consultationsOn(string $date, int $count): void
    {
        for ($i = 0; $i < $count; $i++) {
            Consultation::create([
                'patient_id' => $this->patient->id,
                'fecha_consulta' => $date,
            ]);
        }
    }

    public function test_actual_days_count_only_the_last_seven_days(): void
    {
        $this->consultationsOn('2026-10-22', 2);
        $this->consultationsOn('2026-10-16', 5); // fuera de la ventana de 7 dias

        $data = $this->getJson('/api/reports/consultations-forecast')->assertOk()->json();

        $this->assertCount(7, $data['actual']);
        $this->assertSame('2026-10-17', $data['actual'][0]['date']);
        $this->assertSame('2026-10-23', $data['actual'][6]['date']);
        $this->assertSame(2, $data['actual'][5]['total']);
        $this->assertSame(0, $data['actual'][0]['total']);
        $this->assertSame(2, array_sum(array_column($data['actual'], 'total')));
    }

    public function test_forecast_averages_the_same_date_in_previous_years(): void
    {
        // Manana (2026-10-24) se compara con 2025-10-24, 2024-10-24 y 2023-10-24.
        // 15 consultas en 2025 dentro de la ventana de ±7 dias = 1 al dia en ese ano.
        // Promedio de los tres anos: 15 / 15 / 3 = 0.33. Sin datos de tendencia: x1.0.
        $this->consultationsOn('2025-10-24', 15);

        $data = $this->getJson('/api/reports/consultations-forecast?days=7')->assertOk()->json();

        $this->assertCount(7, $data['forecast']);
        $this->assertSame('2026-10-24', $data['forecast'][0]['date']);
        $this->assertSame(0.3, $data['forecast'][0]['expected']);
        $this->assertEqualsWithDelta(1.0, $data['trend_factor'], 0.001);
    }

    public function test_trend_factor_is_capped_at_two(): void
    {
        // Ultimos 90 dias: 8 consultas. Mismo periodo del ano anterior: 1. Ratio 8 -> tope 2.0.
        $this->consultationsOn('2026-10-01', 8);
        $this->consultationsOn('2025-08-01', 1);
        $this->consultationsOn('2025-10-24', 15);

        $data = $this->getJson('/api/reports/consultations-forecast')->assertOk()->json();

        $this->assertEqualsWithDelta(2.0, $data['trend_factor'], 0.001);
        $this->assertSame(0.7, $data['forecast'][0]['expected']);
    }

    public function test_trend_factor_is_floored_at_half(): void
    {
        // Ultimos 90 dias: 0 consultas. Ano anterior: 4. Ratio 0 -> piso 0.5.
        $this->consultationsOn('2025-08-01', 4);
        $this->consultationsOn('2025-10-24', 15);

        $data = $this->getJson('/api/reports/consultations-forecast')->assertOk()->json();

        $this->assertEqualsWithDelta(0.5, $data['trend_factor'], 0.001);
        $this->assertSame(0.2, $data['forecast'][0]['expected']);
    }

    public function test_without_history_every_forecast_is_zero(): void
    {
        $data = $this->getJson('/api/reports/consultations-forecast')->assertOk()->json();

        $this->assertCount(7, $data['forecast']);
        foreach ($data['forecast'] as $day) {
            $this->assertEqualsWithDelta(0.0, $day['expected'], 0.001);
        }
        $this->assertSame(0, array_sum(array_column($data['actual'], 'total')));
    }

    public function test_days_must_be_between_one_and_fourteen(): void
    {
        $this->getJson('/api/reports/consultations-forecast?days=0')->assertUnprocessable();
        $this->getJson('/api/reports/consultations-forecast?days=15')->assertUnprocessable();
    }

    public function test_band_spans_the_same_dates_percentiles(): void
    {
        // 8 dias con 1 consulta en la ventana de 2025 (45 muestras, 37 ceros).
        // P10 = 0, P90 = 1, promedio = 8 / 45 = 0.18 -> 0.2.
        foreach (range(24, 31) as $day) {
            $this->consultationsOn(sprintf('2025-10-%02d', $day), 1);
        }

        $forecast = $this->getJson('/api/reports/consultations-forecast')->assertOk()->json('forecast.0');

        $this->assertSame(0.2, $forecast['expected']);
        $this->assertEqualsWithDelta(0.0, $forecast['low'], 0.001);
        $this->assertEqualsWithDelta(1.0, $forecast['high'], 0.001);
        $this->assertEqualsWithDelta(0.0, $forecast['high_pct'], 0.001);
    }

    public function test_high_pct_is_share_of_similar_days_with_high_load(): void
    {
        // 2 de 45 dias parecidos llegaron a 6 o mas consultas: 4.4 %.
        $this->consultationsOn('2025-10-24', 6);
        $this->consultationsOn('2024-10-20', 7);

        $data = $this->getJson('/api/reports/consultations-forecast')->assertOk()->json();

        $this->assertSame(6, $data['high_threshold']);
        $this->assertSame(4.4, $data['forecast'][0]['high_pct']);
        // El P90 no alcanza un pico aislado: el rango no sustituye a high_pct.
        $this->assertEqualsWithDelta(0.0, $data['forecast'][0]['high'], 0.001);
    }
}
