@echo off
chcp 65001 >nul
echo ========================================
echo  Subir projeto para GitHub (FariaGaspar/BOT)
echo ========================================
cd /d "%~dp0"

where git >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Git nao encontrado. Instale em https://git-scm.com e tente novamente.
    pause
    exit /b 1
)

if not exist .git (
    echo Inicializar repositorio...
    git init
    git branch -M main
)

echo Adicionar remote...
git remote remove origin 2>nul
git remote add origin git@github.com:FariaGaspar/BOT.git

echo Adicionar ficheiros...
git add .

echo Commit...
git commit -m "Projeto Planeamento de Cargas - deploy Render" 2>nul || git commit -m "Atualizacao"

echo Push para GitHub...
git push -u origin main

if errorlevel 1 (
    echo.
    echo Se der erro de permissoes, use HTTPS em vez de SSH:
    echo   git remote set-url origin https://github.com/FariaGaspar/BOT.git
    echo   git push -u origin main
    echo.
)
pause
