<?php

namespace Tests\Feature;

use App\Models\Consultation;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PDO;
use Tests\TestCase;

/**
 * Medico de las consultas importadas de Optica Andina. Reproduce la carga del
 * 2026-10-09: el usuario del codigo "3" habia pasado a "003" y tres medicos
 * del backup ya no existian en el sistema.
 */
class ImportOpticaAndinaDoctorsTest extends TestCase
{
    use RefreshDatabase;

    private string $source;

    protected function setUp(): void
    {
        parent::setUp();

        $this->source = tempnam(sys_get_temp_dir(), 'legacy-import-').'.sqlite';
        $pdo = new PDO('sqlite:'.$this->source);
        $pdo->exec('create table CLIENTES (Id text, CLIE_CEDULA text, "CLIE_APELLIDOS NOMBRES" text)');
        $pdo->exec('create table "HISTORIAL OPTAMOLOGIA" (Id text, ced_optometria text, FECHA text, MEDICO_RESPONSABLE text)');
        $pdo->exec('create table MEDICOS (Id text, "MED_NOMBRE APELLIDOS" text, MED_CODIGO text)');
        $pdo->exec("insert into CLIENTES values ('40001', '1710000301', 'PEREZ ANA')");
        $pdo->exec("insert into MEDICOS values ('93', 'Opt. Ramiro Lopez', '3'), ('94', 'DOC. RETIRADO', '45')");
        $pdo->exec("insert into \"HISTORIAL OPTAMOLOGIA\" values
            ('71001', '1710000301', '2026-10-01 00:00:00', '3'),
            ('71002', '1710000301', '2026-10-02 00:00:00', '0500'),
            ('71003', '1710000301', '2026-10-03 00:00:00', '2')");
    }

    protected function tearDown(): void
    {
        @unlink($this->source);

        parent::tearDown();
    }

    private function user(string $name, ?string $codigo): User
    {
        return User::create([
            'name' => $name,
            'email' => str($name)->slug().'@example.test',
            'password' => 'secret-password',
            'role' => 'optometra',
            'codigo' => $codigo,
        ]);
    }

    private function doctorOf(string $legacyId): ?int
    {
        return Consultation::where('legacy_id', $legacyId)->value('optometrista_id');
    }

    public function test_a_doctor_code_matches_the_user_code_ignoring_leading_zeros(): void
    {
        $this->user('Administrador', 'ADM001');
        $ramiro = $this->user('Ramiro Lopez', '003');

        $this->artisan('import:optica-andina-sqlite', ['database' => $this->source])->assertSuccessful();

        $this->assertSame($ramiro->id, $this->doctorOf('71001'));
    }

    public function test_a_doctor_code_never_falls_back_to_the_user_id(): void
    {
        $this->user('Administrador', 'ADM001');
        $second = $this->user('Pamela Lopez', '002');
        $this->assertSame(2, $second->id);

        $this->artisan('import:optica-andina-sqlite', ['database' => $this->source, '--only' => 'consultations'])
            ->assertSuccessful();

        // El codigo "3" no tiene usuario: sin medico, no el usuario de id 3 ni otro.
        $this->assertNull($this->doctorOf('71001'));
        $this->assertNull($this->doctorOf('71002'));
        // "2" es el codigo "002", no el id 2 por casualidad.
        $this->assertSame($second->id, $this->doctorOf('71003'));
    }

    public function test_an_update_does_not_recreate_doctors_removed_from_the_system(): void
    {
        $this->user('Administrador', 'ADM001');
        $this->user('Ramiro Lopez', '003');
        $patient = Patient::create(['nombre' => 'Previo', 'cedula' => '1710000999', 'fecha_nacimiento' => '1970-01-01']);
        DB::table('consultations')->insert([
            'patient_id' => $patient->id, 'numero_consulta' => 1, 'fecha_consulta' => '2026-07-05',
            'estado' => 'completada', 'legacy_id' => '70000', 'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->artisan('import:optica-andina-sqlite', ['database' => $this->source])->assertSuccessful();

        $this->assertSame(2, User::count());
        $this->assertFalse(User::where('codigo', '45')->exists());
    }

    public function test_the_first_import_creates_the_doctors_of_the_backup(): void
    {
        $this->user('Administrador', 'ADM001');

        $this->artisan('import:optica-andina-sqlite', ['database' => $this->source])->assertSuccessful();

        $this->assertTrue(User::where('codigo', '3')->exists());
        $this->assertTrue(User::where('codigo', '45')->exists());
        $this->assertSame(User::where('codigo', '3')->value('id'), $this->doctorOf('71001'));
    }
}
