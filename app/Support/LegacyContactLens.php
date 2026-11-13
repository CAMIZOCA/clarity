<?php

namespace App\Support;

/**
 * Lentes de contacto del sistema anterior (Access de Optica Andina).
 *
 * La importacion guardaba el lente de prueba con claves planas (`bc_od`,
 * `poder_od`, `sobreref_od`...), pero el formulario lee `test_lens.od.curva_base`:
 * la tabla "Lente de prueba" salia vacia. Aqui se pasa a la forma que lee el
 * formulario. Lo usan el importador y la revision de datos heredados.
 */
class LegacyContactLens
{
    /** Casillas de "Lente de prueba" en el formulario, en orden. */
    public const TEST_LENS_FIELDS = ['curva_base', 'poder', 'h2o', 'material', 'diametro', 'sobre_refraccion', 'agudeza_visual'];

    /** Clave plana del importador -> casilla del formulario. */
    private const TEST_LENS_FLAT = [
        'bc' => 'curva_base',
        'poder' => 'poder',
        'diametro' => 'diametro',
        'material' => 'material',
        'h2o' => 'h2o',
        'sobreref' => 'sobre_refraccion',
        'av' => 'agudeza_visual',
    ];

    /** Datos del lente de prueba sin casilla en el formulario: van a las observaciones. */
    private const TEST_LENS_EXTRA = [
        'calificacion' => 'Calificación',
        'gas_permeable' => 'Gas permeable',
        'tipo_lente' => 'Tipo de lente',
        'blando' => 'Blando',
    ];

    private const FIELD_LABELS = [
        'curva_base' => 'Curva base',
        'poder' => 'Poder',
        'h2o' => '%H2O',
        'material' => 'Material',
        'diametro' => 'Diámetro',
        'sobre_refraccion' => 'Sobre-refracción',
        'agudeza_visual' => 'AV',
    ];

    /** Si el JSON del lente de prueba tiene alguna clave plana del importador. */
    public static function hasFlatTestLens(array $lens): bool
    {
        foreach (array_keys($lens) as $key) {
            if (! is_string($key)) {
                continue;
            }
            if (isset(self::TEST_LENS_EXTRA[$key]) || preg_match('/^('.implode('|', array_keys(self::TEST_LENS_FLAT)).')_(od|oi)$/', $key) === 1) {
                return true;
            }
        }

        return false;
    }

    /**
     * `{bc_od: "8,3", av_oi: "20/20", calificacion: "B"}` ->
     * `{od: {curva_base: "8,3", ...}, oi: {agudeza_visual: "20/20", ...}}` y las notas.
     *
     * Solo llena casillas vacias. Un valor cuya casilla ya tiene otro texto, y lo
     * que no tiene casilla, pasan a `notes` para no perderlo. Las claves planas
     * desaparecen; cualquier otra clave se conserva.
     *
     * @return array{lens: array<string, mixed>, notes: list<string>}
     */
    public static function nestTestLens(array $current): array
    {
        $lens = $current;
        $notes = [];

        foreach (['od', 'oi'] as $eye) {
            if (isset($lens[$eye]) && ! is_array($lens[$eye])) {
                unset($lens[$eye]);
            }
        }

        foreach ($current as $key => $value) {
            if (! is_string($key)) {
                continue;
            }

            if (isset(self::TEST_LENS_EXTRA[$key])) {
                unset($lens[$key]);
                if (filled($value)) {
                    $notes[] = self::TEST_LENS_EXTRA[$key].': '.trim((string) $value);
                }

                continue;
            }

            if (preg_match('/^('.implode('|', array_keys(self::TEST_LENS_FLAT)).')_(od|oi)$/', $key, $matches) !== 1) {
                continue;
            }

            unset($lens[$key]);
            if (blank($value)) {
                continue;
            }

            [, $flat, $eye] = $matches;
            $field = self::TEST_LENS_FLAT[$flat];
            $value = trim((string) $value);
            $lens[$eye] = self::eye($lens[$eye] ?? []);
            $existing = trim((string) ($lens[$eye][$field] ?? ''));

            if ($existing === '') {
                $lens[$eye][$field] = $value;
            } elseif ($existing !== $value) {
                $notes[] = strtoupper($eye).' '.self::FIELD_LABELS[$field].': '.$value;
            }
        }

        return ['lens' => $lens, 'notes' => $notes];
    }

    /** Resumen legible de un ojo del lente de prueba: "CB 8,3 · Poder -2 -2 x 180". */
    public static function summary(array $lens, string $eye): ?string
    {
        $parts = [];
        foreach (self::TEST_LENS_FIELDS as $field) {
            $value = trim((string) ($lens[$eye][$field] ?? ''));
            if ($value !== '') {
                $parts[] = self::FIELD_LABELS[$field].' '.$value;
            }
        }

        return $parts === [] ? null : implode(' · ', $parts);
    }

    /**
     * Si dos poderes son la misma medida aunque esten escritos distinto
     * ("-425-075x0" y "-4.25 -0.75 x 0"). Eje 0 y 180 son el mismo. Si alguno no
     * se lee como una refraccion, no se da por igual.
     */
    public static function samePower(?string $a, ?string $b): bool
    {
        if (blank($a) || blank($b)) {
            return false;
        }

        $first = LegacyOpticalParser::refraction($a);
        $second = LegacyOpticalParser::refraction($b);
        if ($first === null || $second === null || filled($first['resto']) || filled($second['resto'])) {
            return false;
        }

        $number = fn (?string $value) => $value === null ? null : round((float) $value, 2);
        if ($number($first['esfera']) !== $number($second['esfera'])
            || $first['esfera_neutral'] !== $second['esfera_neutral']
            || $number($first['cilindro']) !== $number($second['cilindro'])) {
            return false;
        }

        if ($first['cilindro'] === null) {
            return true;
        }

        $axis = fn (?int $value) => $value === null ? null : $value % 180;

        return $axis($first['eje']) === $axis($second['eje']);
    }

    /** Agrega una nota con " / " sin repetirla. */
    public static function appendNote(?string $current, string $note): ?string
    {
        $current = trim((string) $current);
        $note = trim($note);

        if ($note === '' || str_contains($current, $note)) {
            return $current === '' ? null : $current;
        }

        return $current === '' ? $note : "{$current} / {$note}";
    }

    /** @return array<string, ?string> las 7 casillas del formulario, con lo que ya tenga */
    private static function eye(array $current): array
    {
        return [...array_fill_keys(self::TEST_LENS_FIELDS, null), ...$current];
    }
}
