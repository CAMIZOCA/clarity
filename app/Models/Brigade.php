<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Brigade extends Model
{
    use SoftDeletes;

    protected $fillable = ['nombre', 'lugar', 'fecha', 'optometrista_id', 'observaciones'];

    protected function casts(): array
    {
        return ['fecha' => 'date:Y-m-d'];
    }

    public function optometrista(): BelongsTo
    {
        return $this->belongsTo(User::class, 'optometrista_id');
    }

    public function patients(): BelongsToMany
    {
        return $this->belongsToMany(Patient::class)->withPivot('notas')->withTimestamps();
    }
}
