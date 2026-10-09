"""Informe de una actualizacion desde Access. Solo lee.

Uso: python -I report.py <origen.sqlite> <bd_sistema.sqlite> [bd_antes.sqlite]

- Sin el tercer argumento: que hay de nuevo en el origen respecto a la BD.
- Con el tercer argumento (copia de la BD tomada antes de importar): ademas
  revisa las consultas que la importacion creo en <bd_sistema.sqlite>.
"""
import sqlite3
import sys
from pathlib import Path

IMPORTER = 'app/Console/Commands/ImportOpticaAndinaSqlite.php'
DIOPTER_COLUMNS = [
    'rx_final_esfera_od', 'rx_final_esfera_oi', 'rx_final_cilindro_od', 'rx_final_cilindro_oi',
    'rx_final_add_od', 'rx_final_add_oi', 'subj_esfera_od', 'subj_esfera_oi',
    'subj_cilindro_od', 'subj_cilindro_oi', 'vc_esfera_od', 'vc_esfera_oi',
    'rx_uso_esfera_od', 'rx_uso_esfera_oi', 'rx_uso_add_od', 'rx_uso_add_oi',
]
AXIS_COLUMNS = ['rx_final_eje_od', 'rx_final_eje_oi', 'subj_eje_od', 'subj_eje_oi', 'rx_uso_eje_od', 'rx_uso_eje_oi']


def ro(path):
    return sqlite3.connect(Path(path).resolve().as_uri() + '?mode=ro', uri=True)


def column(db, sql):
    return {str(r[0]) for r in db.execute(sql) if r[0] is not None}


src = ro(sys.argv[1])
local = ro(sys.argv[2])
before = ro(sys.argv[3]) if len(sys.argv) > 3 else None
base = before or local

src_patients = column(src, 'select "Id" from "CLIENTES"')
src_consults = column(src, 'select "Id" from "HISTORIAL OPTAMOLOGIA"')
had_patients = column(base, 'select legacy_id from patients')
had_consults = column(base, 'select legacy_id from consultations')
new_patients = src_patients - had_patients
new_consults = src_consults - had_consults

print('== Origen (Access) frente al sistema ==')
print(f'Pacientes : {len(src_patients)} en Access, {len(new_patients)} nuevos')
print(f'Consultas : {len(src_consults)} en Access, {len(new_consults)} nuevas')
print(f'Consultas del sistema que ya no estan en Access: {len({c for c in had_consults if c.isdigit()} - src_consults)}')

if new_consults:
    src.execute('create temp table nuevas (id text primary key)')
    src.executemany('insert into nuevas values (?)', [(i,) for i in new_consults])
    lo, hi = src.execute('select min("FECHA"), max("FECHA") from "HISTORIAL OPTAMOLOGIA" '
                         'where "Id" in (select id from nuevas)').fetchone()
    print(f'Fechas de las consultas nuevas: {lo} a {hi}')

    # Mismo criterio que el importador: sin ceros a la izquierda ("3" = "003").
    codes = {c.upper().lstrip('0') or '0' for c in column(base, 'select codigo from users')}
    print('Medico responsable en las consultas nuevas:')
    for code, n in src.execute('select "MEDICO_RESPONSABLE", count(*) from "HISTORIAL OPTAMOLOGIA" '
                               'where "Id" in (select id from nuevas) group by 1 order by 2 desc'):
        note = '' if code is not None and (str(code).strip().upper().lstrip('0') or '0') in codes else '  <-- sin usuario con ese codigo: quedan sin medico'
        print(f'  [{code}] {n}{note}')

if before is not None:
    print()
    print('== Consultas creadas por la importacion ==')
    local.execute('create temp table previas (id text primary key)')
    local.executemany('insert into previas values (?)', [(i,) for i in had_consults])
    created = 'legacy_id is not null and legacy_id not in (select id from previas)'
    total = local.execute(f'select count(*) from consultations where {created}').fetchone()[0]
    no_doctor = local.execute(f'select count(*) from consultations where {created} and optometrista_id is null').fetchone()[0]
    print(f'Creadas: {total} | sin medico: {no_doctor}')
    print('Pacientes creados (incluye placeholders):',local.execute('select count(*) from patients').fetchone()[0]
          - before.execute('select count(*) from patients').fetchone()[0])
    print('Placeholders creados:', local.execute(
        "select count(*) from patients where legacy_id like 'HIST-PAT-%'").fetchone()[0]
        - before.execute("select count(*) from patients where legacy_id like 'HIST-PAT-%'").fetchone()[0])

    bad = 0
    for col in DIOPTER_COLUMNS:
        n, lo, hi, out = local.execute(
            f'select count({col}), min({col}), max({col}), sum(abs({col}) > 30) from consultations where {created}').fetchone()
        bad += out or 0
        if n:
            print(f'  {col:<22} n={n:<4} min={lo} max={hi}' + (f'  <-- {out} fuera de +-30' if out else ''))
    for col in AXIS_COLUMNS:
        out = local.execute(f'select count(*) from consultations where {created} and {col} > 180').fetchone()[0]
        bad += out
        if out:
            print(f'  {col}: {out} ejes mayores a 180')
    print('Medidas fuera de rango:', bad, '(0 = el parser legacy sigue leyendo bien)' if bad == 0 else f'<-- revisar {IMPORTER}')
