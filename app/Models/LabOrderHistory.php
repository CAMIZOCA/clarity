<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LabOrderHistory extends Model
{
    /**
     * LabOrderHistory does not use updated_at.
     */
    public $timestamps = false;

    protected $fillable = [
        'lab_order_id',
        'user_id',
        'old_status',
        'new_status',
        'notes',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }

    // ─── Relationships ───────────────────────────────────────────────────────

    public function labOrder(): BelongsTo
    {
        return $this->belongsTo(LabOrder::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
