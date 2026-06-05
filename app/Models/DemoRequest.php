<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DemoRequest extends Model
{
    protected $fillable = [
        'name',
        'company',
        'email',
        'phone',
        'city',
        'branches_count',
        'interests',
        'message',
        'privacy_accepted',
        'status',
        'source',
        'ip_hash',
        'user_agent',
        'submitted_at',
    ];

    protected function casts(): array
    {
        return [
            'interests' => 'array',
            'privacy_accepted' => 'boolean',
            'submitted_at' => 'datetime',
        ];
    }
}
