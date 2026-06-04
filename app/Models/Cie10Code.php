<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Cie10Code extends Model
{
    public $timestamps = false;
    protected $fillable = ['code', 'description'];
}
