# Abre a porta 5000 na Firewall do Windows para outros PCs na rede acederem à aplicação.
# É preciso executar UMA VEZ como Administrador (clique direito -> "Executar como administrador").
# Depois disso, a tua colega pode aceder com: http://<TEU-IP>:5000

$ruleName = "Planeamento Cargas - Porta 5000"
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "A regra '$ruleName' ja existe. Nada a alterar." -ForegroundColor Green
    exit 0
}

try {
    New-NetFirewallRule -DisplayName $ruleName `
        -Direction Inbound `
        -LocalPort 5000 `
        -Protocol TCP `
        -Action Allow `
        -Profile Any `
        -ErrorAction Stop
    Write-Host "OK. Porta 5000 aberta na Firewall (todos os perfis)." -ForegroundColor Green
    Write-Host "Outros PCs na mesma rede ja podem aceder a:  http://<IP-deste-PC>:5000" -ForegroundColor Cyan
} catch {
    Write-Host "Erro (precisa de executar como Administrador): $_" -ForegroundColor Red
    exit 1
}
