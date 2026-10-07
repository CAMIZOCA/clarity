<?php

namespace App\Support;

/**
 * Lee las medidas opticas del sistema anterior de Optica Andina tal como se
 * escribian alli, que no es como se llaman sus columnas:
 *
 * - Las dioptrias van sin punto decimal ("+300" es +3.00, "-050" es -0.50).
 *   Leerlas como numero literal dejo el 92 % de las consultas importadas con
 *   esferas de 300 y cilindros de -225.
 * - En "RX en uso" la columna ESFERA no trae la esfera (en el 95 % de las filas
 *   importadas quedo un 20, lo que deja una agudeza "20/20" al leerla como
 *   numero): la esfera esta en la columna EJE, y CILINDRO siempre esta vacio.
 *   Es una deduccion hecha sobre los datos ya importados, sin el respaldo
 *   original a la vista.
 * - ARK guarda la refraccion objetiva ("+300 -225 x 15 cc 20/20"), que en este
 *   sistema es la Retinoscopia, y RETINOSCOPIA guarda el cover test ("ORTHO").
 *
 * Lo usan los importadores para que una importacion nueva no repita el
 * problema; `LegacyConsultationRepairService` corrige lo ya importado.
 */
class LegacyOpticalParser
{
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

    /**
     * "RX en uso" de un ojo.
     *
     * Si la fila tiene la forma legacy (AV en ESFERA, o un "eje" con signo o
     * mayor a 180, que solo puede ser una esfera) se reubica cada dato; si no,
     * se respeta el nombre de las columnas.
     *
     * @return array{esfera: ?string, cilindro: ?string, eje: ?int, add: ?string, avcc: ?string}
     */
    public static function rxUso(?string $esfera, ?string $cilindro, ?string $eje, ?string $add, ?string $avcc): array
    {
        $axis = self::axis($eje);
        $shifted = self::looksLikeAcuity($esfera)
            || ($eje !== null && preg_match('/^\s*[-+]/', $eje) === 1)
            || ($axis !== null && $axis > 180);

        if (! $shifted) {
            return [
                'esfera' => self::diopter($esfera),
                'cilindro' => self::diopter($cilindro),
                'eje' => $axis,
                'add' => self::diopter($add),
                'avcc' => $avcc,
            ];
        }

        return [
            'esfera' => self::diopter($eje),
            'cilindro' => self::diopter($cilindro),
            'eje' => null,
            'add' => self::diopter($add),
            // Lo que venia en ESFERA no es una esfera: se conserva como texto.
            'avcc' => $avcc ?? $esfera,
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
