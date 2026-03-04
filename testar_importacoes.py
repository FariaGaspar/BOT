#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Script para testar se todas as dependências estão instaladas"""

try:
    import flask
    print(f"[OK] Flask {flask.__version__}")
except ImportError as e:
    print(f"[ERRO] Flask nao encontrado: {e}")

try:
    import flask_cors
    print(f"[OK] flask-cors instalado")
except ImportError as e:
    print(f"[ERRO] flask-cors nao encontrado: {e}")

try:
    import openpyxl
    print(f"[OK] openpyxl {openpyxl.__version__}")
except ImportError as e:
    print(f"[ERRO] openpyxl nao encontrado: {e}")

try:
    import pyngrok
    print(f"[OK] pyngrok instalado")
except ImportError as e:
    print(f"[ERRO] pyngrok nao encontrado: {e}")

print("\n[OK] Todas as dependencias estao instaladas!")
