@echo off
title Servidor Flask - Planeamento de Cargas
color 0A
echo ========================================
echo SERVIDOR FLASK - PLANEAMENTO DE CARGAS
echo ========================================
echo.
echo Iniciando servidor...
echo.
echo O servidor estara disponivel em: http://localhost:5000
echo.
echo Para parar o servidor, pressione: Ctrl+C
echo ========================================
echo.

cd /d "%~dp0"

@echo off
title Servidor Flask - Planeamento de Cargas
color 0A
echo ========================================
echo SERVIDOR FLASK - PLANEAMENTO DE CARGAS
echo ========================================
echo.
echo Verificando Python...
"C:\Users\joao.gaspar\python38\python.exe" --version
echo.
echo Iniciando servidor...
echo O servidor estara disponivel em: http://localhost:5000
echo.
echo Para parar o servidor, pressione: Ctrl+C
echo ========================================
echo.

cd /d "%~dp0"

"C:\Users\joao.gaspar\python38\python.exe" app.py

pause

pause
