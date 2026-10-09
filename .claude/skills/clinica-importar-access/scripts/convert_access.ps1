# Convierte el .accdb del sistema anterior de Optica Andina al SQLite que lee
# `php artisan import:optica-andina-sqlite`. Abre Access en solo lectura.
#
# La contrasena se toma de $env:ACCDB_PASSWORD (no se pasa por parametro para
# que no quede en el historial ni en el repositorio).
param(
    [Parameter(Mandatory = $true)][string]$Accdb,
    [Parameter(Mandatory = $true)][string]$OutSqlite
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Accdb)) { throw "Archivo no encontrado: $Accdb" }

$provider = (New-Object System.Data.OleDb.OleDbEnumerator).GetElements() |
    Where-Object { $_.SOURCES_NAME -like 'Microsoft.ACE.OLEDB.*' } |
    Sort-Object SOURCES_NAME -Descending | Select-Object -First 1 -ExpandProperty SOURCES_NAME
if (-not $provider) { throw 'No hay driver de Access (Microsoft.ACE.OLEDB). Instalar "Microsoft Access Database Engine" de 64 bits.' }

$builder = New-Object System.Data.OleDb.OleDbConnectionStringBuilder
$builder['Provider'] = [string]$provider
$builder['Data Source'] = [string](Resolve-Path -LiteralPath $Accdb).Path
$builder['Mode'] = 'Read'
if ($env:ACCDB_PASSWORD) { $builder['Jet OLEDB:Database Password'] = [string]$env:ACCDB_PASSWORD }

$cn = New-Object System.Data.OleDb.OleDbConnection($builder.ConnectionString)
try { $cn.Open() } catch { throw "No se pudo abrir el .accdb (revisar `$env:ACCDB_PASSWORD): $($_.Exception.InnerException.Message)" }

$outDir = Split-Path -Parent $OutSqlite
$exportDir = Join-Path $outDir 'export'
New-Item -ItemType Directory -Force $exportDir | Out-Null

Add-Type -AssemblyName System.Web.Extensions
$js = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$js.MaxJsonLength = [int]::MaxValue
$inv = [System.Globalization.CultureInfo]::InvariantCulture
$utf8 = New-Object System.Text.UTF8Encoding($false)

$tables = [ordered]@{ 'CLIENTES' = 'clientes.jsonl'; 'HISTORIAL OPTAMOLOGIA' = 'historial.jsonl'; 'MEDICOS' = 'medicos.jsonl' }

try {
    foreach ($table in $tables.Keys) {
        $cmd = $cn.CreateCommand()
        $cmd.CommandText = "SELECT * FROM [$table]"
        $rd = $cmd.ExecuteReader()
        $names = 0..($rd.FieldCount - 1) | ForEach-Object { $rd.GetName($_) }

        $sw = New-Object System.IO.StreamWriter((Join-Path $exportDir $tables[$table]), $false, $utf8)
        $sw.WriteLine($js.Serialize($names))
        $count = 0
        while ($rd.Read()) {
            $row = New-Object 'object[]' $rd.FieldCount
            for ($i = 0; $i -lt $rd.FieldCount; $i++) {
                if ($rd.IsDBNull($i)) { continue }
                $v = $rd.GetValue($i)
                # Fotos (OLE) fuera: el importador no las usa y pesan casi todo el archivo.
                if ($v -is [byte[]]) { continue }
                elseif ($v -is [datetime]) { $row[$i] = $v.ToString('yyyy-MM-dd HH:mm:ss', $inv) }
                elseif ($v -is [bool]) { $row[$i] = if ($v) { '1' } else { '0' } }
                else { $row[$i] = [System.Convert]::ToString($v, $inv) }
            }
            $sw.WriteLine($js.Serialize($row))
            $count++
        }
        $sw.Close()
        $rd.Close()
        "{0}: {1} filas, {2} columnas" -f $table, $count, $names.Count
    }
}
finally { $cn.Close() }

if (Test-Path -LiteralPath $OutSqlite) { Remove-Item -LiteralPath $OutSqlite -Confirm:$false }
python -I (Join-Path $PSScriptRoot 'jsonl_to_sqlite.py') $exportDir $OutSqlite
if ($LASTEXITCODE -ne 0) { throw 'Fallo la conversion a SQLite.' }
Remove-Item -LiteralPath $exportDir -Recurse -Confirm:$false
"SQLite listo: $OutSqlite"
