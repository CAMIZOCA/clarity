# Clarity - Sistema de gestion clinica y operativa

Clarity es una plataforma web para clinicas y opticas que necesitan trabajar con pacientes, consultas, agenda, ventas, inventario, laboratorio, reportes y administracion en un solo lugar.

## Que resuelve

- Registro y seguimiento de pacientes
- Consultas clinicas con datos optometricos y recomendaciones
- Agenda de citas y brigadas comunitarias
- Inventario, productos, stock y movimientos
- Punto de venta, caja y ordenes de trabajo
- Laboratorio, lentes especiales y referencias oftalmologicas
- CRM, recordatorios, reportes y administracion por roles

## Modulos principales

| Modulo | Que permite hacer |
|---|---|
| Pacientes | Crear, editar y consultar el historial de cada paciente |
| Consulta | Registrar atencion clinica, diagnosticos, recetas y recomendaciones |
| Agenda | Programar citas por dia, semana o mes |
| Brigadas | Organizar jornadas comunitarias y asociar pacientes |
| Lentes especiales | Dar seguimiento a adaptaciones de lentes especiales |
| Referencias | Controlar derivaciones a oftalmologia u otras especialidades |
| Ordenes de trabajo | Generar y revisar ordenes vinculadas a la atencion |
| Inventario | Administrar productos, stock, movimientos y bodegas |
| POS / Ventas | Registrar ventas, pagos, descuentos y devoluciones |
| Caja | Abrir, cerrar y revisar sesiones de caja |
| Laboratorio | Seguir pedidos, estados y observaciones tecnicas |
| CRM | Enviar recordatorios, gestionar plantillas y campanas |
| Reportes | Revisar indicadores clinicos, comerciales y operativos |
| Administracion | Gestionar usuarios, sucursales, bodegas, catalogos y configuracion |

## Stack tecnologico

- Laravel 13
- PHP 8.3+
- React 18
- Vite 8
- Tailwind CSS 4
- SQLite por defecto

## Requisitos

- PHP 8.3 o superior
- Composer
- Node.js 20 o superior
- npm

## Instalacion rapida

```bash
git clone https://github.com/CAMIZOCA/clarity.git
cd clarity
composer setup
```

`composer setup` instala dependencias, prepara el archivo `.env`, genera la clave de la aplicacion, ejecuta migraciones y compila los assets.

## Instalacion manual

```bash
git clone https://github.com/CAMIZOCA/clarity.git
cd clarity
composer install
npm install

Copy-Item .env.example .env
php artisan key:generate

if (!(Test-Path database\database.sqlite)) { New-Item -ItemType File database\database.sqlite | Out-Null }
php artisan migrate --seed

npm run build
```

## Desarrollo local

```bash
composer dev
```

Ese comando levanta el servidor Laravel, Vite, la cola de trabajos y el visor de logs en paralelo.

La aplicacion suele quedar disponible en `http://localhost:8000`.

## Acceso por defecto

El seeder principal crea un usuario administrador de prueba:

- Email: `admin@clinica.com`
- Password: `password`

## Comandos utiles

```bash
composer test
php artisan test --filter NombreDelTest
./vendor/bin/pint
npm run build
php artisan import:historias-clinicas
```

## Estructura general

- `routes/web.php` - rutas web y SPA
- `app/Http/Controllers/` - controladores HTTP y API
- `app/Models/` - modelos Eloquent
- `resources/js/` - aplicacion frontend en React
- `resources/views/` - vistas Blade base
- `database/migrations/` - esquema de base de datos
- `database/seeders/` - datos iniciales

## API

La API usa autenticacion por token con Laravel Sanctum.

Consulta `routes/api.php` para revisar los endpoints disponibles.

## Tests

```bash
composer test
```

Los tests cubren reglas de validacion, modulos CRUD y flujos de la API.

## Licencia

Distribuido bajo licencia MIT.
