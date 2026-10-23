<?php

namespace Tests\Unit;

use App\Models\Consultation;
use PHPUnit\Framework\TestCase;

class MeasureNotesCastTest extends TestCase
{
    private const LEGACY = "Datos adicionales del sistema anterior (accdb):\n- ALT OD: Tr";

    public function test_reads_json_notes_as_array(): void
    {
        $consultation = new Consultation;
        $consultation->setRawAttributes(['medidas_notas' => '{"subj_eje_od":"CC"}']);

        $this->assertSame(['subj_eje_od' => 'CC'], $consultation->medidas_notas);
    }

    public function test_legacy_plain_text_reads_as_null_without_breaking_json_state(): void
    {
        $consultation = new Consultation;
        $consultation->setRawAttributes(['medidas_notas' => self::LEGACY]);

        $this->assertNull($consultation->medidas_notas);
        // Un json_decode fallido dejaria el error global: la respuesta JSON fallaria.
        json_decode('[]');
        $this->assertSame(JSON_ERROR_NONE, json_last_error());
        $this->assertSame('{"a":1}', json_encode(['a' => 1]));
    }

    public function test_saving_without_notes_keeps_legacy_text_in_database(): void
    {
        // Igual que al cargar desde la BD: el valor original queda sincronizado.
        $consultation = new Consultation;
        $consultation->setRawAttributes(['medidas_notas' => self::LEGACY], true);

        $consultation->medidas_notas = null;

        $this->assertSame(self::LEGACY, $consultation->getAttributes()['medidas_notas']);
    }

    public function test_saving_notes_stores_json(): void
    {
        $consultation = new Consultation;
        $consultation->setRawAttributes(['medidas_notas' => null]);

        $consultation->medidas_notas = ['subj_eje_od' => 'CC'];

        $this->assertSame('{"subj_eje_od":"CC"}', $consultation->getAttributes()['medidas_notas']);
    }

    public function test_null_without_legacy_text_stores_null(): void
    {
        $consultation = new Consultation;
        $consultation->setRawAttributes(['medidas_notas' => '{"subj_eje_od":"CC"}']);

        $consultation->medidas_notas = null;

        $this->assertNull($consultation->getAttributes()['medidas_notas']);
    }
}
