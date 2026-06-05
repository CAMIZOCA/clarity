<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Supplier extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'ruc',
        'contact_name',
        'phone',
        'email',
        'address',
        'city',
        'type',
        'payment_terms',
        'credit_days',
        'credit_limit',
        'bank_name',
        'bank_account',
        'bank_account_type',
        'is_active',
        'notes',
    ];

    protected $casts = [
        'is_active'    => 'boolean',
        'credit_limit' => 'decimal:2',
    ];

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }
}
