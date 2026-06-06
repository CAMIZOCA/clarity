# CLAUDE.md

Guia rapida para trabajar en este repositorio.

## Comandos

```bash
composer dev
composer test
php artisan test --filter NombreDelTest
./vendor/bin/pint
npm run build
composer setup
```

## Arquitectura

Stack principal: Laravel 13, PHP 8.3+, React 18, Vite 8, Tailwind CSS 4 y SQLite por defecto.

### Directorios clave

- `routes/web.php` - rutas web y entrada de la SPA
- `app/Http/Controllers/` - controladores HTTP y API
- `app/Models/` - modelos Eloquent
- `resources/js/` - frontend React
- `resources/views/` - vistas Blade base
- `database/migrations/` - esquema de base de datos
- `database/seeders/` - datos iniciales

### Base de datos

- SQLite es la configuracion local por defecto.
- Sesiones, cache y colas usan el driver de base de datos.
- No se requiere Redis para desarrollo local.

### Frontend

- Tailwind CSS 4 usa `@tailwindcss/vite`.
- No existe configuracion separada de PostCSS.
- Los estilos principales viven en `resources/css/app.css`.

### Seeder de prueba

`DatabaseSeeder` registra datos base y crea un usuario administrador:

- Email: `admin@clinica.com`
- Password: `password`

## Notas utiles

- La app es una SPA con React Router.
- La ruta `/ayuda` muestra la documentacion interna para usuarios finales.
- Revisa `routes/api.php` para ver los endpoints expuestos por la API.
