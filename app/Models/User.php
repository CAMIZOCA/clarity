<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, HasApiTokens, HasRoles;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'codigo',
        'registro_senescyt',
        'firma_digital',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function getFirmaDigitalUrlAttribute(): ?string
    {
        return $this->firma_digital ? Storage::url($this->firma_digital) : null;
    }

    public function consultations(): HasMany
    {
        return $this->hasMany(Consultation::class, 'optometrista_id');
    }

    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class, 'optometrista_id');
    }

    public function brigades(): HasMany
    {
        return $this->hasMany(Brigade::class, 'optometrista_id');
    }
}
