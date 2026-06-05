<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Expense extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'branch_id',
        'cash_register_session_id',
        'user_id',
        'approved_by',
        'category',
        'description',
        'amount',
        'receipt_number',
        'receipt_path',
        'expense_date',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'amount'       => 'decimal:2',
            'expense_date' => 'date',
        ];
    }

    // ─── Relationships ───────────────────────────────────────────────────────

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function cashRegisterSession(): BelongsTo
    {
        return $this->belongsTo(CashRegisterSession::class);
    }
}
