#!/bin/sh
set -e

cd /var/www/html

ROLE="${CONTAINER_ROLE:-app}"

echo "[entrypoint] rol: ${ROLE}"

if [ -z "${APP_KEY}" ]; then
    echo "[entrypoint] ERROR: APP_KEY no esta definida. Generala con 'php artisan key:generate --show' y cargala en las variables de entorno." >&2
    exit 1
fi

# El volumen persistente se monta sobre storage/ y oculta el arbol que trae la
# imagen, asi que hay que recrearlo en cada arranque.
mkdir -p \
    storage/app/public \
    storage/app/private \
    storage/app/tmp \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/testing \
    storage/framework/views \
    storage/logs \
    bootstrap/cache

chown -R www-data:www-data storage bootstrap/cache
chmod -R ug+rwX storage bootstrap/cache

# composer install corrio con --no-scripts, asi que el manifiesto de paquetes
# se genera aqui, ya con el entorno cargado.
php artisan package:discover --ansi

DB_PING='require "vendor/autoload.php"; $app = require "bootstrap/app.php"; $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap(); Illuminate\Support\Facades\DB::connection()->getPdo();'

wait_for_database() {
    i=1
    while [ "$i" -le 30 ]; do
        if php -r "${DB_PING}" >/dev/null 2>&1; then
            return 0
        fi
        echo "[entrypoint] esperando a la base de datos (${i}/30)..."
        i=$((i + 1))
        sleep 2
    done

    echo "[entrypoint] ERROR: la base de datos no respondio." >&2
    return 1
}

if [ "${ROLE}" = "app" ]; then
    wait_for_database

    php artisan migrate --force --ansi

    # Solo se siembra una base recien creada: los seeders de catalogos usan
    # updateOrCreate y sobrescribirian plantillas editadas por el usuario.
    USER_COUNT=$(php -r 'require "vendor/autoload.php"; $app = require "bootstrap/app.php"; $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap(); echo Illuminate\Support\Facades\DB::table("users")->count();')
    if [ "${USER_COUNT}" = "0" ]; then
        echo "[entrypoint] base vacia: ejecutando seeders iniciales"
        php artisan db:seed --force --ansi
    fi

    php artisan storage:link --force --ansi
else
    wait_for_database
fi

# route:cache no se puede usar: el catch-all de la SPA en routes/web.php es un
# Closure y no es serializable.
php artisan config:cache --ansi
php artisan event:cache --ansi
php artisan view:cache --ansi

chown -R www-data:www-data storage bootstrap/cache

exec "$@"
