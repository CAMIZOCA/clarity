<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class DiscountRule extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'branch_id',
        'name',
        'type',
        'value',
        'max_value',
        'min_sale_amount',
        'applies_to',
        'applies_to_value',
        'requires_approval_above',
        'is_active',
        'valid_from',
        'valid_until',
        'created_by',
    ];

    protected $casts = [
        'value'                   => 'decimal:2',
        'max_value'               => 'decimal:2',
        'min_sale_amount'         => 'decimal:2',
        'requires_approval_above' => 'decimal:2',
        'is_active'               => 'boolean',
        'valid_from'              => 'date',
        'valid_until'             => 'date',
    ];

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
