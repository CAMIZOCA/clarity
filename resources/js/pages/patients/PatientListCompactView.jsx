import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Edit2, Eye, Plus, Search, Trash2, User } from 'lucide-react';
import Button from '../../components/ui/Button';
import { toDisplayDate } from '../../utils/dates';

/**
 * Lista de pacientes en la plantilla Compacto (HIG). Solo presentacion: la
 * busqueda, el orden, la paginacion y el borrado vienen de PatientListPage, que
 * es el mismo codigo que usa la vista Clasico.
 *
 * Paridad con el Clasico (no quitar nada sin quitarlo alla): buscar, ordenar
 * por ultima consulta o nombre, columnas Paciente (con email), Cedula, Edad,
 * Telefono, Consultas y Ultima consulta, acciones Ver / Editar / Eliminar,
 * paginacion, estado vacio con "Registrar paciente" y "Nuevo paciente".
 */
const SORTS = [
    { value: 'ultima_consulta', label: 'Recientes' },
    { value: 'nombre', label: 'A–Z' },
];

export default function PatientListCompactView({
    patients, meta, search, onSearch, sort, onSort, page, onPage, loading, onOpen, onEdit, onDelete,
}) {
    const total = meta?.total;
    const registerLink = /^\d{9,13}$/.test(search.trim()) ? `/pacientes/nuevo?cedula=${search.trim()}` : '/pacientes/nuevo';

    return (
        <div className="mx-auto max-w-[112rem] space-y-4 px-4 py-4 lg:px-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-[28px] font-bold leading-tight tracking-tight text-gray-900">Pacientes</h1>
                    <p className="text-sm text-gray-500">
                        {total != null ? `${total.toLocaleString('es-EC')} ${search.trim() ? 'coinciden' : 'registrados'}` : 'Registro de pacientes'}
                    </p>
                </div>
                <Link to="/pacientes/nuevo">
                    <Button size="sm"><Plus size={16} /> Nuevo paciente</Button>
                </Link>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <label className="relative min-w-[16rem] flex-1">
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => onSearch(e.target.value)}
                        placeholder="Buscar por nombre, apellido o cédula"
                        aria-label="Buscar paciente"
                        className="w-full rounded-lg border-0 bg-gray-900/5 py-1.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-500 focus:bg-white focus:outline-none"
                    />
                </label>
                <div role="radiogroup" aria-label="Ordenar" className="inline-flex rounded-lg bg-gray-900/5 p-0.5">
                    {SORTS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={sort === option.value}
                            onClick={() => onSort(option.value)}
                            className={`rounded-md px-3 py-1 text-[13px] ${sort === option.value ? 'bg-white font-semibold text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="overflow-hidden rounded-xl bg-white shadow-sm">
                <table className="w-full table-fixed text-sm">
                    <thead>
                        <tr className="border-b border-gray-200 text-left text-xs font-semibold text-gray-500">
                            <th className="w-[32%] px-3 py-2">Paciente</th>
                            <th className="w-[13%] px-3 py-2">Cédula</th>
                            <th className="hidden w-[8%] px-3 py-2 md:table-cell">Edad</th>
                            <th className="hidden w-[13%] px-3 py-2 md:table-cell">Teléfono</th>
                            <th className="hidden w-[9%] px-3 py-2 lg:table-cell">Consultas</th>
                            <th className="w-[13%] px-3 py-2">Última consulta</th>
                            <th className="w-[12%] px-3 py-2 text-right"><span className="sr-only">Acciones</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} className="py-12 text-center">
                                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-navy border-t-transparent" />
                            </td></tr>
                        ) : patients.length === 0 ? (
                            <tr><td colSpan={7} className="py-12 text-center">
                                <User size={36} className="mx-auto mb-2 text-gray-300" />
                                <p className="text-gray-600">
                                    {search.trim() ? `Ningún paciente coincide con “${search.trim()}”.` : 'Todavía no hay pacientes registrados.'}
                                </p>
                                <Link to={registerLink}>
                                    <Button className="mt-3" variant="secondary" size="sm">
                                        {search.trim() ? 'Registrar paciente' : 'Registrar primer paciente'}
                                    </Button>
                                </Link>
                            </td></tr>
                        ) : patients.map((p) => {
                            const name = p.nombre_completo || p.nombre;
                            return (
                                <tr
                                    key={p.id}
                                    onClick={() => onOpen(p)}
                                    className="group cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-900/[0.03]"
                                >
                                    <td className="px-3 py-1.5">
                                        <div className="flex min-w-0 items-center gap-2.5">
                                            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gray-900/[0.07] text-xs font-semibold text-gray-600">{name?.[0]}</div>
                                            <div className="min-w-0">
                                                <p className="truncate font-medium text-gray-900">{name}</p>
                                                {p.email && <p className="truncate text-xs text-gray-500">{p.email}</p>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="truncate px-3 py-1.5 font-mono text-[13px] text-gray-700">{p.cedula}</td>
                                    <td className="hidden px-3 py-1.5 text-gray-700 md:table-cell">{p.edad != null ? `${p.edad} años` : '—'}</td>
                                    <td className="hidden truncate px-3 py-1.5 tabular-nums text-gray-700 md:table-cell">{p.telefono || '—'}</td>
                                    <td className="hidden px-3 py-1.5 tabular-nums text-gray-700 lg:table-cell">{p.consultations_count ?? '?'}</td>
                                    <td className="px-3 py-1.5 tabular-nums text-gray-700">
                                        {toDisplayDate(p.ultima_consulta ?? p.last_consultation?.fecha_consulta, '—')}
                                    </td>
                                    <td className="px-3 py-1.5">
                                        <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                                            <button type="button" onClick={() => onOpen(p)} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-900/5 hover:text-navy" title="Ver detalle" aria-label={`Ver ${name}`}>
                                                <Eye size={16} />
                                            </button>
                                            <button type="button" onClick={() => onEdit(p)} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-900/5 hover:text-navy" title="Editar" aria-label={`Editar ${name}`}>
                                                <Edit2 size={16} />
                                            </button>
                                            <button type="button" onClick={() => onDelete(p)} className="rounded-md p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600" title="Eliminar" aria-label={`Eliminar ${name}`}>
                                                <Trash2 size={16} />
                                            </button>
                                            <ChevronRight size={16} className="ml-1 text-gray-300" aria-hidden="true" />
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {meta?.last_page > 1 && (
                    <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2">
                        <p className="text-xs text-gray-500">Mostrando {meta.from}–{meta.to} de {meta.total} pacientes</p>
                        <div className="flex gap-1.5">
                            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Anterior</Button>
                            <Button variant="secondary" size="sm" disabled={page >= meta.last_page} onClick={() => onPage(page + 1)}>Siguiente</Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
