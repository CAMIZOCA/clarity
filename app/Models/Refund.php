<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Refund extends Model
{
    protected $fillable = [
        'refund_number',
        'sale_id',
        'authorized_by',
        'processed_by',
        'reason',
        'reason_detail',
        'items',
        'refund_amount',
        'refund_method',
        'reference',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'refund_amount' => 'decimal:2',
            'items'         => 'array',
        ];
    }

    /**
     * Auto-generate refund_number on creating.
     */
    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (Refund $refund) {
            if (empty($refund->refund_number)) {
                $year = now()->year;
                $last = static::whereYear('created_at', $year)
                    ->orderByDesc('id')
                    ->lockForUpdate()
                    ->first();
                $sequence = $last ? ((int) substr($last->refund_number, -5)) + 1 : 1;
                $refund->refund_number = 'DEV-' . $year . '-' . str_pad($sequence, 5, '0', STR_PAD_LEFT);
            }
        });
    }

    // ─── Relationships ───────────────────────────────────────────────────────

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function authorizedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'authorized_by');
    }

    public function processedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by');
    }
}
