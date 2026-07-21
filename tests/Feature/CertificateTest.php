<?php

namespace Tests\Feature;

use App\Enums\Permission;
use App\Mail\CertificateMail;
use App\Models\Certificate;
use App\Models\CertifyingDoctor;
use App\Models\Consultation;
use App\Models\Patient;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission as SpatiePermission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class CertificateTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
        Storage::fake('public');
    }

    private function userWith(string $permission): User
    {
        $user = User::factory()->create();
        SpatiePermission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
        $user->givePermissionTo($permission);

        return $user;
    }

    private function makeConsultation(): Consultation
    {
        $patient = Patient::create([
            'nombre' => 'Violeta Almeida',
            'cedula' => '1760402469',
            'fecha_nacimiento' => '2021-01-15',
            'email' => 'paciente@correo.com',
        ]);

        return Consultation::create([
            'patient_id' => $patient->id,
            'fecha_consulta' => '2026-07-16',
        ]);
    }

    private function pdf(): UploadedFile
    {
        return UploadedFile::fake()->create('certificado.pdf', 120, 'application/pdf');
    }

    public function test_certificate_is_stored_and_linked_to_patient(): void
    {
        Sanctum::actingAs($this->userWith(Permission::CONSULTATIONS_PDF->value));
        $consultation = $this->makeConsultation();

        $this->post('/api/certificates', [
            'consultation_id' => $consultation->id,
            'pdf' => $this->pdf(),
        ])->assertCreated();

        $certificate = Certificate::first();
        $this->assertNotNull($certificate);
        $this->assertSame($consultation->id, $certificate->consultation_id);
        $this->assertSame($consultation->patient_id, $certificate->patient_id);
        $this->assertSame('generado', $certificate->status);
        Storage::disk('public')->assertExists($certificate->pdf_path);
    }

    public function test_certificate_is_emailed_when_send_is_requested(): void
    {
        Mail::fake();
        Setting::set('mail_host', 'smtp.gmail.com');

        Sanctum::actingAs($this->userWith(Permission::CONSULTATIONS_PDF->value));
        $consultation = $this->makeConsultation();
        $doctor = CertifyingDoctor::create(['nombre' => 'Pamela López', 'registro_senescyt' => '2250-2021']);

        $this->post('/api/certificates', [
            'consultation_id' => $consultation->id,
            'certifying_doctor_id' => $doctor->id,
            'recipient_email' => 'paciente@correo.com',
            'send' => '1',
            'pdf' => $this->pdf(),
        ])->assertCreated();

        Mail::assertSent(CertificateMail::class);

        $certificate = Certificate::first();
        $this->assertSame('enviado', $certificate->status);
        $this->assertNotNull($certificate->sent_at);
        $this->assertSame($doctor->id, $certificate->certifying_doctor_id);
    }

    public function test_send_fails_when_smtp_is_not_configured(): void
    {
        Mail::fake();
        Setting::set('mail_host', '');

        Sanctum::actingAs($this->userWith(Permission::CONSULTATIONS_PDF->value));
        $consultation = $this->makeConsultation();

        $this->post('/api/certificates', [
            'consultation_id' => $consultation->id,
            'recipient_email' => 'paciente@correo.com',
            'send' => '1',
            'pdf' => $this->pdf(),
        ])->assertStatus(422);

        Mail::assertNothingSent();
    }

    public function test_non_pdf_upload_is_rejected(): void
    {
        Sanctum::actingAs($this->userWith(Permission::CONSULTATIONS_PDF->value));
        $consultation = $this->makeConsultation();

        $this->post('/api/certificates', [
            'consultation_id' => $consultation->id,
            'pdf' => UploadedFile::fake()->image('foto.jpg'),
        ], ['Accept' => 'application/json'])->assertStatus(422);
    }

    public function test_user_without_pdf_permission_cannot_store_certificate(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $consultation = $this->makeConsultation();

        $this->post('/api/certificates', [
            'consultation_id' => $consultation->id,
            'pdf' => $this->pdf(),
        ])->assertForbidden();
    }

    public function test_certificates_can_be_listed_by_patient(): void
    {
        Sanctum::actingAs($this->userWith(Permission::CONSULTATIONS_PDF->value));
        $consultation = $this->makeConsultation();

        $this->post('/api/certificates', [
            'consultation_id' => $consultation->id,
            'pdf' => $this->pdf(),
        ])->assertCreated();

        $this->getJson('/api/certificates?patient_id='.$consultation->patient_id)
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }
}
