<?php

namespace Tests\Unit;

use App\Rules\ValidEcuadorPhone;
use PHPUnit\Framework\TestCase;

class ValidEcuadorPhoneTest extends TestCase
{
    public function test_accepts_local_mobile_number(): void
    {
        $this->assertValidationPasses('0991234567');
    }

    public function test_accepts_mobile_number_with_country_code(): void
    {
        $this->assertValidationPasses('+593 99 123 4567');
    }

    public function test_accepts_local_landline_number(): void
    {
        $this->assertValidationPasses('02-234-5678');
    }

    public function test_rejects_non_ecuadorian_phone_number(): void
    {
        $this->assertValidationFails('+1 555 123 4567');
    }

    public function test_rejects_too_short_number(): void
    {
        $this->assertValidationFails('099123');
    }

    private function assertValidationPasses(mixed $value): void
    {
        $failed = false;

        (new ValidEcuadorPhone())->validate('phone', $value, function () use (&$failed): void {
            $failed = true;
        });

        $this->assertFalse($failed);
    }

    private function assertValidationFails(mixed $value): void
    {
        $failed = false;

        (new ValidEcuadorPhone())->validate('phone', $value, function () use (&$failed): void {
            $failed = true;
        });

        $this->assertTrue($failed);
    }
}
