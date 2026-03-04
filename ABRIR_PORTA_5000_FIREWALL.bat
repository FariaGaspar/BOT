@echo off
title Abrir porta 5000 na Firewall
echo.
echo Para outros PCs na rede acederem a aplicacao, e preciso abrir a porta 5000 na Firewall.
echo Este script deve ser executado UMA VEZ como Administrador.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ABRIR_PORTA_5000_FIREWALL.ps1"
echo.
pause
