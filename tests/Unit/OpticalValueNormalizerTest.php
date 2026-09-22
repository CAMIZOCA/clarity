<?php

namespace Tests\Unit;

use App\Support\OpticalValueNormalizer;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class OpticalValueNormalizerTest extends TestCase
{
    #[DataProvider('sphereCases')]
    public function test_normalizes_sphere_values(string $input, string $expected): void
    {
        $this->assertSame($expected, OpticalValueNormalizer::normalize($input, 'sphere'));
    }

    public static function sphereCases(): array
    {
        return [
            '3 digits no sign' => ['025', '0.25'],
            'plus sign 3 digits' => ['+025', '+0.25'],
            'minus sign 3 digits' => ['-050', '-0.50'],
            'no sign 3 digits' => ['250', '2.50'],
            '4 digits' => ['1225', '12.25'],
            'single digit integer' => ['2', '2.00'],
            'two digit integer' => ['12', '12.00'],
            'neutral uppercase' => ['N', 'N'],
            'neutral lowercase' => ['n', 'N'],
            'neutral word' => ['neutro', 'N'],
            'neutral plano' => ['plano', 'N'],
            'neutral pl' => ['pl', 'N'],
            'internal space' => ['+0 25', '+0.25'],
            'comma decimal' => ['0,25', '0.25'],
            'already has dot' => ['-2.5', '-2.50'],
        ];
    }

    #[DataProvider('cylinderAddCases')]
    public function test_normalizes_cylinder_and_add_values(string $type, string $input, string $expected): void
    {
        $this->assertSame($expected, OpticalValueNormalizer::normalize($input, $type));
    }

    public static function cylinderAddCases(): array
    {
        return [
            ['cylinder', '-050', '-0.50'],
            ['cylinder', '025', '0.25'],
            ['add', '250', '2.50'],
            ['add', '2', '2.00'],
        ];
    }

    #[DataProvider('axisCases')]
    public function test_normalizes_axis_values(string $input, string $expected): void
    {
        $this->assertSame($expected, OpticalValueNormalizer::normalize($input, 'axis'));
    }

    public static function axisCases(): array
    {
        return [
            'plain' => ['90', '90'],
            'leading zero' => ['05', '5'],
            'degree symbol' => ['145°', '145'],
        ];
    }

    public function test_null_and_empty_pass_through_unchanged(): void
    {
        $this->assertNull(OpticalValueNormalizer::normalize(null, 'sphere'));
        $this->assertSame('', OpticalValueNormalizer::normalize('', 'sphere'));
    }

    public function test_unparseable_value_is_returned_unchanged_for_downstream_validation(): void
    {
        $this->assertSame('not-a-number', OpticalValueNormalizer::normalize('not-a-number', 'sphere'));
    }
}
