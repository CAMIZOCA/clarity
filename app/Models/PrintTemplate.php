<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PrintTemplate extends Model
{
    protected $fillable = [
        'key',
        'name',
        'description',
        'is_active',
        'sort_order',
        'sections',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'sections' => 'array',
        ];
    }
}
