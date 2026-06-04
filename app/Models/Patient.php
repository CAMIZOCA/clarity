<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Patient extends Model
{
    use SoftDeletes;

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
    ];

    protected function casts(): array
    {
        return [
            'fecha_nacimiento' => 'date:Y-m-d',
        ];
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
}
