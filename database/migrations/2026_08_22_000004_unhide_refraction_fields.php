<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Deja de ocultar las columnas de refraccion.
 *
 * `advanced_form_fields` se sembro marcando como "avanzadas" casi todas las
 * columnas de RX segun su tasa de llenado historico, de modo que el formulario
 * arrancaba sin cilindro en RX en uso, sin prisma/base en RX final y sin la
 * seccion de vision de cerca. La optica necesita verlas siempre.
 *
 * Cambiar solo el default de JS no basta: el valor ya esta persistido en la
 * tabla `settings`, asi que hay que depurar las keys guardadas. El resto de
 * campos avanzados (secciones-modulo, queratometria, etc.) se conserva.
 */
return new class extends Migration
{
    private const UNHIDE = [
        'consulta:col_avsc',
        'consulta:col_avcc',
        'consulta:rx_uso_cilindro',
        'consulta:rx_uso_avcc',
        'consulta:subj_esfera',
        'consulta:subj_eje',
        'consulta:subj_avl',
        'consulta:rx_final_avl',
        'consulta:rx_final_prisma',
        'consulta:rx_final_base',
        'consulta:grp_vision_cerca',
        'consulta:lente_anterior',
    ];

    public function up(): void
    {
        $this->rewrite(fn (array $keys) => array_values(array_diff($keys, self::UNHIDE)));
    }

    public function down(): void
    {
        $this->rewrite(fn (array $keys) => array_values(array_unique(array_merge($keys, self::UNHIDE))));
    }

    private function rewrite(callable $transform): void
    {
        $row = DB::table('settings')->where('key', 'advanced_form_fields')->first();
        if (! $row) {
            return;
        }

        $keys = json_decode($row->value ?? '[]', true);
        if (! is_array($keys)) {
            return;
        }

        DB::table('settings')
            ->where('key', 'advanced_form_fields')
            ->update([
                'value' => json_encode($transform($keys)),
                'updated_at' => now(),
            ]);

        Cache::forget('setting_advanced_form_fields');
        Cache::forget('settings_all');
    }
};
