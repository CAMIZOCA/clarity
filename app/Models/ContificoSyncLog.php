<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Prunable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Historial de envios a Contifico (ver ContificoService).
 */
class ContificoSyncLog extends Model
{
    use Prunable;

    public const ACTION_CREATE = 'create';

    public const ACTION_LINK = 'link';

    public const ACTION_TEST = 'test';

    public const STATUS_SUCCESS = 'success';

    public const STATUS_FAILED = 'failed';

    public const STATUS_SKIPPED = 'skipped';

    /** Dias que se conserva el historial antes de podarse (`model:prune`). */
    public const RETENTION_DAYS = 90;

    protected $fillable = [
        'patient_id',
        'user_id',
        'action',
        'status',
        'http_status',
        'contifico_id',
        'payload',
        'message',
        'attempt',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
        ];
    }

    public function prunable(): Builder
    {
        return static::where('created_at', '<', now()->subDays(self::RETENTION_DAYS));
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class)->withTrashed();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
