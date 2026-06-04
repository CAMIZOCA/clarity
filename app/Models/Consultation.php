<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Consultation extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'numero_consulta', 'patient_id', 'optometrista_id', 'created_by', 'updated_by',
        'legacy_id',
        'fecha_consulta', 'estado', 'estado_lentes', 'motivo_consulta', 'ultimo_control', 'doctor_license', 'print_template_key',
        // Agudeza visual
        'av_lectura_od', 'av_lectura_oi', 'avsc_od', 'avsc_oi', 'avsc_cerca_od', 'avsc_cerca_oi',
        'retinoscopia_od', 'retinoscopia_oi', 'avcc_od', 'avcc_oi', 'avcc_cerca_od', 'avcc_cerca_oi',
        // Retinoscopia por componentes
        'retinoscopia_esfera_od', 'retinoscopia_esfera_oi',
        'retinoscopia_cilindro_od', 'retinoscopia_cilindro_oi',
        'retinoscopia_eje_od', 'retinoscopia_eje_oi', 'retinoscopia_ppc',
        // RX en uso
        'rx_uso_esfera_od', 'rx_uso_cilindro_od', 'rx_uso_eje_od', 'rx_uso_add_od', 'rx_uso_avcc_od',
        'rx_uso_esfera_oi', 'rx_uso_cilindro_oi', 'rx_uso_eje_oi', 'rx_uso_add_oi', 'rx_uso_avcc_oi',
        // Subjetivo / LC
        'subj_esfera_od', 'subj_cilindro_od', 'subj_eje_od', 'subj_avl_od', 'subj_tipo_od',
        'subj_esfera_oi', 'subj_cilindro_oi', 'subj_eje_oi', 'subj_avl_oi', 'subj_tipo_oi',
        'subj_add_od', 'subj_add_oi', 'subj_avc_od', 'subj_avc_oi', 'subj_dp',
        // RX final
        'rx_final_esfera_od', 'rx_final_cilindro_od', 'rx_final_eje_od', 'rx_final_add_od',
        'rx_final_avl_od', 'rx_final_prisma_od', 'rx_final_base_od', 'rx_final_dnp_od',
        'rx_final_esfera_oi', 'rx_final_cilindro_oi', 'rx_final_eje_oi', 'rx_final_add_oi',
        'rx_final_avl_oi', 'rx_final_prisma_oi', 'rx_final_base_oi', 'rx_final_dnp_oi',
        // Vision de cerca
        'vc_esfera_od', 'vc_cilindro_od', 'vc_eje_od', 'vc_av_od', 'vc_dnp_od', 'vc_avcc_od',
        'vc_esfera_oi', 'vc_cilindro_oi', 'vc_eje_oi', 'vc_av_oi', 'vc_dnp_oi', 'vc_avcc_oi',
        'near_vision_data',
        // Otros bloques
        'lente_anterior', 'queratometria_od', 'queratometria_oi',
        'queratometria_horizontal_od', 'queratometria_horizontal_oi',
        'queratometria_vertical_od', 'queratometria_vertical_oi',
        'queratometria_eje_od', 'queratometria_eje_oi',
        'queratometria_miras_od', 'queratometria_miras_oi', 'queratometria_calificacion',
        'examen_externo_od', 'examen_externo_oi', 'vision_colores',
        'ark_od', 'ark_oi',
        'morfoscopica_lejos_od', 'morfoscopica_lejos_oi', 'morfoscopica_cerca_od', 'morfoscopica_cerca_oi',
        'ph_od', 'ph_oi',
        'certificado_diagnostico_od', 'certificado_diagnostico_oi', 'certificado_nota',
        // Pruebas binoculares
        'ducciones_od', 'ducciones_oi', 'versiones', 'ppc', 'cover_test', 'reflejos_pupilares', 'test_hirschberg',
        'motor_binocular_data',
        // Lunas
        'luna_material', 'luna_espesor', 'luna_proteccion', 'luna_observacion',
        // Diagnóstico
        'diagnostico_cie10', 'diagnostico_descripcion', 'diagnostico_adicional',
        // Datos comerciales / pedido
        'costo_total', 'abono', 'estado_cancelado',
        'tipo_lentes', 'color_lentes', 'bifocal', 'espesor',
        'laboratorio_pedido', 'pedido_armazon', 'fecha_entrega', 'observacion_pedidos',
        // Texto libre
        'recomendaciones', 'observaciones',
    ];

    protected function casts(): array
    {
        return [
            'fecha_consulta' => 'date:Y-m-d',
            'ultimo_control' => 'date:Y-m-d',
            'fecha_entrega' => 'date:Y-m-d',
            'estado_cancelado' => 'boolean',
            'motor_binocular_data' => 'array',
            'near_vision_data' => 'array',
        ];
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (self $model) {
            $model->numero_consulta = static::where('patient_id', $model->patient_id)
                ->withTrashed()
                ->count() + 1;
        });
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function optometrista(): BelongsTo
    {
        return $this->belongsTo(User::class, 'optometrista_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function diagnoses(): HasMany
    {
        return $this->hasMany(ConsultationDiagnosis::class)->orderBy('sort_order');
    }

    public function recommendationsList(): HasMany
    {
        return $this->hasMany(ConsultationRecommendation::class)->orderBy('sort_order');
    }

    public function lensRecommendation(): HasOne
    {
        return $this->hasOne(ConsultationLensRecommendation::class);
    }

    public function contactLensModule(): HasOne
    {
        return $this->hasOne(ConsultationContactLensModule::class);
    }

    public function ophthalmoscopyModule(): HasOne
    {
        return $this->hasOne(ConsultationOphthalmoscopyModule::class);
    }

    public function treatmentModule(): HasOne
    {
        return $this->hasOne(ConsultationTreatmentModule::class);
    }
}
