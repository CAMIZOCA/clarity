<?php

namespace App\Services;

use App\Models\CertifyingDoctor;
use App\Models\ClinicalCatalogItem;
use App\Models\Consultation;
use App\Models\PrintTemplate;
use Illuminate\Support\Arr;

class ConsultationService extends BaseService
{
    /** Campos de esfera que aceptan el literal "N" (neutro) ademas de un numero. */
    private const NEUTRAL_SPHERE_FIELDS = [
        'rx_uso_esfera_od', 'rx_uso_esfera_oi',
        'subj_esfera_od', 'subj_esfera_oi',
        'rx_final_esfera_od', 'rx_final_esfera_oi',
        'vc_esfera_od', 'vc_esfera_oi',
    ];

    /**
     * Crear una nueva consulta junto con todos sus sub-módulos.
     * Preserva exactamente la lógica de ConsultationController@store.
     */
    public function create(array $data, int $userId): Consultation
    {
        return $this->transaction(function () use ($data, $userId) {
            $attributes = $this->extractConsultationAttributes($data);
            $attributes['optometrista_id'] = $attributes['optometrista_id'] ?? $userId;
            $attributes['created_by'] = $userId;
            $attributes['updated_by'] = $userId;

            $consultation = Consultation::create($attributes);
            $this->syncModules($consultation, $data);

            $this->logActivity('consultation_created', $consultation, [
                'patient_id' => $consultation->patient_id,
                'numero_consulta' => $consultation->numero_consulta,
            ]);

            return $consultation;
        });
    }

    /**
     * Actualizar una consulta existente y todos sus sub-módulos.
     * Preserva exactamente la lógica de ConsultationController@update.
     */
    public function update(Consultation $consultation, array $data, int $userId): Consultation
    {
        return $this->transaction(function () use ($consultation, $data, $userId) {
            $attributes = $this->extractConsultationAttributes($data);
            $attributes['updated_by'] = $userId;

            $consultation->update($attributes);
            $this->syncModules($consultation, $data);

            $this->logActivity('consultation_updated', $consultation, [
                'patient_id' => $consultation->patient_id,
                'numero_consulta' => $consultation->numero_consulta,
            ]);

            return $consultation;
        });
    }

    /**
     * Eliminar (soft delete) una consulta con auditoría.
     */
    public function delete(Consultation $consultation): bool
    {
        return $this->transaction(function () use ($consultation) {
            $this->logActivity('consultation_deleted', $consultation, [
                'patient_id' => $consultation->patient_id,
                'numero_consulta' => $consultation->numero_consulta,
            ]);

            return (bool) $consultation->delete();
        });
    }

    /**
     * Retorna array de datos para generar el PDF de una consulta.
     * Preserva exactamente la lógica de ConsultationController@pdfData.
     */
    public function generatePdfData(Consultation $consultation): array
    {
        $consultation = $this->loadConsultation($consultation);

        return [
            'consultation' => $consultation,
            'patient' => $consultation->patient,
            'optometrista' => $consultation->optometrista ? array_merge(
                $consultation->optometrista->toArray(),
                ['firma_digital_url' => $consultation->optometrista->firma_digital_url]
            ) : null,
            'templates' => PrintTemplate::query()
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->get(['id', 'key', 'name', 'description']),
            'certifying_doctors' => CertifyingDoctor::query()
                ->where('is_active', true)
                ->orderByDesc('is_default')
                ->orderBy('nombre')
                ->get(),
        ];
    }

    /**
     * Cargar todas las relaciones necesarias de una consulta y calcular
     * la consulta anterior del mismo paciente.
     * Preserva exactamente la lógica de ConsultationController::loadConsultation().
     */
    public function loadConsultation(Consultation $consultation): Consultation
    {
        $consultation->load([
            'patient',
            'optometrista',
            'creator:id,name',
            'updater:id,name',
            'rxUsoEntries',
            'saleItems',
            'diagnoses.catalogItem:id,label,code',
            'recommendationsList.catalogItem:id,label,code',
            'lensRecommendation.material:id,label',
            'lensRecommendation.thickness:id,label',
            'lensRecommendation.protection:id,label',
            'contactLensModule',
            'ophthalmoscopyModule',
            'treatmentModule',
        ]);

        $consultation->patient?->append('edad');

        $previous = Consultation::query()
            ->where('patient_id', $consultation->patient_id)
            ->where('id', '!=', $consultation->id)
            ->whereDate('fecha_consulta', '<=', $consultation->fecha_consulta)
            ->orderByDesc('fecha_consulta')
            ->orderByDesc('id')
            ->first([
                'id',
                'numero_consulta',
                'fecha_consulta',
                'diagnostico_cie10',
                'diagnostico_descripcion',
                'rx_final_esfera_od',
                'rx_final_cilindro_od',
                'rx_final_eje_od',
                'rx_final_esfera_oi',
                'rx_final_cilindro_oi',
                'rx_final_eje_oi',
                'observaciones',
            ]);

        $consultation->setAttribute('previous_consultation_summary', $previous);

        return $consultation;
    }

    // -------------------------------------------------------------------------
    // Métodos privados de soporte (misma lógica que el controlador)
    // -------------------------------------------------------------------------

    /**
     * Extraer solo los atributos de la consulta principal,
     * excluyendo los sub-módulos que van a tablas relacionadas.
     */
    private function extractConsultationAttributes(array $data): array
    {
        $attributes = Arr::except($data, [
            'rx_uso_entries',
            'diagnoses',
            'recommendations_list',
            'lens_recommendation',
            'contact_lens_module',
            'ophthalmoscopy_module',
            'treatment_module',
            'sale_items',
        ]);

        return $this->applyNeutralSphereFlags($attributes);
    }

    /**
     * Separa un valor de esfera "N" (neutro) en `[columna decimal, flag boolean]`.
     *
     * La columna sigue siendo decimal|null; el flag indica que el valor
     * mostrado debe ser el literal "N", no un cero.
     */
    private function applyNeutralSphereFlags(array $attributes): array
    {
        foreach (self::NEUTRAL_SPHERE_FIELDS as $field) {
            if (! array_key_exists($field, $attributes)) {
                continue;
            }

            $isNeutral = is_string($attributes[$field]) && strtoupper(trim($attributes[$field])) === 'N';
            $attributes["{$field}_neutral"] = $isNeutral;
            $attributes[$field] = $isNeutral ? null : $attributes[$field];
        }

        return $attributes;
    }

    /**
     * Sincronizar todos los sub-módulos de una consulta.
     * Preserva exactamente la lógica de ConsultationController::syncModules().
     */
    private function syncModules(Consultation $consultation, array $data): void
    {
        // --- RX en uso (0..N recetas, cada una con observación) ---
        if (array_key_exists('rx_uso_entries', $data)) {
            $consultation->rxUsoEntries()->delete();

            $columns = ['esfera', 'cilindro', 'eje', 'add', 'avcc'];

            $entries = collect($data['rx_uso_entries'] ?? [])
                ->filter(function ($entry) use ($columns) {
                    if (! is_array($entry)) {
                        return false;
                    }
                    foreach ($columns as $column) {
                        foreach (['od', 'oi'] as $eye) {
                            if (filled($entry["{$column}_{$eye}"] ?? null)) {
                                return true;
                            }
                        }
                    }

                    return filled($entry['observacion'] ?? null);
                })
                ->values();

            foreach ($entries as $index => $entry) {
                $payload = ['orden' => $index];

                foreach ($columns as $column) {
                    foreach (['od', 'oi'] as $eye) {
                        $key = "{$column}_{$eye}";
                        $value = $entry[$key] ?? null;
                        $payload[$key] = $value === '' ? null : $value;
                    }
                }

                $payload['observacion'] = $entry['observacion'] ?? null;

                foreach (['esfera_od', 'esfera_oi'] as $sphereKey) {
                    $isNeutral = is_string($payload[$sphereKey]) && strtoupper(trim($payload[$sphereKey])) === 'N';
                    $payload["{$sphereKey}_neutral"] = $isNeutral;
                    $payload[$sphereKey] = $isNeutral ? null : $payload[$sphereKey];
                }

                $consultation->rxUsoEntries()->create($payload);
            }

            // La primera receta se refleja en las columnas planas heredadas, de
            // las que siguen dependiendo el PDF, los reportes y la importación.
            $first = $entries->first();
            $legacy = [];
            foreach ($columns as $column) {
                foreach (['od', 'oi'] as $eye) {
                    $value = $first["{$column}_{$eye}"] ?? null;
                    $legacy["rx_uso_{$column}_{$eye}"] = $value === '' ? null : $value;
                }
            }

            $consultation->forceFill($this->applyNeutralSphereFlags($legacy))->save();
        }

        // --- Diagnósticos ---
        if (array_key_exists('diagnoses', $data)) {
            $consultation->diagnoses()->delete();

            $diagnoses = collect($data['diagnoses'] ?? [])
                ->filter(fn ($item) => filled($item['description'] ?? null))
                ->values();

            foreach ($diagnoses as $index => $diagnosis) {
                $consultation->diagnoses()->create([
                    'catalog_item_id' => $diagnosis['catalog_item_id'] ?? null,
                    'eye' => $diagnosis['eye'] ?? 'general',
                    'code' => $diagnosis['code'] ?? null,
                    'description' => $diagnosis['description'],
                    'notes' => $diagnosis['notes'] ?? null,
                    'sort_order' => $index + 1,
                ]);
            }

            $legacy = $diagnoses->first();
            $consultation->forceFill([
                'diagnostico_cie10' => $legacy['code'] ?? null,
                'diagnostico_descripcion' => $legacy['description'] ?? null,
            ])->save();
        }

        // --- Recomendaciones ---
        if (array_key_exists('recommendations_list', $data)) {
            $consultation->recommendationsList()->delete();

            $recommendations = collect($data['recommendations_list'] ?? [])
                ->filter(fn ($item) => filled($item['text'] ?? null))
                ->values();

            foreach ($recommendations as $index => $recommendation) {
                $consultation->recommendationsList()->create([
                    'catalog_item_id' => $recommendation['catalog_item_id'] ?? null,
                    'text' => $recommendation['text'],
                    'sort_order' => $index + 1,
                ]);
            }

            $consultation->forceFill([
                'recomendaciones' => $recommendations->pluck('text')->implode("\n"),
            ])->save();
        }

        // --- Recomendación de lentes ---
        if (array_key_exists('lens_recommendation', $data)) {
            $payload = Arr::whereNotNull($data['lens_recommendation'] ?? []);
            $consultation->lensRecommendation()->updateOrCreate(
                ['consultation_id' => $consultation->id],
                $payload
            );

            $itemLabels = ClinicalCatalogItem::query()
                ->whereIn('id', array_filter([
                    $payload['material_item_id'] ?? null,
                    $payload['thickness_item_id'] ?? null,
                    $payload['protection_item_id'] ?? null,
                ]))
                ->pluck('label', 'id');

            $consultation->forceFill([
                'luna_material' => $itemLabels[$payload['material_item_id'] ?? 0] ?? null,
                'luna_espesor' => $itemLabels[$payload['thickness_item_id'] ?? 0] ?? null,
                'luna_proteccion' => $itemLabels[$payload['protection_item_id'] ?? 0] ?? null,
                'luna_observacion' => $payload['observation'] ?? null,
            ])->save();
        }

        // --- Módulo de lentes de contacto ---
        if (array_key_exists('contact_lens_module', $data)) {
            $consultation->contactLensModule()->updateOrCreate(
                ['consultation_id' => $consultation->id],
                $data['contact_lens_module'] ?? []
            );
        }

        // --- Módulo de oftalmoscopia ---
        if (array_key_exists('ophthalmoscopy_module', $data)) {
            $consultation->ophthalmoscopyModule()->updateOrCreate(
                ['consultation_id' => $consultation->id],
                $data['ophthalmoscopy_module'] ?? []
            );
        }

        // --- Módulo de tratamiento ---
        if (array_key_exists('treatment_module', $data)) {
            $consultation->treatmentModule()->updateOrCreate(
                ['consultation_id' => $consultation->id],
                $data['treatment_module'] ?? []
            );
        }

        // --- Venta / productos vendidos (informativo, no impacta caja) ---
        if (array_key_exists('sale_items', $data)) {
            $consultation->saleItems()->delete();

            $items = collect($data['sale_items'] ?? [])
                ->filter(fn ($item) => is_array($item) && filled($item['descripcion'] ?? null))
                ->values();

            foreach ($items as $index => $item) {
                $consultation->saleItems()->create([
                    'orden' => $index,
                    'tipo' => $item['tipo'] ?? 'otro',
                    'descripcion' => $item['descripcion'],
                    'precio' => $item['precio'] ?? 0,
                    'descuento_pct' => $item['descuento_pct'] ?? 0,
                    'total' => $item['total'] ?? 0,
                    'nota' => $item['nota'] ?? null,
                ]);
            }
        }
    }
}
