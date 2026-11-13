<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Una correccion aplicada desde "Revision de datos heredados". Los valores que
 * cambio estan en `consultation_legacy_repairs` con este `batch_id`.
 */
class LegacyReviewBatch extends Model
{
    protected $fillable = [
        'user_id', 'case_key', 'consultations', 'changes', 'backup_operation_id',
        'reverted_at', 'reverted_by', 'revert_summary',
    ];

    protected function casts(): array
    {
        return [
            'consultations' => 'integer',
            'changes' => 'integer',
            'reverted_at' => 'datetime',
            'revert_summary' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function revertedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reverted_by');
    }
}
