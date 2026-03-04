@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0criar_pasta_para_github.ps1"
pause
