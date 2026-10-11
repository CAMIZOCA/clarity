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

    /** Recepcion anota el fijo sin codigo de provincia: asi estan 459 importados. */
    public function test_accepts_local_landline_without_area_code(): void
    {
        $this->assertValidationPasses('2345678');
        $this->assertValidationPasses('234-5678');
    }

    public function test_accepts_foreign_number_with_country_code(): void
    {
        $this->assertValidationPasses('+1 555 123 4567');
        $this->assertValidationPasses('+57 300 1234567');
    }

    /** Sin "+" no hay forma de saber que es extranjero: sigue siendo un error. */
    public function test_rejects_foreign_number_without_plus(): void
    {
        $this->assertValidationFails('573001234567');
    }

    public function test_rejects_ecuadorian_number_with_wrong_length(): void
    {
        $this->assertValidationFails('+593 99 123 456');
    }

    public function test_rejects_too_short_number(): void
    {
        $this->assertValidationFails('099123');
        $this->assertValidationFails('1234567');
    }

    public function test_rejects_text(): void
    {
        $this->assertValidationFails('NO TIENE');
        $this->assertValidationFails('+abc 12345678');
    }

    private function assertValidationPasses(mixed $value): void
    {
        $failed = false;

        (new ValidEcuadorPhone)->validate('phone', $value, function () use (&$failed): void {
            $failed = true;
        });

        $this->assertFalse($failed);
    }

    private function assertValidationFails(mixed $value): void
    {
        $failed = false;

        (new ValidEcuadorPhone)->validate('phone', $value, function () use (&$failed): void {
            $failed = true;
        });

        $this->assertTrue($failed);
    }
}
