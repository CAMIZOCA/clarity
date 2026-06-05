<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class MessageTemplate extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'type',
        'channel',
        'subject',
        'body',
        'variables',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'variables' => 'array',
            'is_active' => 'boolean',
        ];
    }

    // ─── Relationships ────────────────────────────────────────────────────────

    public function reminders(): HasMany
    {
        return $this->hasMany(Reminder::class, 'template_id');
    }

    public function campaigns(): HasMany
    {
        return $this->hasMany(Campaign::class, 'template_id');
    }

    // ─── Methods ─────────────────────────────────────────────────────────────

    /**
     * Reemplaza las variables del body con datos del paciente y extras.
     * Variables soportadas: {nombre}, {nombre_completo}, {telefono}, {email},
     *                       {optica}, {fecha}, {monto}, {producto}, {descuento}
     */
    public function resolveVariables(Patient $patient, array $extra = []): string
    {
        $opticaName = \Illuminate\Support\Facades\DB::table('settings')
            ->where('key', 'clinic_name')
            ->value('value') ?? config('app.name', 'la óptica');

        $nombreCompleto = $patient->nombre ?? '';
        $nombrePartes   = explode(' ', trim($nombreCompleto));
        $primerNombre   = $nombrePartes[0] ?? $nombreCompleto;

        $replacements = [
            '{nombre}'          => $primerNombre,
            '{nombre_completo}' => $nombreCompleto,
            '{telefono}'        => $patient->telefono ?? '',
            '{email}'           => $patient->email ?? '',
            '{optica}'          => $opticaName,
            '{fecha}'           => $extra['fecha'] ?? now()->format('d/m/Y'),
            '{monto}'           => $extra['monto'] ?? '',
            '{producto}'        => $extra['producto'] ?? '',
            '{descuento}'       => $extra['descuento'] ?? '',
        ];

        return str_replace(
            array_keys($replacements),
            array_values($replacements),
            $this->body
        );
    }
}
