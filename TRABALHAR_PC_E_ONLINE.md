# Trabalhar no PC e online com os mesmos dados

Com **PostgreSQL na nuvem**, o programa usa a mesma base de dados no teu PC e no site (Render). Assim, tudo o que guardas num sítio fica disponível no outro.

---

## 1. Criar a base de dados PostgreSQL no Render (grátis)

1. Entra em **https://dashboard.render.com**.
2. Clica em **New +** → **PostgreSQL**.
3. Dá um nome (ex.: `planeamento-db`), escolhe **Free** e a mesma região do teu Web Service.
4. Clica em **Create Database**.
5. Quando estiver criado, abre o serviço e copia a **Internal Database URL** (ou **External Database URL** se vais ligar de fora do Render).

---

## 2. Ligar o site (Render) à base de dados

1. No Render, abre o teu **Web Service** (a app).
2. Vai a **Environment** (menu lateral).
3. Clica em **Add Environment Variable**.
4. **Key:** `DATABASE_URL`  
   **Value:** cola a **Internal Database URL** que copiaste no passo 1.
5. Guarda. O Render faz redeploy automático.

O site passa a usar essa base de dados; os dados ficam guardados e não se perdem em novos deploys.

---

## 3. Ligar o teu PC à mesma base de dados

Assim, quando corres a app no teu PC, ela usa a mesma BD que o site.

### Opção A – Ficheiro `.env` (recomendado)

1. Na pasta do projeto (`web_app_old_2`), cria um ficheiro chamado **`.env`** (só o nome, sem extensão).
2. Dentro do ficheiro escreve uma linha (substitui pelo teu URL):

   ```
   DATABASE_URL=postgresql://utilizador:password@host:porta/nome_bd
   ```

   Usa a **External Database URL** que está no Render (no mesmo sítio onde viste a Internal). Se vier com `postgres://`, podes deixar; o programa aceita.

3. No arranque da app, tens de carregar esta variável. No Windows, podes:
   - Abrir **PowerShell** na pasta do projeto e correr:
     ```powershell
     $env:DATABASE_URL = "postgresql://..."; python app.py
     ```
   - Ou instalar `python-dotenv` e carregar o `.env` no início do `app.py`.

### Opção B – Carregar `.env` automaticamente no app

Se quiseres que o programa leia o `.env` sozinho quando corres no PC:

1. Instala: `pip install python-dotenv`
2. No **app.py**, nas primeiras linhas (antes de usar `os.environ`), adiciona:

   ```python
   from dotenv import load_dotenv
   load_dotenv()
   ```

3. Coloca o `.env` na pasta do projeto com a linha `DATABASE_URL=...` como acima.

Assim, no PC a app usa a BD do Render; no Render usa a mesma BD. **Um único sítio onde tudo fica guardado.**

---

## 4. Resumo

| Onde      | O que faz |
|----------|-----------|
| **Render** | Cria PostgreSQL (free) e define `DATABASE_URL` no Web Service. O site usa essa BD. |
| **PC**     | Define `DATABASE_URL` (no `.env` ou na variável de ambiente) com a **External** URL. Quando corres a app no PC, ela liga à mesma BD. |

**Nota:** O ficheiro `.env` não deve ser subido para o GitHub (tem a password da BD). Adiciona `.env` ao `.gitignore` se ainda não estiver.
