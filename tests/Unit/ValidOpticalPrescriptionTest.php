<?php

namespace Tests\Unit;

use App\Rules\ValidOpticalPrescription;
use PHPUnit\Framework\TestCase;

class ValidOpticalPrescriptionTest extends TestCase
{
    public function test_accepts_numeric_value_inside_field_range(): void
    {
        $this->assertValidationPasses(new ValidOpticalPrescription('sphere'), -2.25);
    }

    public function test_accepts_empty_optional_value(): void
    {
        $this->assertValidationPasses(new ValidOpticalPrescription('axis'), '');
    }

    public function test_rejects_non_numeric_value(): void
    {
        $this->assertValidationFails(new ValidOpticalPrescription('sphere'), 'not-a-number');
    }

    public function test_rejects_axis_outside_clinical_range(): void
    {
        $this->assertValidationFails(new ValidOpticalPrescription('axis'), 181);
    }

    public function test_rejects_addition_below_clinical_range(): void
    {
        $this->assertValidationFails(new ValidOpticalPrescription('add'), 0);
    }

    private function assertValidationPasses(ValidOpticalPrescription $rule, mixed $value): void
    {
        $failed = false;

        $rule->validate('prescription', $value, function () use (&$failed): void {
            $failed = true;
        });

        $this->assertFalse($failed);
    }

    private function assertValidationFails(ValidOpticalPrescription $rule, mixed $value): void
    {
        $failed = false;

        $rule->validate('prescription', $value, function () use (&$failed): void {
            $failed = true;
        });

        $this->assertTrue($failed);
    }
}
