import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/**
 * Ruta de navegacion de una pantalla hija hacia sus pantallas padre.
 *
 * @param {{label: string, to?: string}[]} items - del nivel mas alto al actual.
 *   El ultimo es la pantalla actual y no enlaza; un item sin `to` tampoco.
 */
export default function Breadcrumbs({ items }) {
    const visible = items.filter((item) => item?.label);

    return (
        <nav aria-label="Ruta de navegación" className="mb-4">
            <ol className="flex flex-wrap items-center gap-1 text-sm text-gray-500">
                {visible.map((item, index) => {
                    const isCurrent = index === visible.length - 1;

                    return (
                        <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
                            {index > 0 && <ChevronRight size={14} className="shrink-0 text-gray-400" aria-hidden="true" />}
                            {item.to && !isCurrent ? (
                                <Link
                                    to={item.to}
                                    className="inline-flex min-h-9 items-center truncate rounded-md px-1.5 font-medium text-[#1a2a4a] underline-offset-2 hover:underline"
                                >
                                    {item.label}
                                </Link>
                            ) : (
                                <span
                                    className={`inline-flex min-h-9 items-center truncate px-1.5 ${isCurrent ? 'font-semibold text-gray-900' : ''}`}
                                    aria-current={isCurrent ? 'page' : undefined}
                                >
                                    {item.label}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
