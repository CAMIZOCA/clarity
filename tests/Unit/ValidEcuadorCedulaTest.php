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
