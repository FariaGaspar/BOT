# Cria a pasta "para_github" apenas com ficheiros para subir ao GitHub (sem .db, uploads, etc.)
# Depois arraste a pasta "para_github" para github.com/FariaGaspar/BOT > Upload files

$raiz = $PSScriptRoot
$dest = Join-Path $raiz "para_github"

if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
New-Item -ItemType Directory -Path $dest | Out-Null

$excluir = @(
    'planeamento.db', '*.db', 'para_github', '.git',
    'ngrok_token.txt', 'usar_ngrok.txt', 'ngrok_desativado.txt', 'ips_bloqueados.json',
    '__pycache__', 'venv', '.venv', 'env', 'uploads', '.idea', '.vscode'
)

Get-ChildItem $raiz -File | Where-Object {
    $nome = $_.Name
    $excluir -notcontains $nome -and $nome -notmatch '\.db$' -and $_.Length -lt 25MB
} | ForEach-Object { Copy-Item $_.FullName -Destination $dest -Force }

foreach ($dir in @('templates', 'static')) {
    $srcDir = Join-Path $raiz $dir
    if (Test-Path $srcDir) {
        $destDir = Join-Path $dest $dir
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        Get-ChildItem $srcDir -Recurse -File | Where-Object { $_.Length -lt 25MB } | ForEach-Object {
            $rel = $_.FullName.Substring($srcDir.Length)
            $destFile = Join-Path $destDir $rel.TrimStart('\')
            $destSub = Split-Path $destFile -Parent
            if (!(Test-Path $destSub)) { New-Item -ItemType Directory -Path $destSub -Force | Out-Null }
            Copy-Item $_.FullName -Destination $destFile -Force
        }
    }
}

Write-Host "Pasta criada: $dest"
Write-Host "Arraste o CONTEUDO desta pasta para GitHub (Upload files)."
explorer $dest
