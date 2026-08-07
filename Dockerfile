# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Etapa 1: assets de Vite. public/build esta en .gitignore, asi que los assets
# se compilan siempre dentro de la imagen.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS assets

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY vite.config.js ./
COPY resources ./resources
COPY public ./public

ENV NODE_OPTIONS=--max-old-space-size=2048
RUN npm run build

# ---------------------------------------------------------------------------
# Etapa 2: base de PHP con las extensiones que exige la aplicacion.
#
#   pdo_sqlite  SystemRestoreService y LegacyImportService abren archivos
#               SQLite con `new PDO` aunque la base activa sea MySQL.
#   zip/gd/xml  requisitos duros de phpoffice/phpspreadsheet.
#   mariadb-client  aporta mysqldump, que DatabaseBackupService invoca antes
#               de cada restauracion.
# ---------------------------------------------------------------------------
FROM php:8.4-fpm-alpine AS base

COPY --from=mlocati/php-extension-installer:latest /usr/bin/install-php-extensions /usr/local/bin/

RUN install-php-extensions \
        pdo_mysql \
        pdo_sqlite \
        mbstring \
        zip \
        gd \
        intl \
        bcmath \
        exif \
        opcache \
        pcntl \
        sockets \
    && apk add --no-cache \
        nginx \
        supervisor \
        mariadb-client \
        tzdata \
        curl \
    && rm -rf /var/cache/apk/*

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer

WORKDIR /var/www/html

# ---------------------------------------------------------------------------
# Etapa 3: dependencias PHP y codigo de la aplicacion.
#
# composer install corre con --no-scripts porque post-autoload-dump ejecuta
# `artisan package:discover`, que arranca el framework y necesita un .env que
# en build todavia no existe. package:discover se ejecuta en el entrypoint.
# ---------------------------------------------------------------------------
FROM base AS build

COPY composer.json composer.lock ./
RUN composer install \
        --no-dev \
        --no-scripts \
        --no-autoloader \
        --prefer-dist \
        --no-interaction \
        --no-progress

COPY . .
COPY --from=assets /app/public/build ./public/build

RUN composer dump-autoload --no-dev --optimize --classmap-authoritative

# ---------------------------------------------------------------------------
# Etapa final: runtime
# ---------------------------------------------------------------------------
FROM base AS runtime

COPY --from=build --chown=www-data:www-data /var/www/html /var/www/html

COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/php.ini /usr/local/etc/php/conf.d/zz-clarity.ini
# zzz- para que cargue despues de zz-docker.conf, que trae la imagen oficial.
COPY docker/php-fpm.conf /usr/local/etc/php-fpm.d/zzz-clarity.conf
COPY docker/supervisord.conf /etc/supervisord.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint

RUN chmod +x /usr/local/bin/entrypoint \
    && mkdir -p /var/log/supervisor /run/nginx /var/www/html/storage /var/www/html/bootstrap/cache \
    && chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache

ENV CONTAINER_ROLE=app

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=5 \
    CMD curl -fsS http://127.0.0.1:8080/up || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint"]
CMD ["supervisord", "-c", "/etc/supervisord.conf"]
