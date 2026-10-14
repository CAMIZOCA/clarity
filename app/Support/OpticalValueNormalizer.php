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

    /** Largo maximo de la nota que acompana a una medida. */
    public const NOTE_MAX_LENGTH = 20;

    /**
     * Separa una medida de las letras escritas despues ("20cc" -> ["20", "CC"]).
     *
     * La optica anota "CC" junto al numero que comprobo con una prueba. La nota
     * empieza en la primera letra que sigue a un numero, o a una esfera neutra
     * seguida de un espacio ("N CC"); "N", "PL" o "NEUTRO" solos son la esfera,
     * no una nota, y un texto sin numero se devuelve intacto para que falle la
     * validacion. Mismo criterio que `splitMeasureNote` en `opticalFormat.js`.
     *
     * Con `$allowTextOnly` (esfera y cilindro de subjetivo y RX final), un texto
     * sin ningun digito ("COMP": medida compensatoria de un ojo sin vision) es
     * toda nota y no hay medida: `[null, "COMP"]`.
     *
     * @return array{0: ?string, 1: ?string}
     */
    public static function splitNote(string $raw, bool $allowTextOnly = false): array
    {
        if ($allowTextOnly && self::isTextOnly($raw)) {
            return [null, mb_strtoupper(trim(preg_replace('/\s+/u', ' ', $raw)))];
        }

        $pattern = '/^\s*([-+]{0,2}\s*\d[\d.,]*\s*°?|(?:'.implode('|', self::NEUTRAL_ALIASES).')(?=\s))\s*(\p{L}.*)$/iu';

        if (! preg_match($pattern, $raw, $matches)) {
            return [$raw, null];
        }

        $note = mb_strtoupper(trim(preg_replace('/\s+/u', ' ', $matches[2])));

        return [trim($matches[1]), $note === '' ? null : $note];
    }

    /** Empieza por letra, no trae digitos y no es una esfera neutra ("N", "PL", "N CC"). */
    private static function isTextOnly(string $raw): bool
    {
        $text = trim($raw);
        $firstWord = mb_strtoupper(preg_split('/\s+/u', $text, 2)[0]);

        return preg_match('/^\p{L}[^\d]*$/u', $text) === 1
            && ! in_array($firstWord, self::NEUTRAL_ALIASES, true);
    }

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
