<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ConsultationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                   => $this->id,
            'numero_consulta'      => $this->numero_consulta,
            'estado'               => $this->estado,
            'estado_lentes'        => $this->estado_lentes,
            'fecha_consulta'       => $this->fecha_consulta?->toDateString(),
            'ultimo_control'       => $this->ultimo_control?->toDateString(),
            'motivo_consulta'      => $this->motivo_consulta,
            'doctor_license'       => $this->doctor_license,
            'print_template_key'   => $this->print_template_key,

            // Agudeza visual
            'av_lectura_od'        => $this->av_lectura_od,
            'av_lectura_oi'        => $this->av_lectura_oi,
            'avsc_od'              => $this->avsc_od,
            'avsc_oi'              => $this->avsc_oi,
            'avsc_cerca_od'        => $this->avsc_cerca_od,
            'avsc_cerca_oi'        => $this->avsc_cerca_oi,
            'avcc_od'              => $this->avcc_od,
            'avcc_oi'              => $this->avcc_oi,
            'avcc_cerca_od'        => $this->avcc_cerca_od,
            'avcc_cerca_oi'        => $this->avcc_cerca_oi,

            // Retinoscopia
            'retinoscopia_od'         => $this->retinoscopia_od,
            'retinoscopia_oi'         => $this->retinoscopia_oi,
            'retinoscopia_esfera_od'  => $this->retinoscopia_esfera_od,
            'retinoscopia_esfera_oi'  => $this->retinoscopia_esfera_oi,
            'retinoscopia_cilindro_od'=> $this->retinoscopia_cilindro_od,
            'retinoscopia_cilindro_oi'=> $this->retinoscopia_cilindro_oi,
            'retinoscopia_eje_od'     => $this->retinoscopia_eje_od,
            'retinoscopia_eje_oi'     => $this->retinoscopia_eje_oi,
            'retinoscopia_ppc'        => $this->retinoscopia_ppc,

            // RX en uso
            'rx_uso_esfera_od'   => $this->rx_uso_esfera_od,
            'rx_uso_cilindro_od' => $this->rx_uso_cilindro_od,
            'rx_uso_eje_od'      => $this->rx_uso_eje_od,
            'rx_uso_add_od'      => $this->rx_uso_add_od,
            'rx_uso_avcc_od'     => $this->rx_uso_avcc_od,
            'rx_uso_esfera_oi'   => $this->rx_uso_esfera_oi,
            'rx_uso_cilindro_oi' => $this->rx_uso_cilindro_oi,
            'rx_uso_eje_oi'      => $this->rx_uso_eje_oi,
            'rx_uso_add_oi'      => $this->rx_uso_add_oi,
            'rx_uso_avcc_oi'     => $this->rx_uso_avcc_oi,

            // Subjetivo
            'subj_esfera_od'    => $this->subj_esfera_od,
            'subj_cilindro_od'  => $this->subj_cilindro_od,
            'subj_eje_od'       => $this->subj_eje_od,
            'subj_avl_od'       => $this->subj_avl_od,
            'subj_tipo_od'      => $this->subj_tipo_od,
            'subj_esfera_oi'    => $this->subj_esfera_oi,
            'subj_cilindro_oi'  => $this->subj_cilindro_oi,
            'subj_eje_oi'       => $this->subj_eje_oi,
            'subj_avl_oi'       => $this->subj_avl_oi,
            'subj_tipo_oi'      => $this->subj_tipo_oi,
            'subj_add_od'       => $this->subj_add_od,
            'subj_add_oi'       => $this->subj_add_oi,
            'subj_avc_od'       => $this->subj_avc_od,
            'subj_avc_oi'       => $this->subj_avc_oi,
            'subj_dp'           => $this->subj_dp,

            // RX final
            'rx_final_esfera_od'    => $this->rx_final_esfera_od,
            'rx_final_cilindro_od'  => $this->rx_final_cilindro_od,
            'rx_final_eje_od'       => $this->rx_final_eje_od,
            'rx_final_add_od'       => $this->rx_final_add_od,
            'rx_final_avl_od'       => $this->rx_final_avl_od,
            'rx_final_prisma_od'    => $this->rx_final_prisma_od,
            'rx_final_base_od'      => $this->rx_final_base_od,
            'rx_final_dnp_od'       => $this->rx_final_dnp_od,
            'rx_final_esfera_oi'    => $this->rx_final_esfera_oi,
            'rx_final_cilindro_oi'  => $this->rx_final_cilindro_oi,
            'rx_final_eje_oi'       => $this->rx_final_eje_oi,
            'rx_final_add_oi'       => $this->rx_final_add_oi,
            'rx_final_avl_oi'       => $this->rx_final_avl_oi,
            'rx_final_prisma_oi'    => $this->rx_final_prisma_oi,
            'rx_final_base_oi'      => $this->rx_final_base_oi,
            'rx_final_dnp_oi'       => $this->rx_final_dnp_oi,

            // Visión de cerca
            'vc_esfera_od'  => $this->vc_esfera_od,
            'vc_cilindro_od'=> $this->vc_cilindro_od,
            'vc_eje_od'     => $this->vc_eje_od,
            'vc_av_od'      => $this->vc_av_od,
            'vc_dnp_od'     => $this->vc_dnp_od,
            'vc_avcc_od'    => $this->vc_avcc_od,
            'vc_esfera_oi'  => $this->vc_esfera_oi,
            'vc_cilindro_oi'=> $this->vc_cilindro_oi,
            'vc_eje_oi'     => $this->vc_eje_oi,
            'vc_av_oi'      => $this->vc_av_oi,
            'vc_dnp_oi'     => $this->vc_dnp_oi,
            'vc_avcc_oi'    => $this->vc_avcc_oi,
            'near_vision_data' => $this->near_vision_data,

            // Queratometría
            'queratometria_od'           => $this->queratometria_od,
            'queratometria_oi'           => $this->queratometria_oi,
            'queratometria_horizontal_od'=> $this->queratometria_horizontal_od,
            'queratometria_horizontal_oi'=> $this->queratometria_horizontal_oi,
            'queratometria_vertical_od'  => $this->queratometria_vertical_od,
            'queratometria_vertical_oi'  => $this->queratometria_vertical_oi,
            'queratometria_eje_od'       => $this->queratometria_eje_od,
            'queratometria_eje_oi'       => $this->queratometria_eje_oi,
            'queratometria_miras_od'     => $this->queratometria_miras_od,
            'queratometria_miras_oi'     => $this->queratometria_miras_oi,
            'queratometria_calificacion' => $this->queratometria_calificacion,

            // Examen externo / misceláneos
            'lente_anterior'        => $this->lente_anterior,
            'examen_externo_od'     => $this->examen_externo_od,
            'examen_externo_oi'     => $this->examen_externo_oi,
            'vision_colores'        => $this->vision_colores,
            'ark_od'                => $this->ark_od,
            'ark_oi'                => $this->ark_oi,
            'morfoscopica_lejos_od' => $this->morfoscopica_lejos_od,
            'morfoscopica_lejos_oi' => $this->morfoscopica_lejos_oi,
            'morfoscopica_cerca_od' => $this->morfoscopica_cerca_od,
            'morfoscopica_cerca_oi' => $this->morfoscopica_cerca_oi,
            'ph_od'                 => $this->ph_od,
            'ph_oi'                 => $this->ph_oi,

            // Certificado
            'certificado_diagnostico_od' => $this->certificado_diagnostico_od,
            'certificado_diagnostico_oi' => $this->certificado_diagnostico_oi,
            'certificado_nota'           => $this->certificado_nota,

            // Pruebas binoculares
            'ducciones_od'       => $this->ducciones_od,
            'ducciones_oi'       => $this->ducciones_oi,
            'versiones'          => $this->versiones,
            'ppc'                => $this->ppc,
            'cover_test'         => $this->cover_test,
            'reflejos_pupilares' => $this->reflejos_pupilares,
            'test_hirschberg'    => $this->test_hirschberg,
            'motor_binocular_data' => $this->motor_binocular_data,

            // Lunas
            'luna_material'    => $this->luna_material,
            'luna_espesor'     => $this->luna_espesor,
            'luna_proteccion'  => $this->luna_proteccion,
            'luna_observacion' => $this->luna_observacion,

            // Diagnóstico
            'diagnostico_cie10'        => $this->diagnostico_cie10,
            'diagnostico_descripcion'  => $this->diagnostico_descripcion,
            'diagnostico_adicional'    => $this->diagnostico_adicional,

            // Comercial / pedido
            'costo_total'          => $this->costo_total,
            'abono'                => $this->abono,
            'estado_cancelado'     => $this->estado_cancelado,
            'tipo_lentes'          => $this->tipo_lentes,
            'color_lentes'         => $this->color_lentes,
            'bifocal'              => $this->bifocal,
            'espesor'              => $this->espesor,
            'laboratorio_pedido'   => $this->laboratorio_pedido,
            'pedido_armazon'       => $this->pedido_armazon,
            'fecha_entrega'        => $this->fecha_entrega?->toDateString(),
            'observacion_pedidos'  => $this->observacion_pedidos,

            // Texto libre
            'recomendaciones' => $this->recomendaciones,
            'observaciones'   => $this->observaciones,

            // Auditoría — solo nombre, no IDs internos
            'created_by_name'  => $this->whenLoaded('creator', fn () => $this->creator?->name),
            'updated_by_name'  => $this->whenLoaded('updater', fn () => $this->updater?->name),

            // Timestamps
            'created_at' => $this->created_at->toISOString(),
            'updated_at' => $this->updated_at->toISOString(),

            // Consulta anterior (atributo dinámico inyectado por el controlador)
            'previous_consultation_summary' => $this->when(
                $this->relationLoaded('patient') || isset($this->attributes['previous_consultation_summary']),
                fn () => $this->getAttribute('previous_consultation_summary')
            ),

            // Relaciones (solo si están cargadas)
            'patient'     => $this->whenLoaded('patient', fn () => new PatientResource($this->patient)),
            'optometrista' => $this->whenLoaded('optometrista', fn () => [
                'id'               => $this->optometrista->id,
                'name'             => $this->optometrista->name,
                'codigo'           => $this->optometrista->codigo,
                'registro_senescyt'=> $this->optometrista->registro_senescyt,
                'firma_digital_url'=> $this->optometrista->firma_digital_url,
            ]),
            'diagnoses' => $this->whenLoaded('diagnoses', fn () => $this->diagnoses->map(fn ($d) => [
                'id'              => $d->id,
                'eye'             => $d->eye,
                'code'            => $d->code,
                'description'     => $d->description,
                'notes'           => $d->notes,
                'sort_order'      => $d->sort_order,
                'catalog_item'    => $d->relationLoaded('catalogItem') ? [
                    'id'    => $d->catalogItem?->id,
                    'label' => $d->catalogItem?->label,
                    'code'  => $d->catalogItem?->code,
                ] : null,
            ])),
            'recommendations_list' => $this->whenLoaded('recommendationsList', fn () => $this->recommendationsList->map(fn ($r) => [
                'id'           => $r->id,
                'text'         => $r->text,
                'sort_order'   => $r->sort_order,
                'catalog_item' => $r->relationLoaded('catalogItem') ? [
                    'id'    => $r->catalogItem?->id,
                    'label' => $r->catalogItem?->label,
                    'code'  => $r->catalogItem?->code,
                ] : null,
            ])),
            'lens_recommendation'  => $this->whenLoaded('lensRecommendation', fn () => $this->lensRecommendation ? [
                'material_item_id'   => $this->lensRecommendation->material_item_id,
                'thickness_item_id'  => $this->lensRecommendation->thickness_item_id,
                'protection_item_id' => $this->lensRecommendation->protection_item_id,
                'observation'        => $this->lensRecommendation->observation,
                'material'           => $this->lensRecommendation->relationLoaded('material')
                                        ? ['id' => $this->lensRecommendation->material?->id, 'label' => $this->lensRecommendation->material?->label]
                                        : null,
                'thickness'          => $this->lensRecommendation->relationLoaded('thickness')
                                        ? ['id' => $this->lensRecommendation->thickness?->id, 'label' => $this->lensRecommendation->thickness?->label]
                                        : null,
                'protection'         => $this->lensRecommendation->relationLoaded('protection')
                                        ? ['id' => $this->lensRecommendation->protection?->id, 'label' => $this->lensRecommendation->protection?->label]
                                        : null,
            ] : null),
            'contact_lens_module'  => $this->whenLoaded('contactLensModule', fn () => $this->contactLensModule),
            'ophthalmoscopy_module'=> $this->whenLoaded('ophthalmoscopyModule', fn () => $this->ophthalmoscopyModule),
            'treatment_module'     => $this->whenLoaded('treatmentModule', fn () => $this->treatmentModule),
        ];
    }
}
