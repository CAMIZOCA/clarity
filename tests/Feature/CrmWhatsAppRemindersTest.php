<?php

namespace Tests\Feature;

use App\Enums\Permission;
use App\Enums\Role;
use App\Jobs\ProcessPendingReminders;
use App\Jobs\SendWhatsAppMessage;
use App\Models\Consultation;
use App\Models\MessageTemplate;
use App\Models\Patient;
use App\Models\Reminder;
use App\Models\User;
use App\Services\WhatsAppService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission as SpatiePermission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * Recordatorios semi-manuales: el sistema no tiene proveedor de WhatsApp, asi
 * que nunca da un mensaje por enviado solo. El usuario abre el chat con el
 * boton (wa.me) y eso es lo unico que marca "Enviado".
 */
class CrmWhatsAppRemindersTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
        $this->travelTo(Carbon::parse('2026-11-04 19:30:00', 'America/Guayaquil'));

        $this->user = $this->userWith([Permission::CRM_VIEW->value, Permission::CRM_SEND_MESSAGES->value]);
        Sanctum::actingAs($this->user);
    }

    private function userWith(array $permissions): User
    {
        $user = User::factory()->create();
        foreach ($permissions as $permission) {
            SpatiePermission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
            $user->givePermissionTo($permission);
        }

        return $user;
    }

    private function patient(string $nombre, string $apellido, string $cedula, ?string $telefono = '0991234567'): Patient
    {
        return Patient::create(compact('nombre', 'apellido', 'cedula', 'telefono') + ['fecha_nacimiento' => '1980-03-02']);
    }

    private function visit(Patient $patient, string $date): Consultation
    {
        return Consultation::create([
            'patient_id' => $patient->id,
            'fecha_consulta' => $date,
            'estado' => 'completada',
        ]);
    }

    public function test_without_search_lists_patients_seen_in_the_last_30_days_newest_first(): void
    {
        $older = $this->patient('Lucia', 'Mena', '1710034065', '0998331913');
        $this->visit($older, '2026-10-10');

        $recent = $this->patient('Pedro', 'Ruiz', '1710034066', '2892229');
        $this->visit($recent, '2026-10-20');
        $second = $this->visit($recent, '2026-11-03');

        $outside = $this->patient('Ana', 'Lopez', '1710034067');
        $this->visit($outside, '2026-09-01');

        $response = $this->getJson('/api/crm/whatsapp-contacts')->assertOk();

        $rows = $response->json('data.data');
        $this->assertSame([$recent->id, $older->id], array_column($rows, 'patient_id'));
        $this->assertSame(30, $response->json('recent_days'));
        $this->assertFalse($response->json('automatic'));

        $this->assertSame('Pedro Ruiz', $rows[0]['nombre_completo']);
        $this->assertSame('2892229', $rows[0]['telefono']);
        $this->assertSame('1710034066', $rows[0]['cedula']);
        $this->assertSame('2026-11-03', $rows[0]['last_visit']);
        $this->assertSame($second->id, $rows[0]['consultation_id']);
        $this->assertNull($rows[0]['notice']);

        $this->assertSame('0998331913', $rows[1]['telefono']);
        $this->assertSame('2026-10-10', $rows[1]['last_visit']);
    }

    public function test_search_covers_every_patient_regardless_of_visit_date(): void
    {
        $old = $this->patient('Rosa', 'Andrade', '1710034065');
        $this->visit($old, '2024-02-15');

        // Historico: nombre completo en `nombre`, apellido vacio.
        $legacy = $this->patient('ROSA MARIA TAPIA', '', '0912345678');

        $this->patient('Pedro', 'Ruiz', '1710034066');

        $rows = $this->getJson('/api/crm/whatsapp-contacts?search=rosa')->assertOk()->json('data.data');
        $this->assertSame([$old->id, $legacy->id], array_column($rows, 'patient_id'));
        $this->assertSame('2024-02-15', $rows[0]['last_visit']);
        $this->assertNull($rows[1]['last_visit']);
        $this->assertNull($rows[1]['consultation_id']);
        $this->assertSame('ROSA MARIA TAPIA', $rows[1]['nombre_completo']);

        $rows = $this->getJson('/api/crm/whatsapp-contacts?search=rosa andrade')->json('data.data');
        $this->assertSame([$old->id], array_column($rows, 'patient_id'));

        $rows = $this->getJson('/api/crm/whatsapp-contacts?search=0912345')->json('data.data');
        $this->assertSame([$legacy->id], array_column($rows, 'patient_id'));
    }

    public function test_preview_resolves_the_lab_ready_template_with_the_patient_name(): void
    {
        MessageTemplate::create([
            'name' => 'Lentes listos', 'type' => 'lab_ready', 'channel' => 'whatsapp',
            'body' => 'Hola {nombre} ({nombre_completo}), sus lentes están listos.', 'is_active' => true,
        ]);
        $patient = $this->patient('Lucia Fernanda', 'Mena', '1710034065');

        $this->getJson("/api/crm/reminders/preview?patient_id={$patient->id}")
            ->assertOk()
            ->assertJsonPath('data.message', 'Hola Lucia (Lucia Fernanda Mena), sus lentes están listos.');
    }

    public function test_opening_whatsapp_marks_it_sent_and_can_be_undone(): void
    {
        $patient = $this->patient('Lucia', 'Mena', '1710034065');
        $consultation = $this->visit($patient, '2026-11-03');

        $response = $this->postJson('/api/crm/reminders/whatsapp', [
            'patient_id' => $patient->id,
            'consultation_id' => $consultation->id,
            'message' => 'Sus lentes están listos',
        ])->assertCreated();

        $reminder = Reminder::findOrFail($response->json('data.id'));
        $this->assertSame('sent', $reminder->status);
        $this->assertSame('lab_ready', $reminder->type);
        $this->assertSame('whatsapp', $reminder->channel);
        $this->assertSame('2026-11-04 19:30:00', $reminder->sent_at->toDateTimeString());
        $this->assertSame(Consultation::class, $reminder->reference_type);
        $this->assertSame($consultation->id, $reminder->reference_id);
        $this->assertSame($this->user->id, $reminder->created_by);

        $notice = $this->getJson('/api/crm/whatsapp-contacts')->json('data.data.0.notice');
        $this->assertSame('sent', $notice['status']);
        $this->assertSame('2026-11-04 19:30:00', $notice['sent_at']);
        $this->assertSame($this->user->name, $notice['sent_by']);

        $this->patchJson("/api/crm/reminders/{$reminder->id}/status", ['status' => 'cancelled'])
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled')
            ->assertJsonPath('data.sent_at', null);
    }

    public function test_sending_an_existing_pending_reminder_keeps_the_edited_message(): void
    {
        $patient = $this->patient('Lucia', 'Mena', '1710034065');
        $reminder = Reminder::create([
            'patient_id' => $patient->id, 'created_by' => $this->user->id, 'type' => 'birthday',
            'channel' => 'whatsapp', 'message' => 'Feliz cumpleaños', 'status' => 'pending', 'scheduled_at' => now(),
        ]);

        $this->patchJson("/api/crm/reminders/{$reminder->id}/status", ['status' => 'sent', 'message' => 'Feliz cumpleaños, Lucia'])
            ->assertOk()
            ->assertJsonPath('data.status', 'sent')
            ->assertJsonPath('data.message', 'Feliz cumpleaños, Lucia');

        $this->patchJson("/api/crm/reminders/{$reminder->id}/status", ['status' => 'pending'])->assertOk();
        $this->assertSame('pending', $reminder->fresh()->status);
        $this->assertNull($reminder->fresh()->sent_at);
    }

    public function test_reminder_list_filters_by_patient_name(): void
    {
        $lucia = $this->patient('Lucia', 'Mena', '1710034065');
        $pedro = $this->patient('Pedro', 'Ruiz', '1710034066');
        foreach ([$lucia, $pedro] as $patient) {
            Reminder::create([
                'patient_id' => $patient->id, 'created_by' => $this->user->id, 'type' => 'birthday',
                'channel' => 'whatsapp', 'message' => 'x', 'status' => 'pending', 'scheduled_at' => now(),
            ]);
        }

        $rows = $this->getJson('/api/crm/reminders?search=mena')->assertOk()->json('data.data');
        $this->assertCount(1, $rows);
        $this->assertSame('Lucia Mena', $rows[0]['patient']['nombre_completo']);
        $this->assertSame('0991234567', $rows[0]['patient']['telefono']);
    }

    public function test_permissions(): void
    {
        $patient = $this->patient('Lucia', 'Mena', '1710034065');

        Sanctum::actingAs($this->userWith([Permission::CRM_VIEW->value]));
        $this->getJson('/api/crm/whatsapp-contacts')->assertOk();
        $this->postJson('/api/crm/reminders/whatsapp', ['patient_id' => $patient->id, 'message' => 'x'])->assertForbidden();

        Sanctum::actingAs($this->userWith([]));
        $this->getJson('/api/crm/whatsapp-contacts')->assertForbidden();
    }

    /** Recepcion: Recordatorios si, Campañas y editar Plantillas no. */
    public function test_reminders_permission_opens_only_the_reminders_screen(): void
    {
        $template = MessageTemplate::create([
            'name' => 'Lentes listos', 'type' => 'lab_ready', 'channel' => 'whatsapp',
            'body' => 'Hola {nombre}, sus lentes están listos.', 'is_active' => true,
        ]);
        $patient = $this->patient('Lucia', 'Mena', '1710034065');

        Sanctum::actingAs($this->userWith([Permission::CRM_REMINDERS->value, Permission::CRM_SEND_MESSAGES->value]));

        $this->getJson('/api/crm/reminders')->assertOk();
        $this->getJson('/api/crm/whatsapp-contacts')->assertOk();
        $this->getJson('/api/crm/templates?channel=whatsapp')->assertOk()->assertJsonPath('data.0.id', $template->id);
        $this->getJson("/api/crm/reminders/preview?patient_id={$patient->id}&template_id={$template->id}")
            ->assertOk()
            ->assertJsonPath('data.message', 'Hola Lucia, sus lentes están listos.');
        $this->postJson('/api/crm/reminders/whatsapp', ['patient_id' => $patient->id, 'message' => 'x'])->assertCreated();

        $this->getJson('/api/crm/campaigns')->assertForbidden();
        $this->postJson('/api/crm/campaigns/preview', [])->assertForbidden();
        $this->postJson('/api/crm/templates', ['name' => 'x', 'body' => 'x'])->assertForbidden();
        $this->putJson("/api/crm/templates/{$template->id}", ['name' => 'x'])->assertForbidden();
    }

    public function test_reception_role_gets_reminders_but_not_the_rest_of_crm(): void
    {
        $permissions = Permission::forRole(Role::RECEPCIONISTA);

        $this->assertContains(Permission::CRM_REMINDERS->value, $permissions);
        $this->assertContains(Permission::CRM_SEND_MESSAGES->value, $permissions);
        $this->assertNotContains(Permission::CRM_VIEW->value, $permissions);
        $this->assertNotContains(Permission::CRM_CAMPAIGNS->value, $permissions);
    }

    public function test_without_a_provider_nothing_is_marked_as_sent_automatically(): void
    {
        $patient = $this->patient('Lucia', 'Mena', '1710034065');
        $reminder = Reminder::create([
            'patient_id' => $patient->id, 'created_by' => $this->user->id, 'type' => 'birthday',
            'channel' => 'whatsapp', 'message' => 'Feliz cumpleaños', 'status' => 'pending', 'scheduled_at' => now()->subHour(),
        ]);

        Queue::fake();
        (new ProcessPendingReminders)->handle(app(WhatsAppService::class));
        Queue::assertNotPushed(SendWhatsAppMessage::class);

        $this->assertFalse(app(WhatsAppService::class)->sendReminder($reminder));
        $this->assertSame('pending', $reminder->fresh()->status);
        $this->assertNull($reminder->fresh()->sent_at);
    }
}
