<?php

namespace Tests\Unit;

use App\Rules\ValidEcuadorCedula;
use PHPUnit\Framework\TestCase;

class ValidEcuadorCedulaTest extends TestCase
{
    public function test_accepts_valid_ecuadorian_cedula(): void
    {
        $this->assertValidationPasses(new ValidEcuadorCedula(), '1710034065');
    }

    public function test_accepts_valid_ruc_when_enabled(): void
    {
        $this->assertValidationPasses(new ValidEcuadorCedula(), '1710034065001');
    }

    public function test_accepts_passport_when_enabled(): void
    {
        $this->assertValidationPasses(new ValidEcuadorCedula(), 'AB12345');
    }

    public function test_rejects_invalid_verifier_digit(): void
    {
        $this->assertValidationFails(new ValidEcuadorCedula(), '1710034064');
    }

    public function test_rejects_ruc_when_disabled(): void
    {
        $this->assertValidationFails(new ValidEcuadorCedula(allowRuc: false), '1710034065001');
    }

    /** El tercer digito 6 tambien es de personas: paciente real del sistema anterior. */
    public function test_accepts_identification_with_third_digit_six(): void
    {
        $this->assertValidationPasses(new ValidEcuadorCedula(), '1761723178');
        $this->assertValidationPasses(new ValidEcuadorCedula(), '1761723178001');
    }

    public function test_accepts_public_entity_ruc(): void
    {
        $this->assertValidationPasses(new ValidEcuadorCedula(), '1760013210001');
    }

    public function test_accepts_company_ruc(): void
    {
        $this->assertValidationPasses(new ValidEcuadorCedula(), '1790016919001');
    }

    public function test_each_rejection_states_its_reason(): void
    {
        $verifier = 'El dígito verificador no coincide: suele ser un error de tecleo.';

        foreach ([
            '1761723179' => $verifier,
            '1760013220001' => $verifier,
            '1790016918001' => $verifier,
            '9910034065' => 'Los dos primeros dígitos (99) no corresponden a ninguna provincia.',
            '1771723176' => 'El tercer dígito es 7 y no corresponde a una cédula. Si es un RUC, debe tener 13 dígitos.',
            '1791723172' => 'El tercer dígito es 9 y no corresponde a una cédula. Si es un RUC, debe tener 13 dígitos.',
            '1771723176001' => 'El tercer dígito es 7 y no corresponde a ningún tipo de RUC.',
            '1710034065000' => 'Los últimos dígitos del RUC no pueden ser 000.',
            '17100340' => 'Tiene 8 dígitos; la cédula lleva 10 y el RUC 13.',
        ] as $value => $message) {
            $this->assertSame([$message], $this->failuresOf(new ValidEcuadorCedula(), (string) $value), (string) $value);
        }
    }

    /** @return list<string> */
    private function failuresOf(ValidEcuadorCedula $rule, string $value): array
    {
        $failures = [];

        $rule->validate('identification', $value, function (string $message) use (&$failures): void {
            $failures[] = $message;
        });

        return $failures;
    }

    private function assertValidationPasses(ValidEcuadorCedula $rule, mixed $value): void
    {
        $failed = false;

        $rule->validate('identification', $value, function () use (&$failed): void {
            $failed = true;
        });

        $this->assertFalse($failed);
    }

    private function assertValidationFails(ValidEcuadorCedula $rule, mixed $value): void
    {
        $failed = false;

        $rule->validate('identification', $value, function () use (&$failed): void {
            $failed = true;
        });

        $this->assertTrue($failed);
    }
}
