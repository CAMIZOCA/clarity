<?php

namespace App\Services;

use App\Models\Consultation;
use App\Models\LabOrder;
use App\Models\Sale;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Consultas recien terminadas, para la pantalla de recepcion.
 *
 * Cuando el optometra pulsa "Completar consulta", el vendedor ve un resumen
 * corto (medidas, lente recomendado, diagnostico) sin abrir la historia. Es una
 * lectura en vivo: no se cachea, y por eso tampoco hay riesgo de guardar
 * modelos serializados (CLAUDE.md, gotcha 7).
 */
class ReceptionFeedService
{
    public const MIN_DAYS = 1;

    public const MAX_DAYS = 7;

    public const DEFAULT_DAYS = 1;

    /** Columnas de la consulta que alimentan el resumen (la tabla tiene ~145). */
    private const COLUMNS = [
        'id', 'numero_consulta', 'patient_id', 'optometrista_id', 'fecha_consulta', 'completed_at',
        'estado', 'motivo_consulta', 'observaciones', 'recomendaciones',
        'diagnostico_cie10', 'diagnostico_descripcion', 'diagnostico_adicional',
        'avsc_od', 'avsc_oi', 'avcc_od', 'avcc_oi',
        'rx_final_esfera_od', 'rx_final_cilindro_od', 'rx_final_eje_od', 'rx_final_add_od',
        'rx_final_av_od', 'rx_final_dnp_od', 'rx_final_esfera_od_neutral',
        'rx_final_esfera_oi', 'rx_final_cilindro_oi', 'rx_final_eje_oi', 'rx_final_add_oi',
        'rx_final_av_oi', 'rx_final_dnp_oi', 'rx_final_esfera_oi_neutral',
        'rx_final_observaciones', 'medidas_notas',
        'luna_material', 'luna_espesor', 'luna_proteccion', 'luna_observacion',
    ];

    /**
     * @return array{today: string, generated_at: string, days: array<int, array{date: string, consultations: array}>}
     */
    public function feed(int $days = self::DEFAULT_DAYS): array
    {
        $days = max(self::MIN_DAYS, min(self::MAX_DAYS, $days));

        $today = now()->startOfDay();
        $dates = collect(range(0, $days - 1))
            ->map(fn (int $back) => $today->copy()->subDays($back)->toDateString());

        $consultations = $this->query($dates->last(), $dates->first())->get();
        $salesByConsultation = $this->salesByConsultation($consultations->pluck('id'));
        $labOrdersByConsultation = $this->labOrdersByConsultation($consultations->pluck('id'));

        $byDay = $consultations
            ->map(fn (Consultation $c) => $this->summarize(
                $c,
                $salesByConsultation[$c->id] ?? null,
                $labOrdersByConsultation[$c->id] ?? null,
            ))
            ->groupBy('day');

        return [
            'today' => $dates->first(),
            'generated_at' => now()->toIso8601String(),
            'days' => $dates->map(fn (string $date) => [
                'date' => $date,
                'consultations' => $byDay->get($date, collect())
                    ->sortByDesc(fn (array $c) => [$c['closed_at'], $c['id']])
                    ->map(fn (array $c) => collect($c)->except('day')->all())
                    ->values()
                    ->all(),
            ])->all(),
        ];
    }

    /**
     * Completadas dentro del rango. Las que no tienen `completed_at` (importadas
     * o anteriores a la columna) cuentan por `fecha_consulta`.
     */
    private function query(string $fromDate, string $toDate)
    {
        return Consultation::query()
            ->select(self::COLUMNS)
            ->where('estado', ConsultationService::COMPLETED)
            ->where(function ($q) use ($fromDate, $toDate) {
                $q->whereBetween('completed_at', ["{$fromDate} 00:00:00", "{$toDate} 23:59:59"])
                    ->orWhere(function ($q) use ($fromDate, $toDate) {
                        $q->whereNull('completed_at')
                            ->whereDate('fecha_consulta', '>=', $fromDate)
                            ->whereDate('fecha_consulta', '<=', $toDate);
                    });
            })
            ->with([
                'patient:id,nombre,apellido,cedula,fecha_nacimiento',
                'optometrista:id,name',
                'diagnoses:id,consultation_id,eye,code,description,sort_order',
                'recommendationsList.catalogItem:id,label',
                'lensRecommendation.material:id,label',
                'lensRecommendation.thickness:id,label',
                'lensRecommendation.protection:id,label',
                'saleItems:id,consultation_id,orden,tipo,descripcion,total,nota',
            ]);
    }

    /** consultation_id => sale_id de la venta vigente mas reciente. */
    private function salesByConsultation(Collection $consultationIds): Collection
    {
        if ($consultationIds->isEmpty()) {
            return collect();
        }

        return Sale::query()
            ->whereIn('consultation_id', $consultationIds)
            ->whereNull('cancelled_at')
            ->orderBy('id')
            ->pluck('id', 'consultation_id');
    }

    /**
     * consultation_id => id de la orden de trabajo vigente mas reciente.
     *
     * Recepcion hace la orden desde la tarjeta de la consulta; con esto la
     * tarjeta dice "Orden creada" y no se hacen dos de la misma consulta.
     */
    private function labOrdersByConsultation(Collection $consultationIds): Collection
    {
        if ($consultationIds->isEmpty()) {
            return collect();
        }

        return LabOrder::query()
            ->whereIn('consultation_id', $consultationIds)
            ->where('status', '!=', 'cancelled')
            ->orderBy('id')
            ->pluck('id', 'consultation_id');
    }

    private function summarize(Consultation $c, ?int $saleId, ?int $labOrderId = null): array
    {
        $closedAt = $c->completed_at instanceof Carbon ? $c->completed_at : null;
        $day = ($closedAt ?? $c->fecha_consulta)?->toDateString();

        $lens = $c->lensRecommendation;

        return [
            'day' => $day,
            'id' => $c->id,
            'numero_consulta' => $c->numero_consulta,
            // Sin `completed_at` (importada) no hay hora: la tarjeta destacada
            // solo se arma con consultas que si la tienen.
            'closed_at' => $closedAt?->toIso8601String(),
            'sale_id' => $saleId,
            'lab_order_id' => $labOrderId,
            'patient' => [
                'id' => $c->patient?->id,
                'nombre_completo' => $c->patient?->nombre_completo,
                'cedula' => $c->patient?->cedula,
                'edad' => $c->patient?->edad,
            ],
            'doctor' => $c->optometrista?->name,
            'motivo' => $c->motivo_consulta,
            'rx' => [
                'od' => $this->eye($c, 'od'),
                'oi' => $this->eye($c, 'oi'),
                'observaciones' => $c->rx_final_observaciones,
            ],
            'av' => [
                'sc_od' => $c->avsc_od, 'sc_oi' => $c->avsc_oi,
                'cc_od' => $c->avcc_od, 'cc_oi' => $c->avcc_oi,
            ],
            // El registro estructurado manda; el texto de `luna_*` es lo que dejo
            // el sistema anterior (CLAUDE.md, gotcha 16).
            'lens' => [
                'material' => $lens?->material?->label ?: $c->luna_material,
                'espesor' => $lens?->thickness?->label ?: $c->luna_espesor,
                'proteccion' => $lens?->protection?->label ?: $c->luna_proteccion,
                'observacion' => $lens?->observation ?: $c->luna_observacion,
            ],
            'recommendations' => $this->recommendations($c),
            'diagnoses' => $this->diagnoses($c),
            'observaciones' => $c->observaciones,
            'sale_items' => $c->saleItems->map(fn ($i) => [
                'tipo' => $i->tipo,
                'descripcion' => $i->descripcion,
                'total' => $i->total,
                'nota' => $i->nota,
            ])->values()->all(),
        ];
    }

    private function eye(Consultation $c, string $eye): array
    {
        return [
            'esfera' => $c->{"rx_final_esfera_{$eye}"},
            'neutra' => (bool) $c->{"rx_final_esfera_{$eye}_neutral"},
            'cilindro' => $c->{"rx_final_cilindro_{$eye}"},
            // Texto en lugar de la medida ("COMP"): la columna queda en null.
            'esfera_texto' => $c->medidas_notas["rx_final_esfera_{$eye}"] ?? null,
            'cilindro_texto' => $c->medidas_notas["rx_final_cilindro_{$eye}"] ?? null,
            'eje' => $c->{"rx_final_eje_{$eye}"},
            'add' => $c->{"rx_final_add_{$eye}"},
            'av' => $c->{"rx_final_av_{$eye}"},
            'dnp' => $c->{"rx_final_dnp_{$eye}"},
        ];
    }

    private function recommendations(Consultation $c): array
    {
        $list = $c->recommendationsList
            ->map(fn ($r) => trim((string) ($r->text ?: $r->catalogItem?->label)))
            ->filter()
            ->values()
            ->all();

        if ($list === [] && filled($c->recomendaciones)) {
            return [trim($c->recomendaciones)];
        }

        return $list;
    }

    private function diagnoses(Consultation $c): array
    {
        $list = $c->diagnoses
            ->sortBy('sort_order')
            ->map(fn ($d) => [
                'eye' => $d->eye,
                'code' => $d->code,
                'description' => $d->description,
            ])
            ->filter(fn (array $d) => filled($d['code']) || filled($d['description']))
            ->values()
            ->all();

        if ($list === [] && (filled($c->diagnostico_cie10) || filled($c->diagnostico_descripcion))) {
            return [[
                'eye' => null,
                'code' => $c->diagnostico_cie10,
                'description' => $c->diagnostico_descripcion,
            ]];
        }

        return $list;
    }
}
