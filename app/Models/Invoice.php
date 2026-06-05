<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Invoice extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'sale_id',
        'branch_id',
        'created_by',
        'establishment',
        'emission_point',
        'sequential',
        'access_key',
        'authorization_number',
        'issuer_ruc',
        'issuer_name',
        'issuer_address',
        'buyer_cedula_ruc',
        'buyer_name',
        'buyer_address',
        'buyer_email',
        'subtotal_0',
        'subtotal_12',
        'subtotal_15',
        'iva_amount',
        'total',
        'iva_rate',
        'status',
        'type',
        'issue_date',
        'authorized_at',
        'rejection_reason',
        'xml_content',
        'pdf_path',
    ];

    protected function casts(): array
    {
        return [
            'subtotal_0'    => 'decimal:2',
            'subtotal_12'   => 'decimal:2',
            'subtotal_15'   => 'decimal:2',
            'iva_amount'    => 'decimal:2',
            'total'         => 'decimal:2',
            'iva_rate'      => 'decimal:2',
            'issue_date'    => 'date',
            'authorized_at' => 'datetime',
        ];
    }

    // ─── Relationships ───────────────────────────────────────────────────────

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    // ─── Accessors ───────────────────────────────────────────────────────────

    /**
     * Número de factura completo en formato SRI: "001-001-000000001"
     */
    public function getFullNumberAttribute(): string
    {
        return "{$this->establishment}-{$this->emission_point}-{$this->sequential}";
    }

    // ─── Scopes ──────────────────────────────────────────────────────────────

    /**
     * Facturas autorizadas por el SRI.
     */
    public function scopeAuthorized($query)
    {
        return $query->where('status', 'authorized');
    }

    /**
     * Facturas pendientes de procesar (borrador, firmadas o enviadas).
     */
    public function scopePending($query)
    {
        return $query->whereIn('status', ['draft', 'signed', 'sent']);
    }
}
