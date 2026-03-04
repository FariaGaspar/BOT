@echo off
title Abrir porta 8080 na Firewall
echo.
echo Para outros PCs na rede acederem a aplicacao, e preciso abrir a porta 8080 na Firewall.
echo Execute UMA VEZ como Administrador (clique direito - Executar como administrador).
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ABRIR_PORTA_8080_FIREWALL.ps1"
echo.
pause
