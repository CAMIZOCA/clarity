<?php

namespace App\Services;

use App\Jobs\SyncPatientToContifico;
use App\Models\Patient;
use App\Rules\ValidEcuadorCedula;
use App\Support\AppConfig;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Log;

class PatientService extends BaseService
{
    /**
     * Buscar pacientes por término de búsqueda.
     * Delega en Patient::search() que usa MySQL FULLTEXT si está disponible, LIKE como fallback.
     */
    public function search(string $term, int $limit = 15): Collection
    {
        return Patient::search($term)
            ->select(['id', 'nombre', 'apellido', 'cedula', 'telefono', 'email', 'fecha_nacimiento', 'codigo_interno'])
            ->withCount('consultations')
            ->limit($limit)
            ->get();
    }

    /** Ordenamientos admitidos por el listado de pacientes. */
    public const SORT_ULTIMA_CONSULTA = 'ultima_consulta';

    public const SORT_NOMBRE = 'nombre';

    /** Consultas anteriores que ofrece el historial de RX: por defecto y tope. */
    public const RX_HISTORY_LIMIT = 5;

    public const RX_HISTORY_MAX = 20;

    /**
     * Listar pacientes con paginación y filtros.
     *
     * El orden por defecto es por fecha de última consulta descendente (las
     * visitas más recientes primero); los pacientes sin consultas quedan al
     * final. Se apoya en el índice compuesto ['patient_id', 'fecha_consulta'].
     */
    public function paginate(array $filters = [], ?int $perPage = null): LengthAwarePaginator
    {
        $perPage = $perPage ?? AppConfig::PATIENTS_PER_PAGE;

        if (! empty($filters['search'])) {
            $query = Patient::search($filters['search'])->withCount('consultations');
        } else {
            $query = Patient::query()->withCount('consultations');
        }

        $query->withMax('consultations', 'fecha_consulta');

        if (! empty($filters['customer_type'])) {
            $query->where('customer_type', $filters['customer_type']);
        }

        if (! empty($filters['branch_id'])) {
            $query->where('branch_id', $filters['branch_id']);
        }

        $sort = $filters['sort'] ?? self::SORT_ULTIMA_CONSULTA;

        if ($sort === self::SORT_NOMBRE) {
            $query->orderBy('nombre')->orderBy('apellido');
        } else {
            // NULLS LAST portable: los pacientes sin consultas van al final.
            $query->orderByRaw('consultations_max_fecha_consulta IS NULL')
                ->orderByDesc('consultations_max_fecha_consulta')
                ->orderBy('nombre');
        }

        return $query->paginate($perPage);
    }

    /**
     * Crear un nuevo paciente.
     */
    public function create(array $data, int $createdBy): Patient
    {
        $patient = $this->transaction(function () use ($data, $createdBy) {
            $patient = Patient::create(array_merge($data, [
                'created_by' => $createdBy,
            ]));

            $this->logActivity('patient_created', $patient, [
                'nombre' => $patient->nombre,
                'cedula' => $patient->cedula,
            ]);

            return $patient;
        });

        $this->queueContificoSync($patient, $createdBy);

        return $patient;
    }

    /**
     * Encola el envio del paciente a Contifico si la integracion esta activa.
     *
     * Nunca debe tumbar el alta: con la cola `sync` el job corre aqui mismo y
     * un Contifico caido lanzaria la excepcion dentro del request.
     */
    private function queueContificoSync(Patient $patient, int $createdBy): void
    {
        try {
            if (app(ContificoService::class)->isEnabled()) {
                SyncPatientToContifico::dispatch($patient->id, $createdBy)->afterCommit();
            }
        } catch (\Throwable) {
            // El detalle saneado ya quedo en contifico_sync_logs.
            Log::warning('Contifico: no se pudo enviar el paciente', ['patient_id' => $patient->id]);
        }
    }

    /**
     * Actualizar paciente existente.
     */
    public function update(Patient $patient, array $data): Patient
    {
        return $this->transaction(function () use ($patient, $data) {
            $oldData = $patient->only(['nombre', 'cedula', 'telefono', 'email']);
            $patient->update($data);

            $this->logActivity('patient_updated', $patient, [
                'before' => $oldData,
                'after' => $patient->fresh()->only(['nombre', 'cedula', 'telefono', 'email']),
            ]);

            return $patient->fresh();
        });
    }

    /**
     * Eliminar paciente (soft delete).
     */
    public function delete(Patient $patient): bool
    {
        return $this->transaction(function () use ($patient) {
            $this->logActivity('patient_deleted', $patient, [
                'nombre' => $patient->nombre,
                'cedula' => $patient->cedula,
            ]);

            return (bool) $patient->delete();
        });
    }

    /**
     * Devolver a la lista un paciente eliminado (soft delete).
     *
     * El indice unico de `cedula` tambien cubre a los eliminados: sin esto, la
     * unica salida ante una cedula ya usada por un eliminado seria un error 500.
     */
    public function restore(Patient $patient): Patient
    {
        return $this->transaction(function () use ($patient) {
            $patient->restore();

            $this->logActivity('patient_restored', $patient, [
                'nombre' => $patient->nombre,
                'cedula' => $patient->cedula,
            ]);

            return $patient->fresh();
        });
    }

    /** Estados que devuelve lookupByDocument(). */
    public const DOCUMENT_NEW = 'nuevo';

    public const DOCUMENT_EXISTS = 'existe';

    public const DOCUMENT_DELETED = 'eliminado';

    public const DOCUMENT_INVALID = 'invalida';

    /** Tope de cedulas relacionadas y de nombres parecidos que se ofrecen. */
    public const LOOKUP_LIMIT = 5;

    /**
     * Verifica una cedula/RUC antes de registrar un paciente.
     *
     * La importacion del sistema anterior dejo la misma persona escrita de
     * varias formas, asi que la comparacion no es literal:
     *  - 39 cedulas perdieron el cero inicial ("912345678");
     *  - un RUC de persona natural es su cedula + "001";
     *  - hay cedulas con una letra o digitos de mas al final ("1712345678A"),
     *    que no bloquean el alta y se devuelven como `relacionados`.
     *
     * @return array{cedula: string, estado: string, mensaje: ?string, paciente: ?array<string, mixed>, relacionados: list<array<string, mixed>>}
     */
    public function lookupByDocument(string $document, ?int $excludeId = null): array
    {
        $document = strtoupper(trim($document));
        $variants = self::documentVariants($document);

        $matches = Patient::withTrashed()
            ->whereIn('cedula', $variants)
            ->when($excludeId, fn ($query) => $query->where('id', '!=', $excludeId))
            ->withCount('consultations')
            ->withMax('consultations', 'fecha_consulta')
            ->get();

        // Un paciente activo pesa mas que uno eliminado, y la escritura exacta
        // mas que una variante.
        $match = $matches
            ->sortBy(fn (Patient $patient) => [$patient->trashed() ? 1 : 0, $patient->cedula === $document ? 0 : 1])
            ->first();

        $result = [
            'cedula' => $document,
            'estado' => self::DOCUMENT_NEW,
            'mensaje' => null,
            'paciente' => $match ? $this->lookupSummary($match) : null,
            'relacionados' => $this->relatedDocuments($document, $matches->modelKeys(), $excludeId),
        ];

        if ($match) {
            $result['estado'] = $match->trashed() ? self::DOCUMENT_DELETED : self::DOCUMENT_EXISTS;

            return $result;
        }

        if ($error = self::documentFormatError($document)) {
            $result['estado'] = self::DOCUMENT_INVALID;
            $result['mensaje'] = $error;
        }

        return $result;
    }

    /**
     * Nombre, apellido y fecha de nacimiento para llenar el alta, tomados de
     * EcuadorAPI. Null cuando no hay nada que ofrecer (y nunca un error).
     *
     * Solo se consulta una cedula valida y sin registrar: es un servicio de
     * pago por consulta y no debe servir para averiguar datos de cualquiera.
     *
     * @return array{nombre: string, apellido: ?string, fecha_nacimiento: ?string}|null
     */
    public function suggestIdentity(string $document): ?array
    {
        $ecuadorApi = app(EcuadorApiService::class);

        if (trim($document) === '' || ! $ecuadorApi->isEnabled()) {
            return null;
        }

        $lookup = $this->lookupByDocument($document);

        return $lookup['estado'] === self::DOCUMENT_NEW
            ? $ecuadorApi->lookupPerson($lookup['cedula'])
            : null;
    }

    /**
     * Pacientes cuyo nombre contiene todas las palabras dadas, en cualquier
     * orden. Es la segunda red contra duplicados: los importados sin cedula
     * llevan un codigo provisional ("HIST-00123") que ninguna cedula encuentra,
     * y guardan "APELLIDOS NOMBRES" completo en `nombre`.
     *
     * @return list<array<string, mixed>>
     */
    public function findSimilarByName(string $nombre, ?string $apellido = null, ?int $excludeId = null): array
    {
        $words = collect(preg_split('/\s+/u', trim($nombre.' '.$apellido)))
            // % y _ son comodines de LIKE.
            ->map(fn (string $word) => str_replace(['%', '_'], '', $word))
            ->filter(fn (string $word) => mb_strlen($word) >= 3)
            ->unique()
            ->take(6);

        // Una sola palabra ("MARIA") traeria media base.
        if ($words->count() < 2) {
            return [];
        }

        $query = Patient::query()
            ->when($excludeId, fn ($query) => $query->where('id', '!=', $excludeId))
            ->withCount('consultations')
            ->withMax('consultations', 'fecha_consulta');

        foreach ($words as $word) {
            $query->where(fn ($q) => $q->where('nombre', 'LIKE', "%{$word}%")->orWhere('apellido', 'LIKE', "%{$word}%"));
        }

        return $query->orderBy('nombre')
            ->limit(self::LOOKUP_LIMIT)
            ->get()
            ->map(fn (Patient $patient) => $this->lookupSummary($patient))
            ->all();
    }

    /**
     * Formas en que la misma cedula/RUC puede estar guardada.
     *
     * @return list<string>
     */
    private static function documentVariants(string $document): array
    {
        $compact = self::compactDocument($document);
        $variants = [$document, $compact];

        if ($base = self::documentBase($document)) {
            $canonical = strlen($compact) >= 12 ? $base.substr($compact, -3) : $base;

            foreach ([$canonical, $base, $base.'001'] as $form) {
                $variants[] = $form;
                if ($form[0] === '0') {
                    $variants[] = substr($form, 1);
                }
            }
        }

        return array_values(array_unique($variants));
    }

    private static function compactDocument(string $document): string
    {
        return str_replace([' ', '-', '.'], '', $document);
    }

    /**
     * Los 10 digitos de la cedula que hay detras de una cedula o un RUC, o null
     * si el documento no es numerico (pasaporte, codigo provisional).
     */
    private static function documentBase(string $document): ?string
    {
        $compact = self::compactDocument($document);

        if (! preg_match('/^(\d{9,10}|\d{12,13})$/', $compact)) {
            return null;
        }

        // 9 y 12 digitos: cedula o RUC que perdio el cero inicial.
        if (in_array(strlen($compact), [9, 12], true)) {
            $compact = '0'.$compact;
        }

        return substr($compact, 0, 10);
    }

    /**
     * Cedulas que empiezan igual pero llevan algo mas (o un digito menos) al
     * final. No son necesariamente la misma persona (el sistema anterior uso
     * las de letra para familiares), por eso se listan sin bloquear el alta.
     *
     * @param  list<int>  $skipIds
     * @return list<array<string, mixed>>
     */
    private function relatedDocuments(string $document, array $skipIds, ?int $excludeId): array
    {
        $base = self::documentBase($document);

        if ($base === null) {
            return [];
        }

        return Patient::query()
            // Tambien las que se quedaron en 9 digitos por perder el ultimo
            // (el verificador): no hay otra cedula valida con ese comienzo.
            ->where(fn ($query) => $query->where('cedula', 'LIKE', $base.'%')->orWhere('cedula', substr($base, 0, 9)))
            ->whereNotIn('id', array_filter([...$skipIds, $excludeId]))
            ->withCount('consultations')
            ->withMax('consultations', 'fecha_consulta')
            ->orderBy('cedula')
            ->limit(self::LOOKUP_LIMIT)
            ->get()
            ->map(fn (Patient $patient) => $this->lookupSummary($patient))
            ->all();
    }

    /** Mensaje de ValidEcuadorCedula para el documento, o null si es valido. */
    private static function documentFormatError(string $document): ?string
    {
        $error = null;

        (new ValidEcuadorCedula)->validate('cedula', $document, function (string $message) use (&$error) {
            $error = str_replace(':attribute', 'documento', $message);
        });

        return $error;
    }

    /**
     * Lo minimo para reconocer al paciente en la pantalla de alta.
     *
     * @return array<string, mixed>
     */
    private function lookupSummary(Patient $patient): array
    {
        $lastConsultation = $patient->consultations_max_fecha_consulta;

        return [
            'id' => $patient->id,
            'nombre_completo' => $patient->nombre_completo,
            'cedula' => $patient->cedula,
            'edad' => $patient->edad,
            'telefono' => $patient->telefono,
            'consultations_count' => (int) $patient->consultations_count,
            'ultima_consulta' => $lastConsultation ? substr((string) $lastConsultation, 0, 10) : null,
        ];
    }

    /**
     * RX final de las ultimas consultas del paciente, de la mas reciente a la
     * mas antigua. Alimenta el panel "RX en uso" de una consulta nueva, donde la
     * optometra copia con un clic la receta que el paciente ya trae.
     *
     * Solo entran las consultas que tienen alguna medida en la RX final.
     *
     * @return list<array<string, mixed>>
     */
    public function rxHistory(Patient $patient, ?int $excludeConsultationId = null, int $limit = self::RX_HISTORY_LIMIT): array
    {
        $measures = [];
        foreach (['od', 'oi'] as $eye) {
            foreach (['esfera', 'cilindro', 'eje', 'add', 'av'] as $column) {
                $measures[] = "rx_final_{$column}_{$eye}";
            }
        }
        $neutralFlags = ['rx_final_esfera_od_neutral', 'rx_final_esfera_oi_neutral'];

        return $patient->consultations()
            ->when($excludeConsultationId, fn ($query) => $query->where('id', '!=', $excludeConsultationId))
            ->where(function ($query) use ($neutralFlags) {
                foreach (['esfera', 'cilindro', 'eje', 'add'] as $column) {
                    $query->orWhereNotNull("rx_final_{$column}_od")
                        ->orWhereNotNull("rx_final_{$column}_oi");
                }
                foreach ($neutralFlags as $flag) {
                    $query->orWhere($flag, true);
                }
            })
            ->with('optometrista:id,name')
            ->orderByDesc('fecha_consulta')
            ->orderByDesc('id')
            ->limit(max(1, min($limit, self::RX_HISTORY_MAX)))
            ->get(['id', 'patient_id', 'optometrista_id', 'numero_consulta', 'fecha_consulta', 'estado', ...$measures, ...$neutralFlags])
            ->map(fn ($consultation) => [
                'id' => $consultation->id,
                'numero_consulta' => $consultation->numero_consulta,
                'fecha_consulta' => $consultation->fecha_consulta?->toDateString(),
                'estado' => $consultation->estado,
                'optometrista' => $consultation->optometrista?->name,
                ...$consultation->only([...$measures, ...$neutralFlags]),
            ])
            ->all();
    }

    /**
     * Obtener resumen del paciente para el POS / vendedor.
     * Incluye última receta y datos de saldo.
     */
    public function getSummaryForSale(Patient $patient): array
    {
        $patient->load(['consultations' => fn ($q) => $q->latest('fecha_consulta')->limit(3)]);

        $lastConsultation = $patient->consultations->first();

        return [
            'patient' => $patient->only(['id', 'nombre', 'cedula', 'telefono', 'email']),
            'last_consultation' => $lastConsultation ? [
                'id' => $lastConsultation->id,
                'fecha_consulta' => $lastConsultation->fecha_consulta,
                'numero' => $lastConsultation->numero_consulta,
                // Datos de receta para POS (rx_final como fuente principal)
                'od_sphere' => $lastConsultation->rx_final_esfera_od ?? null,
                'od_cylinder' => $lastConsultation->rx_final_cilindro_od ?? null,
                'od_axis' => $lastConsultation->rx_final_eje_od ?? null,
                'oi_sphere' => $lastConsultation->rx_final_esfera_oi ?? null,
                'oi_cylinder' => $lastConsultation->rx_final_cilindro_oi ?? null,
                'oi_axis' => $lastConsultation->rx_final_eje_oi ?? null,
                'add' => $lastConsultation->rx_final_add_od ?? null,
            ] : null,
            'pending_balance' => 0, // TODO: calcular desde ventas en Fase 2
            'total_spent' => (float) ($patient->total_spent ?? 0),
        ];
    }
}
