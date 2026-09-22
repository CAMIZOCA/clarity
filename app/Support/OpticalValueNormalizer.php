<?php

namespace App\Support;

/**
 * Normaliza medidas ópticas escritas sin punto decimal por el personal de
 * clínica (teclado rápido, sin decimales): "025" -> "0.25", "-050" -> "-0.50".
 *
 * Reglas (fijadas por el feedback clínico de Óptica Andina):
 * - Con punto o coma decimal explícito: solo se formatea a 2 decimales.
 * - Sin punto, 1-2 dígitos: es un entero completo ("2" -> "2.00").
 * - Sin punto, 3+ dígitos: los últimos 2 dígitos son la parte decimal
 *   ("025" -> "0.25", "1225" -> "12.25").
 * - El signo se conserva tal cual fue escrito; si no había signo, no se agrega.
 * - Para esfera, "N"/"neutro"/"plano"/"pl" se normaliza al literal "N".
 * - Para eje, se descarta el símbolo "°" y no hay corrimiento de decimales.
 */
class OpticalValueNormalizer
{
    private const NEUTRAL_ALIASES = ['N', 'NEUTRO', 'PLANO', 'PL'];

    public static function normalize(?string $raw, string $type): ?string
    {
        if ($raw === null || $raw === '') {
            return $raw;
        }

        $value = str_replace(' ', '', trim($raw));
        $value = str_replace(',', '.', $value);

        if ($type === 'sphere' && in_array(strtoupper($value), self::NEUTRAL_ALIASES, true)) {
            return 'N';
        }

        if ($type === 'axis') {
            return self::normalizeAxis($value, $raw);
        }

        return self::normalizeDecimal($value, $raw);
    }

    private static function normalizeAxis(string $value, string $raw): string
    {
        $value = rtrim($value, '°');

        if (! is_numeric($value)) {
            return $raw;
        }

        return (string) (int) round((float) $value);
    }

    private static function normalizeDecimal(string $value, string $raw): string
    {
        $sign = '';
        if ($value !== '' && ($value[0] === '+' || $value[0] === '-')) {
            $sign = $value[0];
            $value = substr($value, 1);
        }

        if ($value === '' || ! is_numeric($value)) {
            return $raw;
        }

        if (str_contains($value, '.')) {
            $formatted = number_format((float) $value, 2, '.', '');

            return $sign.$formatted;
        }

        $digits = $value;
        if (strlen($digits) >= 3) {
            $integerPart = substr($digits, 0, -2);
            $decimalPart = substr($digits, -2);
            $formatted = number_format((float) "{$integerPart}.{$decimalPart}", 2, '.', '');
        } else {
            $formatted = number_format((float) $digits, 2, '.', '');
        }

        return $sign.$formatted;
    }
}
