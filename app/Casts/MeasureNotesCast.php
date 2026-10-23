<?php

namespace App\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;
use JsonException;

/**
 * `consultations.medidas_notas` como array, pero tolerante al texto del sistema anterior.
 *
 * La importacion dejo texto plano ("Datos adicionales del sistema anterior (accdb): ...")
 * en ~1.600 consultas, y el cast `array` lo leia como JSON. Ese json_decode fallido deja
 * el error global de PHP y Laravel lo confunde con un fallo de la respuesta: la consulta
 * daba 500. Aqui se decodifica con JSON_THROW_ON_ERROR (no toca ese estado global) y el
 * texto no JSON se lee como null. Al guardar sin notas nuevas se conserva el texto tal cual.
 */
class MeasureNotesCast implements CastsAttributes
{
    public function get(Model $model, string $key, mixed $value, array $attributes): ?array
    {
        if (! is_string($value) || $value === '') {
            return is_array($value) ? $value : null;
        }

        try {
            $decoded = json_decode($value, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return null;
        }

        return is_array($decoded) ? $decoded : null;
    }

    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null) {
            $raw = $model->getRawOriginal($key);

            // Texto legacy que el formulario no entiende: se conserva en BD.
            return is_string($raw) && $raw !== '' && ! $this->isJson($raw) ? $raw : null;
        }

        return json_encode($value, JSON_THROW_ON_ERROR);
    }

    private function isJson(string $value): bool
    {
        try {
            json_decode($value, true, 512, JSON_THROW_ON_ERROR);

            return true;
        } catch (JsonException) {
            return false;
        }
    }
}
