<?php

namespace App\Services;

/**
 * Identificador del build de Vite que se esta sirviendo.
 *
 * El navegador lo compara con el que trajo al cargar para saber si hubo un
 * despliegue nuevo. Es el hash del manifest: cambia con cualquier cambio de assets.
 */
class AppVersion
{
    private static ?string $current = null;

    public static function current(): string
    {
        if (self::$current !== null) {
            return self::$current;
        }

        foreach (['build/.vite/manifest.json', 'build/manifest.json'] as $relative) {
            $path = public_path($relative);
            if (is_file($path)) {
                return self::$current = substr((string) md5_file($path), 0, 16);
            }
        }

        return self::$current = 'dev';
    }
}
