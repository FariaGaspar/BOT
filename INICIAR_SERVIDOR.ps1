# Script PowerShell para iniciar o servidor Flask
# Este script configura o Python e inicia o servidor

Write-Host "========================================" -ForegroundColor Green
Write-Host "SERVIDOR FLASK - PLANEAMENTO DE CARGAS" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Configurar Python no PATH
$pythonPath = "C:\Users\joao.gaspar\python38"
$pythonScriptsPath = "C:\Users\joao.gaspar\python38\Scripts"
$env:Path += ";$pythonPath;$pythonScriptsPath"

# Mudar para o diretório do projeto
Set-Location $PSScriptRoot

Write-Host "Verificando Python..." -ForegroundColor Cyan
python --version
Write-Host ""

Write-Host "Iniciando servidor..." -ForegroundColor Cyan
Write-Host "O servidor estará disponível em: http://localhost:5000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Para parar o servidor, pressione: Ctrl+C" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Iniciar o servidor Flask
python app.py
