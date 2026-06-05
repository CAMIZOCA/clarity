import React from 'react';

/**
 * Muestra un badge de color según el nivel de stock.
 * ok → verde, low → amarillo, empty → rojo
 */
export default function StockBadge({ quantity, minStock = 0 }) {
    if (quantity === 0) {
        return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                Sin stock
            </span>
        );
    }
    if (quantity <= minStock) {
        return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                Stock bajo ({quantity})
            </span>
        );
    }
    return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            {quantity}
        </span>
    );
}
