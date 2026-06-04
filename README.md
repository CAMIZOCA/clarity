<div align="center">

# Clarity — Sistema de Gestión Clínica Oftalmológica

**Plataforma web completa para la administración de consultorios y clínicas de oftalmología.**  
Gestión de pacientes, consultas clínicas, agenda, brigadas comunitarias y reportes analíticos.

![Laravel](https://img.shields.io/badge/Laravel-13-FF2D20?style=flat-square&logo=laravel&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![PHP](https://img.shields.io/badge/PHP-8.3+-777BB4?style=flat-square&logo=php&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-default-003B57?style=flat-square&logo=sqlite&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

</div>

---

## Características principales

| Módulo | Descripción |
|---|---|
| **Pacientes** | Registro completo con historial clínico, búsqueda en tiempo real y perfil oftalmológico |
| **Consultas** | Formulario clínico estructurado con agudeza visual, biomicroscopía, tonometría, diagnósticos CIE-10 y generación de PDF |
| **Agenda** | Calendario interactivo (FullCalendar) con gestión de citas por día, semana o mes |
| **Brigadas** | Organización de jornadas comunitarias con asignación masiva de pacientes |
| **Lentes especiales** | Control de pedidos y seguimiento de lentes de contacto especiales |
| **Referencias** | Gestión de referencias oftalmológicas a especialistas |
| **Reportes** | Dashboard analítico, estadísticas de consultas y diagnósticos, exportación CSV |
| **Configuración** | Logo, datos del consultorio, plantillas de impresión y catálogos clínicos personalizables |
| **Usuarios & Roles** | Control de acceso basado en roles con Spatie Laravel Permission |

---

## Stack tecnológico

**Backend**
- [Laravel 13](https://laravel.com/) — Framework PHP
- [Laravel Sanctum](https://laravel.com/docs/sanctum) — Autenticación API por tokens
- [Spatie Laravel Permission](https://spatie.be/docs/laravel-permission) — Roles y permisos
- [Maatwebsite Excel](https://laravel-excel.com/) — Exportación de datos
- SQLite — Base de datos (sin configuración adicional)

**Frontend**
- [React 18](https://react.dev/) + [React Router 6](https://reactrouter.com/) — SPA
- [Tailwind CSS 4.0](https://tailwindcss.com/) — Estilos utilitarios
- [FullCalendar](https://fullcalendar.io/) — Módulo de agenda
- [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) — Formularios y validación
- [Headless UI](https://headlessui.com/) — Componentes accesibles
- [html2pdf.js](https://ekoopmans.github.io/html2pdf.js/) — Generación de PDF en cliente
- [Lucide React](https://lucide.dev/) — Iconografía

**Tooling**
- [Vite 8](https://vite.dev/) — Bundler y dev server
- [Laravel Pint](https://laravel.com/docs/pint) — Formateo de código PHP
- [PHPUnit 12](https://phpunit.de/) — Tests

---

## Requisitos

- PHP 8.3+
- Composer
- Node.js 20+
- npm

---

## Instalación

### Configuración rápida (recomendado)

```bash
git clone https://github.com/CAMIZOCA/clarity.git
cd clarity
composer setup
```

Este comando ejecuta en secuencia: `composer install`, copia `.env`, genera la clave de app, ejecuta migraciones, instala dependencias npm y compila los assets.

### Configuración manual

```bash
# 1. Clonar e instalar dependencias
git clone https://github.com/CAMIZOCA/clarity.git
cd clarity
composer install
npm install

# 2. Configurar entorno
cp .env.example .env
php artisan key:generate

# 3. Crear base de datos y ejecutar migraciones
touch database/database.sqlite
php artisan migrate

# 4. Poblar datos iniciales (roles, catálogos, usuario admin)
php artisan db:seed

# 5. Compilar assets
npm run build
```

---

## Desarrollo

```bash
# Levanta todos los servicios en paralelo:
# servidor PHP · Vite (HMR) · queue listener · log viewer (Pail)
composer dev
```

La aplicación estará disponible en `http://localhost:8000`.

**Credenciales de acceso por defecto:**
- Email: `admin@clarity.com`
- Password: `password`

---

## Comandos útiles

```bash
# Ejecutar suite de tests
composer test

# Filtrar un test específico
php artisan test --filter NombreTest

# Formatear código PHP
./vendor/bin/pint

# Compilar assets para producción
npm run build

# Importar historias clínicas desde CSV
php artisan import:historias-clinicas
```

---

## Estructura del proyecto

```
clarity/
├── app/
│   ├── Http/Controllers/Api/   # Controladores REST (14 módulos)
│   └── Models/                 # Modelos Eloquent
├── database/
│   ├── migrations/             # Esquema de base de datos
│   └── seeders/                # Datos iniciales (roles, catálogos CIE-10)
├── resources/
│   ├── css/app.css             # Entrada Tailwind CSS 4
│   └── js/
│       ├── components/         # Componentes reutilizables (UI, PDF, forms)
│       ├── pages/              # Páginas por módulo
│       ├── contexts/           # AuthContext, SettingsContext
│       ├── hooks/              # useAutosave, usePatientSearch
│       └── api/                # Cliente HTTP centralizado con caché
└── routes/
    └── api.php                 # Endpoints REST protegidos con Sanctum
```

---

## API

Todos los endpoints requieren autenticación Bearer Token (Laravel Sanctum).

```
POST   /api/login

GET    /api/patients
GET    /api/patients/search?q=...
GET    /api/patients/{id}/consultations
GET    /api/consultations/{id}/pdf-data
GET    /api/reports/dashboard
GET    /api/reports/export/csv
...
```

Ver [`routes/api.php`](routes/api.php) para el listado completo de endpoints.

---

## Tests

```bash
composer test
```

Los tests de Feature validan los endpoints de la API. Los de Unit cubren la lógica de modelos.

---

## Licencia

Distribuido bajo la [Licencia MIT](https://opensource.org/licenses/MIT).
