<?php

namespace App\Services;

use App\Models\Certificate;
use App\Models\CertifyingDoctor;
use App\Models\Consultation;
use App\Models\Setting;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpWord\Element\Cell;
use PhpOffice\PhpWord\Element\Section;
use PhpOffice\PhpWord\Element\Table;
use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\Settings;
use PhpOffice\PhpWord\Shared\Converter;
use PhpOffice\PhpWord\SimpleType\Jc;

/**
 * Certificado visual en Word (.docx).
 *
 * ESPEJO de `resources/js/components/pdf/CertificadoPdf.jsx`: mismos datos, mismo
 * orden y las mismas reglas de texto (diagnostico, RX final, recomendaciones,
 * medidas "N" y "COMP"). Un cambio en el PDF se replica aqui, y al reves.
 *
 * El ancho util de la hoja A4 con margenes de 2.1 cm es de 9525 twips.
 */
class CertificateDocxService
{
    /** Ancho util de la hoja en twips (A4 menos los margenes laterales). */
    private const WIDTH = 9525;

    private const NAVY = '1A2A4A';

    private const BLUE = '2F6DB5';

    private const BORDER = '9DB4D0';

    /** Columnas de la RX final (RX_COLS del JSX). */
    private const RX_COLS = [
        'rx_final_esfera' => 'ESFERA',
        'rx_final_cilindro' => 'CILINDRO',
        'rx_final_eje' => 'EJE',
        'rx_final_add' => 'ADD',
        'rx_final_av' => 'AVL',
        'rx_final_prisma' => 'PRISMA',
        'rx_final_base' => 'BASE',
        'rx_final_dnp' => 'DNP/DP',
    ];

    /** Medidas que se imprimen con signo explicito (SIGNED_RX_KEYS del JSX). */
    private const SIGNED_RX_KEYS = ['rx_final_esfera', 'rx_final_cilindro', 'rx_final_add'];

    private const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif'];

    public function __construct(private ConsultationService $consultations) {}

    /**
     * Devuelve el contenido binario del .docx.
     */
    public function generate(Consultation $consultation, string $tipo, ?CertifyingDoctor $doctor): string
    {
        $c = $this->consultations->loadConsultation($consultation);
        $patient = $c->patient;

        $word = new PhpWord;
        $word->setDefaultFontName('Arial');
        $word->setDefaultFontSize(9);

        $section = $word->addSection([
            'paperSize' => 'A4',
            'marginTop' => Converter::cmToTwip(1.6),
            'marginBottom' => Converter::cmToTwip(1.3),
            'marginLeft' => Converter::cmToTwip(2.1),
            'marginRight' => Converter::cmToTwip(2.1),
        ]);

        $this->header($section);
        $this->title($section);
        $this->dateLine($section);
        $this->patientBlock($section, $c, $patient);
        $this->visualAcuityRow($section, $c);
        $this->diagnosis($section, $c);

        if ($this->showsRx($tipo) && $this->hasRx($c)) {
            $this->rxTable($section, $c);
        }

        $this->recommendations($section, $c);
        $this->closing($section);
        $this->signature($section, $doctor);
        $this->footer($section);

        return $this->save($word);
    }

    /** Certificado escolar/vehicular: igual que el general, sin RX final. */
    private function showsRx(string $tipo): bool
    {
        return $tipo !== Certificate::TIPO_ESCOLAR_VEHICULAR;
    }

    private function header(Section $section): void
    {
        $logo = $this->localImage(Setting::get('clinic_logo'));

        if ($logo) {
            $section->addImage($logo, ['height' => 70, 'alignment' => Jc::START]);

            return;
        }

        $section->addText(Setting::get('clinic_name', 'Óptica'), ['bold' => true, 'size' => 14, 'color' => self::NAVY], ['spaceAfter' => 0]);

        $tagline = Setting::get('clinic_tagline');
        if ($tagline) {
            $section->addText($tagline, ['size' => 8, 'color' => '666666'], ['spaceAfter' => 0]);
        }
    }

    private function title(Section $section): void
    {
        $section->addText(
            'CERTIFICADO VISUAL',
            ['bold' => true, 'size' => 16, 'color' => self::NAVY, 'underline' => 'single'],
            ['alignment' => Jc::CENTER, 'spaceBefore' => 240, 'spaceAfter' => 240]
        );
    }

    private function dateLine(Section $section): void
    {
        $city = Setting::get('clinic_city', 'Quito');
        $emision = mb_strtolower($this->longDate(now()->toDateString()));

        $section->addText("{$city}, {$emision}", ['bold' => true, 'size' => 9.5], ['alignment' => Jc::END, 'spaceAfter' => 240]);
    }

    private function patientBlock(Section $section, Consultation $c, $patient): void
    {
        $cedula = $patient->cedula ?: ($patient->company_ruc ?? '');
        $fecha = $this->longDate($c->fecha_consulta);
        $paragraph = ['spaceAfter' => 60, 'lineHeight' => 1.3];

        $run = $section->addTextRun($paragraph);
        $run->addText('Por medio de la presente certifico haber examinado al paciente ', ['size' => 10]);
        $run->addText($patient->nombre_completo ?: $patient->nombre, ['bold' => true, 'size' => 10]);

        $run = $section->addTextRun($paragraph);
        $run->addText('De ', ['size' => 10]);
        $run->addText((string) $patient->edad, ['bold' => true, 'size' => 10]);
        $run->addText(' Años de edad, con Cédula ID: ', ['size' => 10]);
        $run->addText($cedula, ['bold' => true, 'size' => 10]);

        if ($fecha) {
            $section->addText("Asistió a consulta, el día: {$fecha}", ['size' => 10], $paragraph);
        }

        if ($c->numero_consulta) {
            $run = $section->addTextRun($paragraph);
            $run->addText('Consulta No: ', ['size' => 10]);
            $run->addText((string) $c->numero_consulta, ['bold' => true, 'size' => 10]);
        }

        $section->addText('', [], ['spaceAfter' => 120]);
    }

    /** AV.SC, AV.CC y visión de colores, en una fila sin bordes. */
    private function visualAcuityRow(Section $section, Consultation $c): void
    {
        $hasAv = filled($c->avsc_od) || filled($c->avsc_oi) || filled($c->rx_final_av_od) || filled($c->rx_final_av_oi);
        $vision = (string) ($c->vision_colores ?? '');

        if (! $hasAv && $vision === '') {
            return;
        }

        $avBlocks = [];
        if ($hasAv) {
            $avBlocks = [
                ['AV.SC', $c->avsc_od, $c->avsc_oi],
                ['AV.CC', $c->rx_final_av_od, $c->rx_final_av_oi],
            ];
        }

        $table = $section->addTable(['borderSize' => 0]);
        $row = $table->addRow();

        $used = 0;
        foreach ($avBlocks as [$label, $od, $oi]) {
            $width = 2300;
            $used += $width;
            $cell = $row->addCell($width, ['valign' => 'top']);
            $this->avTable($cell, $label, $od, $oi);
        }

        $visionWidth = $vision === '' ? 0 : 2900;
        $spacer = self::WIDTH - $used - $visionWidth;
        if ($spacer > 0) {
            $row->addCell($spacer)->addText('', [], ['spaceAfter' => 0]);
        }

        if ($vision !== '') {
            $cell = $row->addCell($visionWidth, ['valign' => 'top']);
            $inner = $cell->addTable(['borderSize' => 6, 'borderColor' => self::BORDER]);
            $this->mergedHeader($inner, 'VISIÓN DE COLORES', 1, self::BLUE);
            $innerRow = $inner->addRow();
            $this->cellText($innerRow->addCell($visionWidth), $vision, ['bold' => true, 'size' => 9], ['alignment' => Jc::CENTER, 'spaceAfter' => 0]);
            $cell->addText('', [], ['spaceAfter' => 0]);
        }

        $section->addText('', [], ['spaceAfter' => 200]);
    }

    private function avTable(Cell $cell, string $label, ?string $od, ?string $oi): void
    {
        $inner = $cell->addTable(['borderSize' => 6, 'borderColor' => self::BORDER]);
        $this->mergedHeader($inner, $label, 2, self::BLUE);

        $lejos = $inner->addRow();
        $this->cellText($lejos->addCell(2300, ['gridSpan' => 2]), 'LEJOS', ['bold' => true, 'size' => 8], ['alignment' => Jc::CENTER, 'spaceAfter' => 0]);

        foreach (['O.D' => $od, 'O.I' => $oi] as $eye => $value) {
            $row = $inner->addRow();
            $this->cellText($row->addCell(900), $eye, ['bold' => true, 'size' => 9], ['alignment' => Jc::CENTER, 'spaceAfter' => 0]);
            $this->cellText($row->addCell(1400), (string) ($value ?? ''), ['size' => 9], ['alignment' => Jc::CENTER, 'spaceAfter' => 0]);
        }

        $cell->addText('', [], ['spaceAfter' => 0]);
    }

    /** Diagnostico por ojo; un diagnostico "general" aplica a ambos. */
    private function diagnosis(Section $section, Consultation $c): void
    {
        $diagnoses = $c->diagnoses ?? collect();
        $general = $diagnoses->where('eye', 'general');

        $od = filled($c->certificado_diagnostico_od)
            ? $c->certificado_diagnostico_od
            : $this->joinDiagnoses($diagnoses->where('eye', 'od')->concat($general));
        $oi = filled($c->certificado_diagnostico_oi)
            ? $c->certificado_diagnostico_oi
            : $this->joinDiagnoses($diagnoses->where('eye', 'oi')->concat($general));

        if (! $od && ! $oi) {
            return;
        }

        $section->addText('DIAGNÓSTICO:', ['bold' => true, 'size' => 10, 'color' => self::NAVY], ['spaceAfter' => 80]);

        foreach (['O.D' => $od, 'O.I' => $oi] as $eye => $text) {
            if (! $text) {
                continue;
            }
            $run = $section->addTextRun(['spaceAfter' => 60]);
            $run->addText($eye, ['bold' => true, 'size' => 9]);
            $run->addText('   '.$text, ['size' => 9]);
        }

        $section->addText('', [], ['spaceAfter' => 200]);
    }

    /** Codigos juntos y despues las descripciones, sin repetir estas ultimas. */
    private function joinDiagnoses(Collection $list): string
    {
        $codes = $list->pluck('code')->filter()->implode(', ');
        $descriptions = $list->pluck('description')->filter()->unique()->implode(', ');

        return implode(' ', array_filter([$codes, $descriptions]));
    }

    private function hasRx(Consultation $c): bool
    {
        foreach (array_keys(self::RX_COLS) as $key) {
            if (filled($c->{$key.'_od'}) || filled($c->{$key.'_oi'})) {
                return true;
            }
        }

        return false;
    }

    private function rxTable(Section $section, Consultation $c): void
    {
        $table = $section->addTable(['borderSize' => 6, 'borderColor' => self::BORDER]);
        $columns = count(self::RX_COLS) + 1;
        $eyeWidth = 900;
        $colWidth = intdiv(self::WIDTH - $eyeWidth, count(self::RX_COLS));

        $this->mergedHeader($table, 'RX FINAL', $columns, self::BLUE);

        $head = $table->addRow();
        $this->cellText($head->addCell($eyeWidth), '', ['size' => 8], ['spaceAfter' => 0]);
        foreach (self::RX_COLS as $label) {
            $this->cellText($head->addCell($colWidth), $label, ['bold' => true, 'size' => 8], ['alignment' => Jc::CENTER, 'spaceAfter' => 0]);
        }

        foreach (['od' => 'O.D', 'oi' => 'O.I'] as $eye => $label) {
            $row = $table->addRow();
            $this->cellText($row->addCell($eyeWidth), $label, ['bold' => true, 'size' => 9], ['alignment' => Jc::CENTER, 'spaceAfter' => 0]);
            foreach (array_keys(self::RX_COLS) as $key) {
                $this->cellText($row->addCell($colWidth), $this->rxCell($c, $key, $eye), ['size' => 9], ['alignment' => Jc::CENTER, 'spaceAfter' => 0]);
            }
        }

        $section->addText('', [], ['spaceAfter' => 200]);
    }

    /** Valor de una celda de la RX final: la esfera neutra va como "N". */
    private function rxCell(Consultation $c, string $key, string $eye): string
    {
        if ($key === 'rx_final_esfera' && $c->{"rx_final_esfera_{$eye}_neutral"}) {
            return 'N';
        }

        $value = $c->{"{$key}_{$eye}"};

        // Esfera/cilindro sin numero ("COMP"): se imprime el texto que lo reemplaza.
        if ($value === null) {
            return (string) ($c->medidas_notas[$key.'_'.$eye] ?? '');
        }

        return in_array($key, self::SIGNED_RX_KEYS, true)
            ? $this->opticalForInput($value)
            : (string) $value;
    }

    /** Igual que formatOpticalForInput de opticalFormat.js: "+0.75", "-0.25", "0.00", "N". */
    private function opticalForInput(mixed $value): string
    {
        if (! filled($value)) {
            return '';
        }

        if (strtoupper((string) $value) === 'N') {
            return 'N';
        }

        if (! is_numeric($value)) {
            return (string) $value;
        }

        $number = (float) $value;

        if ($number === 0.0) {
            return '0.00';
        }

        return ($number > 0 ? '+' : '').number_format($number, 2, '.', '');
    }

    private function recommendations(Section $section, Consultation $c): void
    {
        $text = filled($c->certificado_nota)
            ? $c->certificado_nota
            : (filled($c->recomendaciones)
                ? $c->recomendaciones
                : $c->recommendationsList->filter(fn ($r) => filled($r->text))->pluck('text')->implode("\n"));

        if (! filled($text)) {
            return;
        }

        $section->addText('RECOMENDACIONES:', ['bold' => true, 'size' => 10, 'color' => self::NAVY], ['spaceAfter' => 80]);

        foreach (explode("\n", mb_strtoupper($text)) as $line) {
            $section->addText($line, ['size' => 9], ['spaceAfter' => 0]);
        }

        $section->addText('', [], ['spaceAfter' => 200]);
    }

    private function closing(Section $section): void
    {
        $section->addText('Es todo cuanto puedo certificar.', ['size' => 9.5], ['spaceAfter' => 480]);
    }

    private function signature(Section $section, ?CertifyingDoctor $doctor): void
    {
        if (! $doctor) {
            return;
        }

        $center = ['alignment' => Jc::CENTER, 'spaceAfter' => 0];

        if (filled($doctor->nombre)) {
            $section->addText($doctor->nombre, ['bold' => true, 'size' => 9], $center);
        }

        if (filled($doctor->titulo)) {
            $section->addText($doctor->titulo, ['bold' => true, 'size' => 8.5], $center);
        }

        if (filled($doctor->registro_senescyt)) {
            $run = $section->addTextRun($center);
            $run->addText('REG. SENESCYT', ['size' => 8]);
            $run->addTextBreak();
            $run->addText($doctor->registro_senescyt, ['size' => 8]);
        }

        $firma = $this->localImage($doctor->firma_path);
        if ($firma) {
            $section->addImage($firma, ['height' => 55, 'alignment' => Jc::CENTER]);
        } elseif (filled($doctor->nombre)) {
            $section->addText('______________________________', ['size' => 9], ['alignment' => Jc::CENTER, 'spaceBefore' => 480, 'spaceAfter' => 0]);
        }

        if (filled($doctor->titulo)) {
            $titulo = mb_strtoupper(mb_substr($doctor->titulo, 0, 1)).mb_strtolower(mb_substr($doctor->titulo, 1));
            $section->addText($titulo, ['size' => 8.5, 'color' => '333333'], $center);
        }

        $section->addText('', [], ['spaceAfter' => 240]);
    }

    private function footer(Section $section): void
    {
        $style = ['size' => 7.5, 'color' => '555555'];
        $center = ['alignment' => Jc::CENTER, 'spaceAfter' => 0];

        $address = Setting::get('clinic_address');
        if ($address) {
            $phone = Setting::get('clinic_phone');
            $section->addText('Dirección: '.$address.($phone ? " · Telf.: {$phone}" : ''), $style, $center);
        }

        $email = Setting::get('clinic_email');
        $website = Setting::get('clinic_website');
        if ($email || $website) {
            $line = collect([$email ? "Email: {$email}" : null, $website])->filter()->implode(' / ');
            $section->addText($line, $style, $center);
        }
    }

    /** Fila de encabezado azul que ocupa todas las columnas de la tabla. */
    private function mergedHeader(Table $table, string $text, int $span, string $background): void
    {
        $row = $table->addRow();
        $this->cellText(
            $row->addCell(null, ['gridSpan' => $span, 'bgColor' => $background, 'valign' => 'center']),
            $text,
            ['bold' => true, 'size' => 9, 'color' => 'FFFFFF'],
            ['alignment' => Jc::CENTER, 'spaceAfter' => 0]
        );
    }

    private function cellText(Cell $cell, string $text, array $font = [], array $paragraph = []): void
    {
        $cell->addText($text, $font, $paragraph);
    }

    /** Fecha larga en español, con la primera letra en mayuscula ("Martes, 27 de octubre de 2026"). */
    private function longDate(?string $iso): string
    {
        if (! $iso) {
            return '';
        }

        $raw = Carbon::parse($iso)->locale('es')->isoFormat('dddd, D [de] MMMM [de] YYYY');

        return mb_strtoupper(mb_substr($raw, 0, 1)).mb_substr($raw, 1);
    }

    /** Ruta absoluta de una imagen del disco publico, si existe y Word la puede leer. */
    private function localImage(?string $path): ?string
    {
        if (! $path || ! Storage::disk('public')->exists($path)) {
            return null;
        }

        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));

        return in_array($extension, self::IMAGE_EXTENSIONS, true)
            ? Storage::disk('public')->path($path)
            : null;
    }

    /**
     * PhpWord escribe el zip en su carpeta temporal. En Windows `sys_get_temp_dir()` apunta a
     * C:\Windows\Temp, donde PHP no puede crear ni leer carpetas, asi que se usa storage/app.
     */
    private function save(PhpWord $word): string
    {
        $dir = storage_path('app/phpword');
        File::ensureDirectoryExists($dir);
        Settings::setTempDir($dir);

        $tmp = tempnam($dir, 'certdocx');

        try {
            IOFactory::createWriter($word, 'Word2007')->save($tmp);

            return file_get_contents($tmp);
        } finally {
            @unlink($tmp);
        }
    }
}
