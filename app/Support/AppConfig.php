<?php

namespace App\Support;

/**
 * Constantes de configuración de la aplicación Clarity.
 * Centraliza valores que se usan en múltiples partes del sistema.
 */
class AppConfig
{
    // Límites de negocio
    public const MAX_DISCOUNT_WITHOUT_APPROVAL = 20.0; // 20% máximo sin aprobación
    public const MIN_DEPOSIT_PERCENTAGE = 50.0;        // 50% mínimo para generar orden lab
    public const LAB_ORDER_OVERDUE_DAYS = 2;           // Días para alerta de atraso
    public const SESSION_TIMEOUT_MINUTES = 480;        // 8 horas de sesión

    // Paginación
    public const PATIENTS_PER_PAGE = 25;
    public const SALES_PER_PAGE = 20;
    public const PRODUCTS_PER_PAGE = 30;

    // Cache TTL en segundos
    public const CACHE_DASHBOARD = 60;
    public const CACHE_CONSULTATION_META = 600;
    public const CACHE_PRODUCTS = 300;
    public const CACHE_SETTINGS = 3600;

    // Notificaciones
    public const APPOINTMENT_REMINDER_HOURS_BEFORE = 24;
    public const STOCK_ALERT_MIN_QUANTITY = 5;

    // Facturación Ecuador
    public const IVA_RATE = 0.15;  // IVA Ecuador 15%
    public const CURRENCY = 'USD';
    public const CURRENCY_SYMBOL = '$';

    // WhatsApp
    public const WHATSAPP_MESSAGE_MAX_LENGTH = 4096;
    public const WHATSAPP_REMINDER_TEMPLATE = 'appointment_reminder';

    // Lab orders estados permitidos (en orden)
    public const LAB_ORDER_STATUSES = [
        'draft'      => 'Borrador',
        'pending'    => 'Pendiente envío',
        'sent'       => 'Enviado al laboratorio',
        'processing' => 'En proceso',
        'received'   => 'Recibido en óptica',
        'qc'         => 'Control de calidad',
        'ready'      => 'Listo para entrega',
        'delivered'  => 'Entregado',
        'reprocess'  => 'Reproceso',
        'cancelled'  => 'Cancelado',
    ];

    // Estados de venta
    public const SALE_STATUSES = [
        'draft'     => 'Borrador',
        'confirmed' => 'Confirmada',
        'partial'   => 'Pago parcial',
        'paid'      => 'Pagada',
        'cancelled' => 'Cancelada',
        'refunded'  => 'Devuelta',
    ];

    // Métodos de pago
    public const PAYMENT_METHODS = [
        'cash'     => 'Efectivo',
        'card'     => 'Tarjeta',
        'transfer' => 'Transferencia',
        'credit'   => 'Crédito interno',
        'coupon'   => 'Cupón',
    ];

    // Tipos de movimiento de inventario
    public const INVENTORY_MOVEMENT_TYPES = [
        'purchase'       => 'Compra',
        'sale'           => 'Venta',
        'return'         => 'Devolución',
        'transfer_in'    => 'Transferencia entrada',
        'transfer_out'   => 'Transferencia salida',
        'adjustment_add' => 'Ajuste (aumento)',
        'adjustment_sub' => 'Ajuste (disminución)',
        'physical_count' => 'Toma física',
        'initial'        => 'Stock inicial',
    ];
}
