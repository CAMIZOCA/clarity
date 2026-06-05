<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\Support\LogOptions;
use Spatie\Activitylog\Models\Concerns\LogsActivity;

class LabOrder extends Model
{
    use SoftDeletes, LogsActivity;

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['status', 'priority', 'assigned_to', 'actual_delivery_date', 'reprocess_reason'])
            ->logOnlyDirty()
            ->dontLogEmptyChanges()
            ->setDescriptionForEvent(fn (string $event) => "Orden de laboratorio {$event}");
    }

    protected $fillable = [
        'order_number',
        'sale_id',
        'patient_id',
        'consultation_id',
        'lab_supplier_id',
        'branch_id',
        'assigned_to',
        'created_by',
        'status',
        'priority',
        'od_sphere',
        'od_cylinder',
        'od_axis',
        'od_add',
        'od_prism',
        'oi_sphere',
        'oi_cylinder',
        'oi_axis',
        'oi_add',
        'oi_prism',
        'pd_far',
        'pd_near',
        'height_od',
        'height_oi',
        'frame_description',
        'lens_type',
        'lens_material',
        'lens_treatment',
        'lens_design',
        'estimated_delivery_date',
        'actual_delivery_date',
        'lab_cost',
        'technical_notes',
        'internal_notes',
        'reprocess_reason',
    ];

    protected function casts(): array
    {
        return [
            'od_sphere'    => 'decimal:2',
            'od_cylinder'  => 'decimal:2',
            'od_axis'      => 'decimal:1',
            'od_add'       => 'decimal:2',
            'od_prism'     => 'decimal:2',
            'oi_sphere'    => 'decimal:2',
            'oi_cylinder'  => 'decimal:2',
            'oi_axis'      => 'decimal:1',
            'oi_add'       => 'decimal:2',
            'oi_prism'     => 'decimal:2',
            'pd_far'       => 'decimal:1',
            'pd_near'      => 'decimal:1',
            'height_od'    => 'decimal:1',
            'height_oi'    => 'decimal:1',
            'lab_cost'     => 'decimal:2',
            'estimated_delivery_date' => 'date',
            'actual_delivery_date'    => 'date',
        ];
    }

    /**
     * Auto-generate order_number on creating.
     */
    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (LabOrder $order) {
            if (empty($order->order_number)) {
                $year = now()->year;
                $last = static::whereYear('created_at', $year)
                    ->orderByDesc('id')
                    ->lockForUpdate()
                    ->first();
                $sequence = $last ? ((int) substr($last->order_number, -5)) + 1 : 1;
                $order->order_number = 'LB-' . $year . '-' . str_pad($sequence, 5, '0', STR_PAD_LEFT);
            }
        });
    }

    // ─── Relationships ───────────────────────────────────────────────────────

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function consultation(): BelongsTo
    {
        return $this->belongsTo(Consultation::class);
    }

    public function labSupplier(): BelongsTo
    {
        return $this->belongsTo(LabSupplier::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function assignedTo(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function history(): HasMany
    {
        return $this->hasMany(LabOrderHistory::class);
    }

    // ─── Scopes ──────────────────────────────────────────────────────────────

    /**
     * Órdenes retrasadas: no entregadas ni canceladas y con fecha estimada vencida.
     */
    public function scopeOverdue($query)
    {
        return $query
            ->whereNotIn('status', ['delivered', 'cancelled'])
            ->whereNotNull('estimated_delivery_date')
            ->where('estimated_delivery_date', '<', now()->toDateString());
    }

    /**
     * Órdenes pendientes filtradas por sucursal.
     */
    public function scopePendingByBranch($query, int $branchId)
    {
        return $query
            ->whereNotIn('status', ['delivered', 'cancelled'])
            ->where('branch_id', $branchId);
    }
}
