<?php

namespace App\Services;

use App\Models\Consultation;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Pronostico de consultas por dia. Cada dia futuro se estima con la misma fecha
 * calendario de los anos anteriores (ventana de ±WINDOW_DAYS para suavizar, porque
 * hay pocas consultas por dia) y se ajusta con la tendencia del ultimo trimestre.
 *
 * Ademas de la estimacion, devuelve el rango (percentiles 10 y 90 de esos mismos
 * dias) y la proporcion de dias parecidos que llegaron a HIGH_THRESHOLD consultas,
 * para avisar cuando un dia sale de lo comun.
 */
class ConsultationForecastService
{
    /** Anos de historico que se usan para cada dia futuro. */
    public const HISTORY_YEARS = 3;

    /** Dias a cada lado de la fecha de referencia dentro de cada ano. */
    public const WINDOW_DAYS = 7;

    /** Periodo, en dias, que se compara contra el mismo periodo del ano anterior. */
    public const TREND_DAYS = 90;

    /** Limites del factor de tendencia: un mes atipico no debe disparar el pronostico. */
    public const TREND_MIN = 0.5;

    public const TREND_MAX = 2.0;

    /** Consultas en un dia a partir de las cuales se considera carga alta. */
    public const HIGH_THRESHOLD = 6;

    /**
     * @return array{
     *     generated_at: string,
     *     today: string,
     *     history_years: int,
     *     high_threshold: int,
     *     trend_factor: float,
     *     actual: array<int, array{date: string, total: int}>,
     *     forecast: array<int, array{date: string, expected: float, low: float, high: float, high_pct: float}>
     * }
     */
    public function forecast(int $days = 7): array
    {
        $today = CarbonImmutable::today();
        $counts = $this->countsBetween(
            $today->subYears(self::HISTORY_YEARS)->subDays(self::WINDOW_DAYS),
            $today,
        );
        $trend = $this->trendFactor($counts, $today);

        $actual = [];
        for ($day = $today->subDays($days - 1); $day <= $today; $day = $day->addDay()) {
            $actual[] = [
                'date' => $day->toDateString(),
                'total' => $counts[$day->toDateString()] ?? 0,
            ];
        }

        $forecast = [];
        for ($i = 1; $i <= $days; $i++) {
            $forecast[] = $this->forecastDay($counts, $today->addDays($i), $trend);
        }

        return [
            'generated_at' => now()->toISOString(),
            'today' => $today->toDateString(),
            'history_years' => self::HISTORY_YEARS,
            'high_threshold' => self::HIGH_THRESHOLD,
            'trend_factor' => $trend,
            'actual' => $actual,
            'forecast' => $forecast,
        ];
    }

    /**
     * Estimacion de un dia: promedio de los dias parecidos ajustado por tendencia,
     * rango (P10-P90) y probabilidad historica de carga alta.
     *
     * @param  array<string, int>  $counts  consultas por dia (YYYY-MM-DD)
     * @return array{date: string, expected: float, low: float, high: float, high_pct: float}
     */
    public function forecastDay(array $counts, CarbonImmutable $target, float $trend): array
    {
        $samples = $this->sameDateSamples($counts, $target);
        $sorted = $samples;
        sort($sorted);

        $highDays = count(array_filter($samples, fn (int $total) => $total >= self::HIGH_THRESHOLD));

        return [
            'date' => $target->toDateString(),
            'expected' => round(array_sum($samples) / count($samples) * $trend, 1),
            'low' => round($this->percentile($sorted, 10) * $trend, 1),
            'high' => round($this->percentile($sorted, 90) * $trend, 1),
            'high_pct' => round(100 * $highDays / count($samples), 1),
        ];
    }

    /**
     * Consultas por dia en la ventana alrededor de la misma fecha de cada uno de
     * los ultimos anos: HISTORY_YEARS * (2 * WINDOW_DAYS + 1) muestras.
     *
     * @param  array<string, int>  $counts
     * @return array<int, int>
     */
    public function sameDateSamples(array $counts, CarbonImmutable $target): array
    {
        $samples = [];

        for ($year = 1; $year <= self::HISTORY_YEARS; $year++) {
            $anchor = $target->subYears($year);
            $to = $anchor->addDays(self::WINDOW_DAYS);

            for ($day = $anchor->subDays(self::WINDOW_DAYS); $day <= $to; $day = $day->addDay()) {
                $samples[] = $counts[$day->toDateString()] ?? 0;
            }
        }

        return $samples;
    }

    /**
     * Ultimos TREND_DAYS dias frente al mismo periodo del ano anterior. Sin historico
     * en ese periodo no hay con que comparar y se devuelve 1.0.
     *
     * @param  array<string, int>  $counts
     */
    public function trendFactor(array $counts, CarbonImmutable $today): float
    {
        $recent = $this->sumBetween($counts, $today->subDays(self::TREND_DAYS - 1), $today);
        $prior = $this->sumBetween(
            $counts,
            $today->subYear()->subDays(self::TREND_DAYS - 1),
            $today->subYear(),
        );

        if ($prior === 0) {
            return 1.0;
        }

        return round(min(self::TREND_MAX, max(self::TREND_MIN, $recent / $prior)), 2);
    }

    /**
     * Percentil por rango mas cercano sobre un arreglo ya ordenado.
     *
     * @param  array<int, int>  $sorted
     */
    private function percentile(array $sorted, int $percent): int
    {
        $rank = (int) ceil($percent / 100 * count($sorted));

        return $sorted[max(0, $rank - 1)];
    }

    /**
     * Una sola consulta agrupada por dia; el resto de calculos trabaja sobre el arreglo.
     *
     * @return array<string, int>
     */
    private function countsBetween(CarbonImmutable $from, CarbonImmutable $to): array
    {
        return Consultation::query()
            ->whereBetween('fecha_consulta', [$from->toDateString(), $to->toDateString()])
            ->select(DB::raw('DATE(fecha_consulta) as dia'), DB::raw('count(*) as total'))
            ->groupBy('dia')
            ->pluck('total', 'dia')
            ->map(fn ($total) => (int) $total)
            ->all();
    }

    /** @param  array<string, int>  $counts */
    private function sumBetween(array $counts, CarbonImmutable $from, CarbonImmutable $to): int
    {
        $sum = 0;
        for ($day = $from; $day <= $to; $day = $day->addDay()) {
            $sum += $counts[$day->toDateString()] ?? 0;
        }

        return $sum;
    }
}
