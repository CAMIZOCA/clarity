<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\Campaign;
use App\Models\Consultation;
use App\Models\LabOrder;
use App\Models\MessageTemplate;
use App\Models\Patient;
use App\Models\Reminder;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class CrmService extends BaseService
{
    /**
     * Segmenta pacientes según criterios dinámicos.
     *
     * Criterios soportados:
     *   no_purchase_days            => 180   (sin compra en X días)
     *   birthday_month              => 6     (cumpleaños en mes X)
     *   birthday_week               => true  (cumpleaños esta semana)
     *   has_balance                 => true  (tiene saldo pendiente en alguna venta)
     *   prescription_expired_days   => 365   (última consulta hace >= X días)
     *   last_purchase_product_category => 'lente_contacto'
     *   city                        => 'Quito'
     *   min_total_spent             => 500
     *   branch_id                   => 1
     */
    public function segmentPatients(array $criteria): Collection
    {
        $query = Patient::query()->whereNull('deleted_at');

        if (isset($criteria['no_purchase_days'])) {
            $cutoff = now()->subDays((int) $criteria['no_purchase_days']);
            $query->where(function ($q) use ($cutoff) {
                $q->whereNull('last_purchase_at')
                    ->orWhere('last_purchase_at', '<=', $cutoff);
            });
        }

        if (isset($criteria['birthday_month'])) {
            $month = (int) $criteria['birthday_month'];
            $query->whereNotNull('fecha_nacimiento')
                ->whereMonth('fecha_nacimiento', $month);
        }

        if (! empty($criteria['birthday_week'])) {
            $startOfWeek = now()->startOfWeek();
            $endOfWeek = now()->endOfWeek();
            // Compare only month-day using strftime/DATE_FORMAT depending on driver
            $driver = DB::getDriverName();
            if ($driver === 'mysql') {
                $query->whereNotNull('fecha_nacimiento')
                    ->whereRaw(
                        "DATE_FORMAT(fecha_nacimiento, '%m-%d') BETWEEN ? AND ?",
                        [$startOfWeek->format('m-d'), $endOfWeek->format('m-d')]
                    );
            } else {
                // SQLite
                $query->whereNotNull('fecha_nacimiento')
                    ->whereRaw(
                        "strftime('%m-%d', fecha_nacimiento) BETWEEN ? AND ?",
                        [$startOfWeek->format('m-d'), $endOfWeek->format('m-d')]
                    );
            }
        }

        if (! empty($criteria['has_balance'])) {
            $query->whereHas('sales', function ($q) {
                $q->where('balance', '>', 0)
                    ->whereNotIn('status', ['cancelled', 'refunded']);
            });
        }

        if (isset($criteria['prescription_expired_days'])) {
            $cutoff = now()->subDays((int) $criteria['prescription_expired_days']);
            $query->whereHas('consultations', function ($q) use ($cutoff) {
                $q->where('fecha_consulta', '<=', $cutoff);
            })->whereDoesntHave('consultations', function ($q) use ($cutoff) {
                $q->where('fecha_consulta', '>', $cutoff);
            });
        }

        if (isset($criteria['last_purchase_product_category'])) {
            $category = $criteria['last_purchase_product_category'];
            $query->whereHas('sales.items.productVariant.product', function ($q) use ($category) {
                $q->where('category', $category);
            });
        }

        if (isset($criteria['city'])) {
            $query->where('direccion', 'LIKE', '%'.$criteria['city'].'%');
        }

        if (isset($criteria['min_total_spent'])) {
            $query->where('total_spent', '>=', (float) $criteria['min_total_spent']);
        }

        if (isset($criteria['branch_id'])) {
            $query->where('branch_id', (int) $criteria['branch_id']);
        }

        return $query->get();
    }

    /**
     * Reemplaza variables en un template de texto con datos del paciente.
     */
    public function resolveMessage(string $template, Patient $patient, array $extra = []): string
    {
        $opticaName = DB::table('settings')
            ->where('key', 'clinic_name')
            ->value('value') ?? config('app.name', 'la óptica');

        // `nombre` es el nombre de pila (los historicos traen ahi el nombre
        // completo); el completo sale del accessor, que suma el apellido.
        $nombreCompleto = $patient->nombre_completo;
        $nombrePartes = explode(' ', trim($patient->nombre ?? ''));
        $primerNombre = $nombrePartes[0] !== '' ? $nombrePartes[0] : $nombreCompleto;

        $replacements = [
            '{nombre}' => $primerNombre,
            '{nombre_completo}' => $nombreCompleto,
            '{telefono}' => $patient->telefono ?? '',
            '{email}' => $patient->email ?? '',
            '{optica}' => $opticaName,
            '{fecha}' => $extra['fecha'] ?? now()->format('d/m/Y'),
            '{monto}' => $extra['monto'] ?? '',
            '{producto}' => $extra['producto'] ?? '',
            '{descuento}' => $extra['descuento'] ?? '',
        ];

        return str_replace(
            array_keys($replacements),
            array_values($replacements),
            $template
        );
    }

    // ─── Envio manual por WhatsApp ───────────────────────────────────────────

    /** Dias que abarca la lista de "clientes recientes" sin busqueda. */
    public const RECENT_VISIT_DAYS = 30;

    /**
     * Pacientes a los que se les puede escribir desde Recordatorios.
     *
     * Sin busqueda: los atendidos en los ultimos RECENT_VISIT_DAYS dias, de la
     * visita mas reciente a la anterior (acceso visual rapido). Con busqueda:
     * todo el padron, sin limite de fecha; los que nunca tuvieron consulta van
     * al final.
     */
    public function whatsappContacts(?string $search, int $perPage = 25): LengthAwarePaginator
    {
        $lastVisits = Consultation::query()
            ->selectRaw('patient_id, MAX(fecha_consulta) as last_visit')
            ->groupBy('patient_id');

        $query = Patient::query()
            ->select('patients.id', 'patients.nombre', 'patients.apellido', 'patients.cedula', 'patients.telefono', 'lv.last_visit')
            ->leftJoinSub($lastVisits, 'lv', 'lv.patient_id', '=', 'patients.id');

        $search = trim((string) $search);
        if ($search === '') {
            $query->where('lv.last_visit', '>=', today()->subDays(self::RECENT_VISIT_DAYS)->toDateString());
        } else {
            // Cada palabra debe aparecer en algun campo: "lucia mena" encuentra
            // nombre=Lucia, apellido=Mena y tambien el historico "LUCIA MENA".
            foreach (preg_split('/\s+/', $search) as $word) {
                $query->where(function ($q) use ($word) {
                    $like = "%{$word}%";
                    $q->where('patients.nombre', 'LIKE', $like)
                        ->orWhere('patients.apellido', 'LIKE', $like)
                        ->orWhere('patients.cedula', 'LIKE', $like)
                        ->orWhere('patients.telefono', 'LIKE', $like);
                });
            }
        }

        $page = $query
            ->orderByRaw('lv.last_visit IS NULL')
            ->orderByDesc('lv.last_visit')
            ->orderByDesc('patients.id')
            ->paginate($perPage);

        $patients = collect($page->items());
        $consultationIds = $this->consultationsAtLastVisit($patients);
        $notices = $this->latestLabReadyNotices($patients);

        return $page->through(fn (Patient $patient) => [
            'patient_id' => $patient->id,
            'nombre' => $patient->nombre,
            'apellido' => $patient->apellido,
            'nombre_completo' => $patient->nombre_completo,
            'cedula' => $patient->cedula,
            'telefono' => $patient->telefono,
            'last_visit' => $patient->last_visit ? substr((string) $patient->last_visit, 0, 10) : null,
            'consultation_id' => $consultationIds[$patient->id] ?? null,
            'notice' => $notices[$patient->id] ?? null,
        ]);
    }

    /**
     * Id de la consulta de la ultima visita de cada paciente (la mas nueva si
     * hubo dos el mismo dia).
     *
     * @return array<int, int>
     */
    private function consultationsAtLastVisit(Collection $patients): array
    {
        $withVisit = $patients->filter(fn ($p) => $p->last_visit);
        if ($withVisit->isEmpty()) {
            return [];
        }

        $ids = [];
        Consultation::query()
            ->select('id', 'patient_id', 'fecha_consulta')
            ->whereIn('patient_id', $withVisit->pluck('id'))
            ->whereIn('fecha_consulta', $withVisit->map(fn ($p) => substr((string) $p->last_visit, 0, 10))->unique()->values())
            ->orderBy('id')
            ->get()
            ->each(function (Consultation $c) use (&$ids, $withVisit) {
                $visit = substr((string) $withVisit->firstWhere('id', $c->patient_id)?->last_visit, 0, 10);
                if ($c->fecha_consulta?->toDateString() === $visit) {
                    $ids[$c->patient_id] = $c->id;
                }
            });

        return $ids;
    }

    /**
     * Ultimo aviso de "lentes listos" de cada paciente desde su ultima visita
     * (o de los ultimos RECENT_VISIT_DAYS dias si no tiene ninguna).
     *
     * @return array<int, array<string, mixed>>
     */
    private function latestLabReadyNotices(Collection $patients): array
    {
        if ($patients->isEmpty()) {
            return [];
        }

        $notices = [];
        Reminder::query()
            ->with('createdBy:id,name')
            ->select('id', 'patient_id', 'status', 'sent_at', 'created_at', 'created_by')
            ->whereIn('patient_id', $patients->pluck('id'))
            ->where('type', 'lab_ready')
            ->where('channel', 'whatsapp')
            ->where('created_at', '>=', $patients->min(fn ($p) => $p->last_visit ?? today()->subDays(self::RECENT_VISIT_DAYS)->toDateString()))
            ->orderBy('id')
            ->get()
            ->each(function (Reminder $reminder) use (&$notices, $patients) {
                $patient = $patients->firstWhere('id', $reminder->patient_id);
                $since = $patient->last_visit
                    ? substr((string) $patient->last_visit, 0, 10)
                    : today()->subDays(self::RECENT_VISIT_DAYS)->toDateString();
                if ($reminder->created_at->toDateString() < $since) {
                    return;
                }
                $notices[$reminder->patient_id] = [
                    'reminder_id' => $reminder->id,
                    'status' => $reminder->status,
                    'sent_at' => $reminder->sent_at?->toDateTimeString(),
                    'sent_by' => $reminder->createdBy?->name,
                ];
            });

        return $notices;
    }

    /**
     * Mensaje listo para WhatsApp. Sin plantilla elegida usa la activa de
     * "lentes listos" y, si no existe, un texto fijo.
     */
    public function previewMessage(Patient $patient, ?MessageTemplate $template = null, array $extra = []): array
    {
        $template ??= MessageTemplate::where('type', 'lab_ready')
            ->where('channel', 'whatsapp')
            ->where('is_active', true)
            ->orderBy('id')
            ->first();

        $body = $template?->body
            ?? 'Estimado/a {nombre}, sus lentes están listos para retiro en {optica}.';

        return [
            'template_id' => $template?->id,
            'message' => $this->resolveMessage($body, $patient, $extra),
        ];
    }

    /**
     * Deja constancia de que se abrio el chat de WhatsApp con el mensaje.
     * "Enviado" aqui significa eso: el sistema no puede saber si el usuario
     * pulso enviar dentro de WhatsApp.
     */
    public function recordWhatsAppSent(
        Patient $patient,
        string $message,
        ?Consultation $consultation,
        User $user,
        ?int $templateId = null
    ): Reminder {
        return Reminder::create([
            'patient_id' => $patient->id,
            'template_id' => $templateId,
            'created_by' => $user->id,
            'type' => 'lab_ready',
            'channel' => 'whatsapp',
            'message' => $message,
            'status' => 'sent',
            'scheduled_at' => now(),
            'sent_at' => now(),
            'reference_type' => $consultation ? Consultation::class : null,
            'reference_id' => $consultation?->id,
        ]);
    }

    /**
     * Cambia el estado de un recordatorio a mano: enviarlo desde la lista
     * (sent) o deshacer (pending / cancelled).
     */
    public function setReminderStatus(Reminder $reminder, string $status, ?string $message = null): Reminder
    {
        $data = [
            'status' => $status,
            'sent_at' => $status === 'sent' ? now() : null,
        ];
        if ($status === 'sent') {
            $data['error_message'] = null;
        }
        if ($message !== null && trim($message) !== '') {
            $data['message'] = $message;
        }

        $reminder->update($data);

        return $reminder->fresh(['patient:id,nombre,apellido,cedula,telefono', 'createdBy:id,name']);
    }

    /**
     * Crea un recordatorio para un paciente.
     */
    public function createReminder(
        Patient $patient,
        string $type,
        string $message,
        Carbon $scheduledAt,
        string $channel = 'whatsapp',
        int $createdBy = 0,
        array $referenceData = []
    ): Reminder {
        return Reminder::create([
            'patient_id' => $patient->id,
            'template_id' => $referenceData['template_id'] ?? null,
            'created_by' => $createdBy ?: (auth()->id() ?? 1),
            'type' => $type,
            'channel' => $channel,
            'message' => $message,
            'status' => 'pending',
            'scheduled_at' => $scheduledAt,
            'reference_type' => $referenceData['reference_type'] ?? null,
            'reference_id' => $referenceData['reference_id'] ?? null,
        ]);
    }

    /**
     * Programa un recordatorio 24 horas antes de la cita.
     */
    public function scheduleAppointmentReminder(Appointment $appointment): Reminder
    {
        $patient = $appointment->patient;
        $scheduledAt = Carbon::parse($appointment->fecha_hora_inicio)->subHours(24);

        /** @var MessageTemplate|null $template */
        $template = MessageTemplate::where('type', 'appointment_reminder')
            ->where('is_active', true)
            ->first();

        if ($template) {
            $message = $this->resolveMessage($template->body, $patient, [
                'fecha' => Carbon::parse($appointment->fecha_hora_inicio)->format('d/m/Y H:i'),
            ]);
        } else {
            $optica = DB::table('settings')->where('key', 'clinic_name')->value('value') ?? 'la óptica';
            $fecha = Carbon::parse($appointment->fecha_hora_inicio)->format('d/m/Y H:i');
            $nombre = explode(' ', $patient->nombre)[0];
            $message = "Hola {$nombre}, le recordamos su cita en {$optica} el {$fecha}. ¡Le esperamos!";
        }

        return $this->createReminder(
            $patient,
            'appointment',
            $message,
            $scheduledAt,
            $patient->preferred_contact ?? 'whatsapp',
            auth()->id() ?? 1,
            [
                'template_id' => $template?->id,
                'reference_type' => Appointment::class,
                'reference_id' => $appointment->id,
            ]
        );
    }

    /**
     * Crea recordatorio inmediato cuando una orden de laboratorio está lista.
     */
    public function scheduleLabReadyNotification(LabOrder $labOrder): Reminder
    {
        $patient = $labOrder->patient ?? $labOrder->sale?->patient;

        /** @var MessageTemplate|null $template */
        $template = MessageTemplate::where('type', 'lab_ready')
            ->where('is_active', true)
            ->first();

        if ($template) {
            $message = $this->resolveMessage($template->body, $patient);
        } else {
            $optica = DB::table('settings')->where('key', 'clinic_name')->value('value') ?? 'la óptica';
            $nombre = explode(' ', $patient->nombre)[0];
            $message = "Estimado {$nombre}, sus lentes están listos para retiro en {$optica}. Horario: Lun-Sab 9h-19h.";
        }

        return $this->createReminder(
            $patient,
            'lab_ready',
            $message,
            now(),
            $patient->preferred_contact ?? 'whatsapp',
            auth()->id() ?? 1,
            [
                'template_id' => $template?->id,
                'reference_type' => LabOrder::class,
                'reference_id' => $labOrder->id,
            ]
        );
    }

    /**
     * Crea recordatorios de cumpleaños para los pacientes cuyo cumpleaños es mañana.
     * Retorna la cantidad de recordatorios creados.
     */
    public function scheduleBirthdayReminders(): int
    {
        $tomorrow = now()->addDay();
        $driver = DB::getDriverName();

        $query = Patient::query()->whereNull('deleted_at')->whereNotNull('fecha_nacimiento');

        if ($driver === 'mysql') {
            $query->whereRaw("DATE_FORMAT(fecha_nacimiento, '%m-%d') = ?", [$tomorrow->format('m-d')]);
        } else {
            $query->whereRaw("strftime('%m-%d', fecha_nacimiento) = ?", [$tomorrow->format('m-d')]);
        }

        /** @var MessageTemplate|null $template */
        $template = MessageTemplate::where('type', 'birthday')
            ->where('is_active', true)
            ->first();

        $count = 0;

        foreach ($query->get() as $patient) {
            // Evitar duplicados: no crear si ya existe un recordatorio de cumpleaños para mañana
            $alreadyExists = Reminder::where('patient_id', $patient->id)
                ->where('type', 'birthday')
                ->whereDate('scheduled_at', $tomorrow->toDateString())
                ->exists();

            if ($alreadyExists) {
                continue;
            }

            if ($template) {
                $message = $this->resolveMessage($template->body, $patient);
            } else {
                $optica = DB::table('settings')->where('key', 'clinic_name')->value('value') ?? 'la óptica';
                $nombre = explode(' ', $patient->nombre)[0];
                $message = "¡Feliz cumpleaños {$nombre}! En {$optica} le deseamos un excelente día. Visítenos y obtenga un 10% en su próxima compra.";
            }

            $this->createReminder(
                $patient,
                'birthday',
                $message,
                $tomorrow->copy()->setTime(9, 0),
                $patient->preferred_contact ?? 'whatsapp',
                1,
                ['template_id' => $template?->id]
            );

            $count++;
        }

        return $count;
    }

    /**
     * Crea recordatorios de control visual para pacientes cuya última consulta
     * fue hace aproximadamente 12 meses (±7 días).
     * Retorna cantidad creada.
     */
    public function scheduleControlVisualReminders(): int
    {
        $targetDate = now()->subMonths(12);
        $rangeStart = $targetDate->copy()->subDays(7);
        $rangeEnd = $targetDate->copy()->addDays(7);

        /** @var MessageTemplate|null $template */
        $template = MessageTemplate::where('type', 'reorder')
            ->where('is_active', true)
            ->first();

        // Busca la plantilla de control visual (si existe tipo personalizado)
        $templateCv = MessageTemplate::where('type', 'custom')
            ->where('name', 'LIKE', '%control%')
            ->where('is_active', true)
            ->first() ?? $template;

        // Pacientes con última consulta en el rango ±7 días de hace 12 meses
        $patients = Patient::query()
            ->whereNull('deleted_at')
            ->whereHas('consultations', function ($q) use ($rangeStart, $rangeEnd) {
                $q->whereBetween('fecha_consulta', [$rangeStart, $rangeEnd]);
            })
            ->whereDoesntHave('consultations', function ($q) use ($rangeEnd) {
                $q->where('fecha_consulta', '>', $rangeEnd);
            })
            ->get();

        $count = 0;

        foreach ($patients as $patient) {
            $alreadyExists = Reminder::where('patient_id', $patient->id)
                ->where('type', 'control_visual')
                ->where('scheduled_at', '>=', now()->subDays(7))
                ->exists();

            if ($alreadyExists) {
                continue;
            }

            if ($templateCv) {
                $message = $this->resolveMessage($templateCv->body, $patient);
            } else {
                $optica = DB::table('settings')->where('key', 'clinic_name')->value('value') ?? 'la óptica';
                $nombre = explode(' ', $patient->nombre)[0];
                $message = "Hola {$nombre}, han pasado 12 meses desde su último control visual. Le recomendamos agendar su cita en {$optica}.";
            }

            $this->createReminder(
                $patient,
                'control_visual',
                $message,
                now()->addHour(),
                $patient->preferred_contact ?? 'whatsapp',
                1,
                ['template_id' => $templateCv?->id]
            );

            $count++;
        }

        return $count;
    }

    /**
     * Crea una campaña, calculando total_recipients a partir de los criterios.
     */
    public function createCampaign(array $data, int $userId): Campaign
    {
        $recipients = $this->segmentPatients($data['segment_criteria'] ?? []);

        return Campaign::create([
            'name' => $data['name'],
            'channel' => $data['channel'] ?? 'whatsapp',
            'template_id' => $data['template_id'] ?? null,
            'message_body' => $data['message_body'],
            'segment_criteria' => $data['segment_criteria'] ?? [],
            'status' => $data['status'] ?? 'draft',
            'scheduled_at' => $data['scheduled_at'] ?? null,
            'total_recipients' => $recipients->count(),
            'created_by' => $userId,
        ]);
    }

    /**
     * Previsualiza destinatarios de una campaña sin guardar nada.
     * Retorna count y muestra de los primeros 5 nombres.
     */
    public function previewCampaignRecipients(array $criteria): array
    {
        $patients = $this->segmentPatients($criteria);

        return [
            'count' => $patients->count(),
            'sample' => $patients->take(5)->pluck('nombre')->values()->toArray(),
        ];
    }
}
