<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Campaign extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'channel',
        'template_id',
        'message_body',
        'segment_criteria',
        'status',
        'scheduled_at',
        'started_at',
        'completed_at',
        'total_recipients',
        'sent_count',
        'failed_count',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'segment_criteria' => 'array',
            'scheduled_at'     => 'datetime',
            'started_at'       => 'datetime',
            'completed_at'     => 'datetime',
        ];
    }

    // ─── Relationships ────────────────────────────────────────────────────────

    public function template(): BelongsTo
    {
        return $this->belongsTo(MessageTemplate::class, 'template_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function sends(): HasMany
    {
        return $this->hasMany(CampaignSend::class);
    }
}
