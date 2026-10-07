<?php

namespace App\Services;

use App\Jobs\SyncPatientToContifico;
use App\Models\Patient;
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

        if (!empty($filters['search'])) {
            $query = Patient::search($filters['search'])->withCount('consultations');
        } else {
            $query = Patient::query()->withCount('consultations');
        }

        $query->withMax('consultations', 'fecha_consulta');

        if (!empty($filters['customer_type'])) {
            $query->where('customer_type', $filters['customer_type']);
        }

        if (!empty($filters['branch_id'])) {
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
                'after'  => $patient->fresh()->only(['nombre', 'cedula', 'telefono', 'email']),
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
            'patient'           => $patient->only(['id', 'nombre', 'cedula', 'telefono', 'email']),
            'last_consultation' => $lastConsultation ? [
                'id'             => $lastConsultation->id,
                'fecha_consulta' => $lastConsultation->fecha_consulta,
                'numero'         => $lastConsultation->numero_consulta,
                // Datos de receta para POS (rx_final como fuente principal)
                'od_sphere'   => $lastConsultation->rx_final_esfera_od ?? null,
                'od_cylinder' => $lastConsultation->rx_final_cilindro_od ?? null,
                'od_axis'     => $lastConsultation->rx_final_eje_od ?? null,
                'oi_sphere'   => $lastConsultation->rx_final_esfera_oi ?? null,
                'oi_cylinder' => $lastConsultation->rx_final_cilindro_oi ?? null,
                'oi_axis'     => $lastConsultation->rx_final_eje_oi ?? null,
                'add'         => $lastConsultation->rx_final_add_od ?? null,
            ] : null,
            'pending_balance' => 0, // TODO: calcular desde ventas en Fase 2
            'total_spent'     => (float) ($patient->total_spent ?? 0),
        ];
    }
}
