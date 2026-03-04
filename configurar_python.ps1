# Script para configurar Python no PATH (para esta sessão)
# Execute este script antes de usar python ou pip diretamente

$pythonPath = "C:\Users\joao.gaspar\python38"
$pythonScriptsPath = "C:\Users\joao.gaspar\python38\Scripts"

# Adicionar ao PATH da sessão atual
$env:Path += ";$pythonPath;$pythonScriptsPath"

Write-Host "Python configurado para esta sessão!" -ForegroundColor Green
Write-Host "Python: $pythonPath\python.exe" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para usar Python permanentemente, adicione ao PATH do sistema:" -ForegroundColor Yellow
Write-Host "  $pythonPath" -ForegroundColor White
Write-Host "  $pythonScriptsPath" -ForegroundColor White
Write-Host ""
Write-Host "Testando Python..." -ForegroundColor Cyan
python --version
pip --version
