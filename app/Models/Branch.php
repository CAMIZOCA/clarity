<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Branch extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'code',
        'address',
        'city',
        'province',
        'phone',
        'email',
        'ruc',
        'sri_establishment',
        'is_active',
        'is_main',
        'settings',
        'notes',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_main'   => 'boolean',
        'settings'  => 'array',
    ];

    public function warehouses(): HasMany
    {
        return $this->hasMany(Warehouse::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
