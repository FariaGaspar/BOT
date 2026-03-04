# Correr a aplicação num servidor interno (para vários utilizadores acederem)

Quando a rede corporativa não permite túneis e o acesso direto entre PCs está bloqueado, a solução é **correr a aplicação num servidor ou PC que todos na rede consigam alcançar**.

---

## O que é preciso

- Um **Windows Server**, **PC dedicado** ou **VM** com um endereço (IP ou hostname) conhecido na rede, acessível a todos os utilizadores (ou ao IT para abrir a porta).
- **Python 3** instalado nesse servidor.
- A **pasta do projeto** (esta aplicação) copiada para o servidor.

---

## Passos no servidor

1. Copie a pasta completa do projeto (incluindo `app.py`, `requirements.txt`, `templates/`, `static/`, `planeamento.db` se quiser manter dados, etc.) para o servidor.

2. Abra **PowerShell** ou **Cmd** na pasta do projeto e execute:
   ```text
   pip install -r requirements.txt
   python app.py
   ```
   A aplicação fica a escutar em `http://0.0.0.0:5000` (todas as interfaces).

3. **Firewall no servidor:** é preciso permitir tráfego de entrada na porta **5000** (TCP). O IT pode fazer isso, ou use o script **ABRIR_PORTA_5000_FIREWALL.bat** como administrador nesse servidor.

4. Os utilizadores acedem no browser com:
   ```text
   http://<IP-ou-nome-do-servidor>:5000
   ```
   Exemplo: `http://srv-planeamento:5000` ou `http://10.0.1.20:5000`.

---

## Correr em segundo plano (opcional)

Para a aplicação continuar a correr depois de fechar a janela:

- **Windows:** pode usar **NSSM** (Non-Sucking Service Manager) ou agendar uma tarefa que execute `python app.py`.
- **Linux:** use `systemd` ou `nohup python app.py &`.

---

## Pedir ao IT

Se o servidor já existir mas a porta 5000 estiver bloqueada, peça ao IT:

- **Autorizar tráfego TCP de entrada na porta 5000** no servidor onde a aplicação corre (ou no firewall da rede para esse servidor).
- Confirmar o **hostname ou IP** que os utilizadores devem usar para aceder (ex.: `http://srv-planeamento:5000`).

Sem túneis e sem depender do PC de um utilizador, todos passam a aceder pelo mesmo endereço.
