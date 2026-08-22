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
                'nombre', 'apellido', 'cedula', 'email', 'telefono', 'direccion',
                'customer_type', 'internal_notes',
            ])
            ->logOnlyDirty()
            ->dontLogEmptyChanges()
            ->setDescriptionForEvent(fn (string $event) => "Paciente {$event}");
    }

    protected $fillable = [
        'nombre',
        'apellido',
        'cedula',
        'codigo_interno',
        'legacy_id',
        'fecha_nacimiento',
        'fecha_registro',
        'ocupacion',
        'como_nos_conocio',
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

    /**
     * `nombre_completo` viaja en todas las serializaciones (incluidas las
     * relaciones anidadas), para que la UI nunca tenga que recomponer el nombre.
     */
    protected $appends = ['nombre_completo'];

    protected function casts(): array
    {
        return [
            'fecha_nacimiento'  => 'date:Y-m-d',
            'fecha_registro'    => 'date:Y-m-d',
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
                'MATCH(nombre, apellido, cedula, telefono, email, codigo_interno) AGAINST(? IN BOOLEAN MODE)',
                ['+' . str_replace(' ', '* +', trim($term)) . '*']
            );
        }

        // Fallback para SQLite o términos muy cortos
        return $query->where(function ($q) use ($term) {
            $q->where('nombre', 'LIKE', "%{$term}%")
              ->orWhere('apellido', 'LIKE', "%{$term}%")
              ->orWhereRaw("TRIM(CONCAT(COALESCE(nombre, ''), ' ', COALESCE(apellido, ''))) LIKE ?", ["%{$term}%"])
              ->orWhere('cedula', 'LIKE', "%{$term}%")
              ->orWhere('telefono', 'LIKE', "%{$term}%")
              ->orWhere('email', 'LIKE', "%{$term}%")
              ->orWhere('codigo_interno', 'LIKE', "%{$term}%");
        });
    }

    public function getEdadAttribute(): ?int
    {
        if (blank($this->fecha_nacimiento)) {
            return null;
        }

        $age = Carbon::parse($this->fecha_nacimiento)->age;

        // La importacion legacy dejo algunas fechas de nacimiento en el futuro
        // (anios de 2 digitos mal interpretados), lo que producia edades
        // negativas en pantalla. Sin fecha valida, no hay edad.
        return $age >= 0 ? $age : null;
    }

    /**
     * Nombre para mostrar. Los pacientes historicos guardan el nombre completo
     * en `nombre` y tienen `apellido` vacio, asi que se siguen viendo bien.
     */
    public function getNombreCompletoAttribute(): string
    {
        return trim(($this->nombre ?? '') . ' ' . ($this->apellido ?? ''));
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
