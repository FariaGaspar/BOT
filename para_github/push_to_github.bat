@echo off
chcp 65001 >nul
cd /d "%~dp0"

set "GIT_CMD="
where git >nul 2>&1
if not errorlevel 1 set "GIT_CMD=git"
if not defined GIT_CMD if exist "C:\Program Files\Git\bin\git.exe" set "GIT_CMD=C:\Program Files\Git\bin\git.exe"
if not defined GIT_CMD if exist "C:\Program Files (x86)\Git\bin\git.exe" set "GIT_CMD=C:\Program Files (x86)\Git\bin\git.exe"
if not defined GIT_CMD if exist "%LOCALAPPDATA%\Programs\Git\bin\git.exe" set "GIT_CMD=%LOCALAPPDATA%\Programs\Git\bin\git.exe"

echo.
echo === Subir projeto para GitHub (FariaGaspar/BOT) ===
echo.

if not defined GIT_CMD (
    echo [ERRO] Git nao encontrado.
    echo.
    echo Instale o Git e tente novamente:
    echo   1. Abra https://git-scm.com/download/win
    echo   2. Descarregue e instale (deixe as opcoes por defeito^)
    echo   3. Feche e reabra esta janela, ou reinicie o PC
    echo   4. Execute novamente push_to_github.bat
    echo.
    pause
    exit /b 1
)

if not exist .git (
    echo Inicializando repositorio Git...
    "%GIT_CMD%" init
)

"%GIT_CMD%" add .
"%GIT_CMD%" status
echo.
set /p OK="Fazer commit e push? (s/n): "
if /i not "%OK%"=="s" exit /b 0

"%GIT_CMD%" commit -m "Projeto Planeamento de Cargas - deploy Render" 2>nul
if errorlevel 1 (
    echo Nada para commit ou erro. A continuar para push...
) else (
    echo Commit feito.
)

"%GIT_CMD%" branch -M main 2>nul
"%GIT_CMD%" remote remove origin 2>nul
"%GIT_CMD%" remote add origin git@github.com:FariaGaspar/BOT.git

echo.
echo A enviar para GitHub...
"%GIT_CMD%" push -u origin main
if errorlevel 1 (
    echo.
    echo Se der erro de permissoes, use HTTPS em vez de SSH:
    echo   "%GIT_CMD%" remote set-url origin https://github.com/FariaGaspar/BOT.git
    echo   "%GIT_CMD%" push -u origin main
    echo.
)
pause
