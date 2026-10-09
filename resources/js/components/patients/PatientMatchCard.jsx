import React from 'react';
import { Link } from 'react-router-dom';
import { Edit2, Eye, Plus, RotateCcw, Trash2, UserCheck } from 'lucide-react';
import Button from '../ui/Button';
import { toDisplayDate } from '../../utils/dates';

/** "CI: 1712345678 · 45 años · Tel: 0991234567 · 3 consultas · Última: 20/02/2026" */
function summaryLine(patient) {
    const count = patient.consultations_count ?? 0;

    return [
        `CI: ${patient.cedula}`,
        patient.edad != null && `${patient.edad} años`,
        patient.telefono && `Tel: ${patient.telefono}`,
        count === 0 ? 'Sin consultas' : `${count} ${count === 1 ? 'consulta' : 'consultas'}`,
        patient.ultima_consulta && `Última: ${toDisplayDate(patient.ultima_consulta)}`,
    ].filter(Boolean).join(' · ');
}

/**
 * Paciente que ya tiene la cedula que se intenta registrar. Lleva a lo que la
 * recepcion necesita hacer con el: atenderlo, ver su ficha o corregir sus datos.
 */
export default function PatientMatchCard({
    patient, title = 'Este paciente ya está registrado', deleted = false, canEdit, canRestore, onRestore, restoring,
}) {
    if (deleted) {
        return (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5">
                <div className="flex items-start gap-3">
                    <Trash2 size={24} className="mt-0.5 flex-shrink-0 text-red-600" />
                    <div className="min-w-0 flex-1">
                        <p className="font-semibold text-red-900">Esta cédula pertenece a un paciente eliminado</p>
                        <p className="mt-1 text-lg font-semibold text-gray-900">{patient.nombre_completo}</p>
                        <p className="text-sm text-gray-600">{summaryLine(patient)}</p>
                        {canRestore ? (
                            <Button className="mt-4" onClick={onRestore} loading={restoring}>
                                <RotateCcw size={18} /> Restaurar paciente
                            </Button>
                        ) : (
                            <p className="mt-3 text-sm text-red-800">
                                No se puede registrar de nuevo. Pida a un administrador que lo restaure.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
                <UserCheck size={24} className="mt-0.5 flex-shrink-0 text-amber-700" />
                <div className="min-w-0 flex-1">
                    <p className="font-semibold text-amber-900">{title}</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{patient.nombre_completo}</p>
                    <p className="text-sm text-gray-600">{summaryLine(patient)}</p>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                        <Link to={`/consulta?paciente=${patient.id}`}>
                            <Button className="w-full justify-center"><Plus size={18} /> Nueva consulta</Button>
                        </Link>
                        <Link to={`/pacientes/${patient.id}`}>
                            <Button variant="secondary" className="w-full justify-center"><Eye size={18} /> Ver ficha</Button>
                        </Link>
                        {canEdit && (
                            <Link to={`/pacientes/${patient.id}/editar`}>
                                <Button variant="secondary" className="w-full justify-center"><Edit2 size={18} /> Actualizar datos</Button>
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Lista compacta de posibles coincidencias (cedulas relacionadas, nombres
 * parecidos). Avisa sin bloquear: quien registra decide si es la misma persona.
 */
export function PatientMatchList({ title, description, patients, renderAction }) {
    if (!patients?.length) return null;

    return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
            <p className="font-semibold text-amber-900">{title}</p>
            {description && <p className="mt-0.5 text-sm text-amber-800">{description}</p>}
            <ul className="mt-3 divide-y divide-amber-200/70">
                {patients.map((patient) => (
                    <li key={patient.id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <p className="font-medium text-gray-900">{patient.nombre_completo}</p>
                            <p className="text-sm text-gray-600">{summaryLine(patient)}</p>
                        </div>
                        <div className="flex flex-shrink-0 gap-2">
                            <Link to={`/pacientes/${patient.id}`}>
                                <Button variant="secondary" size="sm"><Eye size={16} /> Ver ficha</Button>
                            </Link>
                            {renderAction?.(patient)}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
