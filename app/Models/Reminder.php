<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Reminder extends Model
{
    protected $fillable = [
        'patient_id',
        'template_id',
        'created_by',
        'type',
        'channel',
        'message',
        'status',
        'scheduled_at',
        'sent_at',
        'error_message',
        'reference_type',
        'reference_id',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_at' => 'datetime',
            'sent_at'      => 'datetime',
        ];
    }

    // ─── Relationships ────────────────────────────────────────────────────────

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(MessageTemplate::class, 'template_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function reference(): MorphTo
    {
        return $this->morphTo('reference', 'reference_type', 'reference_id');
    }

    // ─── Scopes ───────────────────────────────────────────────────────────────

    /**
     * Recordatorios pendientes cuyo scheduled_at ya llegó.
     */
    public function scopePending(Builder $query): Builder
    {
        return $query->where('status', 'pending')
                     ->where('scheduled_at', '<=', now());
    }

    /**
     * Recordatorios programados para hoy.
     */
    public function scopeForToday(Builder $query): Builder
    {
        return $query->whereBetween('scheduled_at', [
            now()->startOfDay(),
            now()->endOfDay(),
        ]);
    }
}
