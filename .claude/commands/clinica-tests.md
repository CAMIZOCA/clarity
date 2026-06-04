---
description: Crear y mantener tests del sistema clínico — tests de API (Feature), tests unitarios de modelos, tests de validación y autorización. Usar cuando se necesite agregar cobertura de tests a módulos nuevos o existentes.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# Agente de Testing — Sistema Clínico Optométrico

Eres un experto en testing del sistema Laravel. Tu objetivo es crear tests que cubran los módulos de la API y la lógica de modelos, siguiendo el estilo Laravel PHPUnit.

## Configuración de Tests

- **Framework:** PHPUnit con Laravel
- **Tests de API:** `tests/Feature/` — prueban endpoints HTTP completos
- **Tests de modelos:** `tests/Unit/` — prueban lógica de modelos y servicios
- **DB:** `RefreshDatabase` trait — rollback automático por test
- **Usuario de prueba:** `test@example.com / password` (creado por `DatabaseSeeder`)

## Comando para Ejecutar

```bash
composer test                          # Todos los tests
php artisan test --filter NombreTest   # Un test específico
php artisan test tests/Feature/        # Solo Feature tests
php artisan test --parallel            # En paralelo (más rápido)
```

## Estructura de Test Feature (API)

```php
<?php

namespace Tests\Feature;

use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PatientTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->user = User::factory()->create(['role' => 'optometra']);
        $this->admin = User::factory()->create(['role' => 'admin']);
        $this->admin->assignRole('admin');
    }

    /** @test */
    public function it_lists_patients_for_authenticated_user(): void
    {
        Patient::factory(5)->create();

        $response = $this->actingAs($this->user)
            ->getJson('/api/patients');

        $response->assertOk()
            ->assertJsonStructure(['data', 'current_page', 'total']);
    }

    /** @test */
    public function it_requires_authentication_to_list_patients(): void
    {
        $this->getJson('/api/patients')->assertUnauthorized();
    }

    /** @test */
    public function it_creates_a_patient(): void
    {
        $data = Patient::factory()->make()->toArray();

        $response = $this->actingAs($this->user)
            ->postJson('/api/patients', $data);

        $response->assertCreated();
        $this->assertDatabaseHas('patients', ['cedula' => $data['cedula']]);
    }

    /** @test */
    public function it_validates_unique_cedula(): void
    {
        $patient = Patient::factory()->create();

        $this->actingAs($this->user)
            ->postJson('/api/patients', ['cedula' => $patient->cedula, 'nombre' => 'Otro'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['cedula']);
    }
}
```

## Patrones Importantes del Sistema

### Autenticación en tests
```php
// SIEMPRE usar actingAs() para rutas auth:sanctum
$this->actingAs($this->user)->getJson('/api/endpoint');

// NO usar: withHeaders(['Authorization' => 'Bearer ...'])
// El sistema usa session-based auth, no tokens
```

### Probar roles (admin-only)
```php
/** @test */
public function it_requires_admin_to_manage_users(): void
{
    $optometra = User::factory()->create(['role' => 'optometra']);
    
    $this->actingAs($optometra)
        ->getJson('/api/users')
        ->assertForbidden();
        
    $this->actingAs($this->admin)
        ->getJson('/api/users')
        ->assertOk();
}
```

### Probar SoftDeletes
```php
/** @test */
public function it_soft_deletes_patient(): void
{
    $patient = Patient::factory()->create();
    
    $this->actingAs($this->user)
        ->deleteJson("/api/patients/{$patient->id}")
        ->assertOk();
    
    $this->assertSoftDeleted('patients', ['id' => $patient->id]);
    $this->assertDatabaseHas('patients', ['id' => $patient->id]); // sigue en DB
}
```

### Probar auto-numeración
```php
/** @test */
public function consultation_numero_increments_per_patient(): void
{
    $patient = Patient::factory()->create();
    $optometra = User::factory()->create(['role' => 'optometra']);
    
    // Primera consulta del paciente
    $c1 = Consultation::factory()->create([
        'patient_id' => $patient->id,
        'optometrista_id' => $optometra->id,
    ]);
    
    // Segunda consulta del mismo paciente
    $c2 = Consultation::factory()->create([
        'patient_id' => $patient->id,
        'optometrista_id' => $optometra->id,
    ]);
    
    $this->assertEquals(1, $c1->numero_consulta);
    $this->assertEquals(2, $c2->numero_consulta);
}
```

### Probar filtros y búsqueda
```php
/** @test */
public function it_filters_patients_by_name(): void
{
    Patient::factory()->create(['nombre' => 'Juan Pérez']);
    Patient::factory()->create(['nombre' => 'María García']);

    $this->actingAs($this->user)
        ->getJson('/api/patients?search=Juan')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.nombre', 'Juan Pérez');
}
```

## Factories Existentes

- `User::factory()` — con campos `role`, `codigo`, `registro_senescyt`
- `Patient::factory()` — con `nombre`, `cedula` único, `fecha_nacimiento`
- Otros factories en `database/factories/`

## Crear Factory para Nuevo Módulo

```bash
php artisan make:factory NuevoModuloFactory --model=NuevoModulo
```

```php
// database/factories/NuevoModuloFactory.php
public function definition(): array
{
    return [
        'patient_id' => Patient::factory(),
        'campo_texto' => $this->faker->sentence(),
        'fecha' => $this->faker->date(),
        'estado' => $this->faker->randomElement(['pendiente', 'completado']),
    ];
}
```

## Checklist de Tests por Nuevo Módulo

Para cada módulo CRUD, crear tests para:

- [ ] `index` — lista elementos autenticado
- [ ] `index` — requiere autenticación
- [ ] `index` — filtra por parámetros de búsqueda
- [ ] `store` — crea con datos válidos
- [ ] `store` — falla con datos inválidos (validaciones)
- [ ] `store` — requiere autenticación
- [ ] `show` — devuelve elemento correcto
- [ ] `show` — 404 para elemento no existente
- [ ] `update` — actualiza con datos válidos
- [ ] `destroy` — elimina (soft delete)
- [ ] Si admin-only: test de autorización por rol

## Errores Comunes

```php
// ERROR: No incluir RefreshDatabase → datos se acumulan entre tests
use RefreshDatabase; // SIEMPRE

// ERROR: No asignar rol con Spatie → hasRole() devuelve false
$user->assignRole('admin'); // Necesario además de $user->role = 'admin'

// ERROR: Probar CRUD de consulta sin datos mínimos
// La consulta requiere patient_id, optometrista_id, y campos clínicos mínimos para estado 'completada'
// Para 'borrador', solo requiere patient_id
```
