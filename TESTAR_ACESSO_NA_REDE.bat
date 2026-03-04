@echo off
title Testar se consigo aceder ao servidor
setlocal
echo.
echo ============================================
echo  TESTE DE ACESSO (executar no PC da COLEGA)
echo ============================================
echo.
set /p SERVER_IP="Introduza o IP do PC onde corre a aplicacao (ex.: 192.168.1.50): "
if "%SERVER_IP%"=="" (
  echo Nenhum IP introduzido.
  pause
  exit /b 1
)
echo.
echo A testar ligacao a %SERVER_IP% porta 8080...
echo.

powershell -NoProfile -Command "$r = Test-NetConnection -ComputerName '%SERVER_IP%' -Port 8080 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue; if ($r.TcpTestSucceeded) { Write-Host 'OK: Consegue ligar. Abra no browser: http://%SERVER_IP%:8080' -ForegroundColor Green } else { Write-Host 'FALHOU: A rede esta a bloquear.' -ForegroundColor Red }"

echo.
pause
