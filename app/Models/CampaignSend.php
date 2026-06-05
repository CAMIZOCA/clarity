<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CampaignSend extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'campaign_id',
        'patient_id',
        'message_sent',
        'status',
        'sent_at',
        'error_message',
    ];

    protected function casts(): array
    {
        return [
            'sent_at'    => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    // ─── Relationships ────────────────────────────────────────────────────────

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }
}
