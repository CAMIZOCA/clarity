<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class LabSupplier extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'ruc',
        'contact_name',
        'phone',
        'email',
        'address',
        'turnaround_days',
        'is_active',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'is_active'       => 'boolean',
            'turnaround_days' => 'integer',
        ];
    }

    // ─── Relationships ───────────────────────────────────────────────────────

    public function labOrders(): HasMany
    {
        return $this->hasMany(LabOrder::class);
    }
}
