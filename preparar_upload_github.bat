@echo off
chcp 65001 >nul
cd /d "%~dp0"

set "DEST=para_github"
if exist "%DEST%" rmdir /s /q "%DEST%"
mkdir "%DEST%"
mkdir "%DEST%\templates"
mkdir "%DEST%\static"

echo Copiando ficheiros para %DEST%\ (sem .db, uploads, venv - nada com +25MB)...

copy app.py "%DEST%\" >nul
copy requirements.txt "%DEST%\" >nul
copy Procfile "%DEST%\" >nul
copy render.yaml "%DEST%\" >nul
copy runtime.txt "%DEST%\" >nul 2>nul
copy .gitignore "%DEST%\" >nul
copy DEPLOY_RENDER.md "%DEST%\" >nul
copy push_to_github.bat "%DEST%\" >nul
if exist "ngrok_token.txt.example" copy "ngrok_token.txt.example" "%DEST%\" >nul
if exist "ngrok_config.yml" copy "ngrok_config.yml" "%DEST%\" >nul

xcopy "templates\*.*" "%DEST%\templates\" /I /Y >nul 2>nul
xcopy "static\*.*" "%DEST%\static\" /I /Y >nul 2>nul
copy "templates\*.html" "%DEST%\templates\" >nul 2>nul
copy "static\*.js" "%DEST%\static\" >nul 2>nul
copy "static\*.css" "%DEST%\static\" >nul 2>nul

echo.
echo Conteudo em templates:
dir /b "%DEST%\templates"
echo.
echo Conteudo em static:
dir /b "%DEST%\static"
echo.
echo Concluido: %CD%\%DEST%
echo.
echo COMO SUBIR NO GITHUB (tudo fica abaixo de 25MB):
echo   1. Abra github.com/FariaGaspar/BOT
echo   2. Add file - Upload files
echo   3. Arraste a PASTA "para_github" para a janela (ou arraste o conteudo: app.py, Procfile, requirements.txt, render.yaml, .gitignore, DEPLOY_RENDER.md, e as pastas templates e static)
echo   4. Se arrastou a pasta "para_github" inteira: no Render, em Settings do Web Service, defina "Root Directory" = para_github
echo.
pause
