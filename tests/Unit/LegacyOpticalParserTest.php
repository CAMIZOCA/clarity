<?php

namespace Tests\Unit;

use App\Support\LegacyOpticalParser;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class LegacyOpticalParserTest extends TestCase
{
    #[DataProvider('diopterCases')]
    public function test_reads_legacy_diopters(?string $raw, ?string $expected): void
    {
        $this->assertSame($expected, LegacyOpticalParser::diopter($raw));
    }

    public static function diopterCases(): array
    {
        return [
            'sin punto, positivo' => ['+300', '3.00'],
            'sin punto, negativo' => ['-050', '-0.50'],
            'sin punto ni signo' => ['225', '2.25'],
            'con punto' => ['-3.50', '-3.50'],
            'con coma' => ['1,25', '1.25'],
            'entero corto' => ['3', '3.00'],
            'doble signo' => ['--050', '-0.50'],
            'agudeza visual' => ['20/20', null],
            'texto' => ['ORTHO', null],
            'vacio' => ['', null],
            'nulo' => [null, null],
        ];
    }

    public function test_rx_en_uso_with_legacy_shape_takes_the_sphere_from_the_axis_column(): void
    {
        $this->assertSame(
            ['esfera' => '-0.50', 'cilindro' => null, 'eje' => null, 'add' => '2.50', 'avcc' => '20/25'],
            LegacyOpticalParser::rxUso('20/25', null, '-050', '250', null)
        );

        // "300" no puede ser un eje: tambien es una esfera.
        $this->assertSame('3.00', LegacyOpticalParser::rxUso('20', null, '300', null, null)['esfera']);
    }

    public function test_rx_en_uso_with_real_columns_is_respected(): void
    {
        $this->assertSame(
            ['esfera' => '-1.25', 'cilindro' => '-0.50', 'eje' => 90, 'add' => null, 'avcc' => '20/20'],
            LegacyOpticalParser::rxUso('-125', '-050', '90', null, '20/20')
        );
    }

    public function test_ark_is_the_retinoscopy_and_the_old_retinoscopy_is_the_cover_test(): void
    {
        $this->assertSame(
            [
                'retinoscopia_od' => '+300 -225 x 15 cc 20/20',
                'retinoscopia_oi' => '+450 -375 x170 cc 20/20',
                'ark_od' => null,
                'ark_oi' => null,
                'cover_test' => '6/8 | OD: ORTHO / OI: X',
            ],
            LegacyOpticalParser::retinoscopy('+300 -225 x 15 cc 20/20', '+450 -375 x170 cc 20/20', 'ORTHO', 'X', '6/8')
        );
    }

    public function test_without_ark_nothing_moves(): void
    {
        $this->assertSame(
            ['retinoscopia_od' => '-1.25 -0.50 x85', 'retinoscopia_oi' => null, 'ark_od' => null, 'ark_oi' => null, 'cover_test' => null],
            LegacyOpticalParser::retinoscopy(null, null, '-1.25 -0.50 x85', null, null)
        );
    }
}
