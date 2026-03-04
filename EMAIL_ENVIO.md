# Envio do resumo por email

O botão **"Resumo por email"** envia o resumo do dia seguinte para **joao.gaspar@pragosa.pt**. A forma mais simples é usar **Resend**.

---

## Opção 1: Resend (recomendado – funciona sempre)

1. Abre **https://resend.com** e cria uma conta (email + password). Plano gratuito: 3000 emails/mês.
2. No dashboard: **API Keys** → **Create API Key** → copia a chave (começa por `re_`).
3. No ficheiro **`.env`** (na pasta do projeto) coloca:
   ```
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxx
   EMAIL_RESUMO_DESTINO=joao.gaspar@pragosa.pt
   ```
4. Reinicia a aplicação. O resumo passa a ser enviado para joao.gaspar@pragosa.pt.

Não é preciso configurar SMTP, Office 365 nem Gmail.

---

## Opção 2: Gmail

1. Usa uma conta Gmail (pode ser pessoal).
2. Ativa a verificação em 2 passos: https://myaccount.google.com/security
3. Cria uma **palavra-passe de aplicação**: https://myaccount.google.com/apppasswords
4. No ficheiro **`.env`** (na pasta do projeto) coloca:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=teu.email@gmail.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx
EMAIL_RESUMO_DESTINO=joao.gaspar@pragosa.pt
```

5. Reinicia a aplicação. O resumo passará a ser enviado por Gmail para joao.gaspar@pragosa.pt.

---

## Opção 2: Microsoft Graph (Office 365 com SMTP desativado)

Quando o Office 365 tem a mensagem *"SmtpClientAuthentication is disabled for the Tenant"*, o envio por SMTP não funciona. Nesse caso pode usar a **Microsoft Graph API** (um administrador do Microsoft 365 tem de criar a app).

### Passos para o administrador

1. Entrar em **portal.azure.com** → **Azure Active Directory** → **Registos de aplicações** → **Novo registo**.
2. Nome da aplicação, por exemplo: `Pragosa Resumo Email`. Contas: "Contas apenas neste diretório organizacional".
3. Registar. Anotar:
   - **Application (client) ID** → será `GRAPH_CLIENT_ID`
   - **Directory (tenant) ID** → será `GRAPH_TENANT_ID`
4. Em **Certificados e segredos** → **Novo segredo de cliente** → criar e copiar o valor → será `GRAPH_CLIENT_SECRET`.
5. Em **Permissões de API** → **Adicionar uma permissão** → **Microsoft Graph** → **Permissões de aplicação** → procurar **Mail.Send** → adicionar.
6. Clicar em **Conceder consentimento de administrador** para a aplicação (para a organização).
7. No `.env` do projeto (no servidor onde corre a app), o administrador ou o utilizador coloca:

```env
GRAPH_TENANT_ID=<Directory (tenant) ID>
GRAPH_CLIENT_ID=<Application (client) ID>
GRAPH_CLIENT_SECRET=<valor do segredo>
GRAPH_SEND_AS=joao.gaspar@pragosa.pt
EMAIL_RESUMO_DESTINO=joao.gaspar@pragosa.pt
```

8. Reiniciar a aplicação. O envio passa a ser feito pela Graph API (não usa SMTP).

---

## Opção 3: Office 365 SMTP (se o admin ativar SMTP AUTH)

O administrador pode ativar **SMTP AUTH** no tenant: https://aka.ms/smtp_auth_disabled  

Depois disso, o `.env` com `SMTP_HOST=smtp.office365.com`, `SMTP_USER` e `SMTP_PASSWORD` (password da conta) funciona normalmente.

---

**Resumo:** Para não depender de ninguém, use a **Opção 1 (Gmail)**. Se quiser enviar a partir do email da empresa (joao.gaspar@pragosa.pt) sem ativar SMTP, use a **Opção 2 (Graph)** com uma app criada pelo administrador.
