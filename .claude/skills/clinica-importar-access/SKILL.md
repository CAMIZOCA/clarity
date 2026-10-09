---
name: clinica-importar-access
description: Actualizar el sistema clínico con un archivo Access (.accdb) del sistema anterior de Óptica Andina — convertirlo a SQLite, ver qué pacientes y consultas nuevas trae, probar la importación sobre una copia y aplicarla. Usar cuando el usuario entregue un .accdb / "la base de Access" / "el respaldo de la óptica" y pida subir, actualizar o importar pacientes o historias.
allowed-tools: Read, Glob, Grep, Bash, PowerShell
---

# Importar una actualización desde Access (Óptica Andina)

La óptica sigue usando su sistema anterior en Access y cada cierto tiempo envía el `.accdb`
completo. El importador `php artisan import:optica-andina-sqlite` ya sabe leer sus tablas, pero
recibe SQLite, no Access. Este skill cubre el tramo que falta y el orden seguro de aplicación.

Los scripts están en `.claude/skills/clinica-importar-access/scripts/`. Todo archivo intermedio va
en `storage/app/private/legacy-import/` (ignorado por git: son datos reales de pacientes, nunca
al repositorio ni a una carpeta versionada).

## Reglas

- **Nunca `--replace`** en una actualización: reescribe pacientes y consultas ya importados y
  pisa lo corregido a mano en el sistema nuevo. Sin esa opción el importador es incremental:
  crea lo nuevo (por `legacy_id`), salta las consultas existentes y en pacientes existentes solo
  rellena campos vacíos.
- **La BD real no se toca hasta que el usuario lo confirme** después de ver el informe de la
  prueba. Antes de aplicar, respaldo.
- **La contraseña del .accdb** la da el usuario en el chat. Va solo en `$env:ACCDB_PASSWORD`
  dentro del mismo comando; no escribirla en archivos, memoria, commits ni repetirla en respuestas.
- Requiere Windows con el driver "Microsoft Access Database Engine" de 64 bits (el script avisa
  si falta) y `python`.

## Pasos

Todos los comandos son PowerShell desde la raíz del proyecto.

### 1. Convertir

```powershell
$s = ".claude\skills\clinica-importar-access\scripts"; $w = "storage\app\private\legacy-import"
New-Item -ItemType Directory -Force $w | Out-Null
$env:ACCDB_PASSWORD = '<la que dio el usuario>'
powershell -NoProfile -ExecutionPolicy Bypass -File "$s\convert_access.ps1" -Accdb "<ruta.accdb>" -OutSqlite "$w\origen.sqlite"
$env:ACCDB_PASSWORD = $null
```

Tarda ~1 minuto. Si responde "No es una contraseña válida", pedir la contraseña al usuario.
Si falta alguna de las tablas `CLIENTES`, `HISTORIAL OPTAMOLOGIA` o `MEDICOS`, el archivo no es
el del sistema anterior: detenerse y avisar.

### 2. Informe previo (solo lectura)

```powershell
python -I "$s\report.py" "$w\origen.sqlite" "database\database.sqlite"
```

Dice cuántos pacientes y consultas nuevas hay, su rango de fechas y qué códigos de médico no
tienen usuario. Si no hay nada nuevo, informar y terminar.

### 3. Importación de prueba sobre una copia

```powershell
Copy-Item database\database.sqlite "$w\antes.sqlite" -Force
Copy-Item database\database.sqlite "$w\prueba.sqlite" -Force
$env:DB_DATABASE = (Resolve-Path "$w\prueba.sqlite").Path
php artisan import:optica-andina-sqlite "$w\origen.sqlite" --no-ansi | Select-Object -Last 18
$env:DB_DATABASE = $null
python -I "$s\report.py" "$w\origen.sqlite" "$w\prueba.sqlite" "$w\antes.sqlite"
```

`DB_DATABASE` en el entorno gana sobre `.env` (no hay config cacheada en local), así que el
importador escribe en la copia. Limpiar la variable siempre, o el siguiente `artisan` de la
sesión seguirá apuntando a la copia.

Revisar en la salida:

- **Errores = 0** en la tabla del importador.
- **Medidas fuera de rango = 0.** Si no, el archivo nuevo escribe las dioptrías de otra forma y
  hay que revisar `App\Support\LegacyOpticalParser` antes de seguir (gotcha 14 de `CLAUDE.md`).
- **Sin médico** y **placeholders**: no bloquean, pero se informan (ver "Casos conocidos").

### 4. Informar y pedir confirmación

Resumir al usuario: nuevos pacientes, nuevas consultas, rango de fechas, errores, consultas sin
médico, placeholders. Preguntar si se aplica en la BD real. No aplicar sin un sí explícito.

### 5. Aplicar en local

```powershell
Copy-Item database\database.sqlite ("database\database.before_optica_andina_import.{0}.sqlite" -f (Get-Date -Format 'yyyyMMdd_HHmmss'))
php artisan import:optica-andina-sqlite "$w\origen.sqlite" --no-ansi | Select-Object -Last 18
python -I "$s\report.py" "$w\origen.sqlite" "database\database.sqlite" "$w\antes.sqlite"
```

El importador no dispara Contifico ni eventos de modelo (`Model::withoutEvents`) y al final
recalcula los números de consulta y las métricas CRM de los pacientes.

### 6. Producción

Producción es MariaDB en Coolify; ahí no hay driver de Access, así que lo que viaja es
`origen.sqlite`. Hay dos caminos y ambos requieren confirmación explícita del usuario:

- Consola del contenedor: subir `origen.sqlite` y correr el mismo comando del paso 5 (respaldo
  de la BD antes).
- Pantalla de mantenimiento (`LegacyImportService`): **leer el servicio antes de usarla**. Su
  opción de reescritura pasa `--replace --reset-placeholder-import --prune-placeholders`, que es
  justo lo que una actualización no debe hacer.

### 7. Limpiar

```powershell
Remove-Item "$w\antes.sqlite", "$w\prueba.sqlite" -Confirm:$false
```

Conservar `origen.sqlite` solo si falta aplicar en producción; después borrarlo también.

## Casos conocidos

- **Código de médico `0500`**: aparece en ~1/3 de las consultas y no existe en `MEDICOS` ni en
  `users.codigo`, así que esas consultas quedan con `optometrista_id` nulo. Pasa también con las
  ya importadas. Solo se resuelve si la óptica dice a quién corresponde.
- **Médicos**: el código de Access se empareja con `users.codigo` ignorando ceros a la izquierda
  ("3" = "003") y nunca por id. En una actualización (ya hay consultas con `legacy_id`) los
  médicos de `MEDICOS` que no tienen usuario **no se crean**: el importador los lista al final
  junto con las consultas que quedaron sin médico. Para crearlos a propósito, `--only=users`.
  Antes de este arreglo (2026-10-09) el código 3 caía en el usuario de id 3 y se recreaban
  usuarios borrados; lo cubre `tests/Feature/ImportOpticaAndinaDoctorsTest.php`.
- **Placeholders**: una historia cuya cédula no está en `CLIENTES` crea un paciente
  "Paciente importado <cédula>" con `legacy_id` `HIST-PAT-<id>`. Lo normal son 0–2 por carga.
- **La reparación legacy** (`consultations:repair-legacy-import`) sigue sin aplicarse en ninguna
  instancia. No interfiere: las consultas nuevas entran ya corregidas por `LegacyOpticalParser` y
  la reparación solo divide enteros de 25 o más.
- **`php artisan tinker --execute`** desde PowerShell pierde las comillas dobles del código PHP.
  Para consultas sueltas usar `python -I` con `sqlite3`, o PHP solo con comillas simples.
- Access tiene ~127 tablas (facturas, procedimientos, catálogos). Solo se importan las tres de
  arriba; el resto no tiene destino en el sistema nuevo.
