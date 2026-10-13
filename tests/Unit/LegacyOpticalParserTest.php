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

    #[DataProvider('refractionCases')]
    public function test_reads_a_whole_refraction_written_in_one_field(string $raw, ?array $expected): void
    {
        $parsed = LegacyOpticalParser::refraction($raw);

        if ($expected === null) {
            $this->assertNull($parsed);

            return;
        }

        [$esfera, $cilindro, $eje, $av, $resto] = $expected;
        $this->assertSame(
            ['esfera' => $esfera === 'N' ? null : $esfera, 'esfera_neutral' => $esfera === 'N', 'cilindro' => $cilindro, 'eje' => $eje, 'av' => $av, 'resto' => $resto],
            $parsed
        );
    }

    /** Textos tomados del Access de Optica Andina: [esfera, cilindro, eje, av, resto]. */
    public static function refractionCases(): array
    {
        return [
            'pegada' => ['+050-100x 80', ['0.50', '-1.00', 80, null, null]],
            'con agudeza' => ['+025 -050 x 5 20/25-', ['0.25', '-0.50', 5, '20/25-', null]],
            'agudeza con sufijo separado' => ['-075 -125 x 100  20/20 -2', ['-0.75', '-1.25', 100, '20/20-2', null]],
            'signo separado' => ['-425 - 100 X 10 20/20', ['-4.25', '-1.00', 10, '20/20', null]],
            'sin signo' => ['125-125x 25', ['1.25', '-1.25', 25, null, null]],
            'cilindro sin signo' => ['+025 075 x 75', ['0.25', '0.75', 75, null, null]],
            'con coma y asterisco' => ['-1,25-1,00*20', ['-1.25', '-1.00', 20, null, null]],
            'coma antes del eje' => ['+075-025,180', ['0.75', '-0.25', 180, null, null]],
            'cilindro y eje con coma' => ['-100,165', [null, '-1.00', 165, null, null]],
            'cilindro sin el cero' => ['+100-25 x 180 20/20-', ['1.00', '-0.25', 180, '20/20-', null]],
            'cilindro imposible' => ['+075-025.180', null],
            'octavos de dioptria' => ['+112 -037 x 90', ['1.12', '-0.37', 90, null, null]],
            'fuera de los pasos de una luna' => ['-050-0580x 15', null],
            'radio de lente de contacto' => ['7,45 8.60 -2,00 Dia 8,8', null],
            'con punto' => ['+2.50-0.75x103', ['2.50', '-0.75', 103, null, null]],
            'esfera neutra' => ['N -025 X 15 20/20', ['N', '-0.25', 15, '20/20', null]],
            'neutra pegada' => ['N-3.00X8', ['N', '-3.00', 8, null, null]],
            'solo neutro' => ['n 20/20', ['N', null, null, '20/20', null]],
            'solo esfera' => ['+075', ['0.75', null, null, null, null]],
            'esfera rotulada' => ['-050 Esf.', ['-0.50', null, null, null, null]],
            'esfera con agudeza' => ['+050 20/20', ['0.50', null, null, '20/20', null]],
            'cilindro con eje' => ['-100 X 180 20/20', [null, '-1.00', 180, '20/20', null]],
            'eje sin la x' => ['+075 -275 175', ['0.75', '-2.75', 175, null, null]],
            'eje pegado a la agudeza' => ['-275-200x 520/30+', ['-2.75', '-2.00', 5, '20/30+', null]],
            'cilindro sin eje' => ['+300 -050 x', ['3.00', '-0.50', null, null, null]],
            'comprobado con cc' => ['-075 -025 X 5 20/20 CC', ['-0.75', '-0.25', 5, '20/20', 'CC']],
            'con nota' => ['N -050 X 5 20/20 prog ev gold', ['N', '-0.50', 5, '20/20', 'prog ev gold']],
            'tipo de lente' => ['-050-150x15 Varilux Confort AR BL', ['-0.50', '-1.50', 15, null, 'Varilux Confort AR BL']],
            'eje ilegible' => ['+225-100x c65', ['2.25', '-1.00', null, null, 'c65']],
            'nota con numero' => ['6 años, usó también de lectura', null],
            'nota' => ['No trajo', null],
            'sin medida' => ['sin bateria', null],
            'no empieza por la medida' => ['Trae Rx. -200 -100 x 180', null],
            'medida imposible' => ['-50165', null],
        ];
    }

    public function test_subjective_written_in_the_cylinder_column_is_split(): void
    {
        $this->assertSame(
            ['esfera' => '0.50', 'esfera_neutral' => false, 'cilindro' => '-1.00', 'eje' => 80, 'avl' => '20/40-', 'legible' => true],
            LegacyOpticalParser::subjective(null, '+050-100x 80 20/40-', null, null)
        );
    }

    public function test_subjective_with_real_columns_is_respected(): void
    {
        $this->assertSame(
            ['esfera' => '-0.50', 'esfera_neutral' => false, 'cilindro' => '1.25', 'eje' => 0, 'avl' => null, 'legible' => true],
            LegacyOpticalParser::subjective('-050', '125', '0', null)
        );
    }

    public function test_subjective_that_is_not_a_clean_refraction_is_flagged(): void
    {
        $this->assertFalse(LegacyOpticalParser::subjective(null, 'sin bateria', null, null)['legible']);
        $this->assertFalse(LegacyOpticalParser::subjective(null, '+225-100x c65', null, null)['legible']);
    }

    public function test_rx_en_uso_with_legacy_shape_reads_the_prescription_from_the_axis_column(): void
    {
        $this->assertSame(
            ['esfera' => '-0.50', 'esfera_neutral' => false, 'cilindro' => null, 'eje' => null, 'add' => '2.50', 'avcc' => '20/25', 'observacion' => null],
            LegacyOpticalParser::rxUso('20/25', null, '-050', '250', null)
        );

        // "300" no puede ser un eje: tambien es una esfera.
        $this->assertSame('3.00', LegacyOpticalParser::rxUso('20', null, '300', null, null)['esfera']);

        $this->assertSame(
            ['esfera' => null, 'esfera_neutral' => true, 'cilindro' => '-0.50', 'eje' => 5, 'add' => '2.00', 'avcc' => '20/25-', 'observacion' => '20/20 prog ev gold'],
            LegacyOpticalParser::rxUso('20/25-', null, 'N -050 X 5 20/20 prog ev gold', '+200', null)
        );

        // "CD 3m" (cuenta dedos) es una agudeza, no una esfera de 3.00.
        $this->assertSame(
            ['esfera' => '1.25', 'esfera_neutral' => false, 'cilindro' => '-1.25', 'eje' => 25, 'add' => null, 'avcc' => 'CD 3m', 'observacion' => null],
            LegacyOpticalParser::rxUso('CD 3m', null, '125-125x 25', null, null)
        );
    }

    public function test_rx_en_uso_without_a_prescription_keeps_the_note(): void
    {
        $this->assertSame(
            ['esfera' => null, 'esfera_neutral' => false, 'cilindro' => null, 'eje' => null, 'add' => null, 'avcc' => '20/40', 'observacion' => 'No trajo. Tiene 5 años'],
            LegacyOpticalParser::rxUso('20/40', null, 'No trajo. Tiene 5 años', null, null)
        );
    }

    public function test_rx_en_uso_with_real_columns_is_respected(): void
    {
        $this->assertSame(
            ['esfera' => '-1.25', 'esfera_neutral' => false, 'cilindro' => '-0.50', 'eje' => 90, 'add' => null, 'avcc' => '20/20', 'observacion' => null],
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
