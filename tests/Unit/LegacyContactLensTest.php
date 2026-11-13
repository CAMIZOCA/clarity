<?php

namespace Tests\Unit;

use App\Support\LegacyContactLens;
use PHPUnit\Framework\TestCase;

class LegacyContactLensTest extends TestCase
{
    public function test_flat_trial_lens_keys_are_nested_like_the_form_reads_them(): void
    {
        // Consulta legacy 66746 tal como la dejo la importacion.
        $result = LegacyContactLens::nestTestLens([
            'bc_od' => '8,3', 'poder_od' => '-2 -2 x 180', 'diametro_od' => '14,0', 'material_od' => 'Blandos',
            'h2o_od' => '49 %', 'sobreref_od' => '-050 -075x10', 'av_od' => '20/20-', 'av_oi' => '20/20',
            'calificacion' => 'Buena',
        ]);

        $this->assertSame('8,3', $result['lens']['od']['curva_base']);
        $this->assertSame('-2 -2 x 180', $result['lens']['od']['poder']);
        $this->assertSame('-050 -075x10', $result['lens']['od']['sobre_refraccion']);
        $this->assertSame('20/20-', $result['lens']['od']['agudeza_visual']);
        $this->assertSame('20/20', $result['lens']['oi']['agudeza_visual']);
        $this->assertNull($result['lens']['oi']['curva_base']);
        $this->assertArrayNotHasKey('bc_od', $result['lens']);
        $this->assertArrayNotHasKey('calificacion', $result['lens']);
        $this->assertSame(['Calificación: Buena'], $result['notes']);
    }

    public function test_a_filled_box_is_not_overwritten_and_the_value_goes_to_the_notes(): void
    {
        $result = LegacyContactLens::nestTestLens([
            'od' => ['curva_base' => '8,6'],
            'bc_od' => '8,3',
            'poder_od' => '',
        ]);

        $this->assertSame('8,6', $result['lens']['od']['curva_base']);
        $this->assertSame(['OD Curva base: 8,3'], $result['notes']);
        $this->assertFalse(LegacyContactLens::hasFlatTestLens($result['lens']));
        $this->assertTrue(LegacyContactLens::hasFlatTestLens(['bc_od' => 'N']));
    }

    public function test_same_power_written_without_decimal_point(): void
    {
        $this->assertTrue(LegacyContactLens::samePower('-425-075x0', '-4.25 -0.75 x 0'));
        // Eje 0 y 180 son el mismo (consulta legacy 71277, OI).
        $this->assertTrue(LegacyContactLens::samePower('-275-075x0', '-2.75 -0.75 x 180'));
        $this->assertTrue(LegacyContactLens::samePower('-350', '-3.50'));
        $this->assertFalse(LegacyContactLens::samePower('-425-075x10', '-4.25 -0.75 x 0'));
        $this->assertFalse(LegacyContactLens::samePower('AE 20/30', '-4.25'));
        $this->assertFalse(LegacyContactLens::samePower(null, '-4.25'));
    }

    public function test_append_note_does_not_repeat(): void
    {
        $this->assertSame('Marca: Biofinity', LegacyContactLens::appendNote(null, 'Marca: Biofinity'));
        $this->assertSame('2 cajas / Marca: Biofinity', LegacyContactLens::appendNote('2 cajas', 'Marca: Biofinity'));
        $this->assertSame('2 cajas / Marca: Biofinity', LegacyContactLens::appendNote('2 cajas / Marca: Biofinity', 'Marca: Biofinity'));
    }

    public function test_summary_of_one_eye(): void
    {
        $lens = ['od' => ['curva_base' => '8,3', 'poder' => '-2 -2 x 180', 'agudeza_visual' => '20/20-']];

        $this->assertSame('Curva base 8,3 · Poder -2 -2 x 180 · AV 20/20-', LegacyContactLens::summary($lens, 'od'));
        $this->assertNull(LegacyContactLens::summary($lens, 'oi'));
    }
}
