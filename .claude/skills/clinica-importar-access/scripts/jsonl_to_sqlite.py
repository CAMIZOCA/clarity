"""Arma el SQLite del importador a partir de los JSONL de convert_access.ps1.

Uso: python -I jsonl_to_sqlite.py <carpeta_export> <salida.sqlite>
Todas las columnas van como TEXT: el importador las lee como texto.
"""
import json
import sqlite3
import sys

export_dir, out_path = sys.argv[1], sys.argv[2]
tables = {
    'CLIENTES': 'clientes.jsonl',
    'HISTORIAL OPTAMOLOGIA': 'historial.jsonl',
    'MEDICOS': 'medicos.jsonl',
}


def qi(name):
    return '"' + name.replace('"', '""') + '"'


db = sqlite3.connect(out_path)
for table, filename in tables.items():
    with open(f'{export_dir}/{filename}', encoding='utf-8') as fh:
        columns = json.loads(fh.readline())
        db.execute(f'create table {qi(table)} (' + ', '.join(f'{qi(c)} TEXT' for c in columns) + ')')
        insert = f'insert into {qi(table)} values (' + ', '.join('?' * len(columns)) + ')'
        db.executemany(insert, (json.loads(line) for line in fh if line.strip()))
db.commit()
db.close()
