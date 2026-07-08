<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class MaintenanceOperation extends Model
{
    protected $fillable = [
        'type',
        'status',
        'user_id',
        'backup_operation_id',
        'disk',
        'path',
        'original_filename',
        'file_size',
        'sha256',
        'mode',
        'options',
        'summary',
        'log',
        'error_message',
        'started_at',
        'finished_at',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'options' => 'array',
            'summary' => 'array',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
            'expires_at' => 'datetime',
            'file_size' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function backupOperation(): BelongsTo
    {
        return $this->belongsTo(self::class, 'backup_operation_id');
    }

    public function fileExists(): bool
    {
        return $this->path !== null && Storage::disk($this->disk)->exists($this->path);
    }
}
