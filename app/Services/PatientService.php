<?php

namespace App\Services;

use App\Models\Patient;
use App\Support\AppConfig;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;

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
        return $this->transaction(function () use ($data, $createdBy) {
            $patient = Patient::create(array_merge($data, [
                'created_by' => $createdBy,
            ]));

            $this->logActivity('patient_created', $patient, [
                'nombre' => $patient->nombre,
                'cedula' => $patient->cedula,
            ]);

            return $patient;
        });
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
