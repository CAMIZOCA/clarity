<?php

namespace App\Console\Commands;

use App\Models\Patient;
use Illuminate\Console\Command;
use PhpOffice\PhpSpreadsheet\IOFactory;

class UpdatePacientesImportados extends Command
{
    protected $signature = 'import:update-patients
                            {file : Ruta al archivo Excel con datos de pacientes}
                            {--header-row=1 : Número de fila con los encabezados (default: 1)}
                            {--col-id= : Nombre de la columna con el Id de consulta/paciente (legacy_id)}
                            {--col-nombre= : Nombre de la columna con el nombre del paciente}
                            {--col-cedula= : Nombre de la columna con la cédula}
                            {--col-nacimiento= : Nombre de la columna con la fecha de nacimiento}
                            {--dry-run : Solo reportar, no guardar en BD}
                            {--show-headers : Solo mostrar los encabezados del archivo y salir}';

    protected $description = 'Actualiza nombre, cédula y fecha de nacimiento de los pacientes importados';

    public function handle(): int
    {
        ini_set('memory_limit', '1G');

        $file = $this->argument('file');
        $dryRun = (bool) $this->option('dry-run');
        $headerRow = (int) $this->option('header-row');

        if (! file_exists($file)) {
            $this->error("Archivo no encontrado: {$file}");
            return Command::FAILURE;
        }

        $spreadsheet = IOFactory::load($file);
        $sheet = $spreadsheet->getActiveSheet();
        $rows = $sheet->toArray(null, true, true, true);

        // Si solo quiere ver encabezados
        if ($this->option('show-headers')) {
            $headers = $rows[$headerRow] ?? [];
            $this->info('Encabezados encontrados:');
            foreach ($headers as $colLetter => $header) {
                if (! empty($header)) {
                    $this->line("  [{$colLetter}] {$header}");
                }
            }
            return Command::SUCCESS;
        }

        // Validar columnas requeridas
        $colId = $this->option('col-id');
        $colNombre = $this->option('col-nombre');
        $colCedula = $this->option('col-cedula');
        $colNacimiento = $this->option('col-nacimiento');

        if (empty($colId) || (empty($colNombre) && empty($colCedula))) {
            $this->error('Debes indicar al menos --col-id y uno de --col-nombre o --col-cedula');
            $this->line('');
            $this->line('Usa --show-headers para ver los encabezados disponibles en el archivo.');
            $this->line('Ejemplo:');
            $this->line('  php artisan import:update-patients archivo.xlsx \\');
            $this->line('    --col-id="Id" --col-nombre="NOMBRE" --col-cedula="CEDULA" --col-nacimiento="FECHA_NACIMIENTO"');
            return Command::FAILURE;
        }

        if ($dryRun) {
            $this->warn('MODO DRY-RUN activado — no se guardarán cambios en la BD');
        }

        // Construir índice de columnas
        $headers = array_map('trim', $rows[$headerRow] ?? []);
        $colIndex = array_flip(array_filter($headers));

        // Verificar que las columnas existen en el archivo
        foreach (array_filter([$colId, $colNombre, $colCedula, $colNacimiento]) as $col) {
            if (! isset($colIndex[$col])) {
                $this->error("Columna '{$col}' no encontrada en el archivo. Usa --show-headers para ver las disponibles.");
                return Command::FAILURE;
            }
        }

        $updated = 0;
        $notFound = 0;
        $skipped = 0;
        $merged = 0;
        $errors = 0;

        $totalRows = count($rows) - $headerRow;
        $bar = $this->output->createProgressBar($totalRows);
        $bar->start();

        foreach ($rows as $rowNum => $row) {
            if ($rowNum <= $headerRow) {
                continue;
            }
            $bar->advance();

            $legacyId = trim((string) ($row[$colIndex[$colId] ?? ''] ?? ''));
            if (empty($legacyId)) {
                continue;
            }

            $nombre = $colNombre ? trim((string) ($row[$colIndex[$colNombre] ?? ''] ?? '')) : null;
            $cedula = $colCedula ? trim((string) ($row[$colIndex[$colCedula] ?? ''] ?? '')) : null;
            $nacimiento = $colNacimiento ? trim((string) ($row[$colIndex[$colNacimiento] ?? ''] ?? '')) : null;

            try {
                $patient = Patient::where('legacy_id', $legacyId)->first();

                if (! $patient) {
                    // También intentar buscar por cédula en caso de importaciones parciales previas
                    if ($cedula) {
                        $patient = Patient::where('cedula', $cedula)->first();
                    }
                    if (! $patient) {
                        $notFound++;
                        continue;
                    }
                }

                // Si ya tiene nombre real (no placeholder), saltar a menos que se fuerce
                if (! str_starts_with($patient->nombre, 'Paciente Pendiente #') && ! str_starts_with($patient->cedula, 'IMPORT-')) {
                    $skipped++;
                    continue;
                }

                if ($dryRun) {
                    $updated++;
                    continue;
                }

                $updateData = [];
                if ($nombre) {
                    $updateData['nombre'] = $nombre;
                }
                if ($cedula) {
                    // Verificar si ya existe otro paciente con esa cédula (para evitar duplicados)
                    $existing = Patient::where('cedula', $cedula)
                        ->where('id', '!=', $patient->id)
                        ->first();

                    if ($existing) {
                        // El paciente ya tiene un registro con esa cédula — re-asignar las consultas
                        $patient->consultations()->update(['patient_id' => $existing->id]);
                        $patient->delete();
                        $merged++;
                        continue;
                    }
                    $updateData['cedula'] = $cedula;
                }
                if ($nacimiento) {
                    try {
                        $updateData['fecha_nacimiento'] = \Carbon\Carbon::parse($nacimiento)->toDateString();
                    } catch (\Throwable) {
                        // ignorar fechas inválidas
                    }
                }

                if (! empty($updateData)) {
                    $patient->update($updateData);
                    $updated++;
                }
            } catch (\Throwable $e) {
                $errors++;
            }
        }

        $bar->finish();
        $this->newLine(2);

        $this->table(['Resultado', 'Total'], [
            ['Pacientes actualizados', $updated],
            ['Pacientes fusionados (cédula duplicada)', $merged],
            ['No encontrados (legacy_id sin registro)', $notFound],
            ['Saltados (ya tenían datos reales)', $skipped],
            ['Errores', $errors],
        ]);

        if ($dryRun) {
            $this->warn('DRY-RUN completado. Ningún dato fue guardado.');
        } else {
            $this->info('Actualización de pacientes completada.');
        }

        return Command::SUCCESS;
    }
}
