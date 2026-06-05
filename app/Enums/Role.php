<?php

namespace App\Enums;

enum Role: string
{
    case ADMIN           = 'admin';
    case OPTOMETRA       = 'optometra';
    case RECEPCIONISTA   = 'recepcionista';
    case VENDEDOR        = 'vendedor';
    case CAJERO          = 'cajero';
    case ENCARGADO_LAB   = 'encargado_lab';

    public function label(): string
    {
        return match($this) {
            self::ADMIN         => 'Administrador',
            self::OPTOMETRA     => 'Optómetra',
            self::RECEPCIONISTA => 'Recepcionista',
            self::VENDEDOR      => 'Vendedor',
            self::CAJERO        => 'Cajero',
            self::ENCARGADO_LAB => 'Encargado de Laboratorio',
        };
    }

    public function color(): string
    {
        return match($this) {
            self::ADMIN         => 'red',
            self::OPTOMETRA     => 'blue',
            self::RECEPCIONISTA => 'green',
            self::VENDEDOR      => 'purple',
            self::CAJERO        => 'yellow',
            self::ENCARGADO_LAB => 'orange',
        };
    }

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    public static function labels(): array
    {
        return array_combine(
            array_column(self::cases(), 'value'),
            array_map(fn($r) => $r->label(), self::cases())
        );
    }
}
