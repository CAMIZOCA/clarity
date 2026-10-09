<?php

namespace App\Services;

use Generator;
use Illuminate\Database\Migrations\Migrator;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use PDO;
use PDOStatement;
use RuntimeException;

/**
 * Convierte un backup de MySQL/MariaDB (el .sql.gz que genera mysqldump en
 * produccion) en un archivo SQLite que SystemRestoreService ya sabe restaurar.
 *
 * El DDL de MySQL no se traduce: el esquema sale de las migraciones del
 * proyecto y del dump solo se leen los datos. Primero se corren las
 * migraciones que el backup declara en su tabla `migrations`, despues se
 * cargan las filas y al final las migraciones que falten, para que un backup
 * de un ambiente atrasado reciba tambien las migraciones de datos.
 */
class MysqlDumpSqliteConverter
{
    private const CONNECTION = 'mysql_dump_import';

    /**
     * Tablas cuyo contenido no se traslada: estado de ejecucion del ambiente
     * de origen y el historial de mantenimiento, que apunta a archivos que
     * solo existen alla.
     */
    private const SKIPPED_DATA_TABLES = [
        'cache',
        'cache_locks',
        'failed_jobs',
        'job_batches',
        'jobs',
        'maintenance_operations',
        'personal_access_tokens',
        'sessions',
    ];

    private const STRING_ESCAPES = [
        '0' => "\0",
        'b' => "\x08",
        'n' => "\n",
        'r' => "\r",
        't' => "\t",
        'Z' => "\x1a",
    ];

    public function convert(string $dumpPath, string $sqlitePath): array
    {
        if (! is_file($dumpPath)) {
            throw new RuntimeException('No se pudo leer el archivo temporal subido.');
        }

        @set_time_limit(600);

        $dumpMigrations = $this->dumpMigrations($dumpPath);

        $directory = dirname($sqlitePath);
        if (! is_dir($directory)) {
            mkdir($directory, 0755, true);
        }

        if (file_put_contents($sqlitePath, '') === false) {
            throw new RuntimeException('No se pudo crear el SQLite de destino.');
        }

        Config::set('database.connections.'.self::CONNECTION, [
            'driver' => 'sqlite',
            'database' => $sqlitePath,
            'prefix' => '',
            'foreign_key_constraints' => false,
            // Archivo descartable: sin fsync por migracion la conversion pasa
            // de minutos a segundos.
            'journal_mode' => 'memory',
            'synchronous' => 'off',
        ]);
        DB::purge(self::CONNECTION);

        /** @var Migrator $migrator */
        $migrator = app('migrator');

        try {
            return $migrator->usingConnection(
                self::CONNECTION,
                fn (): array => $this->build($migrator, $dumpPath, $dumpMigrations)
            );
        } finally {
            // Sin esto el archivo queda abierto y en Windows no se puede
            // copiar ni borrar.
            DB::purge(self::CONNECTION);
        }
    }

    private function build(Migrator $migrator, string $dumpPath, array $dumpMigrations): array
    {
        $paths = array_merge([database_path('migrations')], $migrator->paths());
        $files = $migrator->getMigrationFiles($paths);

        $unknown = array_values(array_diff($dumpMigrations, array_keys($files)));
        if ($unknown !== []) {
            throw new RuntimeException(
                'El backup viene de una version mas nueva del sistema. Actualiza el codigo antes de restaurarlo.'
                .' Migraciones desconocidas: '.implode(', ', $unknown).'.'
            );
        }

        if (! $migrator->repositoryExists()) {
            $migrator->getRepository()->createRepository();
        }

        $initial = array_values(array_intersect_key($files, array_flip($dumpMigrations)));
        $migrator->requireFiles($initial);
        $migrator->runPending($initial);

        $load = $this->loadData($dumpPath, DB::connection(self::CONNECTION)->getPdo());

        $pending = $migrator->run($paths);

        return [
            'source_driver' => 'mysql',
            'loaded_tables' => $load['tables'],
            'loaded_rows' => $load['rows'],
            'skipped_tables' => $load['skipped'],
            'pending_migrations_applied' => array_map($migrator->getMigrationName(...), array_values($pending)),
        ];
    }

    private function dumpMigrations(string $dumpPath): array
    {
        $migrations = [];
        $found = false;

        foreach ($this->readDump($dumpPath, fn (string $table): bool => $table === 'migrations') as $event) {
            if ($event['table'] !== 'migrations') {
                continue;
            }

            $found = true;

            if ($event['type'] !== 'insert') {
                continue;
            }

            $index = array_search('migration', $event['columns'], true);
            if ($index === false) {
                break;
            }

            foreach ($event['rows'] as $row) {
                $migrations[] = (string) ($row[$index] ?? '');
            }
        }

        if (! $found || $migrations === []) {
            throw new RuntimeException('No es un backup del sistema actual: el archivo SQL no trae la tabla migrations.');
        }

        return $migrations;
    }

    private function loadData(string $dumpPath, PDO $pdo): array
    {
        $targetTables = $pdo
            ->query("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'")
            ->fetchAll(PDO::FETCH_COLUMN);
        $targetLookup = array_fill_keys($targetTables, true);

        $loadable = fn (string $table): bool => isset($targetLookup[$table])
            && $table !== 'migrations'
            && ! in_array($table, self::SKIPPED_DATA_TABLES, true);

        /** @var array<string, array{statement: PDOStatement, indexes: int[]}|null> $writers */
        $writers = [];
        $rowsLoaded = [];
        $skipped = [];

        $pdo->beginTransaction();

        try {
            foreach ($this->readDump($dumpPath, $loadable) as $event) {
                $table = $event['table'];

                if ($event['type'] === 'create') {
                    if (! isset($targetLookup[$table])) {
                        $skipped[] = $table;
                    } elseif ($table !== 'migrations') {
                        // Las migraciones siembran catalogos y ajustes; lo que
                        // vale es el contenido del backup.
                        $pdo->exec('delete from '.$this->quote($table));
                        if ($loadable($table)) {
                            $rowsLoaded[$table] = 0;
                        }
                    }

                    continue;
                }

                if (! $loadable($table)) {
                    continue;
                }

                if (! array_key_exists($table, $writers)) {
                    $writers[$table] = $this->writerFor($pdo, $table, $event['columns']);
                }

                $writer = $writers[$table];
                if ($writer === null) {
                    continue;
                }

                foreach ($event['rows'] as $row) {
                    $values = [];
                    foreach ($writer['indexes'] as $index) {
                        $values[] = $row[$index] ?? null;
                    }

                    $writer['statement']->execute($values);
                }

                $rowsLoaded[$table] = ($rowsLoaded[$table] ?? 0) + count($event['rows']);
            }

            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $e;
        } finally {
            $writers = [];
        }

        return [
            'tables' => count($rowsLoaded),
            'rows' => array_sum($rowsLoaded),
            'skipped' => $skipped,
        ];
    }

    /**
     * @return array{statement: PDOStatement, indexes: int[]}|null
     */
    private function writerFor(PDO $pdo, string $table, array $dumpColumns): ?array
    {
        $targetColumns = array_column(
            $pdo->query('pragma table_info('.$this->quote($table).')')->fetchAll(PDO::FETCH_ASSOC),
            'name'
        );

        // Una columna que el destino ya no tiene se descarta; una que el
        // backup no trae queda con el default de la migracion.
        $indexes = [];
        $columns = [];
        foreach ($dumpColumns as $index => $column) {
            if (in_array($column, $targetColumns, true)) {
                $indexes[] = $index;
                $columns[] = $this->quote($column);
            }
        }

        if ($columns === []) {
            return null;
        }

        $statement = $pdo->prepare(sprintf(
            'insert into %s (%s) values (%s)',
            $this->quote($table),
            implode(', ', $columns),
            implode(', ', array_fill(0, count($columns), '?'))
        ));

        return ['statement' => $statement, 'indexes' => $indexes];
    }

    /**
     * Recorre el dump y entrega un evento `create` por tabla (con sus
     * columnas en el orden del dump) y un evento `insert` por sentencia.
     * Las filas solo se interpretan para las tablas que `$wantsRows` acepta.
     */
    private function readDump(string $dumpPath, callable $wantsRows): Generator
    {
        // gzopen tambien lee archivos sin comprimir.
        $handle = gzopen($dumpPath, 'rb');
        if ($handle === false) {
            throw new RuntimeException('No se pudo leer el backup SQL.');
        }

        $columnsByTable = [];

        try {
            while (($line = gzgets($handle)) !== false) {
                if (str_starts_with($line, 'CREATE TABLE')) {
                    if (preg_match('/^CREATE TABLE (?:IF NOT EXISTS )?`((?:[^`]|``)+)`/', $line, $matches) !== 1) {
                        continue;
                    }

                    $table = str_replace('``', '`', $matches[1]);
                    $columns = [];

                    while (($definition = gzgets($handle)) !== false) {
                        if (preg_match('/^\s*`((?:[^`]|``)+)`\s/', $definition, $column) === 1) {
                            $columns[] = str_replace('``', '`', $column[1]);
                        }

                        if (str_starts_with($definition, ')')) {
                            break;
                        }
                    }

                    $columnsByTable[$table] = $columns;

                    yield ['type' => 'create', 'table' => $table, 'columns' => $columns];

                    continue;
                }

                if (! str_starts_with($line, 'INSERT')) {
                    continue;
                }

                if (preg_match('/^INSERT\s+(?:IGNORE\s+)?INTO\s+`((?:[^`]|``)+)`\s*(?:\(([^)]*)\)\s*)?VALUES\s*/', $line, $matches) !== 1) {
                    continue;
                }

                $table = str_replace('``', '`', $matches[1]);
                if (! $wantsRows($table)) {
                    continue;
                }

                $columns = ($matches[2] ?? '') !== ''
                    ? array_map(fn (string $column): string => trim($column, " `\t"), explode(',', $matches[2]))
                    : ($columnsByTable[$table] ?? []);

                if ($columns === []) {
                    throw new RuntimeException("El backup SQL no define las columnas de la tabla {$table}.");
                }

                $offset = strlen($matches[0]);

                // mysqldump escribe cada INSERT en una linea; si un valor
                // trajera un salto literal, se sigue leyendo hasta cerrarlo.
                while (($rows = $this->parseRows($line, $offset)) === null) {
                    $next = gzgets($handle);
                    if ($next === false) {
                        throw new RuntimeException("El backup SQL esta truncado en la tabla {$table}.");
                    }

                    $line .= $next;
                }

                yield ['type' => 'insert', 'table' => $table, 'columns' => $columns, 'rows' => $rows];
            }
        } finally {
            gzclose($handle);
        }
    }

    /**
     * Interpreta `(v, v, ...),(...);`. Devuelve null si la sentencia termina
     * antes del punto y coma.
     */
    private function parseRows(string $sql, int $pos): ?array
    {
        $length = strlen($sql);
        $rows = [];

        while (true) {
            $pos += strspn($sql, " \t\r\n,", $pos);
            if ($pos >= $length) {
                return null;
            }

            if ($sql[$pos] === ';') {
                return $rows;
            }

            if ($sql[$pos] !== '(') {
                throw new RuntimeException('El backup SQL tiene un INSERT con formato no reconocido.');
            }

            $pos++;
            $row = [];

            while (true) {
                $pos += strspn($sql, " \t\r\n", $pos);
                if ($pos >= $length) {
                    return null;
                }

                if (substr_compare($sql, '_binary', $pos, 7) === 0) {
                    $pos += 7;
                    $pos += strspn($sql, " \t", $pos);
                    if ($pos >= $length) {
                        return null;
                    }
                }

                if ($sql[$pos] === "'") {
                    $string = $this->parseString($sql, $pos, $length);
                    if ($string === null) {
                        return null;
                    }

                    [$row[], $pos] = $string;
                } else {
                    $tokenLength = strcspn($sql, ',)', $pos);
                    if ($pos + $tokenLength >= $length) {
                        return null;
                    }

                    $row[] = $this->literal(trim(substr($sql, $pos, $tokenLength)));
                    $pos += $tokenLength;
                }

                $pos += strspn($sql, " \t\r\n", $pos);
                if ($pos >= $length) {
                    return null;
                }

                if ($sql[$pos] === ',') {
                    $pos++;

                    continue;
                }

                if ($sql[$pos] === ')') {
                    $pos++;

                    break;
                }

                throw new RuntimeException('El backup SQL tiene un INSERT con formato no reconocido.');
            }

            $rows[] = $row;
        }
    }

    /**
     * @return array{0: string, 1: int}|null
     */
    private function parseString(string $sql, int $pos, int $length): ?array
    {
        $pos++;
        $value = '';

        while (true) {
            $chunk = strcspn($sql, "'\\", $pos);
            $value .= substr($sql, $pos, $chunk);
            $pos += $chunk;

            if ($pos + 1 >= $length) {
                return null;
            }

            if ($sql[$pos] === '\\') {
                $escaped = $sql[$pos + 1];
                $value .= self::STRING_ESCAPES[$escaped] ?? $escaped;
                $pos += 2;

                continue;
            }

            if ($sql[$pos + 1] === "'") {
                $value .= "'";
                $pos += 2;

                continue;
            }

            return [$value, $pos + 1];
        }
    }

    private function literal(string $token): ?string
    {
        if (strcasecmp($token, 'NULL') === 0) {
            return null;
        }

        if (preg_match('/^0x([0-9a-f]*)$/i', $token, $matches) === 1 && strlen($matches[1]) % 2 === 0) {
            return (string) hex2bin($matches[1]);
        }

        return $token;
    }

    private function quote(string $identifier): string
    {
        return '"'.str_replace('"', '""', $identifier).'"';
    }
}
