<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CashRegisterSession extends Model
{
    protected $fillable = [
        'cash_register_id',
        'opened_by',
        'closed_by',
        'opened_at',
        'closed_at',
        'opening_amount',
        'total_sales',
        'total_cash',
        'total_card',
        'total_transfer',
        'total_credit',
        'total_refunds',
        'total_expenses',
        'expected_cash',
        'actual_cash',
        'difference',
        'status',
        'closing_notes',
        'denomination_count',
    ];

    protected function casts(): array
    {
        return [
            'opening_amount'    => 'decimal:2',
            'total_sales'       => 'decimal:2',
            'total_cash'        => 'decimal:2',
            'total_card'        => 'decimal:2',
            'total_transfer'    => 'decimal:2',
            'total_credit'      => 'decimal:2',
            'total_refunds'     => 'decimal:2',
            'total_expenses'    => 'decimal:2',
            'expected_cash'     => 'decimal:2',
            'actual_cash'       => 'decimal:2',
            'difference'        => 'decimal:2',
            'opened_at'         => 'datetime',
            'closed_at'         => 'datetime',
            'denomination_count' => 'array',
        ];
    }

    // ─── Accessors ───────────────────────────────────────────────────────────

    /**
     * Diferencia entre el efectivo esperado y el efectivo contado.
     * Valor positivo → sobrante; valor negativo → faltante.
     */
    public function getDifferenceAttribute(): ?float
    {
        if ($this->actual_cash === null) {
            return null;
        }

        return (float) $this->expected_cash - (float) $this->actual_cash;
    }

    // ─── Relationships ───────────────────────────────────────────────────────

    public function cashRegister(): BelongsTo
    {
        return $this->belongsTo(CashRegister::class);
    }

    public function openedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'opened_by');
    }

    public function closedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(Expense::class);
    }
}
