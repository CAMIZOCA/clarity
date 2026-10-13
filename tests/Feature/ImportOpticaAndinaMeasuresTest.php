<?php

namespace Tests\Feature;

use App\Models\Consultation;
use App\Models\Patient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PDO;
use Tests\TestCase;

/**
 * Medidas de las historias importadas de Optica Andina. En el Access el
 * subjetivo y la RX en uso son un solo texto por ojo; los valores son de
 * historias reales.
 */
class ImportOpticaAndinaMeasuresTest extends TestCase
{
    use RefreshDatabase;

    private string $source;

    protected function setUp(): void
    {
        parent::setUp();

        $this->source = tempnam(sys_get_temp_dir(), 'legacy-import-').'.sqlite';
        $pdo = new PDO('sqlite:'.$this->source);
        $pdo->exec('create table CLIENTES (Id text, CLIE_CEDULA text, "CLIE_APELLIDOS NOMBRES" text)');
        $pdo->exec('create table MEDICOS (Id text, "MED_NOMBRE APELLIDOS" text, MED_CODIGO text)');
        $pdo->exec('create table "HISTORIAL OPTAMOLOGIA" (Id text, ced_optometria text, FECHA text,
            RXPARCIAL_CILINDRO_OD text, RXPARCIAL_CILINDRO_OI text,
            "RX_EN USO_ESFERA_OD" text, "RX_EN USO_EJE_OD" text, "RX_EN USO_ESFERA_OI" text, "RX_EN USO_EJE_OI" text,
            RX_FINAL_OD_ESFRERA text, RX_FINAL_OD_CILINDRO text, RX_FINAL_OD_EJE text)');
        $pdo->exec("insert into CLIENTES values ('40001', '1710000301', 'PEREZ ANA')");
        $pdo->exec("insert into \"HISTORIAL OPTAMOLOGIA\" values
            ('71001', '1710000301', '2026-10-01 00:00:00',
             '+050-100x 80 20/40-', 'N -025 X 15 20/20',
             '20/25-', 'N -050 X 5 20/20 prog ev gold', '20/40', 'No trajo',
             'N', '-125', '20')");
    }

    protected function tearDown(): void
    {
        @unlink($this->source);

        parent::tearDown();
    }

    public function test_a_new_consultation_gets_the_whole_subjective_and_rx_en_uso(): void
    {
        $this->artisan('import:optica-andina-sqlite', ['database' => $this->source])->assertSuccessful();

        $consultation = Consultation::where('legacy_id', '71001')->firstOrFail();

        $this->assertEqualsWithDelta(0.50, $consultation->subj_esfera_od, 0.001);
        $this->assertEqualsWithDelta(-1.00, $consultation->subj_cilindro_od, 0.001);
        $this->assertSame(80, $consultation->subj_eje_od);
        $this->assertSame('20/40-', $consultation->subj_avl_od);
        $this->assertTrue($consultation->subj_esfera_oi_neutral);
        $this->assertEqualsWithDelta(-0.25, $consultation->subj_cilindro_oi, 0.001);

        $this->assertTrue($consultation->rx_uso_esfera_od_neutral);
        $this->assertEqualsWithDelta(-0.50, $consultation->rx_uso_cilindro_od, 0.001);
        $this->assertSame(5, $consultation->rx_uso_eje_od);
        $this->assertSame('20/25-', $consultation->rx_uso_avcc_od);

        // "N" en la RX final es una esfera neutra, no un campo en blanco.
        $this->assertTrue($consultation->rx_final_esfera_od_neutral);
        $this->assertEqualsWithDelta(-1.25, $consultation->rx_final_cilindro_od, 0.001);

        $entry = $consultation->rxUsoEntries()->where('orden', 0)->firstOrFail();
        $this->assertEqualsWithDelta(-0.50, $entry->cilindro_od, 0.001);
        $this->assertSame('20/40', $entry->avcc_oi);
        $this->assertSame('OD: 20/20 prog ev gold / OI: No trajo', $entry->observacion);
    }

    public function test_an_update_completes_the_measures_of_consultations_already_imported(): void
    {
        $patient = Patient::create(['nombre' => 'Ana', 'apellido' => 'Perez', 'cedula' => '1710000301', 'fecha_nacimiento' => '1970-01-01']);
        // Como la dejo la primera importacion, ya con el punto decimal corregido.
        $id = DB::table('consultations')->insertGetId([
            'patient_id' => $patient->id, 'numero_consulta' => 1, 'fecha_consulta' => '2026-10-01',
            'estado' => 'completada', 'legacy_id' => '71001', 'created_at' => now(), 'updated_at' => now(),
            'subj_cilindro_od' => 0.50, 'rx_final_cilindro_od' => -1.25, 'rx_final_eje_od' => 20,
        ]);

        $this->artisan('import:optica-andina-sqlite', ['database' => $this->source])->assertSuccessful();

        $row = DB::table('consultations')->find($id);
        $this->assertEqualsWithDelta(0.50, $row->subj_esfera_od, 0.001);
        $this->assertEqualsWithDelta(-1.00, $row->subj_cilindro_od, 0.001);
        $this->assertEquals(80, $row->subj_eje_od);
        $this->assertEqualsWithDelta(-0.50, $row->rx_uso_cilindro_od, 0.001);
        $this->assertDatabaseHas('consultation_legacy_repairs', ['consultation_id' => $id, 'rule' => 'subj_origen']);
    }

    public function test_a_dry_run_reports_the_recovery_without_writing(): void
    {
        $patient = Patient::create(['nombre' => 'Ana', 'apellido' => 'Perez', 'cedula' => '1710000301', 'fecha_nacimiento' => '1970-01-01']);
        $id = DB::table('consultations')->insertGetId([
            'patient_id' => $patient->id, 'numero_consulta' => 1, 'fecha_consulta' => '2026-10-01',
            'estado' => 'completada', 'legacy_id' => '71001', 'created_at' => now(), 'updated_at' => now(),
            'subj_cilindro_od' => 50,
        ]);

        $this->artisan('import:optica-andina-sqlite', ['database' => $this->source, '--dry-run' => true])->assertSuccessful();

        $this->assertEqualsWithDelta(50, DB::table('consultations')->find($id)->subj_cilindro_od, 0.001);
        $this->assertDatabaseCount('consultation_legacy_repairs', 0);
    }
}
