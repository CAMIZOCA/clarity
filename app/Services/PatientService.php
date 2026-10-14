<?php

namespace App\Services;

use App\Jobs\SyncPatientToContifico;
use App\Models\Patient;
use App\Rules\ValidPatientDocument;
use App\Support\AppConfig;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Collection as SupportCollection;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

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
        try {
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
        } catch (UniqueConstraintViolationException) {
            // Dos altas de la misma cedula a la vez: ambas pasan el `unique` de
            // la validacion y la segunda choca con el indice. No es un 500.
            throw ValidationException::withMessages([
                'cedula' => 'Ya existe un paciente registrado con esta cédula.',
            ]);
        }

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
     * `$type` es el tipo de documento que eligio quien registra (ver
     * ValidPatientDocument): decide con que regla se da por invalido.
     *
     * @return array{cedula: string, estado: string, mensaje: ?string, paciente: ?array<string, mixed>, relacionados: list<array<string, mixed>>}
     */
    public function lookupByDocument(string $document, ?int $excludeId = null, string $type = ValidPatientDocument::TYPE_CEDULA): array
    {
        $document = ValidPatientDocument::normalize($document, $type);
        $matches = $this->documentMatches($document, $excludeId);
        $match = $matches->first();

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

        if ($error = self::documentFormatError($document, $type)) {
            $result['estado'] = self::DOCUMENT_INVALID;
            $result['mensaje'] = $error;
        }

        return $result;
    }

    /**
     * Motivo por el que un documento no se puede registrar porque ya es de otro
     * paciente (tambien escrito de otra forma), o null si esta libre. Es la
     * misma comparacion de lookupByDocument(), para las reglas de validacion.
     */
    public function duplicateDocumentMessage(string $document, ?int $excludeId = null): ?string
    {
        $match = $this->documentMatches(strtoupper(trim($document)), $excludeId)->first();

        if (! $match) {
            return null;
        }

        return $match->trashed()
            ? "Este documento pertenece a un paciente eliminado ({$match->cedula}). Restáurelo en lugar de registrarlo de nuevo."
            : "Ya existe un paciente con este documento, registrado como {$match->cedula}.";
    }

    /**
     * Pacientes (tambien eliminados) que tienen el documento en alguna de sus
     * variantes. Primero el mejor: un paciente activo pesa mas que uno
     * eliminado, y la escritura exacta mas que una variante.
     *
     * @return Collection<int, Patient>
     */
    private function documentMatches(string $document, ?int $excludeId): Collection
    {
        return Patient::withTrashed()
            ->whereIn('cedula', self::documentVariants($document))
            ->when($excludeId, fn ($query) => $query->where('id', '!=', $excludeId))
            ->withCount('consultations')
            ->withMax('consultations', 'fecha_consulta')
            ->get()
            ->sortBy(fn (Patient $patient) => [$patient->trashed() ? 1 : 0, $patient->cedula === $document ? 0 : 1])
            ->values();
    }

    /**
     * Otros pacientes con el mismo email. Solo es un aviso: en una familia es
     * normal compartirlo, pero tambien delata a la misma persona registrada dos
     * veces.
     *
     * @return list<array<string, mixed>>
     */
    public function findByEmail(string $email, ?int $excludeId = null): array
    {
        $email = mb_strtolower(trim($email));

        if ($email === '') {
            return [];
        }

        return Patient::query()
            ->whereRaw('LOWER(email) = ?', [$email])
            ->when($excludeId, fn ($query) => $query->where('id', '!=', $excludeId))
            ->withCount('consultations')
            ->withMax('consultations', 'fecha_consulta')
            ->orderBy('nombre')
            ->limit(self::LOOKUP_LIMIT)
            ->get()
            ->map(fn (Patient $patient) => $this->lookupSummary($patient))
            ->all();
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

    /** Candidatos que se traen de la BD antes de decidir cuales se parecen. */
    private const SIMILAR_CANDIDATES = 50;

    /**
     * Pacientes cuyo nombre se parece al dado, en cualquier orden. Es la
     * segunda red contra duplicados: los importados sin cedula llevan un codigo
     * provisional ("HIST-00123") que ninguna cedula encuentra, y guardan
     * "APELLIDOS NOMBRES" completo en `nombre`.
     *
     * No se exigen todas las palabras: el Registro Civil trae los cuatro
     * nombres y muchos registros guardan dos o tres ("LOPEZ MARIA"), asi que
     * con el autocompletado la red dejaba de avisar. Basta con que coincida el
     * nombre mas corto de los dos; solo cuando ambos tienen cuatro palabras o
     * mas se tolera una distinta (un apellido escrito de otra forma).
     *
     * @return list<array<string, mixed>>
     */
    public function findSimilarByName(string $nombre, ?string $apellido = null, ?int $excludeId = null): array
    {
        $words = self::nameWords($nombre.' '.$apellido)->take(6);

        // Una sola palabra ("MARIA") traeria media base.
        if ($words->count() < 2) {
            return [];
        }

        $score = $words
            ->map(fn () => "(CASE WHEN nombre LIKE ? OR COALESCE(apellido, '') LIKE ? THEN 1 ELSE 0 END)")
            ->implode(' + ');
        $bindings = $words->flatMap(fn (string $word) => ["%{$word}%", "%{$word}%"])->all();

        return Patient::query()
            ->select('patients.*')
            ->selectRaw("({$score}) AS coincidencias", $bindings)
            ->whereRaw("({$score}) >= 2", $bindings)
            ->when($excludeId, fn ($query) => $query->where('id', '!=', $excludeId))
            ->withCount('consultations')
            ->withMax('consultations', 'fecha_consulta')
            ->orderByDesc('coincidencias')
            // A igual coincidencia, primero el nombre mas corto: es el que tiene
            // menos palabras sin emparejar.
            ->orderByRaw("LENGTH(nombre) + LENGTH(COALESCE(apellido, ''))")
            ->orderBy('nombre')
            ->limit(self::SIMILAR_CANDIDATES)
            ->get()
            ->filter(function (Patient $patient) use ($words) {
                $shortest = min($words->count(), self::nameWords($patient->nombre_completo)->count());

                return $patient->coincidencias >= max(2, $shortest >= 4 ? $shortest - 1 : $shortest);
            })
            ->take(self::LOOKUP_LIMIT)
            ->map(fn (Patient $patient) => $this->lookupSummary($patient))
            ->values()
            ->all();
    }

    /**
     * Palabras de un nombre que sirven para comparar: sin las de una o dos
     * letras ("DE", "LA") ni los comodines de LIKE.
     *
     * @return SupportCollection<int, string>
     */
    private static function nameWords(string $name): SupportCollection
    {
        return collect(preg_split('/\s+/u', trim($name)))
            ->map(fn (string $word) => str_replace(['%', '_'], '', $word))
            ->filter(fn (string $word) => mb_strlen($word) >= 3)
            ->unique()
            ->values();
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
        $patterns = $base !== null ? [$base.'%'] : self::lookalikePatterns($document);

        if ($patterns === []) {
            return [];
        }

        return Patient::query()
            ->where(function ($query) use ($patterns, $base) {
                foreach ($patterns as $pattern) {
                    $query->orWhere('cedula', 'LIKE', $pattern);
                }

                // Tambien las que se quedaron en 9 digitos por perder el ultimo
                // (el verificador): no hay otra cedula valida con ese comienzo.
                if ($base !== null) {
                    $query->orWhere('cedula', substr($base, 0, 9));
                }
            })
            ->whereNotIn('id', array_filter([...$skipIds, $excludeId]))
            ->withCount('consultations')
            ->withMax('consultations', 'fecha_consulta')
            ->orderBy('cedula')
            ->limit(self::LOOKUP_LIMIT)
            ->get()
            ->map(fn (Patient $patient) => $this->lookupSummary($patient))
            ->all();
    }

    /**
     * Patrones LIKE para un documento con letras que parece una cedula: la que
     * lleva un sufijo ("1710034065A", como anotaba a los familiares el sistema
     * anterior) y la que tiene una letra donde iba un digito ("17100340Q5").
     *
     * @return list<string>
     */
    private static function lookalikePatterns(string $document): array
    {
        $compact = self::compactDocument($document);

        if (! preg_match('/^[A-Z0-9]+$/', $compact) || preg_match_all('/\d/', $compact) < 8) {
            return [];
        }

        return array_values(array_unique([
            rtrim($compact, 'A..Z').'%',
            preg_replace('/[A-Z]/', '_', $compact).'%',
        ]));
    }

    /** Mensaje de ValidPatientDocument para el documento, o null si es valido. */
    private static function documentFormatError(string $document, string $type): ?string
    {
        $error = null;

        (new ValidPatientDocument($type))->validate('cedula', $document, function (string $message) use (&$error) {
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
            ->get(['id', 'patient_id', 'optometrista_id', 'numero_consulta', 'fecha_consulta', 'estado', ...$measures, ...$neutralFlags, 'medidas_notas'])
            ->map(fn ($consultation) => [
                'id' => $consultation->id,
                'numero_consulta' => $consultation->numero_consulta,
                'fecha_consulta' => $consultation->fecha_consulta?->toDateString(),
                'estado' => $consultation->estado,
                'optometrista' => $consultation->optometrista?->name,
                ...$consultation->only([...$measures, ...$neutralFlags, 'medidas_notas']),
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
