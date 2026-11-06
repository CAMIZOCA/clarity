<?php

namespace Tests\Feature;

use App\Enums\Permission;
use App\Mail\AppointmentReminderMail;
use App\Models\Appointment;
use App\Models\Patient;
use App\Models\Reminder;
use App\Models\Setting;
use App\Models\User;
use App\Services\AppointmentCalendarService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission as SpatiePermission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class AppointmentReminderTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
        Carbon::setTestNow(Carbon::parse('2026-11-05 10:00:00'));
        Setting::set('clinic_name', 'Óptica Andina');
        Setting::set('clinic_address', 'Av. Amazonas N24, Quito');
        Setting::set('mail_host', 'mail.opticaandina.com.ec');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function userWith(string ...$permissions): User
    {
        $user = User::factory()->create(['name' => 'Dra. Pamela López']);
        foreach ($permissions as $permission) {
            SpatiePermission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
            $user->givePermissionTo($permission);
        }

        return $user;
    }

    private function appointment(array $attrs = [], ?string $email = 'paciente@correo.com'): Appointment
    {
        $patient = Patient::create([
            'nombre' => 'Marvin',
            'apellido' => 'Baptista',
            'cedula' => '1758026320',
            'fecha_nacimiento' => '1990-01-01',
            'email' => $email,
        ]);

        return Appointment::create(array_merge([
            'patient_id' => $patient->id,
            'titulo' => 'Control',
            'fecha_hora_inicio' => '2026-11-06 09:30:00',
            'fecha_hora_fin' => '2026-11-06 10:00:00',
            'estado' => 'pendiente',
        ], $attrs));
    }

    public function test_button_sends_reminder_with_calendar_attachment(): void
    {
        Mail::fake();
        Sanctum::actingAs($user = $this->userWith(Permission::APPOINTMENTS_EDIT->value));
        $appointment = $this->appointment();

        $this->postJson("/api/appointments/{$appointment->id}/send-reminder")
            ->assertOk()
            ->assertJsonPath('email', 'paciente@correo.com');

        Mail::assertSent(AppointmentReminderMail::class, function (AppointmentReminderMail $mail) {
            $attachment = $mail->attachments()[0];

            return $mail->hasTo('paciente@correo.com')
                && $attachment->as === 'cita.ics'
                && str_starts_with($attachment->mime, 'text/calendar');
        });

        $reminder = Reminder::first();
        $this->assertSame('sent', $reminder->status);
        $this->assertSame('email', $reminder->channel);
        $this->assertSame('appointment', $reminder->type);
        $this->assertSame($appointment->id, $reminder->reference_id);
        $this->assertSame($user->id, $reminder->created_by);
    }

    public function test_reminder_mail_renders_date_and_calendar_links(): void
    {
        $html = (new AppointmentReminderMail($this->appointment()))->render();

        $this->assertStringContainsString('Recordatorio de su cita', $html);
        $this->assertStringContainsString('Marvin Baptista', $html);
        $this->assertStringContainsString('Viernes 6 de noviembre de 2026', $html);
        $this->assertStringContainsString('09:30', $html);
        $this->assertStringContainsString('calendar.google.com/calendar/render', $html);
        // 09:30 en Guayaquil (UTC-5) son las 14:30 UTC.
        $this->assertStringContainsString('20261106T143000Z', $html);
    }

    public function test_button_rejects_patient_without_email_or_missing_smtp(): void
    {
        Mail::fake();
        Sanctum::actingAs($this->userWith(Permission::APPOINTMENTS_EDIT->value));

        $noEmail = $this->appointment([], null);
        $this->postJson("/api/appointments/{$noEmail->id}/send-reminder")
            ->assertStatus(422)
            ->assertJsonPath('message', 'El paciente no tiene un correo electrónico válido. Agréguelo en su ficha.');

        Setting::set('mail_host', '');
        $noSmtp = Appointment::create([
            'patient_id' => Patient::create(['nombre' => 'Ana', 'cedula' => '1710034065', 'fecha_nacimiento' => '1985-03-02', 'email' => 'ana@correo.com'])->id,
            'fecha_hora_inicio' => '2026-11-06 11:00:00',
            'fecha_hora_fin' => '2026-11-06 11:30:00',
        ]);
        $this->postJson("/api/appointments/{$noSmtp->id}/send-reminder")->assertStatus(422);

        Mail::assertNothingSent();
        $this->assertSame(0, Reminder::count());
    }

    public function test_button_requires_edit_permission(): void
    {
        Sanctum::actingAs($this->userWith(Permission::APPOINTMENTS_VIEW->value));
        $appointment = $this->appointment();

        $this->postJson("/api/appointments/{$appointment->id}/send-reminder")->assertForbidden();
    }

    public function test_command_sends_once_within_window_and_skips_others(): void
    {
        Mail::fake();
        Setting::set('appointment_email_reminders_enabled', '1');
        Setting::set('appointment_reminder_hours', '24');
        // El automatico registra el envio a nombre del primer usuario del sistema.
        $admin = User::factory()->create();

        $due = $this->appointment(); // mañana 09:30, dentro de 24 h
        $far = Appointment::create([
            'patient_id' => $due->patient_id,
            'fecha_hora_inicio' => '2026-11-08 09:00:00',
            'fecha_hora_fin' => '2026-11-08 09:30:00',
        ]);
        $cancelled = Appointment::create([
            'patient_id' => $due->patient_id,
            'fecha_hora_inicio' => '2026-11-05 15:00:00',
            'fecha_hora_fin' => '2026-11-05 15:30:00',
            'estado' => 'cancelado',
        ]);
        $past = Appointment::create([
            'patient_id' => $due->patient_id,
            'fecha_hora_inicio' => '2026-11-05 08:00:00',
            'fecha_hora_fin' => '2026-11-05 08:30:00',
        ]);

        $this->artisan('appointments:send-email-reminders')->assertSuccessful();
        $this->artisan('appointments:send-email-reminders')->assertSuccessful();

        Mail::assertSent(AppointmentReminderMail::class, 1);
        Mail::assertSent(AppointmentReminderMail::class, fn ($m) => $m->appointment->is($due));
        $this->assertSame(1, Reminder::count());
        $this->assertSame($admin->id, Reminder::first()->created_by);
        $this->assertNotNull($far);
        $this->assertNotNull($cancelled);
        $this->assertNotNull($past);
    }

    public function test_command_does_nothing_when_disabled(): void
    {
        Mail::fake();
        Setting::set('appointment_email_reminders_enabled', '0');
        $this->appointment();

        $this->artisan('appointments:send-email-reminders')->assertSuccessful();

        Mail::assertNothingSent();
    }

    public function test_command_skips_patient_without_email_without_recording(): void
    {
        Mail::fake();
        Setting::set('appointment_email_reminders_enabled', '1');
        $this->appointment([], '');

        $this->artisan('appointments:send-email-reminders')->assertSuccessful();

        Mail::assertNothingSent();
        $this->assertSame(0, Reminder::count());
    }

    public function test_ics_is_valid_and_in_utc(): void
    {
        $ics = app(AppointmentCalendarService::class)->ics($this->appointment(['notas' => 'x']));

        $this->assertStringStartsWith("BEGIN:VCALENDAR\r\n", $ics);
        $this->assertStringContainsString("DTSTART:20261106T143000Z\r\n", $ics);
        $this->assertStringContainsString("DTEND:20261106T150000Z\r\n", $ics);
        $this->assertStringContainsString('SUMMARY:Cita en Óptica Andina – Control', $ics);
        $this->assertStringContainsString('LOCATION:Av. Amazonas N24\, Quito', $ics);
        $this->assertStringContainsString('BEGIN:VALARM', $ics);
        $this->assertStringEndsWith("END:VCALENDAR\r\n", $ics);

        foreach (explode("\r\n", $ics) as $line) {
            $this->assertLessThanOrEqual(75, strlen($line), "Linea sin plegar: {$line}");
        }
    }

    public function test_resource_returns_patient_id_so_editing_keeps_the_patient(): void
    {
        Sanctum::actingAs($this->userWith(Permission::APPOINTMENTS_VIEW->value, Permission::APPOINTMENTS_EDIT->value));
        $appointment = $this->appointment();

        $this->getJson('/api/appointments?from=2026-11-01&to=2026-11-30')
            ->assertOk()
            ->assertJsonPath('0.patient_id', $appointment->patient_id)
            ->assertJsonPath('0.patient.nombre_completo', 'Marvin Baptista')
            ->assertJsonPath('0.patient.email', 'paciente@correo.com')
            ->assertJsonPath('0.reminder_email_sent_at', null);
    }
}
