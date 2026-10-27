<?php

namespace Tests\Feature;

use App\Enums\Permission;
use App\Models\Certificate;
use App\Models\Consultation;
use App\Models\ConsultationDiagnosis;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission as SpatiePermission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;
use ZipArchive;

class CertificateDocxTest extends TestCase
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
            'nombre' => 'Violeta',
            'apellido' => 'Almeida',
            'cedula' => '1760402469',
            'fecha_nacimiento' => '1990-01-15',
        ]);

        $consultation = Consultation::create([
            'patient_id' => $patient->id,
            'fecha_consulta' => '2026-07-16',
            'rx_final_esfera_od' => '-1.25',
            'rx_final_cilindro_od' => '-0.50',
            'rx_final_eje_od' => '90',
            'rx_final_esfera_oi' => '0.75',
            'certificado_nota' => 'USO PERMANENTE',
            'vision_colores' => '14/14 Test Ishihara',
        ]);

        ConsultationDiagnosis::create([
            'consultation_id' => $consultation->id,
            'eye' => 'od',
            'code' => 'H52.1',
            'description' => 'Miopia',
            'sort_order' => 0,
        ]);

        return $consultation;
    }

    /** Texto plano del documento Word (word/document.xml). */
    private function documentText(string $binary): string
    {
        $path = tempnam(sys_get_temp_dir(), 'docxtest');
        file_put_contents($path, $binary);

        $zip = new ZipArchive;
        $this->assertTrue($zip->open($path) === true, 'El archivo descargado no es un zip válido.');
        $xml = $zip->getFromName('word/document.xml');
        $zip->close();
        @unlink($path);

        $this->assertNotFalse($xml);

        return html_entity_decode(strip_tags($xml), ENT_QUOTES | ENT_XML1, 'UTF-8');
    }

    public function test_general_model_downloads_word_with_rx_final_values(): void
    {
        Sanctum::actingAs($this->userWith(Permission::CONSULTATIONS_PDF->value));
        $consultation = $this->makeConsultation();

        $response = $this->get("/api/consultations/{$consultation->id}/certificado-docx?tipo=general")
            ->assertOk()
            ->assertHeader('Content-Disposition', 'attachment; filename="certificado.docx"');

        $this->assertStringStartsWith(
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            $response->headers->get('Content-Type')
        );

        $text = $this->documentText($response->getContent());

        $this->assertStringContainsString('Violeta Almeida', $text);
        $this->assertStringContainsString("Consulta No: {$consultation->numero_consulta}", $text);
        $this->assertStringContainsString('H52.1 Miopia', $text);
        $this->assertStringContainsString('RX FINAL', $text);
        $this->assertStringContainsString('-1.25', $text);
        $this->assertStringContainsString('+0.75', $text);
        $this->assertStringContainsString('14/14 Test Ishihara', $text);
        $this->assertStringContainsString('USO PERMANENTE', $text);
    }

    public function test_school_and_vehicle_model_omits_rx_final(): void
    {
        Sanctum::actingAs($this->userWith(Permission::CONSULTATIONS_PDF->value));
        $consultation = $this->makeConsultation();

        $response = $this->get("/api/consultations/{$consultation->id}/certificado-docx?tipo=escolar_vehicular")
            ->assertOk();

        $text = $this->documentText($response->getContent());

        $this->assertStringNotContainsString('RX FINAL', $text);
        $this->assertStringContainsString('Violeta Almeida', $text);
        $this->assertStringContainsString('USO PERMANENTE', $text);
    }

    public function test_download_does_not_store_a_certificate_row(): void
    {
        Sanctum::actingAs($this->userWith(Permission::CONSULTATIONS_PDF->value));
        $consultation = $this->makeConsultation();

        $this->get("/api/consultations/{$consultation->id}/certificado-docx")->assertOk();

        $this->assertSame(0, Certificate::count());
    }

    public function test_download_requires_certificate_permission(): void
    {
        Sanctum::actingAs($this->userWith(Permission::CONSULTATIONS_VIEW->value));
        $consultation = $this->makeConsultation();

        $this->get("/api/consultations/{$consultation->id}/certificado-docx")->assertForbidden();
    }

    public function test_unknown_model_and_doctor_are_rejected(): void
    {
        Sanctum::actingAs($this->userWith(Permission::CONSULTATIONS_PDF->value));
        $consultation = $this->makeConsultation();

        $this->getJson("/api/consultations/{$consultation->id}/certificado-docx?tipo=laboral")
            ->assertUnprocessable();

        $this->getJson("/api/consultations/{$consultation->id}/certificado-docx?certifying_doctor_id=99999")
            ->assertUnprocessable();
    }
}
