<?php

namespace App\Http\Controllers\Api;

use App\Enums\Permission;
use App\Http\Controllers\Api\Concerns\ApiResponses;
use App\Http\Controllers\Controller;
use App\Mail\CertificateMail;
use App\Models\Certificate;
use App\Models\Consultation;
use App\Models\Setting;
use App\Services\MailConfigService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class CertificateController extends Controller
{
    use ApiResponses;

    /**
     * Listar certificados guardados (por paciente o consulta).
     * GET /api/certificates?patient_id=&consultation_id=
     */
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->can(Permission::CONSULTATIONS_PDF->value)) {
            return $this->forbidden();
        }

        $query = Certificate::with('certifyingDoctor:id,nombre')
            ->orderByDesc('created_at');

        if ($patientId = $request->input('patient_id')) {
            $query->where('patient_id', $patientId);
        }
        if ($consultationId = $request->input('consultation_id')) {
            $query->where('consultation_id', $consultationId);
        }

        return $this->ok($query->limit(100)->get());
    }

    /**
     * Guardar (y opcionalmente enviar por correo) un certificado.
     * El PDF lo genera el cliente con html2pdf.js y se sube aquí.
     * POST /api/certificates  (multipart)
     */
    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->can(Permission::CONSULTATIONS_PDF->value)) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'consultation_id' => ['required', 'integer', 'exists:consultations,id'],
            'pdf' => ['required', 'file', 'mimes:pdf', 'max:8192'],
            'certifying_doctor_id' => ['nullable', 'integer', 'exists:certifying_doctors,id'],
            'recipient_email' => ['nullable', 'email'],
            'subject' => ['nullable', 'string', 'max:255'],
            'send' => ['nullable', 'boolean'],
        ]);

        $consultation = Consultation::with('patient:id,branch_id')->findOrFail($validated['consultation_id']);
        $send = $request->boolean('send');

        $path = $request->file('pdf')->store('certificates', 'public');

        $branchId = $consultation->patient?->branch_id
            ?? ($request->header('X-Branch-Id') ?: null);

        $certificate = Certificate::create([
            'consultation_id' => $consultation->id,
            'patient_id' => $consultation->patient_id,
            'branch_id' => $branchId,
            'certifying_doctor_id' => $validated['certifying_doctor_id'] ?? null,
            'numero_consulta' => $consultation->numero_consulta,
            'pdf_path' => $path,
            'recipient_email' => $validated['recipient_email'] ?? null,
            'subject' => $validated['subject'] ?? null,
            'status' => 'generado',
            'created_by' => $request->user()->id,
        ]);

        if ($send) {
            $recipient = $validated['recipient_email'] ?? null;
            if (! $recipient) {
                return $this->error('Debe indicar un correo destinatario para enviar el certificado.');
            }

            if (! MailConfigService::isConfigured()) {
                return $this->error('El correo SMTP no está configurado. Revise Configuraciones → Correo.');
            }

            try {
                MailConfigService::apply();
                Mail::to($recipient)->send(new CertificateMail($certificate));

                $certificate->update([
                    'status' => 'enviado',
                    'sent_at' => now(),
                ]);
            } catch (\Throwable $e) {
                Log::error('Error al enviar certificado', ['id' => $certificate->id, 'error' => $e->getMessage()]);
                $certificate->update([
                    'status' => 'error',
                    'error_message' => $e->getMessage(),
                ]);

                return $this->error('El certificado se guardó, pero no se pudo enviar el correo: '.$e->getMessage(), 502);
            }
        }

        return $this->created($certificate->fresh(), $send ? 'Certificado guardado y enviado.' : 'Certificado guardado.');
    }

    /**
     * Enviar un correo de prueba con la configuración SMTP guardada.
     * POST /api/certificates/test-email
     */
    public function sendTest(Request $request): JsonResponse
    {
        if (! $request->user()->can(Permission::SETTINGS_EDIT->value)) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'recipient' => ['required', 'email'],
        ]);

        if (! MailConfigService::isConfigured()) {
            return $this->error('El correo SMTP no está configurado. Complete los datos de Correo.');
        }

        try {
            MailConfigService::apply();
            $clinic = Setting::get('clinic_name', 'Óptica');

            Mail::raw(
                "Este es un correo de prueba de {$clinic}. Si lo recibe, la configuración SMTP funciona correctamente.",
                fn ($message) => $message
                    ->to($validated['recipient'])
                    ->subject("Prueba de correo - {$clinic}")
            );
        } catch (\Throwable $e) {
            Log::error('Error en correo de prueba', ['error' => $e->getMessage()]);

            return $this->error('No se pudo enviar el correo de prueba: '.$e->getMessage(), 502);
        }

        return $this->ok(['sent' => true], 'Correo de prueba enviado.');
    }
}
