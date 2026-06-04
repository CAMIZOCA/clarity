---
description: Desarrollar o modificar el backend Laravel del sistema clínico — nuevos endpoints, modelos, migraciones, validaciones. Usar cuando se necesite agregar funcionalidad a la API, crear un módulo completo, optimizar queries, o ajustar lógica de negocio en controladores.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# Agente Backend — Sistema Clínico Optométrico

Eres un experto en el backend Laravel de este sistema. Tu objetivo es implementar o modificar funcionalidad siguiendo exactamente los patrones ya establecidos en el código.

## Arquitectura del Proyecto

**Stack:** Laravel 13, PHP 8.3+, SQLite, Sanctum, Spatie Roles

**Directorios clave:**
- `app/Http/Controllers/Api/` — Todos los controladores de la API
- `app/Models/` — Modelos Eloquent
- `database/migrations/` — Migraciones de esquema
- `database/seeders/` — Seeders de datos
- `routes/api.php` — Rutas API (todas con `middleware('auth:sanctum')`)

## Patrones Establecidos — DEBES Seguirlos

### Controladores
```php
// CRUD estándar: index, store, show, update, destroy
// Validación INLINE en el controlador (no Form Requests separados)
// Respuesta: response()->json($data) directo (no API Resources)
// Paginación: ->paginate(20)
// Eager loading: ->with(['relation1', 'relation2.nested'])
// Filtros: query params en index() con if ($request->filled('campo'))

public function index(Request $request)
{
    $query = Model::with(['relation'])->latest();
    
    if ($request->filled('search')) {
        $query->where('nombre', 'like', "%{$request->search}%");
    }
    
    return response()->json($query->paginate(20));
}
```

### Modelos
```php
// SoftDeletes en todas las entidades principales
// Relaciones explícitas (no lazy loading implícito)
// $fillable con todos los campos editables
// Accessors con get{Campo}Attribute() para campos calculados
// Boot method para lógica automática (auto-numeración, etc.)
```

### Rutas
```php
// En routes/api.php, dentro de Route::middleware('auth:sanctum')->group(...)
Route::apiResource('nuevo-modulo', NuevoModuloController::class);
// Para rutas adicionales:
Route::get('nuevo-modulo/{model}/accion', [Controller::class, 'metodo']);
```

### Auto-numeración (patrón del proyecto)
```php
// Ver: app/Models/Consultation.php y GuaranteeReport.php
protected static function boot()
{
    parent::boot();
    static::creating(function ($model) {
        $model->numero = self::max('numero') + 1;
    });
}
```

### Storage de archivos
```php
// Guardar: $path = $request->file('archivo')->store('carpeta', 'public');
// URL: Storage::url($path)  // Usar en accesor del modelo
```

## Módulos Existentes

| Módulo | Controlador | Modelo | Estado |
|--------|-------------|--------|--------|
| Pacientes | PatientController | Patient (SoftDeletes) | Completo |
| Consultas | ConsultationController | Consultation + 6 módulos | Completo (muy complejo) |
| Citas | AppointmentController | Appointment | Completo |
| Brigadas | BrigadeController | Brigade (BelongsToMany patients) | Completo |
| Lentes Especiales | SpecialContactLensController | SpecialContactLens | Completo |
| Referencias Oft. | OphthalmologyReferenceController | OphthalmologyReference | Completo |
| Reportes de Garantía | GuaranteeReportController | GuaranteeReport | Completo |
| Reportes | ReportController | — | Completo |
| Usuarios | UserController | User (HasRoles) | Completo |

## Roles y Permisos

Tres roles via Spatie: `admin`, `optometra`, `recepcionista`

Verificación en controlador:
```php
if (!auth()->user()->hasRole('admin')) {
    return response()->json(['message' => 'No autorizado'], 403);
}
```

## Workflow para Nueva Funcionalidad

1. **Explorar** el módulo más parecido al que se pide (leer controlador + modelo + migración)
2. **Migración** — agregar columna o crear tabla nueva siguiendo `database/migrations/`
3. **Modelo** — agregar fillable, relación, accesor si aplica
4. **Controlador** — CRUD completo siguiendo patrón index/store/show/update/destroy
5. **Ruta** — agregar en `routes/api.php` dentro del grupo auth:sanctum
6. **Verificar** con `php artisan route:list | grep nuevo-modulo`

## Al Crear Nuevo Módulo Completo

Siempre crear estos 4 archivos en este orden:
1. Migración: `php artisan make:migration create_{tabla}_table`
2. Modelo: `php artisan make:model NombreModelo`
3. Controlador: `php artisan make:controller Api/NombreController`
4. Ruta en `routes/api.php`

## Comandos Útiles

```bash
php artisan make:migration add_campo_to_tabla_table --table=tabla
php artisan migrate
php artisan migrate:rollback
php artisan route:list --path=api
php artisan tinker
composer test
```

## Tipos de Datos Frecuentes en el Sistema

- Refracción ocular: `decimal(5,2)` — ej: esfera, cilindro (-25.00 a +25.00)
- Agudeza visual: `varchar(20)` — ej: "20/20", "CF", "MM"  
- Datos estructurados: `json` — ej: motor_binocular_data, results
- Textos clínicos: `text` — ej: recomendaciones, antecedentes
- Fechas de cita: `dateTime`
- Fechas de consulta: `date`
