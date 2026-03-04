# Colocar a app online gratuitamente (Render)

Repositório: **github.com/FariaGaspar/BOT**

---

## 1. Subir o código para o GitHub

1. Na pasta do projeto (`web_app_old_2`), faça **duplo clique** em **`push_to_github.bat`**.
2. Confirme com **s** quando perguntar se quer fazer commit e push.
3. Se pedir login do GitHub, use o seu utilizador e palavra-passe (ou token). Se usar SSH e der erro, o script indica como trocar para HTTPS.

---

## 2. Ligar o Render ao repositório

1. Entre em **https://dashboard.render.com**.
2. Clique em **New +** → **Web Service**.
3. Se pedir, ligue a conta **GitHub** e autorize o Render.
4. Na lista de repositórios, escolha **FariaGaspar/BOT**.
5. Configure:
   - **Name:** `planeamento-cargas` (ou outro nome).
   - **Branch:** `main`.
   - **Root Directory:** se tiver subido uma pasta `para_github`, ponha aqui **para_github**. Senão deixe em branco.
   - **Runtime:** **Python 3**.
   - **Build Command:** `pip install -r requirements.txt` (ou em branco; o Procfile serve.)
   - **Start Command:** `gunicorn app:app --bind 0.0.0.0:$PORT` (ou em branco.)
6. Em **Instance Type** escolha **Free**.
7. Clique em **Create Web Service**.

O Render vai fazer o build e arrancar a app. No fim verá um URL tipo:

**https://planeamento-cargas-xxxx.onrender.com**

---

## 3. Avisos (plano gratuito)

- A app **adormece** após ~15 min sem visitas; o primeiro acesso pode demorar 30–60 s.
- A base de dados (SQLite) e a pasta **uploads/** são **efémeras**: podem ser apagadas em cada novo deploy. Para dados permanentes, mais tarde pode usar PostgreSQL no Render.

Depois de fazer o push e ligar o Web Service, a app fica online nesse URL.
