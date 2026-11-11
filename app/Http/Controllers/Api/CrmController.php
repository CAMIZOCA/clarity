<?php

namespace App\Http\Controllers\Api;

use App\Enums\Permission;
use App\Http\Controllers\Api\Concerns\ApiResponses;
use App\Http\Controllers\Controller;
use App\Jobs\SendWhatsAppMessage;
use App\Models\Campaign;
use App\Models\CampaignSend;
use App\Models\Consultation;
use App\Models\MessageTemplate;
use App\Models\Patient;
use App\Models\Reminder;
use App\Services\CrmService;
use App\Services\WhatsAppService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CrmController extends Controller
{
    use ApiResponses;

    public function __construct(private CrmService $crmService) {}

    /**
     * Lo que pide la pantalla de Recordatorios (lista, vista previa, contactos y
     * elegir plantilla). `crm.reminders` lo abre sin Campañas ni Plantillas: es
     * lo que tiene Recepcion. Enviar sigue pidiendo `crm.send_messages`.
     */
    private function canUseReminders(Request $request): bool
    {
        return $request->user()->canAny([
            Permission::CRM_VIEW->value,
            Permission::CRM_REMINDERS->value,
        ]);
    }

    // ─── Templates ────────────────────────────────────────────────────────────

    /**
     * GET /api/crm/templates
     * Listar plantillas activas.
     */
    public function templates(Request $request): JsonResponse
    {
        if (! $this->canUseReminders($request)) {
            return $this->forbidden();
        }

        $query = MessageTemplate::query();

        if ($request->boolean('active_only', true)) {
            $query->where('is_active', true);
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('channel')) {
            $query->where('channel', $request->channel);
        }

        $templates = $query->orderBy('name')->get();

        return $this->ok(['data' => $templates]);
    }

    /**
     * POST /api/crm/templates
     * Crear plantilla.
     */
    public function storeTemplate(Request $request): JsonResponse
    {
        if (! $request->user()->can(Permission::CRM_CAMPAIGNS->value)) {
            return $this->forbidden();
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
            'type' => 'required|in:appointment_reminder,lab_ready,birthday,reorder,balance_reminder,custom,campaign',
            'channel' => 'required|in:whatsapp,email,sms',
            'subject' => 'nullable|string|max:200',
            'body' => 'required|string',
            'variables' => 'nullable|array',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $template = MessageTemplate::create($validator->validated());

        return $this->created($template);
    }

    /**
     * PUT /api/crm/templates/{template}
     * Actualizar plantilla.
     */
    public function updateTemplate(Request $request, MessageTemplate $template): JsonResponse
    {
        if (! $request->user()->can(Permission::CRM_CAMPAIGNS->value)) {
            return $this->forbidden();
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:100',
            'type' => 'sometimes|in:appointment_reminder,lab_ready,birthday,reorder,balance_reminder,custom,campaign',
            'channel' => 'sometimes|in:whatsapp,email,sms',
            'subject' => 'nullable|string|max:200',
            'body' => 'sometimes|string',
            'variables' => 'nullable|array',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $template->update($validator->validated());

        return $this->ok(['data' => $template->fresh()]);
    }

    // ─── Reminders ────────────────────────────────────────────────────────────

    /**
     * GET /api/crm/reminders
     * Listar recordatorios con filtros.
     */
    public function reminders(Request $request): JsonResponse
    {
        if (! $this->canUseReminders($request)) {
            return $this->forbidden();
        }

        $query = Reminder::with(['patient:id,nombre,apellido,cedula,telefono', 'template:id,name', 'createdBy:id,name'])
            ->orderByDesc('scheduled_at')
            ->orderByDesc('id');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('channel')) {
            $query->where('channel', $request->channel);
        }

        if ($request->filled('search')) {
            foreach (preg_split('/\s+/', trim($request->search)) as $word) {
                $query->whereHas('patient', function ($q) use ($word) {
                    $q->where('nombre', 'LIKE', "%{$word}%")
                        ->orWhere('apellido', 'LIKE', "%{$word}%")
                        ->orWhere('cedula', 'LIKE', "%{$word}%");
                });
            }
        }

        if ($request->filled('patient_id')) {
            $query->where('patient_id', $request->patient_id);
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('scheduled_at', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('scheduled_at', '<=', $request->date_to);
        }

        $reminders = $query->paginate($request->integer('per_page', 25));

        return $this->ok($reminders);
    }

    /**
     * POST /api/crm/reminders
     * Crear recordatorio manual.
     */
    public function storeReminder(Request $request): JsonResponse
    {
        if (! $request->user()->can(Permission::CRM_SEND_MESSAGES->value)) {
            return $this->forbidden();
        }

        $validator = Validator::make($request->all(), [
            'patient_id' => 'required|exists:patients,id',
            'template_id' => 'nullable|exists:message_templates,id',
            'type' => 'required|in:appointment,lab_ready,birthday,control_visual,reorder,balance,custom',
            'channel' => 'required|in:whatsapp,email,sms',
            'message' => 'required|string',
            'scheduled_at' => 'required|date',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $reminder = Reminder::create([
            ...$validator->validated(),
            'created_by' => $request->user()->id,
            'status' => 'pending',
        ]);

        return $this->created($reminder->load('patient'));
    }

    // ─── WhatsApp manual ──────────────────────────────────────────────────────

    /**
     * GET /api/crm/whatsapp-contacts
     * Atendidos en los ultimos 30 dias o, con ?search=, todo el padron.
     */
    public function whatsappContacts(Request $request): JsonResponse
    {
        if (! $this->canUseReminders($request)) {
            return $this->forbidden();
        }

        $contacts = $this->crmService->whatsappContacts(
            $request->string('search')->toString(),
            min(max($request->integer('per_page', 25), 1), 100)
        );

        return $this->ok([
            'data' => $contacts,
            'automatic' => app(WhatsAppService::class)->canSendAutomatically(),
            'recent_days' => CrmService::RECENT_VISIT_DAYS,
        ]);
    }

    /**
     * GET /api/crm/reminders/preview
     * Mensaje resuelto con los datos del paciente.
     */
    public function previewReminder(Request $request): JsonResponse
    {
        if (! $this->canUseReminders($request)) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'patient_id' => 'required|integer|exists:patients,id',
            'template_id' => 'nullable|integer|exists:message_templates,id',
        ]);

        $preview = $this->crmService->previewMessage(
            Patient::findOrFail($validated['patient_id']),
            isset($validated['template_id']) ? MessageTemplate::find($validated['template_id']) : null
        );

        return $this->ok(['data' => $preview]);
    }

    /**
     * POST /api/crm/reminders/whatsapp
     * Registra que se abrio WhatsApp con el aviso de lentes listos.
     */
    public function recordWhatsApp(Request $request): JsonResponse
    {
        if (! $request->user()->can(Permission::CRM_SEND_MESSAGES->value)) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'patient_id' => 'required|integer|exists:patients,id',
            'consultation_id' => 'nullable|integer|exists:consultations,id',
            'template_id' => 'nullable|integer|exists:message_templates,id',
            'message' => 'required|string|max:4000',
        ]);

        $patient = Patient::findOrFail($validated['patient_id']);
        $consultation = isset($validated['consultation_id'])
            ? Consultation::where('patient_id', $patient->id)->find($validated['consultation_id'])
            : null;

        $reminder = $this->crmService->recordWhatsAppSent(
            $patient,
            $validated['message'],
            $consultation,
            $request->user(),
            $validated['template_id'] ?? null
        );

        return $this->created($reminder->load('createdBy:id,name'), 'Marcado como enviado.');
    }

    /**
     * PATCH /api/crm/reminders/{reminder}/status
     * Enviar desde la lista (sent) o deshacer (pending / cancelled).
     */
    public function updateReminderStatus(Request $request, Reminder $reminder): JsonResponse
    {
        if (! $request->user()->can(Permission::CRM_SEND_MESSAGES->value)) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'status' => 'required|in:sent,pending,cancelled',
            'message' => 'nullable|string|max:4000',
        ]);

        $reminder = $this->crmService->setReminderStatus($reminder, $validated['status'], $validated['message'] ?? null);

        return $this->ok(['data' => $reminder]);
    }

    // ─── Campaigns ────────────────────────────────────────────────────────────

    /**
     * GET /api/crm/campaigns
     * Listar campañas.
     */
    public function campaigns(Request $request): JsonResponse
    {
        if (! $request->user()->can(Permission::CRM_VIEW->value)) {
            return $this->forbidden();
        }

        $query = Campaign::with(['template', 'createdBy'])
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $campaigns = $query->paginate($request->integer('per_page', 15));

        return $this->ok($campaigns);
    }

    /**
     * POST /api/crm/campaigns
     * Crear campaña.
     */
    public function storeCampaign(Request $request): JsonResponse
    {
        if (! $request->user()->can(Permission::CRM_CAMPAIGNS->value)) {
            return $this->forbidden();
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:150',
            'channel' => 'required|in:whatsapp,email',
            'template_id' => 'nullable|exists:message_templates,id',
            'message_body' => 'required|string',
            'segment_criteria' => 'required|array',
            'status' => 'in:draft,scheduled',
            'scheduled_at' => 'nullable|date|after:now',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $campaign = $this->crmService->createCampaign(
            $validator->validated(),
            $request->user()->id
        );

        return $this->created($campaign->load('template'));
    }

    /**
     * POST /api/crm/campaigns/preview
     * Previsualizar destinatarios sin guardar.
     */
    public function previewCampaign(Request $request): JsonResponse
    {
        if (! $request->user()->can(Permission::CRM_VIEW->value)) {
            return $this->forbidden();
        }

        $validator = Validator::make($request->all(), [
            'segment_criteria' => 'required|array',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $preview = $this->crmService->previewCampaignRecipients(
            $request->input('segment_criteria', [])
        );

        return $this->ok(['data' => $preview]);
    }

    /**
     * POST /api/crm/campaigns/{campaign}/send
     * Despachar campaña a todos los destinatarios.
     */
    public function sendCampaign(Request $request, Campaign $campaign): JsonResponse
    {
        if (! $request->user()->can(Permission::CRM_CAMPAIGNS->value)) {
            return $this->forbidden();
        }

        if (! in_array($campaign->status, ['draft', 'scheduled'])) {
            return response()->json([
                'message' => "La campaña no puede enviarse en estado '{$campaign->status}'.",
            ], 422);
        }

        $campaign->update([
            'status' => 'running',
            'started_at' => now(),
        ]);

        // Segmentar pacientes
        $patients = $this->crmService->segmentPatients($campaign->segment_criteria ?? []);

        $campaign->update(['total_recipients' => $patients->count()]);

        foreach ($patients as $patient) {
            $message = $this->crmService->resolveMessage($campaign->message_body, $patient);

            // Crear un Reminder por cada paciente y despacharlo
            $reminder = Reminder::create([
                'patient_id' => $patient->id,
                'template_id' => $campaign->template_id,
                'created_by' => $request->user()->id,
                'type' => 'custom',
                'channel' => $campaign->channel,
                'message' => $message,
                'status' => 'pending',
                'scheduled_at' => now(),
            ]);

            // Registrar en campaign_sends
            CampaignSend::create([
                'campaign_id' => $campaign->id,
                'patient_id' => $patient->id,
                'message_sent' => $message,
                'status' => 'pending',
            ]);

            SendWhatsAppMessage::dispatch($reminder);
        }

        return $this->ok([
            'data' => $campaign->fresh(),
            'message' => "Campaña despachada a {$patients->count()} destinatarios.",
        ]);
    }
}
