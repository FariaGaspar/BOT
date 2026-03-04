# Abre a porta 8080 na Firewall do Windows para outros PCs na rede acederem à aplicação.
# Executar UMA VEZ como Administrador (clique direito -> "Executar como administrador").
# Depois a colega acede com: http://<IP-deste-PC>:8080

$ruleName = "Planeamento Cargas - Porta 8080"
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "A regra '$ruleName' ja existe. Nada a alterar." -ForegroundColor Green
    exit 0
}

try {
    New-NetFirewallRule -DisplayName $ruleName `
        -Direction Inbound `
        -LocalPort 8080 `
        -Protocol TCP `
        -Action Allow `
        -Profile Any `
        -ErrorAction Stop
    Write-Host "OK. Porta 8080 aberta na Firewall (todos os perfis)." -ForegroundColor Green
    Write-Host "Outros PCs na mesma rede ja podem aceder a:  http://<IP-deste-PC>:8080" -ForegroundColor Cyan
} catch {
    Write-Host "Erro (precisa de executar como Administrador): $_" -ForegroundColor Red
    exit 1
}
