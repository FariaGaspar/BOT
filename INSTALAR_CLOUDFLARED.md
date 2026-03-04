# Instalar cloudflared (túnel para acesso remoto)

Se aparecer **"versão 16-bit não suportada"**, está a usar o executável errado para o seu Windows.

## Windows 64-bit (a maioria dos PCs atuais)

1. Abra: **https://github.com/cloudflare/cloudflared/releases/latest**
2. Na secção **Assets**, descarregue:
   - **`cloudflared-windows-amd64.exe`** (não use 386 nem arm)
3. Renomeie o ficheiro para **`cloudflared.exe`**
4. Coloque **`cloudflared.exe`** nesta pasta (a pasta do projeto, onde está o `app.py`)
5. Reinicie o servidor da aplicação

## Windows 32-bit

Descarregue **`cloudflared-windows-386.exe`** e renomeie para `cloudflared.exe`.

## Verificar se é 64-bit

- Prima **Win + Pausa** ou vá a Definições > Sistema > Acerca de
- Em "Tipo de sistema" deve dizer "sistema operativo de 64 bits" ou "x64"

## Link direto (última versão, 64-bit Windows)

Na página de releases, o ficheiro correto tem o nome **cloudflared-windows-amd64.exe**.  
Exemplo (versão pode mudar):  
`https://github.com/cloudflare/cloudflared/releases/download/2024.x.x/cloudflared-windows-amd64.exe`

Verifique sempre em https://github.com/cloudflare/cloudflared/releases/latest qual é o ficheiro **amd64** da versão mais recente.
