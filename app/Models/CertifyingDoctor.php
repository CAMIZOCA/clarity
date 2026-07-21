<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

class CertifyingDoctor extends Model
{
    protected $fillable = [
        'nombre',
        'titulo',
        'registro_senescyt',
        'codigo',
        'firma_path',
        'is_active',
        'is_default',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_default' => 'boolean',
    ];

    protected $appends = ['firma_url'];

    public function getFirmaUrlAttribute(): ?string
    {
        return $this->firma_path ? Storage::disk('public')->url($this->firma_path) : null;
    }

    public function certificates(): HasMany
    {
        return $this->hasMany(Certificate::class);
    }
}
