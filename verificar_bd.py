#!/usr/bin/env python
# -*- coding: utf-8 -*-
import sqlite3
import os

db_path = 'planeamento.db'
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    
    print(f"Base de dados: {db_path}")
    print(f"Tabelas encontradas: {len(tables)}")
    print("\nLista de tabelas:")
    for table in tables:
        table_name = table[0]
        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
        count = cursor.fetchone()[0]
        print(f"  - {table_name}: {count} registos")
    
    conn.close()
else:
    print(f"Base de dados nao encontrada: {db_path}")
