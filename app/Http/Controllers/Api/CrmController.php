<?php

namespace App\Http\Controllers\Api;

use App\Enums\Permission;
use App\Http\Controllers\Api\Concerns\ApiResponses;
use App\Http\Controllers\Controller;
use App\Jobs\SendWhatsAppMessage;
use App\Models\Campaign;
use App\Models\CampaignSend;
use App\Models\MessageTemplate;
use App\Models\Reminder;
use App\Services\CrmService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CrmController extends Controller
{
    use ApiResponses;

    public function __construct(private CrmService $crmService) {}

    // ─── Templates ────────────────────────────────────────────────────────────

    /**
     * GET /api/crm/templates
     * Listar plantillas activas.
     */
    public function templates(Request $request): JsonResponse
    {
        if (!$request->user()->can(Permission::CRM_VIEW->value)) {
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
        if (!$request->user()->can(Permission::CRM_CAMPAIGNS->value)) {
            return $this->forbidden();
        }

        $validator = Validator::make($request->all(), [
            'name'      => 'required|string|max:100',
            'type'      => 'required|in:appointment_reminder,lab_ready,birthday,reorder,balance_reminder,custom,campaign',
            'channel'   => 'required|in:whatsapp,email,sms',
            'subject'   => 'nullable|string|max:200',
            'body'      => 'required|string',
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
        if (!$request->user()->can(Permission::CRM_CAMPAIGNS->value)) {
            return $this->forbidden();
        }

        $validator = Validator::make($request->all(), [
            'name'      => 'sometimes|string|max:100',
            'type'      => 'sometimes|in:appointment_reminder,lab_ready,birthday,reorder,balance_reminder,custom,campaign',
            'channel'   => 'sometimes|in:whatsapp,email,sms',
            'subject'   => 'nullable|string|max:200',
            'body'      => 'sometimes|string',
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
        if (!$request->user()->can(Permission::CRM_VIEW->value)) {
            return $this->forbidden();
        }

        $query = Reminder::with(['patient', 'template', 'createdBy'])
            ->orderByDesc('scheduled_at');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
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
        if (!$request->user()->can(Permission::CRM_SEND_MESSAGES->value)) {
            return $this->forbidden();
        }

        $validator = Validator::make($request->all(), [
            'patient_id'   => 'required|exists:patients,id',
            'template_id'  => 'nullable|exists:message_templates,id',
            'type'         => 'required|in:appointment,lab_ready,birthday,control_visual,reorder,balance,custom',
            'channel'      => 'required|in:whatsapp,email,sms',
            'message'      => 'required|string',
            'scheduled_at' => 'required|date',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $reminder = Reminder::create([
            ...$validator->validated(),
            'created_by' => $request->user()->id,
            'status'     => 'pending',
        ]);

        return $this->created($reminder->load('patient'));
    }

    // ─── Campaigns ────────────────────────────────────────────────────────────

    /**
     * GET /api/crm/campaigns
     * Listar campañas.
     */
    public function campaigns(Request $request): JsonResponse
    {
        if (!$request->user()->can(Permission::CRM_VIEW->value)) {
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
        if (!$request->user()->can(Permission::CRM_CAMPAIGNS->value)) {
            return $this->forbidden();
        }

        $validator = Validator::make($request->all(), [
            'name'              => 'required|string|max:150',
            'channel'           => 'required|in:whatsapp,email',
            'template_id'       => 'nullable|exists:message_templates,id',
            'message_body'      => 'required|string',
            'segment_criteria'  => 'required|array',
            'status'            => 'in:draft,scheduled',
            'scheduled_at'      => 'nullable|date|after:now',
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
        if (!$request->user()->can(Permission::CRM_VIEW->value)) {
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
        if (!$request->user()->can(Permission::CRM_CAMPAIGNS->value)) {
            return $this->forbidden();
        }

        if (!in_array($campaign->status, ['draft', 'scheduled'])) {
            return response()->json([
                'message' => "La campaña no puede enviarse en estado '{$campaign->status}'.",
            ], 422);
        }

        $campaign->update([
            'status'     => 'running',
            'started_at' => now(),
        ]);

        // Segmentar pacientes
        $patients = $this->crmService->segmentPatients($campaign->segment_criteria ?? []);

        $campaign->update(['total_recipients' => $patients->count()]);

        foreach ($patients as $patient) {
            $message = $this->crmService->resolveMessage($campaign->message_body, $patient);

            // Crear un Reminder por cada paciente y despacharlo
            $reminder = Reminder::create([
                'patient_id'  => $patient->id,
                'template_id' => $campaign->template_id,
                'created_by'  => $request->user()->id,
                'type'        => 'custom',
                'channel'     => $campaign->channel,
                'message'     => $message,
                'status'      => 'pending',
                'scheduled_at'=> now(),
            ]);

            // Registrar en campaign_sends
            CampaignSend::create([
                'campaign_id'  => $campaign->id,
                'patient_id'   => $patient->id,
                'message_sent' => $message,
                'status'       => 'pending',
            ]);

            SendWhatsAppMessage::dispatch($reminder);
        }

        return $this->ok([
            'data'    => $campaign->fresh(),
            'message' => "Campaña despachada a {$patients->count()} destinatarios.",
        ]);
    }
}
