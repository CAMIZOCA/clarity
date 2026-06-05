<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    /**
     * Payment does not use updated_at.
     */
    public $timestamps = false;

    protected $fillable = [
        'sale_id',
        'cash_register_session_id',
        'processed_by',
        'method',
        'amount',
        'reference',
        'bank_name',
        'card_last_four',
        'payment_type',
        'notes',
        'processed_at',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'amount'       => 'decimal:2',
            'processed_at' => 'datetime',
            'created_at'   => 'datetime',
        ];
    }

    // ─── Relationships ───────────────────────────────────────────────────────

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function processedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by');
    }

    public function cashRegisterSession(): BelongsTo
    {
        return $this->belongsTo(CashRegisterSession::class);
    }
}
