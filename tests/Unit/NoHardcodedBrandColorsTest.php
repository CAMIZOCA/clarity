<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;

/**
 * El diseño "Compacto" cambia el color de marca redefiniendo los tokens de
 * Tailwind (`--color-navy`, `--color-navy-light`, `--color-accent-yellow`)
 * bajo `[data-ui="compacto"]`. Una clase con el hex fijo (`bg-[#1a2a4a]`) no
 * pasa por el token y se queda con el color clasico en las dos plantillas.
 * Los PDF quedan fuera: usan estilos en linea a proposito (html2canvas).
 */
class NoHardcodedBrandColorsTest extends TestCase
{
    private const PATTERN = '/-\[#(1a2a4a|243660|253d6b|243a6a|223260|253a6a|fef08a)\]/i';

    public function test_brand_colors_use_theme_tokens_instead_of_hex_classes(): void
    {
        $root = dirname(__DIR__, 2).'/resources/js';
        $offenders = [];

        $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root));
        foreach ($files as $file) {
            if (! $file->isFile() || ! preg_match('/\.(jsx?|tsx?)$/', $file->getFilename())) {
                continue;
            }
            $path = str_replace('\\', '/', $file->getPathname());
            if (str_contains($path, '/components/pdf/')) {
                continue;
            }
            foreach (file($path) as $number => $line) {
                if (preg_match(self::PATTERN, $line, $match)) {
                    $offenders[] = substr($path, strlen($root) + 1).':'.($number + 1).' '.$match[0];
                }
            }
        }

        $this->assertSame([], $offenders, "Use bg-navy / text-navy / navy-light / accent-yellow instead of hex classes:\n".implode("\n", $offenders));
    }
}
