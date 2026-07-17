<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class Certificate extends Model
{
    protected $fillable = [
        'consultation_id',
        'patient_id',
        'branch_id',
        'certifying_doctor_id',
        'numero_consulta',
        'pdf_path',
        'recipient_email',
        'subject',
        'status',
        'sent_at',
        'error_message',
        'created_by',
    ];

    protected $casts = [
        'sent_at' => 'datetime',
    ];

    protected $appends = ['pdf_url'];

    public function getPdfUrlAttribute(): ?string
    {
        return $this->pdf_path ? Storage::disk('public')->url($this->pdf_path) : null;
    }

    public function consultation(): BelongsTo
    {
        return $this->belongsTo(Consultation::class);
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function certifyingDoctor(): BelongsTo
    {
        return $this->belongsTo(CertifyingDoctor::class);
    }
}
