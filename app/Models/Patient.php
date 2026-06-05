<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;
use Spatie\Activitylog\Support\LogOptions;
use Spatie\Activitylog\Models\Concerns\LogsActivity;

class Patient extends Model
{
    use SoftDeletes, LogsActivity;

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly([
                'nombre', 'cedula', 'email', 'telefono', 'direccion',
                'customer_type', 'internal_notes',
            ])
            ->logOnlyDirty()
            ->dontLogEmptyChanges()
            ->setDescriptionForEvent(fn (string $event) => "Paciente {$event}");
    }

    protected $fillable = [
        'nombre',
        'cedula',
        'codigo_interno',
        'legacy_id',
        'fecha_nacimiento',
        'ocupacion',
        'direccion',
        'telefono',
        'email',
        'avatar_path',
        'antecedentes',
        'created_by',
        // CRM / ventas
        'customer_type',
        'company_name',
        'company_ruc',
        'last_purchase_at',
        'total_spent',
        'visit_count',
        'preferred_contact',
        'internal_notes',
        'branch_id',
    ];

    protected function casts(): array
    {
        return [
            'fecha_nacimiento'  => 'date:Y-m-d',
            'customer_type'     => 'string',
            'last_purchase_at'  => 'datetime',
            'total_spent'       => 'decimal:2',
        ];
    }

    /**
     * Búsqueda de pacientes compatible con MySQL (FULLTEXT) y SQLite (LIKE).
     * MySQL usa FULLTEXT BOOLEAN MODE para términos >= 3 caracteres.
     * SQLite usa LIKE como fallback.
     */
    public static function search(string $term): \Illuminate\Database\Eloquent\Builder
    {
        $driver = DB::getDriverName();
        $query = static::query();

        if ($driver === 'mysql' && strlen($term) >= 3) {
            return $query->whereRaw(
                'MATCH(nombre, cedula, telefono, email, codigo_interno) AGAINST(? IN BOOLEAN MODE)',
                ['+' . str_replace(' ', '* +', trim($term)) . '*']
            );
        }

        // Fallback para SQLite o términos muy cortos
        return $query->where(function ($q) use ($term) {
            $q->where('nombre', 'LIKE', "%{$term}%")
              ->orWhere('cedula', 'LIKE', "%{$term}%")
              ->orWhere('telefono', 'LIKE', "%{$term}%")
              ->orWhere('email', 'LIKE', "%{$term}%")
              ->orWhere('codigo_interno', 'LIKE', "%{$term}%");
        });
    }

    public function getEdadAttribute(): int
    {
        return Carbon::parse($this->fecha_nacimiento)->age;
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function consultations(): HasMany
    {
        return $this->hasMany(Consultation::class);
    }

    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class);
    }

    public function ophthalmologyReferences(): HasMany
    {
        return $this->hasMany(OphthalmologyReference::class);
    }

    public function specialContactLenses(): HasMany
    {
        return $this->hasMany(SpecialContactLens::class);
    }

    public function brigades(): BelongsToMany
    {
        return $this->belongsToMany(Brigade::class)->withPivot('notas')->withTimestamps();
    }

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }
}
