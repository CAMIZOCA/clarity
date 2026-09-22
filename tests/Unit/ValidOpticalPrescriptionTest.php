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

    public function test_accepts_neutral_sphere_when_allowed(): void
    {
        $this->assertValidationPasses(new ValidOpticalPrescription('sphere', allowNeutral: true), 'N');
        $this->assertValidationPasses(new ValidOpticalPrescription('sphere', allowNeutral: true), 'n');
    }

    public function test_rejects_neutral_value_when_not_allowed(): void
    {
        $this->assertValidationFails(new ValidOpticalPrescription('sphere'), 'N');
    }

    public function test_rejects_neutral_value_for_cylinder_by_default(): void
    {
        // El formulario solo activa allowNeutral para esfera; cilindro/eje/add
        // se instancian siempre sin el (ver StoreConsultationRequest::rules()).
        $this->assertValidationFails(new ValidOpticalPrescription('cylinder'), 'N');
    }

    public function test_without_range_skips_clinical_range_but_still_requires_numeric_or_neutral(): void
    {
        $relaxed = (new ValidOpticalPrescription('axis'))->withoutRange();

        $this->assertValidationPasses($relaxed, 999);
        $this->assertValidationFails($relaxed, 'not-a-number');
    }

    public function test_without_range_still_accepts_neutral_sphere(): void
    {
        $relaxed = (new ValidOpticalPrescription('sphere', allowNeutral: true))->withoutRange();

        $this->assertValidationPasses($relaxed, 'N');
        $this->assertValidationPasses($relaxed, 999);
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
