<?php

namespace App\Support;

/**
 * Lee las medidas opticas del sistema anterior de Optica Andina tal como se
 * escribian alli, que no es como se llaman sus columnas:
 *
 * - Las dioptrias van sin punto decimal ("+300" es +3.00, "-050" es -0.50).
 *   Leerlas como numero literal dejo el 92 % de las consultas importadas con
 *   esferas de 300 y cilindros de -225.
 * - En "RX en uso" la columna ESFERA trae una agudeza visual ("20/40", "CD 3m")
 *   y la columna EJE la receta entera en un solo texto, a veces con una nota
 *   ("+125-075x 90 20/40", "N -050 X 5 20/20 prog ev gold", "No trajo").
 *   CILINDRO siempre esta vacio.
 * - En el subjetivo pasa lo mismo: RXPARCIAL_CILINDRO trae la refraccion
 *   completa ("+050-100x 80 20/40-") y ESFERA y EJE vienen vacias. Guardar solo
 *   el primer numero dejo la esfera en la columna cilindro y perdio el resto.
 * - ARK guarda la refraccion objetiva ("+300 -225 x 15 cc 20/20"), que en este
 *   sistema es la Retinoscopia, y RETINOSCOPIA guarda el cover test ("ORTHO").
 *
 * Lo usan los importadores para que una importacion nueva no repita el
 * problema; `LegacyConsultationRepairService` corrige lo ya importado.
 */
class LegacyOpticalParser
{
    /** Una esfera o cilindro mayor a esto no existe. */
    public const MAX_DIOPTERS = 30.0;

    /** Un cilindro mayor a esto tampoco: es un texto mal leido. */
    public const MAX_CYLINDER = 10.0;

    private const NEUTRAL = 'N|NEUTRO|PLANO|PL';

    /**
     * Dioptrias legacy -> decimal con dos cifras ("+300" -> "3.00"). Una
     * agudeza visual ("20/20") o un texto no son dioptrias: devuelve null.
     */
    public static function diopter(?string $raw): ?string
    {
        if ($raw === null) {
            return null;
        }

        $value = trim(str_replace(',', '.', $raw));

        if ($value === '' || self::looksLikeAcuity($value)) {
            return null;
        }

        if (! preg_match('/[-+]?\d+(?:\.\d+)?/', $value, $matches)) {
            return null;
        }

        $normalized = OpticalValueNormalizer::normalize($matches[0], 'sphere');

        return is_numeric($normalized) ? number_format((float) $normalized, 2, '.', '') : null;
    }

    /** Dioptria dentro de un texto: a "-25" le falta el cero ("-025"), no son veinticinco. */
    private static function looseDiopter(string $token): ?string
    {
        $token = preg_replace('/\s+/', '', $token);

        return self::diopter(preg_replace('/^([-+]*)(25|50|75)$/', '${1}0$2', $token));
    }

    /**
     * Las lunas van en pasos de 0.25 (a veces de 0.12): "-0258" o un radio de
     * lente de contacto ("7,45") no son una medida y es mejor no adivinarlos.
     */
    private static function isLensStep(?string $diopters): bool
    {
        return $diopters === null || in_array((int) round(abs((float) $diopters) * 100) % 25, [0, 12, 13], true);
    }

    /** Eje en grados enteros; null si no hay numero. */
    public static function axis(?string $raw): ?int
    {
        if ($raw === null || ! preg_match('/[-+]?\d+/', $raw, $matches)) {
            return null;
        }

        return (int) $matches[0];
    }

    /** Una agudeza visual se escribe como fraccion: "20/20", "20/25-1". */
    public static function looksLikeAcuity(?string $raw): bool
    {
        return $raw !== null && str_contains($raw, '/');
    }

    /** "N", "neutro", "plano": esfera sin poder, que se guarda como flag y no como 0. */
    public static function isNeutral(?string $raw): bool
    {
        return $raw !== null && preg_match('/^\s*-?\s*(?:'.self::NEUTRAL.')\s*$/i', $raw) === 1;
    }

    /**
     * Refraccion completa escrita en un solo campo: "+050-100x 80 20/40-" es
     * esfera +0.50, cilindro -1.00, eje 80 y agudeza 20/40-.
     *
     * Un numero solo es la esfera ("+075", "-050 Esf"); seguido de un eje es el
     * cilindro ("-100 X 180"). El primer numero tiene que parecer una dioptria
     * (signo, tres cifras o punto decimal): "6 años" es una nota. Lo que sobra
     * despues de la medida se devuelve en `resto`. Devuelve null si el texto no
     * empieza por una medida ("No trajo", "sin bateria", "Trae Rx -050x 90").
     *
     * @return array{esfera: ?string, esfera_neutral: bool, cilindro: ?string, eje: ?int, av: ?string, resto: ?string}|null
     */
    public static function refraction(?string $raw): ?array
    {
        if ($raw === null || trim($raw) === '') {
            return null;
        }

        // "1,25" es un decimal; en "-025,180" la coma separa el eje.
        $text = preg_replace('/(?<!\d)(\d{1,2}),(?=\d)/', '$1.', trim($raw));

        // La agudeza se retira primero: su "20" no es una medida ni un eje.
        $av = null;
        $tail = '';
        if (preg_match('/20\s*\/\s*\d{2,3}(?:\s?[-+]\d?(?!\d))?/', $text, $acuity, PREG_OFFSET_CAPTURE)) {
            $av = preg_replace('/\s+/', '', $acuity[0][0]);
            $tail = substr($text, $acuity[0][1] + strlen($acuity[0][0]));
            $text = substr($text, 0, $acuity[0][1]);
        }

        $number = '\d+(?:\.\d+)?';
        $pattern = '/^\s*'
            .'(?:(?<neutro>'.self::NEUTRAL.')(?![a-z])|(?<esfera>[-+]{1,2}\s*'.$number.'|\d+\.\d+|\d{3,4}(?!\d)))?'
            .'\s*(?<cilindro>[-+]{1,2}\s*'.$number.'|'.$number.'(?=\s*[x*,]\s*\d))?'
            .'\s*(?:[x*,]\s*(?<eje>\d{1,3})(?!\d))?/i';

        preg_match($pattern, $text, $found);
        $rest = substr($text, strlen($found[0]));

        $neutral = ($found['neutro'] ?? '') !== '';
        $sphere = ($found['esfera'] ?? '') !== '' ? self::looseDiopter($found['esfera']) : null;
        $cylinder = ($found['cilindro'] ?? '') !== '' ? self::looseDiopter($found['cilindro']) : null;
        $axis = ($found['eje'] ?? '') !== '' ? (int) $found['eje'] : null;

        if (! $neutral && $sphere === null && $cylinder === null) {
            return null;
        }

        // "+075 -275 175": el eje sin la "x".
        if ($cylinder !== null && $axis === null && preg_match('/^\s*(\d{1,3})(?![\d.\/])/', $rest, $loose)) {
            $axis = (int) $loose[1];
            $rest = substr($rest, strlen($loose[0]));
        }

        // Un solo numero con eje es el cilindro: una esfera no tiene eje.
        if ($axis !== null && $cylinder === null && ! $neutral) {
            [$sphere, $cylinder] = [null, $sphere];
        }

        if (($sphere !== null && abs((float) $sphere) > self::MAX_DIOPTERS)
            || ($cylinder !== null && abs((float) $cylinder) > self::MAX_CYLINDER)
            || ! self::isLensStep($sphere)
            || ! self::isLensStep($cylinder)) {
            return null;
        }

        if ($axis !== null && $axis > 180) {
            return null;
        }

        // "Esf" y una "x" sin eje no agregan nada a la medida. "CC" si: la
        // optica lo anota cuando comprobo el valor con una prueba.
        $rest = preg_replace('/^(?:\s*(?:esf(?:erico)?|x)(?![a-z])\.?)+/i', '', $rest.' '.$tail);
        $rest = trim($rest, " \t\n\r-.,;:/");

        return [
            'esfera' => $sphere,
            'esfera_neutral' => $neutral,
            'cilindro' => $cylinder,
            'eje' => $axis,
            'av' => $av,
            'resto' => $rest === '' ? null : $rest,
        ];
    }

    /**
     * Subjetivo de un ojo.
     *
     * Con ESFERA y EJE vacias, CILINDRO trae la refraccion entera y se reparte.
     * Si el texto no se entiende como una refraccion limpia (`legible` en false)
     * se deja lo que dicen las columnas, igual que con las pocas filas que si
     * las usan por separado.
     *
     * @return array{esfera: ?string, esfera_neutral: bool, cilindro: ?string, eje: ?int, avl: ?string, legible: bool}
     */
    public static function subjective(?string $esfera, ?string $cilindro, ?string $eje, ?string $avl): array
    {
        $named = [
            'esfera' => self::diopter($esfera),
            'esfera_neutral' => self::isNeutral($esfera),
            'cilindro' => self::diopter($cilindro),
            'eje' => self::axis($eje),
            'avl' => $avl,
            'legible' => true,
        ];

        if (filled($esfera) || filled($eje) || blank($cilindro)) {
            return $named;
        }

        $parsed = self::refraction($cilindro);

        if ($parsed === null || $parsed['resto'] !== null) {
            return ['legible' => false] + $named;
        }

        return [
            'esfera' => $parsed['esfera'],
            'esfera_neutral' => $parsed['esfera_neutral'],
            'cilindro' => $parsed['cilindro'],
            'eje' => $parsed['eje'],
            'avl' => $avl ?? $parsed['av'],
            'legible' => true,
        ];
    }

    /**
     * "RX en uso" de un ojo.
     *
     * Si la fila tiene la forma legacy (AV o texto en ESFERA, o un "eje" que no
     * es un numero de 0 a 180) la receta se lee del texto de EJE; si no, se
     * respeta el nombre de las columnas. La agudeza de ESFERA es la AV con esa
     * receta; la que venga escrita dentro del texto y cualquier nota ("prog ev
     * gold", "No trajo") se devuelven en `observacion`.
     *
     * @return array{esfera: ?string, esfera_neutral: bool, cilindro: ?string, eje: ?int, add: ?string, avcc: ?string, observacion: ?string}
     */
    public static function rxUso(?string $esfera, ?string $cilindro, ?string $eje, ?string $add, ?string $avcc): array
    {
        $axis = self::axis($eje);
        $plainAxis = $eje === null || preg_match('/^\s*\d{1,3}\s*(?:°\s*)?$/', $eje) === 1;
        $plainSphere = $esfera === null || self::isNeutral($esfera) || preg_match('/^\s*[-+]{0,2}\s*\d+(?:[.,]\d+)?\s*$/', $esfera) === 1;
        // "2050" o "70" en ESFERA son una agudeza sin la barra, no veinte dioptrias.
        $acuityAsNumber = $plainSphere && abs((float) self::diopter($esfera)) >= 20;
        $shifted = ! $plainSphere || $acuityAsNumber || ! $plainAxis || ($axis !== null && $axis > 180);

        if (! $shifted) {
            return [
                'esfera' => self::diopter($esfera),
                'esfera_neutral' => self::isNeutral($esfera),
                'cilindro' => self::diopter($cilindro),
                'eje' => $axis,
                'add' => self::diopter($add),
                'avcc' => $avcc,
                'observacion' => null,
            ];
        }

        $parsed = self::refraction($eje);
        // Lo que venia en ESFERA no es una esfera: se conserva como texto.
        $acuity = $avcc ?? $esfera ?? $parsed['av'] ?? null;
        $note = $parsed === null
            ? $eje
            : implode(' ', array_filter([$parsed['av'] !== $acuity ? $parsed['av'] : null, $parsed['resto']]));

        return [
            'esfera' => $parsed['esfera'] ?? null,
            'esfera_neutral' => $parsed['esfera_neutral'] ?? false,
            'cilindro' => $parsed['cilindro'] ?? self::diopter($cilindro),
            'eje' => $parsed['eje'] ?? null,
            'add' => self::diopter($add),
            'avcc' => $acuity,
            'observacion' => filled($note) ? trim($note) : null,
        ];
    }

    /**
     * Retinoscopia y cover test a partir de ARK y RETINOSCOPIA.
     *
     * Con ARK lleno, ARK es la retinoscopia y lo que venia en RETINOSCOPIA pasa
     * al cover test (si la fila ya trae cover test propio, se conserva delante).
     * Sin ARK no se mueve nada.
     *
     * @return array{retinoscopia_od: ?string, retinoscopia_oi: ?string, ark_od: ?string, ark_oi: ?string, cover_test: ?string}
     */
    public static function retinoscopy(?string $arkOd, ?string $arkOi, ?string $retinoscopiaOd, ?string $retinoscopiaOi, ?string $coverTest): array
    {
        $result = [
            'retinoscopia_od' => $retinoscopiaOd,
            'retinoscopia_oi' => $retinoscopiaOi,
            'ark_od' => $arkOd,
            'ark_oi' => $arkOi,
            'cover_test' => $coverTest,
        ];

        $displaced = [];
        foreach (['od' => [$arkOd, $retinoscopiaOd], 'oi' => [$arkOi, $retinoscopiaOi]] as $eye => [$ark, $retinoscopia]) {
            if (blank($ark)) {
                continue;
            }

            $result["retinoscopia_{$eye}"] = trim($ark);
            $result["ark_{$eye}"] = null;

            if (filled($retinoscopia)) {
                $displaced[] = strtoupper($eye).': '.trim($retinoscopia);
            }
        }

        if ($displaced !== []) {
            $result['cover_test'] = implode(' | ', array_filter([
                filled($coverTest) ? trim($coverTest) : null,
                implode(' / ', $displaced),
            ]));
        }

        return $result;
    }
}
