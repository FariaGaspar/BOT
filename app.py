"""
Servidor Web para Sistema de Planeamento de Cargas
Migrado do Excel/VBA para Flask
"""
from flask import Flask, render_template, request, jsonify, send_from_directory, send_file, make_response
from flask_cors import CORS
import sqlite3
import os
from datetime import datetime, date
import json
import csv
import io
from io import BytesIO

# Caminhos absolutos para templates e static (Render + local). Se estiver em para_github, também procura na raiz.
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_TEMPLATES_DIR = os.path.join(_BASE_DIR, 'templates')
_STATIC_DIR = os.path.join(_BASE_DIR, 'static')
# Fallback: procurar templates em vários sítios (GitHub/Render pode ter raiz ou para_github)
def _find_templates_static():
    global _TEMPLATES_DIR, _STATIC_DIR
    for try_dir, try_name in [
        ((_BASE_DIR, 'para_github', 'templates'), (_BASE_DIR, 'para_github', 'static')),
        ((_BASE_DIR, '..', 'templates'), (_BASE_DIR, '..', 'static')),
    ]:
        t = os.path.abspath(os.path.join(*try_dir))
        s = os.path.abspath(os.path.join(*try_name))
        if os.path.isdir(t) and os.path.isfile(os.path.join(t, 'login.html')):
            _TEMPLATES_DIR = t
            if os.path.isdir(s):
                _STATIC_DIR = s
            return
if not os.path.isdir(_TEMPLATES_DIR) or not os.path.isfile(os.path.join(_TEMPLATES_DIR, 'login.html')):
    _find_templates_static()
app = Flask(__name__,
    template_folder=_TEMPLATES_DIR,
    static_folder=_STATIC_DIR,
    static_url_path='/static')
CORS(app)
# Quando atrás de túnel (Cloudflare/ngrok), usar X-Forwarded-* para URLs e redirects corretos
try:
    from werkzeug.middleware.proxy_fix import ProxyFix
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
except ImportError:
    pass

# URL pública do túnel (ngrok/Cloudflare) — atualizada no arranque e na thread do Cloudflare
app.config['URL_PUBLICA'] = None
# IP Tailscale (para contornar rede corporativa) — definido no arranque
app.config['TAILSCALE_IP'] = None

# ========== SERVER SECRET (muda a cada reinício do servidor) ==========
import secrets
import sys
import io
import os

# Configurar encoding UTF-8 para stdout no Windows (evita erro com emojis)
if sys.platform == 'win32':
    try:
        # Python 3.7+
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except (AttributeError, ValueError):
        # Fallback para versões antigas do Python
        try:
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        except:
            pass
    # Também configurar variável de ambiente
    os.environ['PYTHONIOENCODING'] = 'utf-8'

SERVER_SECRET = secrets.token_hex(32)  # Secret único que muda a cada reinício
print(f"Server Secret gerado: {SERVER_SECRET[:16]}... (muda a cada reinicio)")

# ========== SISTEMA DE MONITORIZAÇÃO DE UTILIZADORES ==========
import threading
from datetime import datetime, timedelta
import uuid

# Armazenar sessões ativas (em memória)
sessoes_ativas = {}
sessoes_bloqueadas = set()  # IDs de sessão bloqueados
sessoes_bloqueadas_info = {}  # Informação sobre sessões bloqueadas (IP, data, etc)
ips_bloqueados = set()  # IPs bloqueados diretamente (para casos antigos)
lock_sessoes = threading.Lock()

# Ficheiro para persistir IPs bloqueados
IPS_BLOQUEADOS_FILE = 'ips_bloqueados.json'

def carregar_ips_bloqueados():
    """Carregar IPs bloqueados do ficheiro JSON"""
    global ips_bloqueados
    try:
        if os.path.exists(IPS_BLOQUEADOS_FILE):
            with open(IPS_BLOQUEADOS_FILE, 'r', encoding='utf-8') as f:
                dados = json.load(f)
                ips_bloqueados = set(dados.get('ips', []))
                print(f"✅ Carregados {len(ips_bloqueados)} IPs bloqueados do ficheiro")
        else:
            ips_bloqueados = set()
            print("ℹ️ Nenhum ficheiro de IPs bloqueados encontrado. Iniciando com lista vazia.")
    except Exception as e:
        print(f"⚠️ Erro ao carregar IPs bloqueados: {e}")
        ips_bloqueados = set()

def guardar_ips_bloqueados():
    """Guardar IPs bloqueados no ficheiro JSON"""
    try:
        with open(IPS_BLOQUEADOS_FILE, 'w', encoding='utf-8') as f:
            json.dump({'ips': list(ips_bloqueados)}, f, indent=2, ensure_ascii=False)
        print(f"💾 Guardados {len(ips_bloqueados)} IPs bloqueados no ficheiro")
    except Exception as e:
        print(f"❌ Erro ao guardar IPs bloqueados: {e}")

# Carregar IPs bloqueados ao iniciar
carregar_ips_bloqueados()

def obter_id_sessao():
    """Obter ou criar ID de sessão para o utilizador"""
    return str(uuid.uuid4())

def atualizar_sessao_ativa(request):
    """Atualizar informação da sessão ativa do utilizador"""
    # Obter IP do utilizador
    ip = request.remote_addr
    if request.headers.get('X-Forwarded-For'):
        ip = request.headers.get('X-Forwarded-For').split(',')[0].strip()
    
    # Tentar obter ID de sessão dos cookies
    session_id = request.cookies.get('session_id')
    if not session_id:
        session_id = obter_id_sessao()
    
    # Verificar se a sessão está bloqueada
    if session_id in sessoes_bloqueadas:
        # Manter informação atualizada mesmo quando bloqueado
        with lock_sessoes:
            if session_id in sessoes_bloqueadas_info:
                sessoes_bloqueadas_info[session_id].update({
                    'ultima_tentativa': datetime.now().isoformat(),
                    'user_agent': request.headers.get('User-Agent', 'Desconhecido'),
                    'pagina_atual': request.path,
                    'metodo': request.method
                })
        return None
    
    # Verificar se o IP está bloqueado diretamente (para casos antigos)
    with lock_sessoes:
        if ip in ips_bloqueados:
            return None
    
    with lock_sessoes:
        sessoes_ativas[session_id] = {
            'ip': ip,
            'ultima_atividade': datetime.now(),
            'user_agent': request.headers.get('User-Agent', 'Desconhecido'),
            'pagina_atual': request.path,
            'metodo': request.method
        }
        
        # Limpar sessões inativas há mais de 30 minutos
        agora = datetime.now()
        sessoes_para_remover = []
        for sid, info in sessoes_ativas.items():
            if agora - info['ultima_atividade'] > timedelta(minutes=30):
                sessoes_para_remover.append(sid)
        
        for sid in sessoes_para_remover:
            sessoes_ativas.pop(sid, None)
    
    return session_id

def _html_erro_templates(exc):
    """Resposta HTML quando um template não é encontrado (ex.: no Render sem pasta templates)."""
    from flask import make_response
    html = '''<!DOCTYPE html><html><head><meta charset="utf-8"><title>Erro</title></head><body style="font-family:sans-serif;padding:2rem;">
    <h1>Ficheiros em falta no servidor</h1>
    <p>O servidor não encontrou a pasta <strong>templates</strong> ou o ficheiro <strong>login.html</strong>.</p>
    <p>Certifique-se de que no repositório GitHub (FariaGaspar/BOT) existem as pastas <strong>templates</strong> e <strong>static</strong> com todos os ficheiros.</p>
    <p>Detalhe: %s</p>
    <p>Caminho esperado para templates: %s</p>
    </body></html>''' % (str(exc).replace('<', '&lt;'), _TEMPLATES_DIR)
    r = make_response(html, 500)
    r.headers['Content-Type'] = 'text/html; charset=utf-8'
    return r

@app.before_request
def track_request():
    """Rastrear todas as requisições"""
    # Ignorar requisições para login, logout, túnel de teste, QR telemóvel, acesso remoto, estáticos e admin
    if request.path in ['/login', '/health', '/favicon.ico', '/api/login', '/api/auth/check', '/api/logout', '/api/utilizadores-login', '/tunnel-ok', '/qr', '/acesso-remoto'] or \
       request.path.startswith('/static/') or \
       request.path.startswith('/admin/'):
        return
    
    # Verificar autenticação para rotas protegidas (exceto login)
    try:
        user = verificar_login()
    except Exception:
        user = None
    if not user:
        if request.path.startswith('/api/'):
            return jsonify({'error': 'Não autenticado', 'redirect': '/login'}), 401
        # Para páginas HTML, redirecionar para login
        if request.path == '/' or not request.path.startswith('/api/'):
            try:
                return render_template('login.html')
            except Exception as te:
                return _html_erro_templates(te)
        return jsonify({'error': 'Não autenticado', 'redirect': '/login'}), 401
    
    # Rastrear sessões ativas (apenas para rotas principais, não API)
    if not request.path.startswith('/api/'):
        try:
            session_id = atualizar_sessao_ativa(request)
        except Exception:
            session_id = obter_id_sessao()
        if session_id is None:
            # Sessão bloqueada - redirecionar para login
            if request.path.startswith('/api/'):
                return jsonify({'error': 'Sessão bloqueada pelo administrador'}), 403
            try:
                return render_template('login.html')
            except Exception as te:
                return _html_erro_templates(te)

@app.after_request
def add_session_cookie(response):
    """Adicionar cookie de sessão à resposta"""
    # Apenas para requisições que não são de admin
    if not request.path.startswith('/admin/') and not request.path.startswith('/static/'):
        session_id = request.cookies.get('session_id')
        if not session_id:
            session_id = obter_id_sessao()
        if session_id not in sessoes_bloqueadas:
            response.set_cookie('session_id', session_id, max_age=1800)  # 30 minutos
    return response

# Configuração - usar caminhos relativos ao diretório da aplicação
import os
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, 'planeamento.db')
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')

# Criar pasta de uploads se não existir
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def get_db():
    """Obter conexão com o banco de dados"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def _ensure_cliente_local_materiais_tables(conn):
    """Criar tabelas de materiais por cliente/local se não existirem (usado pelas rotas de materiais)."""
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cliente_local_materiais (
            cliente_local_id INTEGER NOT NULL,
            material_id INTEGER NOT NULL,
            PRIMARY KEY (cliente_local_id, material_id),
            FOREIGN KEY (cliente_local_id) REFERENCES clientes_locais(id),
            FOREIGN KEY (material_id) REFERENCES materiais(id)
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS local_carga_materiais (
            local_carga_id INTEGER NOT NULL,
            material_id INTEGER NOT NULL,
            PRIMARY KEY (local_carga_id, material_id),
            FOREIGN KEY (local_carga_id) REFERENCES locais_carga(id),
            FOREIGN KEY (material_id) REFERENCES materiais(id)
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cliente_local_locais_carga (
            cliente_local_id INTEGER NOT NULL,
            local_carga_id INTEGER NOT NULL,
            PRIMARY KEY (cliente_local_id, local_carga_id),
            FOREIGN KEY (cliente_local_id) REFERENCES clientes_locais(id),
            FOREIGN KEY (local_carga_id) REFERENCES locais_carga(id)
        )
    ''')
    conn.commit()

def _get_materiais_cliente_local_ids(cliente_local_id):
    conn = get_db()
    _ensure_cliente_local_materiais_tables(conn)
    cursor = conn.cursor()
    cursor.execute('SELECT material_id FROM cliente_local_materiais WHERE cliente_local_id = ? ORDER BY material_id', (cliente_local_id,))
    ids = [row[0] for row in cursor.fetchall()]
    conn.close()
    return ids

@app.route('/api/materiais-cliente-local', methods=['GET'])
def get_materiais_cliente_local_q():
    """GET /api/materiais-cliente-local?cliente_local_id=18 (query param para evitar 404)"""
    try:
        cliente_local_id = request.args.get('cliente_local_id', type=int)
        if cliente_local_id is None:
            return jsonify({'error': 'cliente_local_id obrigatório'}), 400
        return jsonify(_get_materiais_cliente_local_ids(cliente_local_id))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/materiais-cliente-local/<int:cliente_local_id>', methods=['GET'])
def get_materiais_cliente_local(cliente_local_id):
    try:
        return jsonify(_get_materiais_cliente_local_ids(cliente_local_id))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def _put_materiais_cliente_local_ids(cliente_local_id, material_ids):
    conn = get_db()
    _ensure_cliente_local_materiais_tables(conn)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM cliente_local_materiais WHERE cliente_local_id = ?', (cliente_local_id,))
    for mid in material_ids:
        cursor.execute('INSERT INTO cliente_local_materiais (cliente_local_id, material_id) VALUES (?, ?)', (cliente_local_id, mid))
    conn.commit()
    conn.close()

@app.route('/api/materiais-cliente-local', methods=['PUT'])
def put_materiais_cliente_local_q():
    """PUT /api/materiais-cliente-local com body { cliente_local_id: 18, material_ids: [...] }"""
    try:
        data = request.get_json() or {}
        cliente_local_id = data.get('cliente_local_id')
        if cliente_local_id is None:
            return jsonify({'error': 'cliente_local_id obrigatório'}), 400
        cliente_local_id = int(cliente_local_id)
        material_ids = data.get('material_ids') or []
        if not isinstance(material_ids, list):
            material_ids = []
        material_ids = [int(x) for x in material_ids if x is not None]
        _put_materiais_cliente_local_ids(cliente_local_id, material_ids)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/materiais-cliente-local/<int:cliente_local_id>', methods=['PUT'])
def put_materiais_cliente_local(cliente_local_id):
    try:
        data = request.get_json() or {}
        material_ids = data.get('material_ids') or []
        if not isinstance(material_ids, list):
            material_ids = []
        material_ids = [int(x) for x in material_ids if x is not None]
        _put_materiais_cliente_local_ids(cliente_local_id, material_ids)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def _get_materiais_local_carga_ids(local_id):
    conn = get_db()
    _ensure_cliente_local_materiais_tables(conn)
    cursor = conn.cursor()
    cursor.execute('SELECT material_id FROM local_carga_materiais WHERE local_carga_id = ? ORDER BY material_id', (local_id,))
    ids = [row[0] for row in cursor.fetchall()]
    conn.close()
    return ids

@app.route('/api/materiais-local-carga', methods=['GET'])
def get_materiais_local_carga_q():
    """GET /api/materiais-local-carga?local_id=10 (query param)"""
    try:
        local_id = request.args.get('local_id', type=int)
        if local_id is None:
            return jsonify({'error': 'local_id obrigatório'}), 400
        return jsonify(_get_materiais_local_carga_ids(local_id))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/materiais-local-carga/<int:local_id>', methods=['GET'])
def get_materiais_local_carga(local_id):
    try:
        return jsonify(_get_materiais_local_carga_ids(local_id))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def _put_materiais_local_carga_ids(local_id, material_ids):
    conn = get_db()
    _ensure_cliente_local_materiais_tables(conn)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM local_carga_materiais WHERE local_carga_id = ?', (local_id,))
    for mid in material_ids:
        cursor.execute('INSERT INTO local_carga_materiais (local_carga_id, material_id) VALUES (?, ?)', (local_id, mid))
    conn.commit()
    conn.close()

@app.route('/api/materiais-local-carga', methods=['PUT'])
def put_materiais_local_carga_q():
    """PUT /api/materiais-local-carga com body { local_id: 10, material_ids: [...] }"""
    try:
        data = request.get_json() or {}
        local_id = data.get('local_id')
        if local_id is None:
            return jsonify({'error': 'local_id obrigatório'}), 400
        local_id = int(local_id)
        material_ids = data.get('material_ids') or []
        if not isinstance(material_ids, list):
            material_ids = []
        material_ids = [int(x) for x in material_ids if x is not None]
        _put_materiais_local_carga_ids(local_id, material_ids)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/materiais-local-carga/<int:local_id>', methods=['PUT'])
def put_materiais_local_carga(local_id):
    try:
        data = request.get_json() or {}
        material_ids = data.get('material_ids') or []
        if not isinstance(material_ids, list):
            material_ids = []
        material_ids = [int(x) for x in material_ids if x is not None]
        _put_materiais_local_carga_ids(local_id, material_ids)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def _get_locais_carga_cliente_local_impl(cliente_local_id):
    """Implementação comum: devolve lista de locais de carga para um cliente_local_id."""
    conn = get_db()
    _ensure_cliente_local_materiais_tables(conn)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT lc.id, lc.nome, lc.descricao
        FROM locais_carga lc
        INNER JOIN cliente_local_locais_carga cllc ON cllc.local_carga_id = lc.id AND cllc.cliente_local_id = ?
        WHERE lc.ativo = 1
        ORDER BY lc.nome ASC
    ''', (cliente_local_id,))
    locais = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return locais

# Rota de teste (sem parâmetros) — se der 200, o servidor tem este código
@app.route('/api/ping-materiais-routes', methods=['GET'])
def ping_materiais_routes():
    """Responde 200 com lista de rotas que contêm 'materiais'. Útil para confirmar que as rotas foram carregadas."""
    rules = [r.rule for r in app.url_map.iter_rules() if 'materiais' in r.rule]
    return jsonify({'ok': True, 'rotas_materiais': rules})

try:
    print('[OK] Rotas /api/materiais-cliente-local e /api/materiais-local-carga registadas.')
except Exception:
    pass

def verificar_data_anterior_e_codigo(data_operacao, codigo_fornecido=None):
    """
    Verifica se a data da operação é anterior à data atual.
    Se for, requer o código "1990" para permitir a operação.
    
    Retorna: (permitido: bool, mensagem_erro: str)
    """
    if not data_operacao:
        return True, None  # Se não há data, permitir (pode ser operação sem data específica)
    
    try:
        data_op = datetime.strptime(data_operacao, '%Y-%m-%d').date()
        data_atual = date.today()
        
        if data_op < data_atual:
            # Data é anterior à atual - requer código
            if codigo_fornecido != '1990':
                return False, 'Esta operação afeta um dia anterior à data atual. É necessário o código de autorização para continuar.'
            return True, None
        else:
            # Data é atual ou futura - permitir sem código
            return True, None
    except (ValueError, TypeError):
        # Se não conseguir parsear a data, permitir (pode ser formato diferente)
        return True, None

def init_db():
    """Inicializar banco de dados com tabelas necessárias"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Tabela de Pedidos Pendentes (histórico completo - nunca apagados)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS pedidos_pendentes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente TEXT NOT NULL,
            tipo_carga TEXT,
            material TEXT,
            data_entrega DATE,
            local_carga TEXT,
            observacoes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Índices para melhor performance com histórico
    try:
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_pedidos_pendentes_data ON pedidos_pendentes(data_entrega)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_pedidos_pendentes_cliente ON pedidos_pendentes(cliente)')
    except:
        pass
    
    # Tabela de Pedidos Entregues (histórico completo - nunca apagados)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS pedidos_entregues (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente TEXT NOT NULL,
            tipo_carga TEXT,
            material TEXT,
            data_entrega DATE,
            local_carga TEXT,
            observacoes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Índices para melhor performance com histórico
    try:
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_pedidos_entregues_data ON pedidos_entregues(data_entrega)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_pedidos_entregues_cliente ON pedidos_entregues(cliente)')
    except:
        pass
    
    # Tabela de Planeamento Diário (histórico completo por data - nunca apagados)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS planeamento_diario (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data_planeamento DATE NOT NULL,
            encomenda_texto TEXT NOT NULL,
            cliente TEXT,
            material TEXT,
            origem_tipo TEXT,
            origem_id INTEGER,
            checkbox_marcado BOOLEAN DEFAULT 0,
            linha_listbox INTEGER,
            viatura_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Índices para melhor performance com histórico
    try:
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_planeamento_data ON planeamento_diario(data_planeamento)')
    except:
        pass
    
    # Garantir coluna observacoes nas tabelas de pedidos (migração leve)
    cursor.execute("PRAGMA table_info(pedidos_pendentes)")
    columns = [row[1] for row in cursor.fetchall()]
    if 'observacoes' not in columns:
        try:
            cursor.execute('ALTER TABLE pedidos_pendentes ADD COLUMN observacoes TEXT')
        except:
            pass

    cursor.execute("PRAGMA table_info(pedidos_entregues)")
    columns = [row[1] for row in cursor.fetchall()]
    if 'observacoes' not in columns:
        try:
            cursor.execute('ALTER TABLE pedidos_entregues ADD COLUMN observacoes TEXT')
        except:
            pass

    # Coluna prioridade em pedidos_pendentes (para destacar em vermelho)
    cursor.execute("PRAGMA table_info(pedidos_pendentes)")
    columns_pp = [row[1] for row in cursor.fetchall()]
    if 'prioridade' not in columns_pp:
        try:
            cursor.execute('ALTER TABLE pedidos_pendentes ADD COLUMN prioridade INTEGER DEFAULT 0')
            print("✅ Coluna 'prioridade' adicionada à tabela 'pedidos_pendentes'.")
        except Exception as e:
            print(f"⚠️ Erro ao adicionar coluna 'prioridade': {e}")
    # Coluna local_descarga em pedidos_pendentes e pedidos_entregues
    if 'local_descarga' not in columns_pp:
        try:
            cursor.execute('ALTER TABLE pedidos_pendentes ADD COLUMN local_descarga TEXT')
            print("✅ Coluna 'local_descarga' adicionada à tabela 'pedidos_pendentes'.")
        except Exception as e:
            print(f"⚠️ Erro ao adicionar coluna 'local_descarga': {e}")
    cursor.execute("PRAGMA table_info(pedidos_entregues)")
    columns_pe = [row[1] for row in cursor.fetchall()]
    if 'local_descarga' not in columns_pe:
        try:
            cursor.execute('ALTER TABLE pedidos_entregues ADD COLUMN local_descarga TEXT')
            print("✅ Coluna 'local_descarga' adicionada à tabela 'pedidos_entregues'.")
        except Exception as e:
            print(f"⚠️ Erro ao adicionar coluna 'local_descarga': {e}")
    
    # ========== NOVA ESTRUTURA: Motoristas, Tratores, Cisternas, Conjuntos ==========
    
    # Tabela de Motoristas
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS motoristas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL UNIQUE,
            telefone TEXT,
            email TEXT,
            ativo BOOLEAN DEFAULT 1,
            observacoes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Migração: Adicionar colunas se não existirem (para tabelas criadas antes)
    cursor.execute("PRAGMA table_info(motoristas)")
    columns = [row[1] for row in cursor.fetchall()]
    
    if 'telefone' not in columns:
        try:
            cursor.execute('ALTER TABLE motoristas ADD COLUMN telefone TEXT')
            print("✅ Coluna 'telefone' adicionada à tabela motoristas")
        except Exception as e:
            print(f"⚠️ Erro ao adicionar coluna 'telefone': {e}")
    
    if 'email' not in columns:
        try:
            cursor.execute('ALTER TABLE motoristas ADD COLUMN email TEXT')
            print("✅ Coluna 'email' adicionada à tabela motoristas")
        except Exception as e:
            print(f"⚠️ Erro ao adicionar coluna 'email': {e}")
    
    if 'ativo' not in columns:
        try:
            cursor.execute('ALTER TABLE motoristas ADD COLUMN ativo BOOLEAN DEFAULT 1')
            print("✅ Coluna 'ativo' adicionada à tabela motoristas")
        except Exception as e:
            print(f"⚠️ Erro ao adicionar coluna 'ativo': {e}")
    
    if 'observacoes' not in columns:
        try:
            cursor.execute('ALTER TABLE motoristas ADD COLUMN observacoes TEXT')
            print("✅ Coluna 'observacoes' adicionada à tabela motoristas")
        except Exception as e:
            print(f"⚠️ Erro ao adicionar coluna 'observacoes': {e}")
    
    if 'created_at' not in columns:
        try:
            cursor.execute('ALTER TABLE motoristas ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
            print("✅ Coluna 'created_at' adicionada à tabela motoristas")
        except Exception as e:
            print(f"⚠️ Erro ao adicionar coluna 'created_at': {e}")
    
    if 'updated_at' not in columns:
        try:
            cursor.execute('ALTER TABLE motoristas ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
            print("✅ Coluna 'updated_at' adicionada à tabela motoristas")
        except Exception as e:
            print(f"⚠️ Erro ao adicionar coluna 'updated_at': {e}")
    
    for col_name, col_def in [
        ('data_nascimento', 'DATE'),
        ('data_admissao', 'DATE'),
        ('numero_funcionario', 'TEXT'),
        ('nome_completo', 'TEXT'),
        ('nome_abreviado', 'TEXT'),
    ]:
        if col_name not in columns:
            try:
                cursor.execute(f'ALTER TABLE motoristas ADD COLUMN {col_name} {col_def}')
                print(f"✅ Coluna '{col_name}' adicionada à tabela motoristas")
            except Exception as e:
                print(f"⚠️ Erro ao adicionar coluna '{col_name}': {e}")
    
    # Tabela de Tratores
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tratores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            matricula TEXT NOT NULL UNIQUE,
            codigo TEXT,
            marca TEXT,
            modelo TEXT,
            ano INTEGER,
            ativo BOOLEAN DEFAULT 1,
            observacoes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Tabela de Cisternas
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cisternas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            matricula TEXT NOT NULL UNIQUE,
            codigo TEXT,
            capacidade REAL,
            tipo TEXT,
            ativo BOOLEAN DEFAULT 1,
            observacoes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Tabela de Conjuntos Habituais (Trator + Cisterna + Motorista)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS conjuntos_habituais (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            trator_id INTEGER NOT NULL,
            cisterna_id INTEGER NOT NULL,
            motorista_id INTEGER,
            ordem INTEGER DEFAULT 0,
            ativo BOOLEAN DEFAULT 1,
            data_desativacao DATE,
            observacoes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (trator_id) REFERENCES tratores(id),
            FOREIGN KEY (cisterna_id) REFERENCES cisternas(id),
            FOREIGN KEY (motorista_id) REFERENCES motoristas(id)
        )
    ''')
    
    # Tabela de Atribuições Diárias (Motorista atribuído a um conjunto numa data específica)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS atribuicoes_motoristas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conjunto_id INTEGER NOT NULL,
            motorista_id INTEGER,
            data_atribuicao DATE NOT NULL,
            observacoes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conjunto_id) REFERENCES conjuntos_habituais(id),
            FOREIGN KEY (motorista_id) REFERENCES motoristas(id),
            UNIQUE(conjunto_id, data_atribuicao)
        )
    ''')
    
    # Migração: Adicionar coluna data_desativacao se não existir
    cursor.execute("PRAGMA table_info(conjuntos_habituais)")
    columns_conjuntos = [row[1] for row in cursor.fetchall()]
    
    if 'data_desativacao' not in columns_conjuntos:
        try:
            cursor.execute('ALTER TABLE conjuntos_habituais ADD COLUMN data_desativacao DATE')
            print("✅ Coluna 'data_desativacao' adicionada à tabela 'conjuntos_habituais'.")
        except Exception as e:
            print(f"⚠️ Erro ao adicionar coluna 'data_desativacao' à tabela 'conjuntos_habituais': {e}")
    
    # Índices para melhor performance
    try:
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_conjuntos_habituais_ordem ON conjuntos_habituais(ordem)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_atribuicoes_motoristas_data ON atribuicoes_motoristas(data_atribuicao)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_atribuicoes_motoristas_conjunto ON atribuicoes_motoristas(conjunto_id, data_atribuicao)')
    except:
        pass
    
    # ========== SISTEMA DE AUTENTICAÇÃO E UTILIZADORES ==========
    
    # Tabela de Utilizadores do Sistema
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS utilizadores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            nome TEXT NOT NULL,
            email TEXT,
            is_admin BOOLEAN DEFAULT 0,
            ativo BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP
        )
    ''')
    
    # Criar utilizador admin padrão se não existir
    cursor.execute('SELECT COUNT(*) as count FROM utilizadores WHERE is_admin = 1')
    admin_exists = cursor.fetchone()['count'] > 0
    
    if not admin_exists:
        import hashlib
        # Password padrão: admin123 (deve ser alterada após primeiro login)
        password_hash = hashlib.sha256('admin123'.encode()).hexdigest()
        cursor.execute('''
            INSERT INTO utilizadores (username, password_hash, nome, is_admin, ativo)
            VALUES (?, ?, ?, ?, ?)
        ''', ('admin', password_hash, 'Administrador', 1, 1))
        print("✅ Utilizador admin criado: username='admin', password='admin123'")
    
    # ========== BASE DE DADOS DE CLIENTES E LOCAIS DE DESCARGA ==========
    
    # Tabela de Clientes e Locais de Descarga
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS clientes_locais (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente TEXT NOT NULL,
            local_descarga TEXT NOT NULL,
            ativo BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(cliente, local_descarga)
        )
    ''')
    
    # Índices para melhor performance
    try:
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_clientes_locais_cliente ON clientes_locais(cliente)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_clientes_locais_ativo ON clientes_locais(ativo)')
    except:
        pass
    
    # ========== BASE DE DADOS DE LOCAIS DE CARGA ==========
    
    # Tabela de Locais de Carga
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS locais_carga (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL UNIQUE,
            descricao TEXT,
            ativo BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Índices para melhor performance
    try:
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_locais_carga_ativo ON locais_carga(ativo)')
    except:
        pass
    
    # ========== BASE DE DADOS DE MATERIAIS ==========
    
    # Tabela de Materiais
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS materiais (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL UNIQUE,
            descricao TEXT,
            ativo BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Índices para melhor performance
    try:
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_materiais_nome ON materiais(nome)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_materiais_ativo ON materiais(ativo)')
    except:
        pass
    
    # Materiais que cada cliente/local de descarga recebe (vistos na BD de clientes)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cliente_local_materiais (
            cliente_local_id INTEGER NOT NULL,
            material_id INTEGER NOT NULL,
            PRIMARY KEY (cliente_local_id, material_id),
            FOREIGN KEY (cliente_local_id) REFERENCES clientes_locais(id),
            FOREIGN KEY (material_id) REFERENCES materiais(id)
        )
    ''')
    # Materiais que cada local de carga carrega (vistos na BD de locais de carga)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS local_carga_materiais (
            local_carga_id INTEGER NOT NULL,
            material_id INTEGER NOT NULL,
            PRIMARY KEY (local_carga_id, material_id),
            FOREIGN KEY (local_carga_id) REFERENCES locais_carga(id),
            FOREIGN KEY (material_id) REFERENCES materiais(id)
        )
    ''')
    # Locais de carga associados a cada cliente/local de descarga
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cliente_local_locais_carga (
            cliente_local_id INTEGER NOT NULL,
            local_carga_id INTEGER NOT NULL,
            PRIMARY KEY (cliente_local_id, local_carga_id),
            FOREIGN KEY (cliente_local_id) REFERENCES clientes_locais(id),
            FOREIGN KEY (local_carga_id) REFERENCES locais_carga(id)
        )
    ''')
    try:
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_cliente_local_mat_cl ON cliente_local_materiais(cliente_local_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_local_carga_mat_lc ON local_carga_materiais(local_carga_id)')
    except:
        pass
    
    # ========== BASE DE DADOS DE CONJUNTOS COMPATÍVEIS ==========
    
    # Tabela de Conjuntos Compatíveis (autorização para alterar matrículas)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS conjuntos_compatives (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trator_id INTEGER NOT NULL,
            cisterna_id INTEGER NOT NULL,
            autorizado BOOLEAN DEFAULT 1,
            observacoes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (trator_id) REFERENCES tratores(id),
            FOREIGN KEY (cisterna_id) REFERENCES cisternas(id),
            UNIQUE(trator_id, cisterna_id)
        )
    ''')
    
    # Índices para melhor performance
    try:
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_conjuntos_compatives_autorizado ON conjuntos_compatives(autorizado)')
    except:
        pass
    
    # ========== BASE DE DADOS DE TRANSPORTADORAS ==========
    
    # Tabela de Transportadoras
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transportadoras (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL UNIQUE,
            ativo BOOLEAN DEFAULT 1,
            observacoes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Tabela de Ativação de Transportadoras por Data
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transportadoras_ativacao (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transportadora_id INTEGER NOT NULL,
            data_ativacao DATE NOT NULL,
            ativo BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (transportadora_id) REFERENCES transportadoras(id),
            UNIQUE(transportadora_id, data_ativacao)
        )
    ''')
    
    # Índices para melhor performance
    try:
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_transportadoras_ativo ON transportadoras(ativo)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_transportadoras_ativacao_data ON transportadoras_ativacao(data_ativacao)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_transportadoras_ativacao_ativo ON transportadoras_ativacao(ativo)')
    except:
        pass
    
    conn.commit()
    
    # ========== MANTER TABELA ANTIGA PARA COMPATIBILIDADE (migração gradual) ==========
    # Tabela de Viaturas e Motoristas (formato: PTSA | MATRÍCULA + CÓDIGO - NOME)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS viatura_motorista (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            matricula TEXT NOT NULL,
            codigo TEXT NOT NULL,
            nome_motorista TEXT NOT NULL,
            status TEXT,
            observacao_status TEXT,
            ativo BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Verificar e adicionar colunas temporárias se não existirem
    cursor.execute("PRAGMA table_info(viatura_motorista)")
    columns = [row[1] for row in cursor.fetchall()]
    
    if 'temporario' not in columns:
        try:
            cursor.execute('ALTER TABLE viatura_motorista ADD COLUMN temporario BOOLEAN DEFAULT 0')
        except:
            pass
    
    if 'data_temporaria' not in columns:
        try:
            cursor.execute('ALTER TABLE viatura_motorista ADD COLUMN data_temporaria DATE')
        except:
            pass
    
    # Verificar e adicionar colunas de status se não existirem
    cursor.execute("PRAGMA table_info(viatura_motorista)")
    columns = [row[1] for row in cursor.fetchall()]
    
    if 'status' not in columns:
        try:
            cursor.execute('ALTER TABLE viatura_motorista ADD COLUMN status TEXT')
        except:
            pass
    
    if 'observacao_status' not in columns:
        try:
            cursor.execute('ALTER TABLE viatura_motorista ADD COLUMN observacao_status TEXT')
        except:
            pass
    
    if 'ordem' not in columns:
        try:
            cursor.execute('ALTER TABLE viatura_motorista ADD COLUMN ordem INTEGER DEFAULT 0')
        except:
            pass
    
    if 'data_desativacao' not in columns:
        try:
            cursor.execute('ALTER TABLE viatura_motorista ADD COLUMN data_desativacao DATE')
        except:
            pass
    
    # Tabela de Associação Encomenda-ViaturaMotorista (histórico completo por data - nunca apagados)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS encomenda_viatura (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id INTEGER NOT NULL,
            pedido_tipo TEXT NOT NULL,  -- 'P' para Pendentes
            viatura_motorista_id INTEGER NOT NULL,
            data_associacao DATE NOT NULL,
            ordem INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (viatura_motorista_id) REFERENCES viatura_motorista(id)
        )
    ''')
    
    # Índices para melhor performance com histórico
    try:
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_encomenda_viatura_data ON encomenda_viatura(data_associacao)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_encomenda_viatura_pedido ON encomenda_viatura(pedido_id, pedido_tipo)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_encomenda_viatura_viatura ON encomenda_viatura(viatura_motorista_id, data_associacao)')
    except:
        pass
    
    # Verificar e adicionar colunas se não existirem
    cursor.execute("PRAGMA table_info(encomenda_viatura)")
    columns = [row[1] for row in cursor.fetchall()]
    
    if 'ordem' not in columns:
        try:
            cursor.execute('ALTER TABLE encomenda_viatura ADD COLUMN ordem INTEGER DEFAULT 0')
        except:
            pass
    
    # Adicionar coluna atribuicao_id para associar encomendas a atribuicoes_motoristas
    if 'atribuicao_id' not in columns:
        try:
            cursor.execute('ALTER TABLE encomenda_viatura ADD COLUMN atribuicao_id INTEGER')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_encomenda_viatura_atribuicao ON encomenda_viatura(atribuicao_id, data_associacao)')
            print("✅ Coluna 'atribuicao_id' adicionada à tabela 'encomenda_viatura'.")
        except Exception as e:
            print(f"⚠️ Erro ao adicionar coluna 'atribuicao_id' à tabela 'encomenda_viatura': {e}")
    
    # Migração: tornar viatura_motorista_id nullable (para permitir INSERT só com atribuicao_id)
    cursor.execute("PRAGMA table_info(encomenda_viatura)")
    rows_ev = cursor.fetchall()
    cols_ev = [row[1] for row in rows_ev]
    for col in rows_ev:
        if col[1] == 'viatura_motorista_id' and col[3] == 1:  # notnull=1
            try:
                cursor.execute('DROP TABLE IF EXISTS encomenda_viatura_new')
                cursor.execute('''
                    CREATE TABLE encomenda_viatura_new (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        pedido_id INTEGER NOT NULL,
                        pedido_tipo TEXT NOT NULL,
                        viatura_motorista_id INTEGER,
                        data_associacao DATE NOT NULL,
                        ordem INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        atribuicao_id INTEGER,
                        FOREIGN KEY (viatura_motorista_id) REFERENCES viatura_motorista(id)
                    )
                ''')
                # Copiar dados: usar apenas colunas que existem na tabela original (created_at, ordem, atribuicao_id podem faltar)
                sel_ordem = 'ordem' if 'ordem' in cols_ev else '0'
                sel_created = 'created_at' if 'created_at' in cols_ev else "CURRENT_TIMESTAMP"
                sel_atrib = 'atribuicao_id' if 'atribuicao_id' in cols_ev else 'NULL'
                cursor.execute(f'''
                    INSERT INTO encomenda_viatura_new (id, pedido_id, pedido_tipo, viatura_motorista_id, data_associacao, ordem, created_at, atribuicao_id)
                    SELECT id, pedido_id, pedido_tipo, viatura_motorista_id, data_associacao, {sel_ordem}, {sel_created}, {sel_atrib} FROM encomenda_viatura
                ''')
                cursor.execute('DROP TABLE encomenda_viatura')
                cursor.execute('ALTER TABLE encomenda_viatura_new RENAME TO encomenda_viatura')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_encomenda_viatura_data ON encomenda_viatura(data_associacao)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_encomenda_viatura_pedido ON encomenda_viatura(pedido_id, pedido_tipo)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_encomenda_viatura_viatura ON encomenda_viatura(viatura_motorista_id, data_associacao)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_encomenda_viatura_atribuicao ON encomenda_viatura(atribuicao_id, data_associacao)')
                conn.commit()
                print("✅ Migração: viatura_motorista_id passou a aceitar NULL em encomenda_viatura.")
            except Exception as e:
                print(f"⚠️ Erro na migração encomenda_viatura: {e}")
                conn.rollback()
            break
    
    # Tabela de Status de Viatura/Motorista por Data
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS viatura_motorista_status (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            viatura_motorista_id INTEGER NOT NULL,
            data_status DATE NOT NULL,
            status TEXT DEFAULT 'Normal',
            observacao_status TEXT,
            data_inicio DATE,
            data_fim DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (viatura_motorista_id) REFERENCES viatura_motorista(id),
            UNIQUE(viatura_motorista_id, data_status)
        )
    ''')
    
    # Verificar e adicionar colunas de período se não existirem
    cursor.execute("PRAGMA table_info(viatura_motorista_status)")
    columns = [row[1] for row in cursor.fetchall()]
    
    if 'data_inicio' not in columns:
        try:
            cursor.execute('ALTER TABLE viatura_motorista_status ADD COLUMN data_inicio DATE')
        except:
            pass
    
    if 'data_fim' not in columns:
        try:
            cursor.execute('ALTER TABLE viatura_motorista_status ADD COLUMN data_fim DATE')
        except:
            pass

    # Tabela de registo de trocas de conjunto (para análise futura, ex.: tempo em oficina)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS troca_conjunto_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            viatura_origem_id INTEGER NOT NULL,
            viatura_destino_id INTEGER NOT NULL,
            data_associacao DATE NOT NULL,
            motivo TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (viatura_origem_id) REFERENCES viatura_motorista(id),
            FOREIGN KEY (viatura_destino_id) REFERENCES viatura_motorista(id)
        )
    ''')
    
    # Tabela de histórico de ações (para reverter ações)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS historico_acoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo_acao TEXT NOT NULL,
            descricao TEXT NOT NULL,
            dados_acao TEXT NOT NULL,
            data_acao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            revertido BOOLEAN DEFAULT 0
        )
    ''')
    
    # Tabela de matrículas temporárias (para troca de conjunto apenas da matrícula/código no dia)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS matricula_temporaria (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            viatura_motorista_id INTEGER NOT NULL,
            data_associacao DATE NOT NULL,
            matricula_temporaria TEXT NOT NULL,
            codigo_temporaria TEXT,
            motivo TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (viatura_motorista_id) REFERENCES viatura_motorista(id),
            UNIQUE(viatura_motorista_id, data_associacao)
        )
    ''')

    # Garantir coluna codigo_temporaria (migração leve)
    cursor.execute("PRAGMA table_info(matricula_temporaria)")
    columns = [row[1] for row in cursor.fetchall()]
    if 'codigo_temporaria' not in columns:
        try:
            cursor.execute('ALTER TABLE matricula_temporaria ADD COLUMN codigo_temporaria TEXT')
        except:
            pass
    
    # Tabela de matrículas temporárias detalhadas (trator + galera)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS matricula_temporaria_detalhada (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            viatura_motorista_id INTEGER NOT NULL,
            data_associacao DATE NOT NULL,
            matricula_trator TEXT,
            matricula_galera TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (viatura_motorista_id) REFERENCES viatura_motorista(id),
            UNIQUE(viatura_motorista_id, data_associacao)
        )
    ''')
    
    # Tabela de observações temporárias (apenas para o dia)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS observacao_temporaria (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            viatura_motorista_id INTEGER NOT NULL,
            data_associacao DATE NOT NULL,
            observacao TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (viatura_motorista_id) REFERENCES viatura_motorista(id),
            UNIQUE(viatura_motorista_id, data_associacao)
        )
    ''')
    
    # Tabela para matrículas temporárias do trator e galera (alteração de matrícula)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS matricula_temporaria_detalhada (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            viatura_motorista_id INTEGER NOT NULL,
            data_associacao DATE NOT NULL,
            matricula_trator TEXT,
            matricula_galera TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (viatura_motorista_id) REFERENCES viatura_motorista(id),
            UNIQUE(viatura_motorista_id, data_associacao)
        )
    ''')
    
    # Tabela para marcar motorista "passa a noite fora" (dia D) -> no dia D+1 mostrar "Fora - continuação"
    # numero_noites_fora: 1 = uma noite (azul), 2 = duas ou mais noites (roxo)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS motorista_noite_fora (
            data DATE NOT NULL,
            motorista_id INTEGER NOT NULL,
            numero_noites_fora INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (data, motorista_id),
            FOREIGN KEY (motorista_id) REFERENCES motoristas(id)
        )
    ''')
    cursor.execute("PRAGMA table_info(motorista_noite_fora)")
    nf_cols = [row[1] for row in cursor.fetchall()]
    if 'numero_noites_fora' not in nf_cols:
        try:
            cursor.execute('ALTER TABLE motorista_noite_fora ADD COLUMN numero_noites_fora INTEGER DEFAULT 1')
            print("✅ Coluna 'numero_noites_fora' adicionada à tabela motorista_noite_fora")
        except Exception as e:
            print(f"⚠️ Erro ao adicionar numero_noites_fora: {e}")
    
    conn.commit()
    conn.close()

def normalize_text(text):
    """Normalizar texto (equivalente à função NormalizeText do VBA)"""
    if text is None:
        return ""
    return text.lower().strip().replace(" ✓", "")

# ==================== SISTEMA DE AUTENTICAÇÃO ====================
import hashlib
from functools import wraps

def hash_password(password):
    """Hash da password usando SHA256"""
    return hashlib.sha256(password.encode()).hexdigest()

def verificar_login():
    """Verificar se o utilizador está autenticado"""
    user_id = request.cookies.get('user_id')
    session_token = request.cookies.get('session_token')
    
    if not user_id or not session_token:
        return None
    
    try:
        user_id_int = int(user_id)
    except (ValueError, TypeError):
        return None
    
    # Verificar sessão na base de dados - sempre verificar se utilizador existe e está ativo
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM utilizadores WHERE id = ? AND ativo = 1', (user_id_int,))
    user = cursor.fetchone()
    conn.close()
    
    if not user:
        return None
    
    # Verificar token - incluir SERVER_SECRET para invalidar sessões quando servidor reinicia
    expected_token = hash_password(f"{user['id']}{user['username']}{SERVER_SECRET}")
    if session_token == expected_token:
        return dict(user)
    
    return None

def login_required(f):
    """Decorator para proteger rotas que requerem login"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = verificar_login()
        if not user:
            if request.path.startswith('/api/'):
                return jsonify({'error': 'Não autenticado', 'redirect': '/login'}), 401
            return render_template('login.html')
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    """Decorator para proteger rotas que requerem admin"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = verificar_login()
        if not user:
            if request.path.startswith('/api/'):
                return jsonify({'error': 'Não autenticado'}), 401
            return render_template('login.html')
        if not user.get('is_admin'):
            return jsonify({'error': 'Acesso negado. Apenas administradores.'}), 403
        return f(*args, **kwargs)
    return decorated_function

@app.route('/favicon.ico')
def favicon():
    """Evitar 500 quando o browser pede o ícone (não requer auth)."""
    from flask import Response
    return Response(status=204)

@app.route('/health')
def health():
    """Verificar se a app está no ar (sem auth). Útil para Render e diagnóstico."""
    import os as _os
    t_dir = _os.path.join(_BASE_DIR, 'templates')
    s_dir = _os.path.join(_BASE_DIR, 'static')
    login_ok = _os.path.isfile(_os.path.join(t_dir, 'login.html'))
    return jsonify({
        'status': 'ok',
        'templates_dir': t_dir,
        'static_dir': s_dir,
        'login_html_exists': login_ok,
    }), 200

@app.route('/login')
def login_page():
    """Página de login"""
    try:
        return render_template('login.html')
    except Exception as e:
        return _html_erro_templates(e)

@app.route('/api/utilizadores-login', methods=['GET'])
def listar_utilizadores_login():
    """Listar utilizadores ativos para o dropdown de login (sem autenticação)"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, username, nome, is_admin
        FROM utilizadores
        WHERE ativo = 1
        ORDER BY nome ASC
    ''')
    utilizadores = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    # Converter booleanos
    for u in utilizadores:
        u['is_admin'] = bool(u['is_admin'])
    
    return jsonify(utilizadores)

@app.route('/api/login', methods=['POST'])
def login():
    """Autenticar utilizador"""
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')
    
    if not username or not password:
        return jsonify({'success': False, 'error': 'Username e password são obrigatórios'}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM utilizadores WHERE username = ? AND ativo = 1', (username,))
    user = cursor.fetchone()
    
    if not user:
        conn.close()
        return jsonify({'success': False, 'error': 'Credenciais inválidas'}), 401
    
    # Verificar password
    password_hash = hash_password(password)
    if user['password_hash'] != password_hash:
        conn.close()
        return jsonify({'success': False, 'error': 'Credenciais inválidas'}), 401
    
    # Atualizar último login
    cursor.execute('UPDATE utilizadores SET last_login = CURRENT_TIMESTAMP WHERE id = ?', (user['id'],))
    conn.commit()
    conn.close()
    
    # Criar resposta com cookies
    response = jsonify({
        'success': True,
        'user': {
            'id': user['id'],
            'username': user['username'],
            'nome': user['nome'],
            'is_admin': bool(user['is_admin'])
        }
    })
    
    # Definir cookies de sessão (incluir SERVER_SECRET para invalidar quando servidor reinicia)
    response.set_cookie('user_id', str(user['id']), max_age=86400)  # 24 horas
    response.set_cookie('session_token', hash_password(f"{user['id']}{user['username']}{SERVER_SECRET}"), max_age=86400)
    
    return response

@app.route('/api/logout', methods=['POST'])
def logout():
    """Terminar sessão"""
    response = jsonify({'success': True})
    response.set_cookie('user_id', '', expires=0)
    response.set_cookie('session_token', '', expires=0)
    return response

@app.route('/api/auth/check', methods=['GET'])
def check_auth():
    """Verificar se o utilizador está autenticado"""
    user = verificar_login()
    if user:
        return jsonify({
            'authenticated': True,
            'user': {
                'id': user['id'],
                'username': user['username'],
                'nome': user['nome'],
                'is_admin': bool(user['is_admin'])
            }
        })
    return jsonify({'authenticated': False}), 401

# ==================== ROTAS PRINCIPAIS ====================

@app.route('/tunnel-ok')
def tunnel_ok():
    """Rota de teste para verificar se o túnel Cloudflare/ngrok chega à aplicação (sem login)."""
    return 'OK - túnel a funcionar', 200, {'Content-Type': 'text/plain; charset=utf-8'}


@app.route('/qr')
def qr_telemovel():
    """Página com link e QR code para abrir a app no telemóvel (fora da rede). Sem login."""
    url = app.config.get('URL_PUBLICA') or ''
    from flask import render_template_string
    if not url:
        html = '''
        <!DOCTYPE html>
        <html lang="pt"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Abrir no telemóvel</title>
        <style>body{font-family:sans-serif;max-width:400px;margin:2rem auto;padding:1rem;text-align:center;}
        .msg{background:#fff3cd;padding:1rem;border-radius:8px;margin:1rem 0;}
        a{color:#0d6efd;}</style></head><body>
        <h1>📱 Abrir no telemóvel</h1>
        <p class="msg">Túnel ainda a iniciar. Aguarde ~15 segundos e <a href="/qr">actualize esta página</a>.</p>
        <p><a href="/login">Voltar ao login</a></p>
        <script>setTimeout(function(){ location.reload(); }, 8000);</script>
        </body></html>'''
        return render_template_string(html)
    import urllib.parse
    url_esc = urllib.parse.quote(url, safe='')
    qr_src = f'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data={url_esc}'
    url_alt = app.config.get('URL_PUBLICA_ALT') or ''
    alt_block = ''
    if url_alt and url_alt != url:
        alt_block = f'<p class="sub" style="margin-top:1.5rem;background:#e7f3ff;padding:0.75rem;border-radius:8px;">Se a página ficar em branco, use no telemóvel em <strong>dados móveis</strong>:<br><a href="{url_alt}" target="_blank" rel="noopener">{url_alt}</a></p>'
    html = f'''
    <!DOCTYPE html>
    <html lang="pt"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Abrir no telemóvel</title>
    <style>body{{font-family:sans-serif;max-width:420px;margin:2rem auto;padding:1rem;text-align:center;}}
    h1{{margin-bottom:0.5rem;}} .qr{{margin:1.5rem 0;}} .qr img{{border:1px solid #ddd;border-radius:12px;}}
    .link{{word-break:break-all;background:#f0f0f0;padding:0.75rem;border-radius:8px;margin:1rem 0;font-size:0.9rem;}}
    a{{color:#0d6efd;}} .sub{{color:#666;font-size:0.9rem;margin-top:1rem;}}</style></head><body>
    <h1>📱 Abrir no telemóvel</h1>
    <p>Apontar a câmara ao QR code ou clicar no link em baixo.</p>
    <div class="qr"><img src="{qr_src}" alt="QR code" width="220" height="220"></div>
    <p class="link"><a href="{url}" target="_blank" rel="noopener">{url}</a></p>
    <p class="sub">Use no telemóvel (dados móveis ou outra rede).</p>
    {alt_block}
    <p><a href="/login">Voltar ao login</a></p>
    </body></html>'''
    return render_template_string(html)


@app.route('/acesso-remoto')
def acesso_remoto():
    """Página fácil: abrir no telemóvel com dados móveis (sem instalar nada). Sem login."""
    from flask import render_template_string
    import urllib.parse
    url = app.config.get('URL_PUBLICA') or ''
    if url:
        url_esc = urllib.parse.quote(url, safe='')
        qr_src = f'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data={url_esc}'
        html = f'''
        <!DOCTYPE html>
        <html lang="pt"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Abrir no telemóvel</title>
        <style>body{{font-family:sans-serif;max-width:420px;margin:2rem auto;padding:1rem;text-align:center;}}
        h1{{font-size:1.25rem;}} .box{{background:#e3f2fd;padding:1rem;border-radius:12px;margin:1rem 0;text-align:left;}}
        .step{{margin:0.5rem 0;}} .qr{{margin:1rem 0;}} .link{{word-break:break-all;background:#fff;padding:1rem;border-radius:8px;margin:1rem 0;font-size:1rem;}}
        a{{color:#0d6efd;}} .btn{{display:inline-block;background:#1976d2;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin:0.5rem;}}</style></head><body>
        <h1>📱 Abrir no telemóvel (fácil)</h1>
        <div class="box">
        <div class="step"><strong>1.</strong> No telemóvel, desligue o Wi-Fi.</div>
        <div class="step"><strong>2.</strong> Ative os dados móveis (4G/5G).</div>
        <div class="step"><strong>3.</strong> Abra o link em baixo ou leia o QR code.</div>
        </div>
        <p>Não precisa instalar nada.</p>
        <div class="qr"><img src="{qr_src}" alt="QR" width="220" height="220"></div>
        <p class="link"><a href="{url}" target="_blank" rel="noopener">{url}</a></p>
        <p><a href="{url}" class="btn" target="_blank" rel="noopener">Abrir app</a></p>
        <p><a href="/login">Voltar ao login</a></p>
        </body></html>'''
    else:
        html = '''
        <!DOCTYPE html>
        <html lang="pt"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Abrir no telemóvel</title>
        <style>body{font-family:sans-serif;max-width:420px;margin:2rem auto;padding:1rem;text-align:center;}
        .box{background:#fff3cd;padding:1rem;border-radius:12px;margin:1rem 0;}</style></head><body>
        <h1>📱 Abrir no telemóvel</h1>
        <div class="box">
        <p>A URL ainda está a ser gerada. Aguarde ~15 segundos e <a href="/acesso-remoto">actualize esta página</a>.</p>
        <p>Ou veja no terminal do servidor a URL que começa por https://....trycloudflare.com</p>
        </div>
        <p><a href="/login">Voltar ao login</a> &nbsp;|&nbsp; <a href="/qr">Ver /qr</a></p>
        <script>setTimeout(function(){ location.reload(); }, 10000);</script>
        </body></html>'''
    return render_template_string(html)


@app.route('/')
def index():
    """Página principal - requer login"""
    user = verificar_login()
    if not user:
        try:
            return render_template('login.html')
        except Exception as e:
            return _html_erro_templates(e)
    try:
        return render_template('index.html', user=user)
    except Exception as e:
        return _html_erro_templates(e)

@app.route('/api/pedidos-pendentes', methods=['GET'])
def get_pedidos_pendentes():
    """Obter todos os pedidos pendentes"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM pedidos_pendentes ORDER BY data_entrega ASC, cliente ASC')
    pedidos = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(pedidos)

@app.route('/api/pedidos-pendentes/prioridade', methods=['POST'])
def atualizar_prioridade_pedido_pendente_body():
    """Marcar ou remover prioridade de um pedido pendente (ID no body)."""
    try:
        data = request.json or {}
        pedido_id = data.get('pedido_id') or data.get('id')
        if pedido_id is None:
            return jsonify({'success': False, 'error': 'pedido_id em falta'}), 400
        pedido_id = int(pedido_id)
        prioridade = data.get('prioridade', True)
        valor = 1 if prioridade else 0
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE pedidos_pendentes 
            SET prioridade = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (valor, pedido_id))
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'success': False, 'error': 'Pedido não encontrado'}), 404
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'prioridade': bool(valor)})
    except Exception as e:
        if 'conn' in locals():
            try:
                conn.close()
            except:
                pass
        return jsonify({'success': False, 'error': str(e)}), 500

# Confirmação de registo (aparece no terminal ao iniciar o servidor)
print("✓ Rota POST /api/pedidos-pendentes/prioridade registada")

@app.route('/api/pedidos-entregues', methods=['GET'])
def get_pedidos_entregues():
    """Obter todos os pedidos entregues"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM pedidos_entregues ORDER BY data_entrega ASC, cliente ASC')
    pedidos = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(pedidos)

@app.route('/api/planeamento-diario', methods=['GET'])
def get_planeamento_diario():
    """Obter planeamento do dia"""
    data_str = request.args.get('data', date.today().isoformat())
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM planeamento_diario 
        WHERE data_planeamento = ? 
        ORDER BY linha_listbox ASC
    ''', (data_str,))
    planeamento = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(planeamento)

@app.route('/api/mover-para-entregues', methods=['POST'])
def mover_para_entregues():
    """Mover pedido de Pendentes para Entregues"""
    data = request.json
    pedido_id = data.get('id')
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Buscar pedido em Pendentes
    cursor.execute('SELECT * FROM pedidos_pendentes WHERE id = ?', (pedido_id,))
    pedido = cursor.fetchone()
    
    if pedido:
        # Inserir em Entregues
        cursor.execute('''
            INSERT INTO pedidos_entregues 
            (cliente, tipo_carga, material, data_entrega, local_carga, local_descarga, observacoes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            pedido['cliente'],
            pedido['tipo_carga'],
            pedido['material'],
            pedido['data_entrega'],
            pedido['local_carga'],
            pedido.get('local_descarga', ''),
            pedido.get('observacoes', '')
        ))
        entregue_id = cursor.lastrowid
        
        # Remover de Pendentes
        cursor.execute('DELETE FROM pedidos_pendentes WHERE id = ?', (pedido_id,))
        
        # Atualizar planeamento diário se existir
        cursor.execute('''
            UPDATE planeamento_diario 
            SET origem_tipo = 'E', origem_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE origem_tipo = 'P' AND origem_id = ?
        ''', (entregue_id, pedido_id))
        
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'id': entregue_id})
    
    conn.close()
    return jsonify({'success': False, 'error': 'Pedido não encontrado'}), 404

@app.route('/api/mover-para-pendentes', methods=['POST'])
def mover_para_pendentes():
    """Mover pedido de Entregues para Pendentes"""
    data = request.json
    pedido_id = data.get('id')
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Buscar pedido em Entregues
    cursor.execute('SELECT * FROM pedidos_entregues WHERE id = ?', (pedido_id,))
    pedido = cursor.fetchone()
    
    if pedido:
        # Inserir em Pendentes
        cursor.execute('''
            INSERT INTO pedidos_pendentes 
            (cliente, tipo_carga, material, data_entrega, local_carga, local_descarga, observacoes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            pedido['cliente'],
            pedido['tipo_carga'],
            pedido['material'],
            pedido['data_entrega'],
            pedido['local_carga'],
            pedido.get('local_descarga', ''),
            pedido.get('observacoes', '')
        ))
        pendente_id = cursor.lastrowid
        
        # Remover de Entregues
        cursor.execute('DELETE FROM pedidos_entregues WHERE id = ?', (pedido_id,))
        
        # Atualizar planeamento diário se existir
        cursor.execute('''
            UPDATE planeamento_diario 
            SET origem_tipo = 'P', origem_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE origem_tipo = 'E' AND origem_id = ?
        ''', (pendente_id, pedido_id))
        
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'id': pendente_id})
    
    conn.close()
    return jsonify({'success': False, 'error': 'Pedido não encontrado'}), 404

@app.route('/api/pedidos-pendentes/<int:pedido_id>/antecipar', methods=['POST'])
def antecipar_pedido_pendente(pedido_id):
    """Antecipar pedido pendente para uma data anterior"""
    try:
        data = request.json
        data_original = data.get('data_original')
        data_nova = data.get('data_nova')
        
        if not data_original or not data_nova:
            return jsonify({'success': False, 'error': 'Datas original e nova são obrigatórias'}), 400
        
        if data_nova >= data_original:
            return jsonify({'success': False, 'error': 'A data nova deve ser anterior à data original'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar se o pedido existe
        cursor.execute('SELECT * FROM pedidos_pendentes WHERE id = ?', (pedido_id,))
        pedido = cursor.fetchone()
        if not pedido:
            conn.close()
            return jsonify({'success': False, 'error': 'Pedido não encontrado'}), 404
        
        # Verificar se a data_entrega atual corresponde à data_original
        if pedido['data_entrega'] != data_original:
            conn.close()
            return jsonify({'success': False, 'error': 'A data de entrega do pedido não corresponde à data original informada'}), 400
        
        # Atualizar data de entrega
        cursor.execute('''
            UPDATE pedidos_pendentes 
            SET data_entrega = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (data_nova, pedido_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True}), 200
    except Exception as e:
        import traceback
        print(f"Erro ao antecipar pedido: {e}")
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/pedidos-pendentes/<int:pedido_id>', methods=['PUT'])
def atualizar_pedido_pendente(pedido_id):
    """Atualizar dados de um pedido pendente (ou apenas prioridade se vier ?prioridade= no URL ou no body)."""
    try:
        # Tratar primeiro o caso "só prioridade" (menu contexto / destacar em vermelho)
        prioridade_qs = request.args.get('prioridade')
        if prioridade_qs is not None:
            valor = 1 if str(prioridade_qs).strip() in ('1', 'true', 'True') else 0
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE pedidos_pendentes 
                SET prioridade = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (valor, pedido_id))
            if cursor.rowcount == 0:
                conn.close()
                return jsonify({'success': False, 'error': 'Pedido não encontrado'}), 404
            conn.commit()
            conn.close()
            return jsonify({'success': True, 'prioridade': bool(valor)})

        data = request.json or {}
        if 'prioridade' in data:
            valor = 1 if data.get('prioridade') in (True, 1, '1', 'true') else 0
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE pedidos_pendentes 
                SET prioridade = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (valor, pedido_id))
            if cursor.rowcount == 0:
                conn.close()
                return jsonify({'success': False, 'error': 'Pedido não encontrado'}), 404
            conn.commit()
            conn.close()
            return jsonify({'success': True, 'prioridade': bool(valor)})

        cliente = (data.get('cliente') or '').strip()
        local_carga = data.get('local_carga', '').strip() or cliente  # Se não especificado, usar o cliente
        local_descarga = data.get('local_descarga', '').strip()
        material = data.get('material', '').strip()
        observacoes = data.get('observacoes', '').strip()
        data_entrega = data.get('data_entrega')
        prioridade = data.get('prioridade')
        valor_prioridade = 1 if prioridade else 0 if 'prioridade' in data else None

        if not cliente or not material:
            return jsonify({'success': False, 'error': 'Cliente e Material são obrigatórios'}), 400

        conn = get_db()
        cursor = conn.cursor()
        if valor_prioridade is not None:
            cursor.execute('''
                UPDATE pedidos_pendentes 
                SET cliente = ?, local_carga = ?, local_descarga = ?, material = ?, observacoes = ?, 
                    data_entrega = ?, prioridade = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (cliente, local_carga, local_descarga, material, observacoes, data_entrega, valor_prioridade, pedido_id))
        else:
            cursor.execute('''
                UPDATE pedidos_pendentes 
                SET cliente = ?, local_carga = ?, local_descarga = ?, material = ?, observacoes = ?, 
                    data_entrega = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (cliente, local_carga, local_descarga, material, observacoes, data_entrega, pedido_id))

        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'success': False, 'error': 'Pedido não encontrado'}), 404

        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        import traceback
        print(f"Erro ao atualizar pedido pendente: {e}")
        print(traceback.format_exc())
        if 'conn' in locals():
            try:
                conn.close()
            except:
                pass
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/pedidos-pendentes/<int:pedido_id>/data', methods=['PATCH'])
def atualizar_data_pedido_pendente(pedido_id):
    """Atualizar apenas a data de entrega de um pedido pendente"""
    try:
        data = request.json
        data_entrega = data.get('data_entrega')
        
        # Validar que a data não é anterior à data atual
        if data_entrega:
            try:
                data_op = datetime.strptime(data_entrega, '%Y-%m-%d').date()
                data_atual = date.today()
                
                if data_op < data_atual:
                    return jsonify({
                        'success': False, 
                        'error': 'Não é possível alterar a data para um dia que já passou. Por favor, selecione uma data atual ou futura.'
                    }), 400
            except (ValueError, TypeError):
                return jsonify({
                    'success': False, 
                    'error': 'Formato de data inválido. Use YYYY-MM-DD.'
                }), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE pedidos_pendentes 
            SET data_entrega = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (data_entrega, pedido_id))
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'success': False, 'error': 'Pedido não encontrado'}), 404
        
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        import traceback
        print(f"Erro ao atualizar data do pedido: {e}")
        print(traceback.format_exc())
        if 'conn' in locals():
            try:
                conn.close()
            except:
                pass
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/pedidos-pendentes/<int:pedido_id>/prioridade', methods=['PATCH', 'POST'])
def atualizar_prioridade_pedido_pendente(pedido_id):
    """Marcar ou remover prioridade de um pedido pendente (ID no path)."""
    try:
        data = request.json or {}
        prioridade = data.get('prioridade', True)
        valor = 1 if prioridade else 0
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE pedidos_pendentes 
            SET prioridade = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (valor, pedido_id))
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'success': False, 'error': 'Pedido não encontrado'}), 404
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'prioridade': bool(valor)})
    except Exception as e:
        if 'conn' in locals():
            try:
                conn.close()
            except:
                pass
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/pedidos-pendentes/<int:pedido_id>', methods=['DELETE'])
def apagar_pedido_pendente(pedido_id):
    """Apagar um pedido pendente"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar se o pedido existe
        cursor.execute('SELECT id FROM pedidos_pendentes WHERE id = ?', (pedido_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': 'Pedido não encontrado'}), 404
        
        # Verificar se há atribuições ativas
        cursor.execute('''
            SELECT COUNT(*) FROM encomenda_viatura 
            WHERE pedido_id = ? AND pedido_tipo = 'P'
        ''', (pedido_id,))
        count = cursor.fetchone()[0]
        
        if count > 0:
            conn.close()
            return jsonify({'success': False, 'error': 'Não é possível apagar. O pedido está atribuído a uma viatura.'}), 400
        
        # Apagar o pedido
        cursor.execute('DELETE FROM pedidos_pendentes WHERE id = ?', (pedido_id,))
        
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        import traceback
        print(f"Erro ao apagar pedido pendente: {e}")
        print(traceback.format_exc())
        if 'conn' in locals():
            try:
                conn.close()
            except:
                pass
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/atualizar-checkbox', methods=['POST'])
def atualizar_checkbox():
    """Atualizar estado do checkbox no planeamento"""
    data = request.json
    planeamento_id = data.get('id')
    marcado = data.get('marcado', False)
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE planeamento_diario 
        SET checkbox_marcado = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (1 if marcado else 0, planeamento_id))
    
    conn.commit()
    
    # Se marcado, mover para Entregues; se desmarcado, mover para Pendentes
    cursor.execute('SELECT * FROM planeamento_diario WHERE id = ?', (planeamento_id,))
    planeamento = cursor.fetchone()
    
    if planeamento:
        if marcado and planeamento['origem_tipo'] == 'P':
            mover_para_entregues_internal(cursor, conn, planeamento['origem_id'])
        elif not marcado and planeamento['origem_tipo'] == 'E':
            mover_para_pendentes_internal(cursor, conn, planeamento['origem_id'])
    
    conn.commit()
    conn.close()
    return jsonify({'success': True})

def mover_para_entregues_internal(cursor, conn, pedido_id):
    """Função interna para mover para entregues"""
    cursor.execute('SELECT * FROM pedidos_pendentes WHERE id = ?', (pedido_id,))
    pedido = cursor.fetchone()
    if pedido:
        cursor.execute('''
            INSERT INTO pedidos_entregues 
            (cliente, tipo_carga, material, data_entrega, local_carga, local_descarga)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            pedido['cliente'], pedido['tipo_carga'], pedido['material'],
            pedido['data_entrega'], pedido['local_carga'], pedido.get('local_descarga', '')
        ))
        cursor.execute('DELETE FROM pedidos_pendentes WHERE id = ?', (pedido_id,))

def mover_para_pendentes_internal(cursor, conn, pedido_id):
    """Função interna para mover para pendentes"""
    cursor.execute('SELECT * FROM pedidos_entregues WHERE id = ?', (pedido_id,))
    pedido = cursor.fetchone()
    if pedido:
        cursor.execute('''
            INSERT INTO pedidos_pendentes 
            (cliente, tipo_carga, material, data_entrega, local_carga, local_descarga)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            pedido['cliente'], pedido['tipo_carga'], pedido['material'],
            pedido['data_entrega'], pedido['local_carga'], pedido.get('local_descarga', '')
        ))
        cursor.execute('DELETE FROM pedidos_entregues WHERE id = ?', (pedido_id,))

@app.route('/api/atualizar-lista', methods=['POST'])
def atualizar_lista():
    """Atualizar lista do planeamento diário (equivalente à função AtualizarLista do VBA)"""
    try:
        data = request.json or {}
        data_planeamento = data.get('data', date.today().isoformat())
        
        conn = get_db()
        cursor = conn.cursor()
        
        # NOTA: NÃO limpar planeamento - manter histórico completo na base de dados
        # O planeamento será atualizado/sobrescrito mas mantém registos históricos
        # cursor.execute('DELETE FROM planeamento_diario WHERE data_planeamento = ?', (data_planeamento,))
        
        # Buscar pedidos pendentes e entregues para a data
        cursor.execute('''
            SELECT id, cliente, local_carga, material, data_entrega, 'P' as origem_tipo
            FROM pedidos_pendentes
            WHERE data_entrega = ?
            UNION ALL
            SELECT id, cliente, local_carga, material, data_entrega, 'E' as origem_tipo
            FROM pedidos_entregues
            WHERE data_entrega = ?
            ORDER BY cliente ASC
        ''', (data_planeamento, data_planeamento))
        
        pedidos = cursor.fetchall()
        
        # Inserir no planeamento diário
        linha = 6  # Começar na linha 6 (como no Excel)
        for pedido in pedidos:
            # Tratar valores None
            local_carga = pedido['local_carga'] or ''
            cliente = pedido['cliente'] or ''
            material = pedido['material'] or ''
            
            texto_encomenda = f"{cliente} / {local_carga} / {material}".strip(' /')
            if not texto_encomenda:
                texto_encomenda = f"Encomenda {pedido['id']}"
            
            cursor.execute('''
                INSERT INTO planeamento_diario 
                (data_planeamento, encomenda_texto, cliente, material, origem_tipo, origem_id, linha_listbox)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                data_planeamento,
                texto_encomenda,
                cliente,
                material,
                pedido['origem_tipo'],
                pedido['id'],
                linha
            ))
            linha += 1
        
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'count': len(pedidos)})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/adicionar-pedido', methods=['POST'])
def adicionar_pedido():
    """Adicionar novo pedido"""
    data = request.json
    tipo = data.get('tipo', 'pendente')  # 'pendente' ou 'entregue'
    
    conn = get_db()
    cursor = conn.cursor()
    
    tabela = 'pedidos_pendentes' if tipo == 'pendente' else 'pedidos_entregues'
    cursor.execute(f'''
        INSERT INTO {tabela} 
        (cliente, tipo_carga, material, data_entrega, local_carga, observacoes)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (
        data.get('cliente', ''),
        data.get('tipo_carga', ''),
        data.get('material', ''),
        data.get('data_entrega', date.today().isoformat()),
        data.get('local_carga', ''),
        data.get('observacoes', '')
    ))
    
    conn.commit()
    pedido_id = cursor.lastrowid
    conn.close()
    
    return jsonify({'success': True, 'id': pedido_id})

@app.route('/api/adicionar-pendente', methods=['POST'])
def adicionar_pendente():
    """Adicionar novo pedido pendente"""
    try:
        data = request.json
        
        if not data:
            return jsonify({'success': False, 'error': 'Dados não fornecidos'}), 400
        
        # Validar campos obrigatórios (aceitar snake_case e camelCase do frontend)
        cliente = (data.get('cliente') or '').strip()
        local_descarga = (data.get('local_descarga') or data.get('localDescarga') or '').strip()
        material = (data.get('material') or '').strip()
        
        if not cliente:
            return jsonify({'success': False, 'error': 'Cliente é obrigatório'}), 400
        if not local_descarga:
            return jsonify({'success': False, 'error': 'Local de Descarga é obrigatório'}), 400
        if not material:
            return jsonify({'success': False, 'error': 'Material é obrigatório'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Validar que cliente e local de descarga existem na base de dados (COALESCE para aceitar ativo NULL em registos antigos)
        cursor.execute('''
            SELECT id FROM clientes_locais 
            WHERE TRIM(cliente) = TRIM(?) AND TRIM(local_descarga) = TRIM(?) AND COALESCE(ativo, 1) = 1
        ''', (cliente, local_descarga))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': f'Cliente "{cliente}" com local de descarga "{local_descarga}" não existe na base de dados. Adicione primeiro no menu Base de Dados de Clientes.'}), 400
        
        # Validar que material existe na base de dados
        cursor.execute('SELECT id FROM materiais WHERE TRIM(nome) = TRIM(?) AND COALESCE(ativo, 1) = 1', (material,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': f'Material "{material}" não existe na base de dados. Adicione primeiro na Base de Dados de Materiais.'}), 400

        quantidade = int(data.get('quantidade', 1) or 1)
        if quantidade < 1:
            quantidade = 1
        
        local_carga = (data.get('local_carga') or data.get('localCarga') or '').strip() or cliente  # Se não especificado, usar o cliente
        
        data_entrega_val = data.get('data_entrega') or date.today().isoformat()
        observacoes_val = (data.get('observacoes') or '').strip()
        ultimo_id = None
        criados = []
        for _ in range(quantidade):
            cursor.execute('''
                INSERT INTO pedidos_pendentes 
                (cliente, tipo_carga, material, data_entrega, local_carga, local_descarga, observacoes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                cliente,
                None,  # tipo_carga não é mais usado
                material,
                data_entrega_val,
                local_carga,
                local_descarga,
                observacoes_val
            ))
            ultimo_id = cursor.lastrowid
            criados.append({
                'id': ultimo_id,
                'cliente': cliente,
                'local_carga': local_carga,
                'local_descarga': local_descarga,
                'material': material,
                'data_entrega': data_entrega_val,
                'observacoes': observacoes_val,
                'prioridade': 0
            })
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'id': ultimo_id, 'quantidade': quantidade, 'criados': criados})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/adicionar-entregue', methods=['POST'])
def adicionar_entregue():
    """Adicionar novo pedido entregue"""
    try:
        data = request.json
        
        if not data:
            return jsonify({'success': False, 'error': 'Dados não fornecidos'}), 400
        
        # Validar campos obrigatórios
        cliente = data.get('cliente', '').strip()
        local_descarga = data.get('local_descarga', '').strip()
        material = data.get('material', '').strip()
        
        if not cliente:
            return jsonify({'success': False, 'error': 'Cliente é obrigatório'}), 400
        if not local_descarga:
            return jsonify({'success': False, 'error': 'Local de Descarga é obrigatório'}), 400
        if not material:
            return jsonify({'success': False, 'error': 'Material é obrigatório'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Validar que cliente e local de descarga existem na base de dados (COALESCE para aceitar ativo NULL)
        cursor.execute('''
            SELECT id FROM clientes_locais 
            WHERE TRIM(cliente) = TRIM(?) AND TRIM(local_descarga) = TRIM(?) AND COALESCE(ativo, 1) = 1
        ''', (cliente, local_descarga))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': f'Cliente "{cliente}" com local de descarga "{local_descarga}" não existe na base de dados. Adicione primeiro no menu Base de Dados de Clientes.'}), 400
        
        # Validar que material existe na base de dados
        cursor.execute('SELECT id FROM materiais WHERE TRIM(nome) = TRIM(?) AND COALESCE(ativo, 1) = 1', (material,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': f'Material "{material}" não existe na base de dados. Adicione primeiro na Base de Dados de Materiais.'}), 400

        quantidade = int(data.get('quantidade', 1) or 1)
        if quantidade < 1:
            quantidade = 1
        
        ultimo_id = None
        for _ in range(quantidade):
            cursor.execute('''
                INSERT INTO pedidos_entregues 
                (cliente, tipo_carga, material, data_entrega, local_carga, local_descarga, observacoes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                cliente,
                None,  # tipo_carga não é mais usado
                material,
                data.get('data_entrega') or date.today().isoformat(),
                local_descarga,  # local_carga mantido por compatibilidade
                local_descarga,
                data.get('observacoes', '').strip()
            ))
            ultimo_id = cursor.lastrowid
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'id': ultimo_id, 'quantidade': quantidade})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/atualizar-planeamento', methods=['POST'])
def atualizar_planeamento():
    """Atualizar campo do planeamento"""
    data = request.json
    planeamento_id = data.get('id')
    field = data.get('field')
    value = data.get('value')
    
    if field not in ['encomenda_texto', 'cliente', 'material']:
        return jsonify({'success': False, 'error': 'Campo inválido'}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute(f'''
        UPDATE planeamento_diario 
        SET {field} = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (value, planeamento_id))
    
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})

@app.route('/api/atualizar-pendente', methods=['POST'])
def atualizar_pendente():
    """Atualizar campo de pedido pendente"""
    try:
        data = request.json
        if not data:
            return jsonify({'success': False, 'error': 'Dados não fornecidos'}), 400
        
        pedido_id = data.get('id')
        field = data.get('field')
        value = data.get('value')
        codigo_autorizacao = data.get('codigo_autorizacao')
        
        if not pedido_id or not field:
            return jsonify({'success': False, 'error': 'ID do pedido e campo são obrigatórios'}), 400
        
        if field not in ['cliente', 'tipo_carga', 'material', 'data_entrega', 'local_carga', 'observacoes']:
            return jsonify({'success': False, 'error': 'Campo inválido'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Buscar valor antigo antes de atualizar (para histórico, especialmente para data_entrega)
        cursor.execute('SELECT * FROM pedidos_pendentes WHERE id = ?', (pedido_id,))
        pedido_antigo = cursor.fetchone()
        
        if pedido_antigo:
            # Converter Row para dicionário
            pedido_antigo_dict = dict(pedido_antigo)
            
            # Verificar se a data de entrega é anterior à atual
            data_entrega = pedido_antigo_dict.get('data_entrega')
            permitido, msg_erro = verificar_data_anterior_e_codigo(data_entrega, codigo_autorizacao)
            if not permitido:
                conn.close()
                return jsonify({'success': False, 'error': msg_erro}), 403
            
            valor_antigo = pedido_antigo_dict.get(field, '')
            
            cursor.execute(f'''
                UPDATE pedidos_pendentes 
                SET {field} = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (value, pedido_id))
            
            # Registar ação no histórico se for alteração de data
            if field == 'data_entrega':
                cursor.execute('''
                    INSERT INTO historico_acoes (tipo_acao, descricao, dados_acao)
                    VALUES (?, ?, ?)
                ''', (
                    'ALTERAR_DATA_PEDIDO',
                    f'Alterar data de entrega: {pedido_antigo_dict.get("cliente", "")} - {valor_antigo} → {value}',
                    json.dumps({
                        'pedido_id': pedido_id,
                        'tipo': 'pendente',
                        'cliente': pedido_antigo_dict.get('cliente', ''),
                        'local_carga': pedido_antigo_dict.get('local_carga', ''),
                        'material': pedido_antigo_dict.get('material', ''),
                        'data_antiga': valor_antigo,
                        'data_nova': value
                    })
                ))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True})
    except Exception as e:
        import traceback
        print(f"Erro ao atualizar pendente: {e}")
        print(traceback.format_exc())
        if 'conn' in locals():
            conn.close()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/atualizar-entregue', methods=['POST'])
def atualizar_entregue():
    """Atualizar campo de pedido entregue"""
    try:
        data = request.json
        if not data:
            return jsonify({'success': False, 'error': 'Dados não fornecidos'}), 400
        
        pedido_id = data.get('id')
        field = data.get('field')
        value = data.get('value')
        codigo_autorizacao = data.get('codigo_autorizacao')
        
        if not pedido_id or not field:
            return jsonify({'success': False, 'error': 'ID do pedido e campo são obrigatórios'}), 400
        
        if field not in ['cliente', 'material', 'data_entrega', 'local_carga', 'observacoes']:
            return jsonify({'success': False, 'error': 'Campo inválido'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Buscar valor antigo antes de atualizar (para histórico, especialmente para data_entrega)
        cursor.execute('SELECT * FROM pedidos_entregues WHERE id = ?', (pedido_id,))
        pedido_antigo = cursor.fetchone()
        
        if pedido_antigo:
            # Converter Row para dicionário
            pedido_antigo_dict = dict(pedido_antigo)
            
            # Verificar se a data de entrega é anterior à atual
            data_entrega = pedido_antigo_dict.get('data_entrega')
            permitido, msg_erro = verificar_data_anterior_e_codigo(data_entrega, codigo_autorizacao)
            if not permitido:
                conn.close()
                return jsonify({'success': False, 'error': msg_erro}), 403
            
            valor_antigo = pedido_antigo_dict.get(field, '')
            
            cursor.execute(f'''
                UPDATE pedidos_entregues 
                SET {field} = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (value, pedido_id))
            
            # Registar ação no histórico se for alteração de data
            if field == 'data_entrega':
                cursor.execute('''
                    INSERT INTO historico_acoes (tipo_acao, descricao, dados_acao)
                    VALUES (?, ?, ?)
                ''', (
                    'ALTERAR_DATA_PEDIDO',
                    f'Alterar data de entrega: {pedido_antigo_dict.get("cliente", "")} - {valor_antigo} → {value}',
                    json.dumps({
                        'pedido_id': pedido_id,
                        'tipo': 'entregue',
                        'cliente': pedido_antigo_dict.get('cliente', ''),
                        'local_carga': pedido_antigo_dict.get('local_carga', ''),
                        'material': pedido_antigo_dict.get('material', ''),
                        'data_antiga': valor_antigo,
                        'data_nova': value
                    })
                ))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True})
    except Exception as e:
        import traceback
        print(f"Erro ao atualizar entregue: {e}")
        print(traceback.format_exc())
        if 'conn' in locals():
            conn.close()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/remover-pedido', methods=['POST'])
def remover_pedido():
    """Remover pedido"""
    data = request.json
    pedido_id = data.get('id')
    tipo = data.get('tipo', 'pendente')
    codigo_autorizacao = data.get('codigo_autorizacao')
    
    conn = get_db()
    cursor = conn.cursor()
    
    tabela = 'pedidos_pendentes' if tipo == 'pendente' else 'pedidos_entregues'
    
    # Buscar dados do pedido antes de remover (para histórico)
    cursor.execute(f'SELECT * FROM {tabela} WHERE id = ?', (pedido_id,))
    pedido = cursor.fetchone()
    
    if pedido:
        # Verificar se a data de entrega é anterior à atual
        data_entrega = pedido['data_entrega'] if pedido else None
        permitido, msg_erro = verificar_data_anterior_e_codigo(data_entrega, codigo_autorizacao)
        if not permitido:
            conn.close()
            return jsonify({'success': False, 'error': msg_erro}), 403
    
    if pedido:
        # Buscar atribuições de encomendas relacionadas
        origem_tipo = 'P' if tipo == 'pendente' else 'E'
        cursor.execute('''
            SELECT ev.*, vm.nome_motorista, vm.matricula
            FROM encomenda_viatura ev
            LEFT JOIN viatura_motorista vm ON ev.viatura_motorista_id = vm.id
            WHERE ev.pedido_id = ? AND ev.pedido_tipo = ?
        ''', (pedido_id, origem_tipo))
        atribuicoes = cursor.fetchall()
        
        # NOTA: Manter histórico - marcar como removido em vez de apagar
        # Remover do planeamento se existir (apenas para esta data específica)
        # Manter histórico: não apagar, apenas marcar como removido se necessário
        cursor.execute('''
            DELETE FROM planeamento_diario 
            WHERE origem_tipo = ? AND origem_id = ?
        ''', (origem_tipo, pedido_id))
        
        # Remover atribuições (ação explícita do utilizador - OK apagar)
        cursor.execute('''
            DELETE FROM encomenda_viatura
            WHERE pedido_id = ? AND pedido_tipo = ?
        ''', (pedido_id, origem_tipo))
        
        # Remover pedido (ação explícita do utilizador - OK apagar)
        # NOTA: Se quiseres manter histórico completo, podes adicionar uma coluna "removido" em vez de apagar
        cursor.execute(f'DELETE FROM {tabela} WHERE id = ?', (pedido_id,))
        
        # Registar ação no histórico
        cursor.execute('''
            INSERT INTO historico_acoes (tipo_acao, descricao, dados_acao)
            VALUES (?, ?, ?)
        ''', (
            'REMOVER_PEDIDO',
            f'Remover pedido {tipo}: {pedido["cliente"]} - {pedido.get("local_carga", "")} - {pedido.get("material", "")}',
            json.dumps({
                'pedido_id': pedido_id,
                'tipo': tipo,
                'cliente': pedido['cliente'],
                'local_carga': pedido.get('local_carga', ''),
                'material': pedido.get('material', ''),
                'data_entrega': pedido.get('data_entrega', ''),
                'observacoes': pedido.get('observacoes', ''),
                'atribuicoes': [{'viatura_motorista_id': a[3], 'data_associacao': a[4], 'nome_motorista': a[6], 'matricula': a[7]} for a in atribuicoes] if atribuicoes else []
            })
        ))
    
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})

# ==================== ROTAS DE VIATURA-MOTORISTA ====================

@app.route('/api/viatura-motorista', methods=['GET'])
def get_viatura_motorista():
    """Obter todas as viaturas e motoristas com status do dia"""
    data_str = request.args.get('data', date.today().isoformat())
    buscar_todos = request.args.get('buscar_todos') == '1'
    conn = get_db()
    cursor = conn.cursor()
    
    if buscar_todos:
        # Modo especial (usado na troca de conjunto com matrícula manual):
        # devolver TODOS os cards ativos, incluindo temporários, independentemente
        # de terem encomendas nesse dia.
        # Para buscar_todos, também considerar data_desativacao se fornecida
        data_str_buscar = request.args.get('data', date.today().isoformat())
        cursor.execute('''
            SELECT vm.*, NULL as encomendas_ids
            FROM viatura_motorista vm
            WHERE vm.ativo = 1
            AND (vm.data_desativacao IS NULL OR vm.data_desativacao > ?)
            ORDER BY 
                COALESCE(vm.ordem, 999999),
                CASE 
                    WHEN vm.matricula GLOB '[0-9]*' THEN 1
                    ELSE 2
                END,
                CAST(SUBSTR(vm.matricula, 1, 2) AS INTEGER),
                vm.matricula ASC
        ''', (data_str_buscar,))
    else:
        cursor.execute('''
            SELECT vm.*, 
                   GROUP_CONCAT(ev.pedido_id || '|' || ev.pedido_tipo, ',') as encomendas_ids
            FROM viatura_motorista vm
            LEFT JOIN encomenda_viatura ev ON vm.id = ev.viatura_motorista_id AND ev.data_associacao = ?
            WHERE (
                -- Cards ativos: mostrar normalmente (sem data_desativacao ou data_desativacao no futuro)
                (vm.ativo = 1 AND (vm.data_desativacao IS NULL OR vm.data_desativacao > ?))
                OR
                -- Cards inativos: mostrar APENAS se a data consultada for ANTERIOR à data_desativacao
                -- (ou seja, mostrar histórico passado, mas NÃO mostrar na data atual ou futuras)
                -- IMPORTANTE: usar < (menor que) para que cards apagados na data atual NÃO apareçam na data atual
                (vm.ativo = 0 AND vm.data_desativacao IS NOT NULL AND ? < vm.data_desativacao)
            )
            AND (
                -- Cards só aparecem a partir da data de criação
                (DATE(vm.created_at) <= ?)
            )
            AND (
                -- Cards permanentes: sempre aparecem (mesmo sem encomendas)
                (vm.temporario = 0 OR vm.temporario IS NULL)
                OR
                -- Cards temporários: aparecem se forem para esta data (mesmo sem encomendas)
                (vm.temporario = 1 AND vm.data_temporaria = ?)
                OR
                -- Cards com matrícula temporária para esta data: sempre aparecem (mesmo sem encomendas)
                EXISTS (
                    SELECT 1 FROM matricula_temporaria mt
                    WHERE mt.viatura_motorista_id = vm.id 
                    AND mt.data_associacao = ?
                )
            )
            GROUP BY vm.id
            ORDER BY 
                COALESCE(vm.ordem, 999999),
                CASE 
                    WHEN vm.matricula GLOB '[0-9]*' THEN 1
                    ELSE 2
                END,
                CAST(SUBSTR(vm.matricula, 1, 2) AS INTEGER),
                vm.matricula ASC
        ''', (data_str, data_str, data_str, data_str, data_str, data_str))
    
    viaturas = []
    for row in cursor.fetchall():
        vm = dict(row)
        
        # Buscar status do dia específico (verificar se está em período de férias)
        cursor.execute('''
            SELECT status, observacao_status, data_inicio, data_fim
            FROM viatura_motorista_status
            WHERE viatura_motorista_id = ?
            AND (
                (data_status = ?) OR
(status IN ('Ferias', 'Baixa', 'OutrosTrabalhos') AND data_inicio IS NOT NULL AND data_fim IS NOT NULL 
                                    AND ? >= data_inicio AND ? <= data_fim)
            )
            ORDER BY 
                CASE WHEN data_status = ? THEN 0 ELSE 1 END,
                created_at DESC
            LIMIT 1
        ''', (vm['id'], data_str, data_str, data_str, data_str))
        
        status_row = cursor.fetchone()
        if status_row:
            status_value = status_row[0] if status_row[0] else 'Normal'
            # Se o status for "EXCLUIDO_DIA", não incluir este card na lista
            if status_value == 'EXCLUIDO_DIA':
                continue
            vm['status'] = status_value
            vm['observacao_status'] = status_row[1]
            vm['data_inicio'] = status_row[2]
            vm['data_fim'] = status_row[3]
        else:
            # Se não houver status para este dia, usar "Normal"
            vm['status'] = 'Normal'
            vm['observacao_status'] = None
            vm['data_inicio'] = None
            vm['data_fim'] = None
        
        # Verificar se há matrícula/código temporários para este dia
        cursor.execute('''
            SELECT matricula_temporaria, codigo_temporaria
            FROM matricula_temporaria
            WHERE viatura_motorista_id = ? AND data_associacao = ?
        ''', (vm['id'], data_str))
        
        matricula_temp_row = cursor.fetchone()
        if matricula_temp_row:
            temp_matricula = matricula_temp_row[0] or ''
            temp_codigo   = matricula_temp_row[1]

            # Caso antigo: alguns registos guardaram "MATRICULA + CODIGO" tudo na matrícula
            # Neste caso, separar e usar a segunda parte como código
            if ('+' in temp_matricula):
                partes = temp_matricula.split('+', 1)
                base_mat = partes[0].strip()
                base_cod = partes[1].strip() if len(partes) > 1 else ''
                if base_mat:
                    vm['matricula'] = base_mat
                # Se há código na matrícula temporária, usar esse (ignorar codigo_temporaria se existir)
                if base_cod:
                    vm['codigo'] = base_cod
                elif temp_codigo:
                    # Se não há código na matrícula mas há em codigo_temporaria, usar esse
                    vm['codigo'] = temp_codigo
                # Se não há código em nenhum lado, manter o código original do card (não fazer nada)
            else:
                # Cenário novo: campos separados (matrícula não contém "+")
                if temp_matricula:
                    vm['matricula'] = temp_matricula
                # IMPORTANTE: Se há código temporário, usar APENAS esse (substituir o original)
                # Se não há código temporário, manter o código original do card
                if temp_codigo:
                    vm['codigo'] = temp_codigo
                # Se temp_codigo é None/vazio, manter o código original (não fazer nada)
        
        # Buscar matrícula temporária detalhada (trator + galera) para este dia
        cursor.execute('''
            SELECT matricula_trator, matricula_galera
            FROM matricula_temporaria_detalhada
            WHERE viatura_motorista_id = ? AND data_associacao = ?
        ''', (vm['id'], data_str))
        
        matricula_detalhada_row = cursor.fetchone()
        if matricula_detalhada_row:
            vm['matricula_trator_temp'] = matricula_detalhada_row[0]
            vm['matricula_galera_temp'] = matricula_detalhada_row[1]
        
        # Buscar observação temporária para este dia
        cursor.execute('''
            SELECT observacao
            FROM observacao_temporaria
            WHERE viatura_motorista_id = ? AND data_associacao = ?
        ''', (vm['id'], data_str))
        
        obs_temp_row = cursor.fetchone()
        if obs_temp_row:
            vm['observacao_temporaria'] = obs_temp_row[0]
        
        # Buscar encomendas associadas com campos separados (ordenadas por ordem)
        cursor.execute('''
            SELECT ev.*, 
                   pp.cliente,
                   pp.local_carga,
                   pp.material,
                   pp.observacoes,
                   CASE 
                       WHEN ev.pedido_tipo = 'P' THEN COALESCE(pp.local_carga, '') || ' | ' || pp.cliente || ' | ' || COALESCE(pp.material, '')
                       ELSE ''
                   END as descricao
            FROM encomenda_viatura ev
            LEFT JOIN pedidos_pendentes pp ON ev.pedido_tipo = 'P' AND ev.pedido_id = pp.id
            WHERE ev.viatura_motorista_id = ? AND ev.data_associacao = ?
            ORDER BY COALESCE(ev.ordem, 999999), ev.id ASC
        ''', (vm['id'], data_str))
        
        encomendas = [dict(e) for e in cursor.fetchall()]
        vm['encomendas'] = encomendas
        viaturas.append(vm)
    
    conn.close()
    return jsonify(viaturas)

@app.route('/api/viatura-motorista', methods=['POST'])
def adicionar_viatura_motorista():
    """Adicionar nova viatura/motorista (verifica duplicados por matrícula)"""
    data = request.json
    matricula = data.get('matricula', '').strip().upper()
    codigo = data.get('codigo', '').strip()
    nome_motorista = data.get('nome_motorista', '').strip()
    
    if not matricula:
        return jsonify({'success': False, 'error': 'Matrícula é obrigatória'}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Verificar se é uma criação temporária (vem com data_temporaria)
    data_temporaria = data.get('data_temporaria')
    is_temporario = data.get('temporario', False) or bool(data_temporaria)
    
    # Verificar se já existe viatura com esta matrícula (ativa e não temporária)
    if not is_temporario:
        cursor.execute('''
            SELECT id FROM viatura_motorista 
            WHERE UPPER(TRIM(matricula)) = ? AND ativo = 1 AND (temporario = 0 OR temporario IS NULL)
        ''', (matricula,))
        
        viatura_existente = cursor.fetchone()
        if viatura_existente:
            conn.close()
            return jsonify({
                'success': True, 
                'id': viatura_existente[0],
                'existed': True,
                'message': 'Viatura já existe, usando a existente'
            })
    
    # Se for temporária, verificar se já existe para aquela data específica
    if is_temporario and data_temporaria:
        cursor.execute('''
            SELECT id FROM viatura_motorista 
            WHERE UPPER(TRIM(matricula)) = ? AND ativo = 1 AND temporario = 1 AND data_temporaria = ?
        ''', (matricula, data_temporaria))
        
        viatura_temporaria_existente = cursor.fetchone()
        if viatura_temporaria_existente:
            conn.close()
            return jsonify({
                'success': True, 
                'id': viatura_temporaria_existente[0],
                'existed': True,
                'message': 'Viatura temporária já existe para esta data'
            })
    
    # Criar nova viatura/motorista
    cursor.execute('''
        INSERT INTO viatura_motorista (matricula, codigo, nome_motorista, temporario, data_temporaria)
        VALUES (?, ?, ?, ?, ?)
    ''', (matricula, codigo, nome_motorista, 1 if is_temporario else 0, data_temporaria if is_temporario else None))
    
    conn.commit()
    vm_id = cursor.lastrowid
    conn.close()
    return jsonify({'success': True, 'id': vm_id, 'existed': False})

@app.route('/api/viatura-motorista/<int:vm_id>', methods=['DELETE'])
def apagar_viatura_motorista_permanente(vm_id):
    """Apagar viatura/motorista permanentemente a partir da data atual (mantém histórico anterior)"""
    try:
        data = request.json or {}
        codigo_autorizacao = data.get('codigo_autorizacao')
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar se o motorista existe
        cursor.execute('SELECT id, matricula, nome_motorista FROM viatura_motorista WHERE id = ?', (vm_id,))
        motorista = cursor.fetchone()
        
        if not motorista:
            conn.close()
            return jsonify({'success': False, 'error': 'Motorista não encontrado'}), 404
        
        data_atual = date.today().isoformat()
        
        # IMPORTANTE: Buscar TODOS os dados ANTES de remover qualquer coisa
        
        # Buscar dados completos do card ANTES de apagar para poder reverter
        cursor.execute('''
            SELECT matricula, codigo, nome_motorista, ordem, temporario, data_temporaria
            FROM viatura_motorista
            WHERE id = ?
        ''', (vm_id,))
        dados_card = cursor.fetchone()
        
        if not dados_card:
            conn.close()
            return jsonify({'success': False, 'error': 'Dados do card não encontrados'}), 404
        
        # Buscar encomendas atribuídas para data atual e futuras (>= data_atual) para histórico
        # IMPORTANTE: Guardar dados da data atual e futuras antes de apagar
        cursor.execute('''
            SELECT ev.pedido_id, ev.pedido_tipo, ev.data_associacao, ev.ordem,
                   pp.cliente, pp.local_carga, pp.material, pp.observacoes
            FROM encomenda_viatura ev
            LEFT JOIN pedidos_pendentes pp ON ev.pedido_tipo = 'P' AND ev.pedido_id = pp.id
            WHERE ev.viatura_motorista_id = ? AND ev.data_associacao >= ?
        ''', (vm_id, data_atual))
        encomendas_futuras = cursor.fetchall()
        
        # Guardar dados das encomendas futuras para histórico
        encomendas_dados = []
        for e in encomendas_futuras:
            encomenda_info = {
                'pedido_id': e[0],
                'pedido_tipo': e[1],
                'data_associacao': e[2],
                'ordem': e[3]
            }
            if e[4]:  # cliente
                encomenda_info['cliente'] = e[4]
            if e[5]:  # local_carga
                encomenda_info['local_carga'] = e[5]
            if e[6]:  # material
                encomenda_info['material'] = e[6]
            if e[7]:  # observacoes
                encomenda_info['observacoes'] = e[7]
            encomendas_dados.append(encomenda_info)
        
        # Buscar status da data atual e futuros ANTES de remover (>= data_atual)
        cursor.execute('''
            SELECT status, observacao_status, data_status, data_inicio, data_fim
            FROM viatura_motorista_status
            WHERE viatura_motorista_id = ? 
            AND (data_status >= ? OR (data_inicio IS NOT NULL AND data_inicio >= ?))
        ''', (vm_id, data_atual, data_atual))
        status_futuros = cursor.fetchall()
        
        status_dados = []
        for s in status_futuros:
            status_dados.append({
                'status': s[0],
                'observacao_status': s[1],
                'data_status': s[2],
                'data_inicio': s[3],
                'data_fim': s[4]
            })
        
        # Buscar matrículas temporárias da data atual e futuras ANTES de remover (>= data_atual)
        cursor.execute('''
            SELECT matricula_temporaria, codigo_temporaria, data_associacao
            FROM matricula_temporaria
            WHERE viatura_motorista_id = ? AND data_associacao >= ?
        ''', (vm_id, data_atual))
        matriculas_temp = cursor.fetchall()
        
        matriculas_dados = []
        for m in matriculas_temp:
            matriculas_dados.append({
                'matricula_temporaria': m[0],
                'codigo_temporaria': m[1],
                'data_associacao': m[2]
            })
        
        # Buscar matrículas temporárias detalhadas da data atual e futuras ANTES de remover (>= data_atual)
        cursor.execute('''
            SELECT matricula_trator, matricula_galera, data_associacao
            FROM matricula_temporaria_detalhada
            WHERE viatura_motorista_id = ? AND data_associacao >= ?
        ''', (vm_id, data_atual))
        matriculas_detalhadas = cursor.fetchall()
        
        matriculas_detalhadas_dados = []
        for m in matriculas_detalhadas:
            matriculas_detalhadas_dados.append({
                'matricula_trator': m[0],
                'matricula_galera': m[1],
                'data_associacao': m[2]
            })
        
        # Buscar observações temporárias da data atual e futuras ANTES de remover (>= data_atual)
        cursor.execute('''
            SELECT observacao, data_associacao
            FROM observacao_temporaria
            WHERE viatura_motorista_id = ? AND data_associacao >= ?
        ''', (vm_id, data_atual))
        observacoes_temp = cursor.fetchall()
        
        observacoes_dados = []
        for o in observacoes_temp:
            observacoes_dados.append({
                'observacao': o[0],
                'data_associacao': o[1]
            })
        
        # AGORA remover os dados (após ter guardado tudo)
        # IMPORTANTE: Remover encomendas da data ATUAL e datas FUTURAS (>= data_atual)
        # As encomendas de datas ANTERIORES são mantidas para histórico
        cursor.execute('''
            DELETE FROM encomenda_viatura 
            WHERE viatura_motorista_id = ? AND data_associacao >= ?
        ''', (vm_id, data_atual))
        count_encomendas_removidas = cursor.rowcount
        
        # Remover status da data ATUAL e futuros do motorista (mantém histórico de status anteriores)
        # Remover status com data_status >= data_atual ou data_inicio >= data_atual
        cursor.execute('''
            DELETE FROM viatura_motorista_status 
            WHERE viatura_motorista_id = ? 
            AND (data_status >= ? OR (data_inicio IS NOT NULL AND data_inicio >= ?))
        ''', (vm_id, data_atual, data_atual))
        
        # Remover matrículas temporárias da data ATUAL e futuras (>= data_atual)
        cursor.execute('''
            DELETE FROM matricula_temporaria 
            WHERE viatura_motorista_id = ? AND data_associacao >= ?
        ''', (vm_id, data_atual))
        
        # Remover matrículas temporárias detalhadas da data ATUAL e futuras (>= data_atual)
        cursor.execute('''
            DELETE FROM matricula_temporaria_detalhada 
            WHERE viatura_motorista_id = ? AND data_associacao >= ?
        ''', (vm_id, data_atual))
        
        # Remover observações temporárias da data ATUAL e futuras (>= data_atual)
        cursor.execute('''
            DELETE FROM observacao_temporaria 
            WHERE viatura_motorista_id = ? AND data_associacao >= ?
        ''', (vm_id, data_atual))
        
        # IMPORTANTE: NÃO apagar o card da tabela viatura_motorista!
        # Em vez disso, marcá-lo como inativo e definir data_desativacao
        # Isso mantém o histórico anterior intacto (encomendas, status, etc. de datas anteriores)
        # IMPORTANTE: data_desativacao deve ser a data de HOJE, para que cards apareçam em datas PASSADAS
        # mas NÃO apareçam em datas FUTURAS (incluindo hoje em diante)
        print(f"DEBUG - Apagar permanente: marcando card {vm_id} como inativo com data_desativacao = {data_atual}")
        cursor.execute('''
            UPDATE viatura_motorista 
            SET ativo = 0, data_desativacao = ?
            WHERE id = ?
        ''', (data_atual, vm_id))
        
        # Registar ação no histórico com TODOS os dados necessários para reverter
        cursor.execute('''
            INSERT INTO historico_acoes (tipo_acao, descricao, dados_acao)
            VALUES (?, ?, ?)
        ''', (
            'APAGAR_CARD_PERMANENTE',
            f'Apagar card permanentemente a partir de {data_atual}: {motorista[2]} ({motorista[1]})',
            json.dumps({
                'viatura_motorista_id': vm_id,
                'data_apagamento': data_atual,
                'matricula': dados_card[0] if dados_card[0] is not None else '',
                'codigo': dados_card[1] if dados_card[1] is not None else '',
                'nome_motorista': dados_card[2] if dados_card[2] is not None else '',
                'ordem': dados_card[3],
                'temporario': dados_card[4] if dados_card[4] is not None else 0,
                'data_temporaria': dados_card[5],
                'encomendas_removidas': encomendas_dados,
                'encomendas_removidas_count': count_encomendas_removidas,
                'status_removidos': status_dados,
                'matriculas_temp_removidas': matriculas_dados,
                'matriculas_detalhadas_removidas': matriculas_detalhadas_dados,
                'observacoes_temp_removidas': observacoes_dados
            })
        ))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': f'Card apagado permanentemente a partir de {data_atual}. Histórico anterior mantido.',
            'encomendas_removidas': count_encomendas_removidas,
            'data_apagamento': data_atual
        })
    except Exception as e:
        import traceback
        print(f"Erro ao apagar card permanentemente: {e}")
        print(traceback.format_exc())
        if 'conn' in locals():
            try:
                conn.close()
            except:
                pass
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/viatura-motorista/<int:vm_id>/matricula', methods=['PUT'])
def alterar_matricula_viatura(vm_id):
    """Alterar matrícula de uma viatura/motorista (temporariamente para o dia)"""
    try:
        data = request.json
        matricula_trator = data.get('matricula_trator', '').strip().upper()
        matricula_galera = data.get('matricula_galera', '').strip().upper()
        data_associacao = data.get('data_associacao', date.today().isoformat())
        
        if not matricula_trator and not matricula_galera:
            return jsonify({'success': False, 'error': 'Pelo menos uma matrícula (trator ou galera) é obrigatória'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar se o motorista existe
        cursor.execute('SELECT id, matricula, nome_motorista FROM viatura_motorista WHERE id = ?', (vm_id,))
        motorista = cursor.fetchone()
        
        if not motorista:
            conn.close()
            return jsonify({'success': False, 'error': 'Motorista não encontrado'}), 404
        
        matricula_original = motorista[1]
        
        # Guardar matrículas temporárias para o dia (substitui se já existir)
        cursor.execute('''
            INSERT OR REPLACE INTO matricula_temporaria_detalhada 
            (viatura_motorista_id, data_associacao, matricula_trator, matricula_galera)
            VALUES (?, ?, ?, ?)
        ''', (vm_id, data_associacao, matricula_trator if matricula_trator else None, matricula_galera if matricula_galera else None))
        
        # Construir descrição da alteração
        descricao_matriculas = []
        if matricula_trator:
            descricao_matriculas.append(f"Trator: {matricula_trator}")
        if matricula_galera:
            descricao_matriculas.append(f"Galera: {matricula_galera}")
        descricao_completa = " + ".join(descricao_matriculas) if descricao_matriculas else "Nenhuma"
        
        # Registar ação no histórico
        cursor.execute('''
            INSERT INTO historico_acoes (tipo_acao, descricao, dados_acao)
            VALUES (?, ?, ?)
        ''', (
            'ALTERAR_MATRICULA',
            f'Alterar matrícula (dia {data_associacao}): {motorista[2]} - {descricao_completa}',
            json.dumps({
                'viatura_motorista_id': vm_id,
                'matricula_original': matricula_original,
                'matricula_trator': matricula_trator,
                'matricula_galera': matricula_galera,
                'data_associacao': data_associacao,
                'nome_motorista': motorista[2]
            })
        ))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': f'Matrícula alterada temporariamente para o dia {data_associacao}: {descricao_completa}'
        })
    except Exception as e:
        import traceback
        print(f"Erro ao alterar matrícula: {e}")
        print(traceback.format_exc())
        if 'conn' in locals():
            try:
                conn.close()
            except:
                pass
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/viatura-motorista/<int:vm_id>/observacao', methods=['PUT'])
def alterar_observacao_temporaria(vm_id):
    """Adicionar/alterar observação temporária para o dia"""
    try:
        data = request.json
        observacao = data.get('observacao', '').strip()
        data_associacao = data.get('data_associacao', date.today().isoformat())
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar se o motorista existe
        cursor.execute('SELECT id, nome_motorista FROM viatura_motorista WHERE id = ?', (vm_id,))
        motorista = cursor.fetchone()
        
        if not motorista:
            conn.close()
            return jsonify({'success': False, 'error': 'Motorista não encontrado'}), 404
        
        if observacao:
            # Guardar observação temporária (substitui se já existir)
            cursor.execute('''
                INSERT OR REPLACE INTO observacao_temporaria 
                (viatura_motorista_id, data_associacao, observacao)
                VALUES (?, ?, ?)
            ''', (vm_id, data_associacao, observacao))
        else:
            # Se observação vazia, remover
            cursor.execute('''
                DELETE FROM observacao_temporaria
                WHERE viatura_motorista_id = ? AND data_associacao = ?
            ''', (vm_id, data_associacao))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': f'Observação {"adicionada" if observacao else "removida"} para o dia {data_associacao}'
        })
    except Exception as e:
        import traceback
        print(f"Erro ao alterar observação: {e}")
        print(traceback.format_exc())
        if 'conn' in locals():
            try:
                conn.close()
            except:
                pass
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/viatura-motorista/<int:vm_id>/status', methods=['PUT'])
def atualizar_status_viatura_motorista(vm_id):
    """Atualizar status de viatura/motorista (suporta períodos de férias)"""
    conn = None
    try:
        if not request.json:
            return jsonify({'success': False, 'error': 'Dados não fornecidos'}), 400
            
        data = request.json
        status = data.get('status', 'Normal')
        observacao_status = data.get('observacao_status')
        data_inicio = data.get('data_inicio')
        data_fim = data.get('data_fim')
        data_status = data.get('data', date.today().isoformat())  # Data de referência
        
        # Debug: imprimir dados recebidos
        print(f"DEBUG - Atualizar status: vm_id={vm_id}, status={status}, data_inicio={data_inicio}, data_fim={data_fim}")
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar se vm_id é um atribuicao_id (sistema novo) ou viatura_motorista_id (sistema antigo)
        # Primeiro, verificar se é um atribuicao_id
        cursor.execute('SELECT conjunto_id, motorista_id FROM atribuicoes_motoristas WHERE id = ?', (vm_id,))
        atribuicao = cursor.fetchone()
        
        viatura_motorista_id = None
        if atribuicao:
            # É um atribuicao_id - buscar viatura_motorista_id através do motorista_id
            motorista_id = atribuicao[1] if atribuicao[1] else None
            conjunto_id = atribuicao[0]
            
            if not motorista_id:
                # Buscar motorista_id do conjunto
                cursor.execute('SELECT motorista_id FROM conjuntos_habituais WHERE id = ?', (conjunto_id,))
                conjunto_row = cursor.fetchone()
                if conjunto_row:
                    motorista_id = conjunto_row[0]
            
            print(f"DEBUG - atualizar_status: atribuicao_id={vm_id}, conjunto_id={conjunto_id}, motorista_id={motorista_id}")
            
            if motorista_id:
                # Buscar o nome do motorista primeiro
                cursor.execute('SELECT nome FROM motoristas WHERE id = ?', (motorista_id,))
                motorista_row = cursor.fetchone()
                if motorista_row:
                    nome_motorista = motorista_row[0]
                    print(f"DEBUG - atualizar_status: nome_motorista={nome_motorista}")
                    # Buscar viatura_motorista pelo nome_motorista (busca case-insensitive e com trim)
                    cursor.execute('SELECT id, nome_motorista FROM viatura_motorista WHERE UPPER(TRIM(nome_motorista)) = UPPER(TRIM(?)) AND ativo = 1 LIMIT 1', (nome_motorista,))
                    vm_row = cursor.fetchone()
                    if vm_row:
                        viatura_motorista_id = vm_row[0]
                        print(f"DEBUG - atualizar_status: Encontrado viatura_motorista_id={viatura_motorista_id}")
                    else:
                        print(f"DEBUG - atualizar_status: Nenhuma viatura_motorista encontrada com nome '{nome_motorista}'")
                        # Criar automaticamente uma entrada na viatura_motorista se não existir
                        # Buscar informações do conjunto para criar a entrada
                        cursor.execute('''
                            SELECT t.matricula, cis.matricula, t.codigo, cis.codigo
                            FROM conjuntos_habituais c
                            LEFT JOIN tratores t ON c.trator_id = t.id
                            LEFT JOIN cisternas cis ON c.cisterna_id = cis.id
                            WHERE c.id = ?
                        ''', (conjunto_id,))
                        conjunto_info = cursor.fetchone()
                        
                        if conjunto_info:
                            trator_matricula = conjunto_info[0] or ''
                            cisterna_matricula = conjunto_info[1] or ''
                            trator_codigo = conjunto_info[2] or ''
                            cisterna_codigo = conjunto_info[3] or ''
                            
                            # Criar matrícula combinada
                            matricula = f"{trator_matricula} + {cisterna_matricula}" if trator_matricula and cisterna_matricula else (trator_matricula or cisterna_matricula or 'N/A')
                            codigo = trator_codigo or cisterna_codigo or ''
                            
                            # Criar entrada na viatura_motorista
                            cursor.execute('''
                                INSERT INTO viatura_motorista (matricula, codigo, nome_motorista, status, ativo)
                                VALUES (?, ?, ?, 'Normal', 1)
                            ''', (matricula, codigo, nome_motorista))
                            conn.commit()
                            viatura_motorista_id = cursor.lastrowid
                            print(f"DEBUG - atualizar_status: Criada nova viatura_motorista com id={viatura_motorista_id} para motorista '{nome_motorista}'")
                        else:
                            # Se não conseguir obter info do conjunto, criar com valores mínimos
                            cursor.execute('''
                                INSERT INTO viatura_motorista (matricula, codigo, nome_motorista, status, ativo)
                                VALUES (?, ?, ?, 'Normal', 1)
                            ''', ('N/A', '', nome_motorista))
                            conn.commit()
                            viatura_motorista_id = cursor.lastrowid
                            print(f"DEBUG - atualizar_status: Criada nova viatura_motorista com id={viatura_motorista_id} para motorista '{nome_motorista}' (sem info do conjunto)")
                        
                        # Listar todas as viaturas ativas para debug
                        cursor.execute('SELECT id, nome_motorista FROM viatura_motorista WHERE ativo = 1 LIMIT 10')
                        todas_viaturas = cursor.fetchall()
                        print(f"DEBUG - atualizar_status: Viaturas ativas disponíveis: {[dict(v) for v in todas_viaturas]}")
                else:
                    print(f"DEBUG - atualizar_status: Motorista com id={motorista_id} não encontrado na tabela motoristas")
            else:
                print(f"DEBUG - atualizar_status: Nenhum motorista_id encontrado para atribuicao_id={vm_id}")
        else:
            # Verificar se é um viatura_motorista_id
            cursor.execute('SELECT id FROM viatura_motorista WHERE id = ?', (vm_id,))
            vm_row = cursor.fetchone()
            if vm_row:
                viatura_motorista_id = vm_id
                print(f"DEBUG - atualizar_status: vm_id é um viatura_motorista_id direto: {vm_id}")
            else:
                print(f"DEBUG - atualizar_status: vm_id={vm_id} não é nem atribuicao_id nem viatura_motorista_id")
        
        if not viatura_motorista_id:
            if conn:
                conn.close()
            return jsonify({'success': False, 'error': 'Viatura/Motorista não encontrado. Verifique se o motorista existe na tabela viatura_motorista.'}), 404
        
        # Buscar status anterior para detectar disponibilidade forçada
        status_anterior = None
        cursor.execute('''
            SELECT status, data_inicio, data_fim
            FROM viatura_motorista_status
            WHERE viatura_motorista_id = ? AND data_status = ?
            ORDER BY created_at DESC
            LIMIT 1
        ''', (viatura_motorista_id, data_status))
        status_anterior_row = cursor.fetchone()
        if status_anterior_row:
            status_anterior = status_anterior_row[0]
            data_inicio_anterior = status_anterior_row[1]
            data_fim_anterior = status_anterior_row[2]
        
        # Buscar informações do motorista para o registo
        cursor.execute('SELECT nome_motorista, matricula FROM viatura_motorista WHERE id = ?', (viatura_motorista_id,))
        vm_info = cursor.fetchone()
        nome_motorista_registo = vm_info[0] if vm_info else 'Desconhecido'
        matricula_registo = vm_info[1] if vm_info else 'N/A'
        
        # Validar se é férias, baixa ou outros trabalhos e tem datas
        if status in ['Ferias', 'Baixa', 'OutrosTrabalhos']:
            if not data_inicio or not data_fim:
                if conn:
                    conn.close()
                nome_status = 'outros trabalhos' if status == 'OutrosTrabalhos' else status.lower()
                return jsonify({'success': False, 'error': f'Para definir {nome_status}, é necessário informar a data de início e data de fim'}), 400
        
        # Se for Disponivel, limpar datas
        if status == 'Disponivel':
            data_inicio = None
            data_fim = None
            
            # Detectar disponibilidade forçada (mudança de Ferias/Baixa/OutrosTrabalhos para Disponivel)
            if status_anterior in ['Ferias', 'Baixa', 'OutrosTrabalhos']:
                # Registar como disponibilidade forçada
                descricao = f'Disponibilidade forçada: {nome_motorista_registo} ({matricula_registo}) - Status anterior: {status_anterior}'
                if data_inicio_anterior and data_fim_anterior:
                    descricao += f' (período: {data_inicio_anterior} a {data_fim_anterior})'
                
                cursor.execute('''
                    INSERT INTO historico_acoes (tipo_acao, descricao, dados_acao)
                    VALUES (?, ?, ?)
                ''', (
                    'DISPONIBILIDADE_FORCADA',
                    descricao,
                    json.dumps({
                        'viatura_motorista_id': viatura_motorista_id,
                        'nome_motorista': nome_motorista_registo,
                        'matricula': matricula_registo,
                        'status_anterior': status_anterior,
                        'status_novo': status,
                        'data_status': data_status,
                        'data_inicio_anterior': data_inicio_anterior,
                        'data_fim_anterior': data_fim_anterior
                    })
                ))
                conn.commit()
                print(f"DEBUG - Disponibilidade forçada registada: {descricao}")
        
        if status in ['Ferias', 'Baixa', 'OutrosTrabalhos'] and data_inicio and data_fim:
            from datetime import datetime, timedelta
            
            try:
                data_inicio_obj = datetime.strptime(data_inicio, '%Y-%m-%d').date()
                data_fim_obj = datetime.strptime(data_fim, '%Y-%m-%d').date()
            except (ValueError, TypeError) as e:
                if conn:
                    conn.close()
                return jsonify({'success': False, 'error': f'Data inválida: {str(e)}'}), 400
            
            # Remover status antigos do mesmo tipo para este motorista
            cursor.execute('''
                DELETE FROM viatura_motorista_status 
                WHERE viatura_motorista_id = ? AND status = ?
            ''', (viatura_motorista_id, status))
            
            # Criar registos para cada dia útil do período
            data_atual = data_inicio_obj
            while data_atual <= data_fim_obj:
                # Só criar para dias úteis (segunda a sexta)
                if data_atual.weekday() < 5:  # 0=segunda, 4=sexta
                    # Remover automaticamente encomendas atribuídas neste dia
                    cursor.execute('''
                        DELETE FROM encomenda_viatura
                        WHERE viatura_motorista_id = ? AND data_associacao = ?
                    ''', (viatura_motorista_id, data_atual.isoformat()))

                    cursor.execute('''
                        INSERT OR REPLACE INTO viatura_motorista_status 
                        (viatura_motorista_id, data_status, status, observacao_status, data_inicio, data_fim, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ''', (viatura_motorista_id, data_atual.isoformat(), status, observacao_status, data_inicio, data_fim))
                
                data_atual += timedelta(days=1)
        else:
            # Status normal - apenas para o dia específico
            # Inserir ou atualizar status para o dia específico
            cursor.execute('''
                INSERT OR REPLACE INTO viatura_motorista_status 
                (viatura_motorista_id, data_status, status, observacao_status, data_inicio, data_fim, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ''', (viatura_motorista_id, data_status, status, observacao_status, None, None))

            # Se está a marcar férias, baixa ou outros trabalhos apenas para um dia específico,
            # remover também as encomendas atribuídas nesse dia
            if status in ['Ferias', 'Baixa', 'OutrosTrabalhos'] and data_status:
                cursor.execute('''
                    DELETE FROM encomenda_viatura
                    WHERE viatura_motorista_id = ? AND data_associacao = ?
                ''', (viatura_motorista_id, data_status))
        
        conn.commit()
        if conn:
            conn.close()
        
        return jsonify({'success': True})
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Erro ao atualizar status: {e}")
        print(error_trace)
        # Garantir que a conexão está fechada em caso de erro
        if conn:
            try:
                conn.close()
            except:
                pass
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/viatura-motorista/<int:vm_id>/desativar', methods=['DELETE'])
def remover_viatura_motorista(vm_id):
    """Desativar viatura/motorista a partir da data atual (mantém histórico)"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar se o motorista existe
        cursor.execute('SELECT id, matricula, nome_motorista FROM viatura_motorista WHERE id = ?', (vm_id,))
        motorista = cursor.fetchone()
        
        if not motorista:
            conn.close()
            return jsonify({'success': False, 'error': 'Motorista não encontrado'}), 404
        
        data_atual = date.today().isoformat()
        
        # Buscar encomendas atribuídas para datas futuras (a partir de hoje)
        cursor.execute('''
            SELECT ev.pedido_id, ev.pedido_tipo, ev.data_associacao, ev.ordem,
                   pp.cliente, pp.local_carga, pp.material, pp.observacoes
            FROM encomenda_viatura ev
            LEFT JOIN pedidos_pendentes pp ON ev.pedido_tipo = 'P' AND ev.pedido_id = pp.id
            WHERE ev.viatura_motorista_id = ? AND ev.data_associacao >= ?
        ''', (vm_id, data_atual))
        encomendas_futuras = cursor.fetchall()
        
        # Guardar dados das encomendas futuras para histórico
        encomendas_dados = []
        for e in encomendas_futuras:
            encomenda_info = {
                'pedido_id': e[0],
                'pedido_tipo': e[1],
                'data_associacao': e[2],
                'ordem': e[3]
            }
            if e[4]:  # cliente
                encomenda_info['cliente'] = e[4]
            if e[5]:  # local_carga
                encomenda_info['local_carga'] = e[5]
            if e[6]:  # material
                encomenda_info['material'] = e[6]
            if e[7]:  # observacoes
                encomenda_info['observacoes'] = e[7]
            encomendas_dados.append(encomenda_info)
        
        # Remover apenas encomendas atribuídas para datas futuras (a partir de hoje)
        # As encomendas de datas anteriores são mantidas para histórico
        cursor.execute('''
            DELETE FROM encomenda_viatura 
            WHERE viatura_motorista_id = ? AND data_associacao >= ?
        ''', (vm_id, data_atual))
        count_encomendas_removidas = cursor.rowcount
        
        # Remover status futuros do motorista (mantém histórico de status anteriores)
        cursor.execute('''
            DELETE FROM viatura_motorista_status 
            WHERE viatura_motorista_id = ? 
            AND (data_status >= ? OR (data_inicio IS NOT NULL AND data_inicio >= ?))
        ''', (vm_id, data_atual, data_atual))
        
        # Remover matrículas temporárias futuras
        cursor.execute('''
            DELETE FROM matricula_temporaria 
            WHERE viatura_motorista_id = ? AND data_associacao >= ?
        ''', (vm_id, data_atual))
        
        # Marcar card como desativado a partir da data atual (não apagar)
        # Mantém o card ativo para datas anteriores, mas desativa para datas futuras
        cursor.execute('''
            UPDATE viatura_motorista 
            SET data_desativacao = ?, ativo = 1
            WHERE id = ?
        ''', (data_atual, vm_id))
        
        # Registar ação no histórico
        cursor.execute('''
            INSERT INTO historico_acoes (tipo_acao, descricao, dados_acao)
            VALUES (?, ?, ?)
        ''', (
            'DESATIVAR_CARD_DATA_ATUAL',
            f'Desativar card a partir de {data_atual}: {motorista[2]} ({motorista[1]})',
            json.dumps({
                'viatura_motorista_id': vm_id,
                'data_desativacao': data_atual,
                'encomendas_removidas': encomendas_dados,
                'matricula': motorista[1],
                'nome_motorista': motorista[2]
            })
        ))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'encomendas_removidas': count_encomendas_removidas,
            'data_desativacao': data_atual,
            'message': f'Card desativado a partir de {data_atual}. Histórico anterior mantido.'
        })
    except Exception as e:
        import traceback
        print(f"Erro ao desativar viatura/motorista: {e}")
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/viatura-motorista/limpar-duplicados', methods=['POST'])
def limpar_duplicados_viatura_motorista():
    """Identificar e remover viaturas/motoristas duplicados (mesma matrícula)"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Encontrar duplicados por matrícula (case-insensitive)
        cursor.execute('''
            SELECT 
                UPPER(TRIM(matricula)) as matricula_upper,
                GROUP_CONCAT(id) as ids,
                COUNT(*) as count
            FROM viatura_motorista
            WHERE ativo = 1
            GROUP BY matricula_upper
            HAVING COUNT(*) > 1
        ''')
        
        duplicados = cursor.fetchall()
        removidos = []
        mantidos = []
        
        for dup in duplicados:
            matricula = dup[0]
            ids_str = dup[1]
            count = dup[2]
            ids = [int(id_str) for id_str in ids_str.split(',')]
            
            # Ordenar IDs (manter o mais antigo ou o que não é temporário)
            placeholders = ','.join('?' * len(ids))
            cursor.execute(f'''
                SELECT id, temporario, created_at
                FROM viatura_motorista
                WHERE id IN ({placeholders})
                ORDER BY 
                    CASE WHEN temporario = 0 OR temporario IS NULL THEN 0 ELSE 1 END,
                    created_at ASC
            ''', ids)
            
            viaturas = cursor.fetchall()
            
            # Manter a primeira (mais antiga ou não temporária)
            manter_id = viaturas[0][0]
            mantidos.append({
                'id': manter_id,
                'matricula': matricula
            })
            
            # Remover as outras (mas verificar se não têm encomendas)
            for viatura in viaturas[1:]:
                viatura_id = viatura[0]
                
                # Verificar se tem encomendas
                cursor.execute('''
                    SELECT COUNT(*) FROM encomenda_viatura 
                    WHERE viatura_motorista_id = ?
                ''', (viatura_id,))
                count_encomendas = cursor.fetchone()[0]
                
                if count_encomendas == 0:
                    # Desativar
                    cursor.execute('UPDATE viatura_motorista SET ativo = 0 WHERE id = ?', (viatura_id,))
                    removidos.append({
                        'id': viatura_id,
                        'matricula': matricula,
                        'motivo': 'Duplicado sem encomendas'
                    })
                else:
                    # Transferir encomendas para a viatura mantida
                    cursor.execute('''
                        UPDATE encomenda_viatura
                        SET viatura_motorista_id = ?
                        WHERE viatura_motorista_id = ?
                    ''', (manter_id, viatura_id))
                    
                    # Desativar
                    cursor.execute('UPDATE viatura_motorista SET ativo = 0 WHERE id = ?', (viatura_id,))
                    removidos.append({
                        'id': viatura_id,
                        'matricula': matricula,
                        'motivo': f'Duplicado com {count_encomendas} encomenda(s) transferida(s)'
                    })
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'removidos': len(removidos),
            'mantidos': len(mantidos),
            'detalhes': {
                'removidos': removidos,
                'mantidos': mantidos
            }
        })
    except Exception as e:
        import traceback
        print(f"Erro ao limpar duplicados: {e}")
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/viatura-motorista/reordenar', methods=['POST'])
def reordenar_viaturas_motoristas():
    """Reordenar viaturas/motoristas"""
    data = request.json
    ids_ordenados = data.get('ids', [])
    
    if not ids_ordenados:
        return jsonify({'success': False, 'error': 'Lista de IDs vazia'}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Atualizar a ordem de cada viatura/motorista
    for ordem, vm_id in enumerate(ids_ordenados, start=1):
        cursor.execute('''
            UPDATE viatura_motorista 
            SET ordem = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (ordem, vm_id))
    
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})

def _normalizar_encomenda_pendente(row):
    """Garantir que cada encomenda tem local_descarga (para exibição na tabela)."""
    d = dict(row)
    # Garantir que local_descarga existe e é string (coluna pode ser NULL em registos antigos)
    ld = d.get('local_descarga')
    if ld is None or (isinstance(ld, str) and not ld.strip()):
        # Registos antigos: usar local_carga como fallback para a coluna "Local de Descarga"
        d['local_descarga'] = (d.get('local_carga') or '').strip() or ''
    else:
        d['local_descarga'] = str(ld).strip()
    return d


@app.route('/api/encomendas-pendentes-dia', methods=['GET'])
def get_encomendas_pendentes_dia():
    """Obter encomendas pendentes do dia e dias futuros (apenas não atribuídas)"""
    data_str = request.args.get('data', date.today().isoformat())
    data_consulta = date.fromisoformat(data_str)
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Query com colunas explicitas (inclui local_descarga); fallback para SELECT * se coluna nao existir
    cols = 'pp.id, pp.cliente, pp.tipo_carga, pp.material, pp.data_entrega, pp.local_carga, pp.local_descarga, pp.observacoes, pp.prioridade, pp.created_at, pp.updated_at'
    q_dia = '''
        SELECT ''' + cols + '''
        FROM pedidos_pendentes pp
        WHERE pp.data_entrega = ?
        AND NOT EXISTS (
            SELECT 1 FROM encomenda_viatura ev 
            WHERE ev.pedido_id = pp.id 
            AND ev.pedido_tipo = 'P' 
            AND ev.data_associacao = ?
        )
        ORDER BY pp.cliente ASC
    '''
    q_futuro = '''
        SELECT ''' + cols + '''
        FROM pedidos_pendentes pp
        WHERE pp.data_entrega > ?
        AND pp.data_entrega <= ?
        AND NOT EXISTS (
            SELECT 1 FROM encomenda_viatura ev 
            WHERE ev.pedido_id = pp.id 
            AND ev.pedido_tipo = 'P' 
            AND ev.data_associacao = pp.data_entrega
        )
        ORDER BY pp.data_entrega ASC, pp.cliente ASC
    '''
    try:
        cursor.execute(q_dia, (data_str, data_str))
        encomendas_dia = [_normalizar_encomenda_pendente(row) for row in cursor.fetchall()]
        cursor.execute(q_futuro, (data_str, (data_consulta + timedelta(days=2)).isoformat()))
        encomendas_futuras = [_normalizar_encomenda_pendente(row) for row in cursor.fetchall()]
    except sqlite3.OperationalError as e:
        if 'local_descarga' in str(e) or 'no such column' in str(e).lower():
            cursor.execute('''
                SELECT pp.* FROM pedidos_pendentes pp
                WHERE pp.data_entrega = ? AND NOT EXISTS (
                    SELECT 1 FROM encomenda_viatura ev
                    WHERE ev.pedido_id = pp.id AND ev.pedido_tipo = 'P' AND ev.data_associacao = ?
                )
                ORDER BY pp.cliente ASC
            ''', (data_str, data_str))
            encomendas_dia = [_normalizar_encomenda_pendente(row) for row in cursor.fetchall()]
            cursor.execute('''
                SELECT pp.* FROM pedidos_pendentes pp
                WHERE pp.data_entrega > ? AND pp.data_entrega <= ?
                AND NOT EXISTS (
                    SELECT 1 FROM encomenda_viatura ev
                    WHERE ev.pedido_id = pp.id AND ev.pedido_tipo = 'P' AND ev.data_associacao = pp.data_entrega
                )
                ORDER BY pp.data_entrega ASC, pp.cliente ASC
            ''', (data_str, (data_consulta + timedelta(days=2)).isoformat()))
            encomendas_futuras = [_normalizar_encomenda_pendente(row) for row in cursor.fetchall()]
        else:
            raise
    
    # Agrupar encomendas futuras por data
    encomendas_por_data = {}
    for enc in encomendas_futuras:
        data_enc = enc['data_entrega']
        if data_enc not in encomendas_por_data:
            encomendas_por_data[data_enc] = []
        encomendas_por_data[data_enc].append(enc)
    
    conn.close()
    return jsonify({
        'dia_atual': encomendas_dia,
        'dias_futuros': encomendas_por_data
    })

@app.route('/api/atribuir-encomenda', methods=['POST'])
def atribuir_encomenda():
    """Atribuir encomenda a viatura/motorista"""
    try:
        data = request.json
        if not data:
            return jsonify({'success': False, 'error': 'Dados não fornecidos'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        pedido_id = data.get('pedido_id')
        pedido_tipo = data.get('pedido_tipo', 'P')
        atribuicao_id = data.get('atribuicao_id')  # Novo: ID da atribuição
        viatura_motorista_id = data.get('viatura_motorista_id')  # Mantido para compatibilidade
        data_associacao = data.get('data_associacao', date.today().isoformat())
        
        if not pedido_id or (not atribuicao_id and not viatura_motorista_id):
            conn.close()
            return jsonify({'success': False, 'error': 'Dados incompletos'}), 400
        
        # Verificar se já existe
        cursor.execute('''
            SELECT id FROM encomenda_viatura 
            WHERE pedido_id = ? AND pedido_tipo = ? AND data_associacao = ?
        ''', (pedido_id, pedido_tipo, data_associacao))
        
        if cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': 'Encomenda já atribuída'}), 400
        
        # Se usar atribuicao_id, buscar ordem baseada na atribuição
        if atribuicao_id:
            cursor.execute('''
                SELECT COALESCE(MAX(ordem), 0) + 1 as proxima_ordem
                FROM encomenda_viatura
                WHERE atribuicao_id = ? AND data_associacao = ?
            ''', (atribuicao_id, data_associacao))
        else:
            # Compatibilidade: usar viatura_motorista_id
            cursor.execute('''
                SELECT COALESCE(MAX(ordem), 0) + 1 as proxima_ordem
                FROM encomenda_viatura
                WHERE viatura_motorista_id = ? AND data_associacao = ?
            ''', (viatura_motorista_id, data_associacao))
        
        resultado = cursor.fetchone()
        proxima_ordem = resultado[0] if resultado else 1
        
        # Buscar dados do pedido e motorista para histórico
        tabela_pedido = 'pedidos_pendentes' if pedido_tipo == 'P' else 'pedidos_entregues'
        cursor.execute(f'SELECT * FROM {tabela_pedido} WHERE id = ?', (pedido_id,))
        pedido_row = cursor.fetchone()
        pedido = dict(pedido_row) if pedido_row else None
        
        # Buscar dados do motorista (dependendo se usa atribuicao_id ou viatura_motorista_id)
        motorista = None
        motorista_nome = None
        motorista_matricula = None
        
        if atribuicao_id:
            # Buscar dados através da atribuição
            cursor.execute('''
                SELECT m.nome, t.matricula || ' + ' || cis.matricula as matricula
                FROM atribuicoes_motoristas a
                INNER JOIN conjuntos_habituais c ON a.conjunto_id = c.id
                LEFT JOIN tratores t ON c.trator_id = t.id
                LEFT JOIN cisternas cis ON c.cisterna_id = cis.id
                LEFT JOIN motoristas m ON COALESCE(a.motorista_id, c.motorista_id) = m.id
                WHERE a.id = ?
            ''', (atribuicao_id,))
            motorista_row = cursor.fetchone()
            if motorista_row:
                motorista_nome = motorista_row[0]
                motorista_matricula = motorista_row[1]
                motorista = (motorista_nome, motorista_matricula)
        else:
            # Compatibilidade: buscar através de viatura_motorista
            cursor.execute('SELECT nome_motorista, matricula FROM viatura_motorista WHERE id = ?', (viatura_motorista_id,))
            motorista_row = cursor.fetchone()
            motorista = motorista_row if motorista_row else None
            if motorista:
                motorista_nome = motorista[0]
                motorista_matricula = motorista[1]
        
        if not pedido:
            conn.close()
            return jsonify({'success': False, 'error': 'Pedido não encontrado'}), 404
        
        if not motorista:
            conn.close()
            return jsonify({'success': False, 'error': 'Motorista não encontrado'}), 404
        
        # Obter viatura_motorista_id para o INSERT (a coluna é NOT NULL na BD)
        vm_id_para_insert = viatura_motorista_id
        if atribuicao_id:
            # Usar o nome do motorista que já temos para encontrar ou criar viatura_motorista
            nome_motorista = (motorista_nome or (motorista[0] if motorista else None) or '').strip() or ('Motorista card #%s' % atribuicao_id)
            cursor.execute('SELECT id FROM viatura_motorista WHERE UPPER(TRIM(nome_motorista)) = UPPER(TRIM(?)) AND ativo = 1 LIMIT 1', (nome_motorista,))
            vm_row = cursor.fetchone()
            if vm_row:
                vm_id_para_insert = vm_row[0]
            else:
                # Criar registo em viatura_motorista com matrícula do conjunto
                cursor.execute('SELECT conjunto_id FROM atribuicoes_motoristas WHERE id = ?', (atribuicao_id,))
                atr = cursor.fetchone()
                conjunto_id = atr[0] if atr else None
                matricula = (motorista_matricula or 'N/A') if motorista_matricula else 'N/A'
                if conjunto_id:
                    cursor.execute('''
                        SELECT t.matricula, cis.matricula FROM conjuntos_habituais c
                        LEFT JOIN tratores t ON c.trator_id = t.id
                        LEFT JOIN cisternas cis ON c.cisterna_id = cis.id
                        WHERE c.id = ?
                    ''', (conjunto_id,))
                    ci = cursor.fetchone()
                    if ci and (ci[0] or ci[1]):
                        matricula = f"{ci[0] or ''} + {ci[1] or ''}".strip(' +') or 'N/A'
                cursor.execute('''
                    INSERT INTO viatura_motorista (matricula, codigo, nome_motorista, status, ativo)
                    VALUES (?, ?, ?, 'Normal', 1)
                ''', (matricula, '', nome_motorista))
                vm_id_para_insert = cursor.lastrowid
        
        # Nunca fazer INSERT sem viatura_motorista_id (NOT NULL)
        if vm_id_para_insert is None:
            conn.close()
            return jsonify({'success': False, 'error': 'Não foi possível associar ao motorista. Defina o motorista no card ou contacte o administrador.'}), 400
        vm_id_para_insert = int(vm_id_para_insert)
        
        # Inserir encomenda (sempre com viatura_motorista_id)
        if atribuicao_id:
            cursor.execute('''
                INSERT INTO encomenda_viatura (pedido_id, pedido_tipo, viatura_motorista_id, atribuicao_id, data_associacao, ordem)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (pedido_id, pedido_tipo, vm_id_para_insert, atribuicao_id, data_associacao, proxima_ordem))
        else:
            cursor.execute('''
                INSERT INTO encomenda_viatura (pedido_id, pedido_tipo, viatura_motorista_id, data_associacao, ordem)
                VALUES (?, ?, ?, ?, ?)
            ''', (pedido_id, pedido_tipo, vm_id_para_insert, data_associacao, proxima_ordem))
        
        # Registar ação no histórico
        cursor.execute('''
            INSERT INTO historico_acoes (tipo_acao, descricao, dados_acao)
            VALUES (?, ?, ?)
        ''', (
            'ATRIBUIR_ENCOMENDA',
            f'Atribuir encomenda a {motorista[0]} ({motorista[1]}): {pedido.get("cliente", "")} - {pedido.get("local_carga", "")} - {pedido.get("material", "")}',
            json.dumps({
                'pedido_id': pedido_id,
                'pedido_tipo': pedido_tipo,
                'viatura_motorista_id': vm_id_para_insert,
                'data_associacao': data_associacao,
                'ordem': proxima_ordem,
                'cliente': pedido.get('cliente', ''),
                'local_carga': pedido.get('local_carga', ''),
                'material': pedido.get('material', ''),
                'nome_motorista': motorista[0],
                'matricula': motorista[1]
            })
        ))
        
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        import traceback
        print(f"Erro ao atribuir encomenda: {e}")
        print(traceback.format_exc())
        if 'conn' in locals():
            try:
                conn.close()
            except:
                pass
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/remover-atribuicao/<int:atribuicao_id>', methods=['DELETE'])
def remover_atribuicao(atribuicao_id):
    """Remover atribuição de encomenda (mover de volta para pendentes)"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar se a atribuição existe e buscar dados completos
        cursor.execute('SELECT * FROM encomenda_viatura WHERE id = ?', (atribuicao_id,))
        atribuicao = cursor.fetchone()
        
        if not atribuicao:
            conn.close()
            return jsonify({'success': False, 'error': 'Atribuição não encontrada'}), 404
        
        atribuicao_dict = dict(atribuicao)
        pedido_id = atribuicao_dict['pedido_id']
        pedido_tipo = atribuicao_dict['pedido_tipo']
        
        # Buscar dados do motorista
        cursor.execute('SELECT nome_motorista, matricula FROM viatura_motorista WHERE id = ?', (atribuicao_dict['viatura_motorista_id'],))
        motorista = cursor.fetchone()
        nome_motorista = motorista[0] if motorista else 'Desconhecido'
        matricula = motorista[1] if motorista else 'Desconhecida'
        
        # Buscar dados do pedido
        tabela_pedido = 'pedidos_pendentes' if pedido_tipo == 'P' else 'pedidos_entregues'
        cursor.execute(f'SELECT cliente, local_carga, material, observacoes FROM {tabela_pedido} WHERE id = ?', (pedido_id,))
        pedido = cursor.fetchone()
        
        cliente = pedido[0] if pedido else ''
        local_carga = pedido[1] if pedido else ''
        material = pedido[2] if pedido else ''
        observacoes = pedido[3] if pedido else ''
        
        # Remover a atribuição
        cursor.execute('DELETE FROM encomenda_viatura WHERE id = ?', (atribuicao_id,))
        
        # Registar ação no histórico
        cursor.execute('''
            INSERT INTO historico_acoes (tipo_acao, descricao, dados_acao)
            VALUES (?, ?, ?)
        ''', (
            'REMOVER_ATRIBUICAO',
            f'Remover atribuição de encomenda: {cliente} - {local_carga} - {material} de {nome_motorista} ({matricula})',
            json.dumps({
                'atribuicao_id': atribuicao_id,
                'pedido_id': pedido_id,
                'pedido_tipo': pedido_tipo,
                'viatura_motorista_id': atribuicao_dict['viatura_motorista_id'],
                'data_associacao': atribuicao_dict['data_associacao'],
                'ordem': atribuicao_dict.get('ordem', 0),
                'cliente': cliente,
                'local_carga': local_carga,
                'material': material,
                'observacoes': observacoes,
                'nome_motorista': nome_motorista,
                'matricula': matricula
            })
        ))
        
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/remover-atribuicao-por-pedido', methods=['POST'])
def remover_atribuicao_por_pedido():
    """Remover atribuição de encomenda usando pedido_id, pedido_tipo e data"""
    try:
        data = request.json
        pedido_id = data.get('pedido_id')
        pedido_tipo = data.get('pedido_tipo')
        data_associacao = data.get('data_associacao')
        codigo_autorizacao = data.get('codigo_autorizacao')
        
        if not pedido_id or not pedido_tipo or not data_associacao:
            return jsonify({'success': False, 'error': 'Dados incompletos'}), 400
        
        # Verificar se a data de associação é anterior à atual
        permitido, msg_erro = verificar_data_anterior_e_codigo(data_associacao, codigo_autorizacao)
        if not permitido:
            return jsonify({'success': False, 'error': msg_erro}), 403
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Buscar dados da atribuição antes de remover (para histórico)
        cursor.execute('''
            SELECT ev.*, vm.nome_motorista, vm.matricula
            FROM encomenda_viatura ev
            LEFT JOIN viatura_motorista vm ON ev.viatura_motorista_id = vm.id
            WHERE ev.pedido_id = ? AND ev.pedido_tipo = ? AND ev.data_associacao = ?
        ''', (pedido_id, pedido_tipo, data_associacao))
        atribuicao = cursor.fetchone()
        
        # Buscar dados do pedido
        tabela_pedido = 'pedidos_pendentes' if pedido_tipo == 'P' else 'pedidos_entregues'
        cursor.execute(f'SELECT * FROM {tabela_pedido} WHERE id = ?', (pedido_id,))
        pedido = cursor.fetchone()
        
        # Buscar e remover a atribuição
        cursor.execute('''
            DELETE FROM encomenda_viatura 
            WHERE pedido_id = ? AND pedido_tipo = ? AND data_associacao = ?
        ''', (pedido_id, pedido_tipo, data_associacao))
        
        # Registar ação no histórico
        if atribuicao and pedido:
            atribuicao_dict = dict(atribuicao) if atribuicao else {}
            pedido_dict = dict(pedido) if pedido else {}
            cursor.execute('''
                INSERT INTO historico_acoes (tipo_acao, descricao, dados_acao)
                VALUES (?, ?, ?)
            ''', (
                'REMOVER_ATRIBUICAO',
                f'Remover atribuição de encomenda: {pedido_dict.get("cliente", "")} - {pedido_dict.get("local_carga", "")} - {pedido_dict.get("material", "")} de {atribuicao_dict.get("nome_motorista", "")} ({atribuicao_dict.get("matricula", "")})',
                json.dumps({
                    'pedido_id': pedido_id,
                    'pedido_tipo': pedido_tipo,
                    'viatura_motorista_id': atribuicao_dict.get('viatura_motorista_id'),
                    'data_associacao': data_associacao,
                    'ordem': atribuicao_dict.get('ordem', 0),
                    'cliente': pedido_dict.get('cliente', ''),
                    'local_carga': pedido_dict.get('local_carga', ''),
                    'material': pedido_dict.get('material', ''),
                    'observacoes': pedido_dict.get('observacoes', ''),
                    'nome_motorista': atribuicao_dict.get('nome_motorista', ''),
                    'matricula': atribuicao_dict.get('matricula', '')
                })
            ))
        
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        import traceback
        print(f"Erro ao remover atribuição: {e}")
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/mover-encomenda-motorista', methods=['POST'])
def mover_encomenda_motorista():
    """Mover encomenda de um motorista para outro"""
    try:
        data = request.json
        pedido_id = data.get('pedido_id')
        pedido_tipo = data.get('pedido_tipo')
        data_associacao = data.get('data_associacao')
        novo_viatura_motorista_id = data.get('novo_viatura_motorista_id')
        codigo_autorizacao = data.get('codigo_autorizacao')
        
        if not pedido_id or not pedido_tipo or not data_associacao or not novo_viatura_motorista_id:
            return jsonify({'success': False, 'error': 'Dados incompletos'}), 400
        
        # Verificar se a data de associação é anterior à atual
        permitido, msg_erro = verificar_data_anterior_e_codigo(data_associacao, codigo_autorizacao)
        if not permitido:
            return jsonify({'success': False, 'error': msg_erro}), 403
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar se já existe atribuição para o novo motorista
        cursor.execute('''
            SELECT id FROM encomenda_viatura 
            WHERE pedido_id = ? AND pedido_tipo = ? AND data_associacao = ? AND viatura_motorista_id = ?
        ''', (pedido_id, pedido_tipo, data_associacao, novo_viatura_motorista_id))
        
        if cursor.fetchone():
            return jsonify({'success': False, 'error': 'Encomenda já atribuída a este motorista'}), 400
        
        # Buscar dados da atribuição antiga (antes de remover)
        cursor.execute('''
            SELECT ev.*, vm.nome_motorista, vm.matricula
            FROM encomenda_viatura ev
            LEFT JOIN viatura_motorista vm ON ev.viatura_motorista_id = vm.id
            WHERE ev.pedido_id = ? AND ev.pedido_tipo = ? AND ev.data_associacao = ?
        ''', (pedido_id, pedido_tipo, data_associacao))
        atribuicao_antiga = cursor.fetchone()
        
        # Buscar dados do novo motorista
        cursor.execute('SELECT nome_motorista, matricula FROM viatura_motorista WHERE id = ?', (novo_viatura_motorista_id,))
        motorista_novo = cursor.fetchone()
        
        # Buscar dados do pedido
        tabela_pedido = 'pedidos_pendentes' if pedido_tipo == 'P' else 'pedidos_entregues'
        cursor.execute(f'SELECT * FROM {tabela_pedido} WHERE id = ?', (pedido_id,))
        pedido = cursor.fetchone()
        
        # Remover atribuição antiga
        ordem_antiga = atribuicao_antiga['ordem'] if atribuicao_antiga else 0
        viatura_origem_id = atribuicao_antiga['viatura_motorista_id'] if atribuicao_antiga else None
        
        cursor.execute('''
            DELETE FROM encomenda_viatura 
            WHERE pedido_id = ? AND pedido_tipo = ? AND data_associacao = ?
        ''', (pedido_id, pedido_tipo, data_associacao))
        
        # Obter a próxima ordem para o novo motorista nesta data
        cursor.execute('''
            SELECT COALESCE(MAX(ordem), 0) + 1 as proxima_ordem
            FROM encomenda_viatura
            WHERE viatura_motorista_id = ? AND data_associacao = ?
        ''', (novo_viatura_motorista_id, data_associacao))
        
        resultado = cursor.fetchone()
        proxima_ordem = resultado[0] if resultado else 1
        
        # Criar nova atribuição
        cursor.execute('''
            INSERT INTO encomenda_viatura (pedido_id, pedido_tipo, viatura_motorista_id, data_associacao, ordem)
            VALUES (?, ?, ?, ?, ?)
        ''', (pedido_id, pedido_tipo, novo_viatura_motorista_id, data_associacao, proxima_ordem))
        
        # Registar ação no histórico
        if atribuicao_antiga and motorista_novo and pedido:
            # Converter Row para dicionário para facilitar acesso
            pedido_dict = dict(pedido) if pedido else {}
            atribuicao_antiga_dict = dict(atribuicao_antiga) if atribuicao_antiga else {}
            motorista_novo_dict = dict(motorista_novo) if motorista_novo else {}
            
            cursor.execute('''
                INSERT INTO historico_acoes (tipo_acao, descricao, dados_acao)
                VALUES (?, ?, ?)
            ''', (
                'MOVER_ENCOMENDA',
                f'Mover encomenda: {pedido_dict.get("cliente", "")} - {atribuicao_antiga_dict.get("nome_motorista", "")} ({atribuicao_antiga_dict.get("matricula", "")}) → {motorista_novo_dict.get("nome_motorista", "")} ({motorista_novo_dict.get("matricula", "")})',
                json.dumps({
                    'pedido_id': pedido_id,
                    'pedido_tipo': pedido_tipo,
                    'viatura_origem_id': viatura_origem_id,
                    'viatura_destino_id': novo_viatura_motorista_id,
                    'data_associacao': data_associacao,
                    'ordem_original': ordem_antiga,
                    'ordem_nova': proxima_ordem,
                    'cliente': pedido_dict.get('cliente', ''),
                    'local_carga': pedido_dict.get('local_carga', ''),
                    'material': pedido_dict.get('material', ''),
                    'motorista_origem': atribuicao_antiga_dict.get('nome_motorista', ''),
                    'matricula_origem': atribuicao_antiga_dict.get('matricula', ''),
                    'motorista_destino': motorista_novo_dict.get('nome_motorista', ''),
                    'matricula_destino': motorista_novo_dict.get('matricula', '')
                })
            ))
        
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/apagar-card-dia', methods=['POST'])
def apagar_card_dia():
    """Apagar card de um motorista apenas para um dia específico (remove encomendas daquele dia)"""
    try:
        data = request.json
        viatura_motorista_id = data.get('viatura_motorista_id')
        data_associacao = data.get('data_associacao')
        
        if not viatura_motorista_id or not data_associacao:
            return jsonify({'success': False, 'error': 'Dados incompletos'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar se o motorista existe
        cursor.execute('SELECT id, matricula, nome_motorista FROM viatura_motorista WHERE id = ?', (viatura_motorista_id,))
        motorista = cursor.fetchone()
        
        if not motorista:
            conn.close()
            return jsonify({'success': False, 'error': 'Motorista não encontrado'}), 404
        
        # Buscar todas as encomendas associadas a este motorista nesta data (com ordem e dados completos)
        cursor.execute('''
            SELECT ev.pedido_id, ev.pedido_tipo, ev.ordem, 
                   pp.cliente, pp.local_carga, pp.material, pp.observacoes
            FROM encomenda_viatura ev
            LEFT JOIN pedidos_pendentes pp ON ev.pedido_tipo = 'P' AND ev.pedido_id = pp.id
            WHERE ev.viatura_motorista_id = ? AND ev.data_associacao = ?
        ''', (viatura_motorista_id, data_associacao))
        
        encomendas = cursor.fetchall()
        count_encomendas = len(encomendas)
        
        # Guardar dados completos para histórico (antes de remover)
        encomendas_dados = []
        for e in encomendas:
            encomenda_info = {
                'pedido_id': e[0],
                'pedido_tipo': e[1],
                'ordem': e[2]
            }
            # Adicionar dados da encomenda se disponíveis
            if e[3]:  # cliente
                encomenda_info['cliente'] = e[3]
            if e[4]:  # local_carga
                encomenda_info['local_carga'] = e[4]
            if e[5]:  # material
                encomenda_info['material'] = e[5]
            if e[6]:  # observacoes
                encomenda_info['observacoes'] = e[6]
            encomendas_dados.append(encomenda_info)
        
        # Remover todas as encomendas associadas a este motorista nesta data
        # (ao remover da tabela encomenda_viatura, elas automaticamente voltam para pendentes
        # porque a query de pendentes verifica se NÃO existe em encomenda_viatura)
        cursor.execute('''
            DELETE FROM encomenda_viatura
            WHERE viatura_motorista_id = ? AND data_associacao = ?
        ''', (viatura_motorista_id, data_associacao))
        
        # Verificar se é um card temporário apenas para esta data
        # Verificar se a coluna data_temporaria existe
        cursor.execute("PRAGMA table_info(viatura_motorista)")
        columns = [row[1] for row in cursor.fetchall()]
        has_data_temporaria = 'data_temporaria' in columns
        
        if has_data_temporaria:
            cursor.execute('''
                SELECT temporario, data_temporaria FROM viatura_motorista
                WHERE id = ?
            ''', (viatura_motorista_id,))
        else:
            cursor.execute('''
                SELECT temporario FROM viatura_motorista
                WHERE id = ?
            ''', (viatura_motorista_id,))
        
        card_info = cursor.fetchone()
        is_temporario = card_info[0] if card_info else 0
        data_temporaria = card_info[1] if card_info and has_data_temporaria else None
        
        # Remover matrícula temporária para esta data (se existir)
        # A tabela matricula_temporaria usa data_associacao, não data_temporaria
        cursor.execute('''
            DELETE FROM matricula_temporaria
            WHERE viatura_motorista_id = ? AND data_associacao = ?
        ''', (viatura_motorista_id, data_associacao))
        
        # Se for um card temporário criado especificamente para esta data, desativar completamente
        if is_temporario and data_temporaria == data_associacao:
            # Remover status para esta data
            cursor.execute('''
                DELETE FROM viatura_motorista_status
                WHERE viatura_motorista_id = ? AND data_status = ?
            ''', (viatura_motorista_id, data_associacao))
            cursor.execute('UPDATE viatura_motorista SET ativo = 0 WHERE id = ?', (viatura_motorista_id,))
            card_desativado = True
        else:
            # Para cards permanentes, criar um registo que indica que este card não deve aparecer nesta data
            # Criar uma entrada na tabela de status com um status especial "EXCLUIDO_DIA" que indica que o card não deve aparecer neste dia.
            cursor.execute('''
                INSERT OR REPLACE INTO viatura_motorista_status (viatura_motorista_id, data_status, status)
                VALUES (?, ?, 'EXCLUIDO_DIA')
            ''', (viatura_motorista_id, data_associacao))
            card_desativado = False
        
        # Registar ação no histórico (antes do commit)
        cursor.execute('''
            INSERT INTO historico_acoes (tipo_acao, descricao, dados_acao)
            VALUES (?, ?, ?)
        ''', (
            'APAGAR_CARD_DIA',
            f'Apagar card do dia: {motorista[2]} ({motorista[1]}) - {data_associacao}',
            json.dumps({
                'viatura_motorista_id': viatura_motorista_id,
                'data_associacao': data_associacao,
                'encomendas': encomendas_dados,
                'matricula': motorista[1],
                'nome_motorista': motorista[2]
            })
        ))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'encomendas_removidas': count_encomendas,
            'card_desativado': card_desativado
        })
    except Exception as e:
        import traceback
        print(f"Erro ao apagar card: {e}")
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/trocar-conjunto-motorista', methods=['POST'])
def trocar_conjunto_motorista():
    """Trocar apenas a matrícula do card para um dia específico (sem mover encomendas)"""
    try:
        data = request.json
        viatura_motorista_origem_id = data.get('viatura_motorista_origem_id')
        viatura_motorista_destino_id = data.get('viatura_motorista_destino_id')
        data_associacao = data.get('data_associacao')
        motivo = (data.get('motivo') or '').strip()
        codigo_autorizacao = data.get('codigo_autorizacao')
        
        # Verificar se a data de associação é anterior à atual
        permitido, msg_erro = verificar_data_anterior_e_codigo(data_associacao, codigo_autorizacao)
        if not permitido:
            return jsonify({'success': False, 'error': msg_erro}), 403
        
        if not viatura_motorista_origem_id or not viatura_motorista_destino_id or not data_associacao:
            return jsonify({'success': False, 'error': 'Dados incompletos'}), 400
        
        if viatura_motorista_origem_id == viatura_motorista_destino_id:
            return jsonify({'success': False, 'error': 'Não é possível trocar para o mesmo motorista'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar se os cards existem
        cursor.execute('SELECT id, matricula, codigo FROM viatura_motorista WHERE id = ?', (viatura_motorista_origem_id,))
        origem_info = cursor.fetchone()
        if not origem_info:
            conn.close()
            return jsonify({'success': False, 'error': 'Card origem não encontrado'}), 400
        
        cursor.execute('SELECT id, matricula, codigo FROM viatura_motorista WHERE id = ?', (viatura_motorista_destino_id,))
        destino_info = cursor.fetchone()
        if not destino_info:
            conn.close()
            return jsonify({'success': False, 'error': 'Card destino não encontrado'}), 400
        
        matricula_destino = destino_info[1]
        
        # Se o utilizador forneceu um código temporário explicitamente, usar esse
        # Caso contrário, usar o código do card destino
        codigo_temporario_fornecido = data.get('codigo_temporario')
        if codigo_temporario_fornecido and codigo_temporario_fornecido.strip():
            codigo_destino = codigo_temporario_fornecido.strip()
        else:
            codigo_destino = destino_info[2]
        
        # Criar ou atualizar matrícula/código temporários para aquele dia
        cursor.execute('''
            INSERT OR REPLACE INTO matricula_temporaria 
            (viatura_motorista_id, data_associacao, matricula_temporaria, codigo_temporaria, motivo)
            VALUES (?, ?, ?, ?, ?)
        ''', (viatura_motorista_origem_id, data_associacao, matricula_destino, codigo_destino or None, motivo))
        
        # Registar motivo da troca (se fornecido) para futura análise
        if motivo:
            cursor.execute('''
                INSERT INTO troca_conjunto_log 
                (viatura_origem_id, viatura_destino_id, data_associacao, motivo)
                VALUES (?, ?, ?, ?)
            ''', (viatura_motorista_origem_id, viatura_motorista_destino_id, data_associacao, motivo))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'matricula_alterada': matricula_destino})
    except Exception as e:
        import traceback
        print(f"Erro ao trocar conjunto: {e}")
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/exportar-wialong', methods=['POST'])
def exportar_wialong():
    """Exportar planeamento para formato Wialong (gera arquivo Excel)"""
    try:
        data = request.json or {}
        data_planeamento = data.get('data', date.today().isoformat())
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Buscar todas as viaturas com encomendas atribuídas para a data
        cursor.execute('''
            SELECT 
                vm.id as viatura_motorista_id,
                vm.matricula,
                vm.codigo,
                vm.nome_motorista,
                pp.cliente,
                pp.local_carga,
                pp.material
            FROM encomenda_viatura ev
            INNER JOIN viatura_motorista vm ON ev.viatura_motorista_id = vm.id
            INNER JOIN pedidos_pendentes pp ON ev.pedido_tipo = 'P' AND ev.pedido_id = pp.id
            WHERE ev.data_associacao = ?
            ORDER BY vm.matricula ASC, pp.cliente ASC
        ''', (data_planeamento,))
        
        dados_raw = cursor.fetchall()
        
        # Aplicar matrículas/códigos temporários se existirem
        dados = []
        for row in dados_raw:
            item = dict(row)
            vm_id = item['viatura_motorista_id']
            
            # Verificar se há matrícula/código temporários para este dia
            cursor.execute('''
                SELECT matricula_temporaria, codigo_temporaria
                FROM matricula_temporaria
                WHERE viatura_motorista_id = ? AND data_associacao = ?
            ''', (vm_id, data_planeamento))
            
            matricula_temp_row = cursor.fetchone()
            if matricula_temp_row:
                temp_matricula = matricula_temp_row[0] or ''
                temp_codigo   = matricula_temp_row[1]

                # Caso antigo: alguns registos guardaram "MATRICULA + CODIGO" tudo na matrícula
                if ('+' in temp_matricula):
                    partes = temp_matricula.split('+', 1)
                    base_mat = partes[0].strip()
                    base_cod = partes[1].strip() if len(partes) > 1 else ''
                    if base_mat:
                        item['matricula'] = base_mat
                    if base_cod:
                        item['codigo'] = base_cod
                    elif temp_codigo:
                        item['codigo'] = temp_codigo
                else:
                    # Cenário novo: campos separados
                    if temp_matricula:
                        item['matricula'] = temp_matricula
                    if temp_codigo:
                        item['codigo'] = temp_codigo
            
            # Remover o campo viatura_motorista_id que não é necessário
            del item['viatura_motorista_id']
            dados.append(item)
        
        conn.close()
        
        return jsonify({
            'success': True,
            'data': dados,
            'data_planeamento': data_planeamento
        })
    except Exception as e:
        import traceback
        print(f"Erro ao exportar para Wialong: {e}")
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/atualizar-wialong', methods=['POST'])
def atualizar_wialong_api():
    """Atualizar ficheiro Wialong diretamente (executa automaticamente)"""
    try:
        data = request.json or {}
        data_planeamento = data.get('data', date.today().isoformat())
        
        # Importar e executar função do script
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        
        # Importar módulo (ele tentará instalar openpyxl automaticamente se necessário)
        try:
            from enviar_para_wialong import atualizar_wialong, encontrar_ficheiro_wialong, OPENPYXL_AVAILABLE
            
            # Verificar se openpyxl está disponível
            if not OPENPYXL_AVAILABLE:
                error_msg = (
                    "openpyxl não está disponível.\n\n"
                    "Por favor, execute no terminal:\n"
                    "pip install openpyxl\n\n"
                    "Ou instale todas as dependências:\n"
                    "pip install -r requirements.txt\n\n"
                    "Depois reinicie o servidor Flask."
                )
                return jsonify({
                    'success': False,
                    'error': error_msg,
                    'tipo_erro': 'MissingDependency',
                    'instrucoes': 'Execute: pip install openpyxl e reinicie o servidor'
                }), 500
        except ImportError as e_import:
            error_msg = f"Erro ao importar módulo enviar_para_wialong: {str(e_import)}"
            print(error_msg)
            return jsonify({
                'success': False,
                'error': error_msg,
                'tipo_erro': 'ImportError'
            }), 500
        
        # Tentar encontrar o ficheiro Wialong automaticamente
        print(f"Procurando ficheiro Wialong...")
        try:
            caminho_wialong = encontrar_ficheiro_wialong()
            print(f"Resultado da busca: {caminho_wialong}")
        except Exception as e_busca:
            import traceback
            print(f"Erro ao procurar ficheiro Wialong: {e_busca}")
            print(traceback.format_exc())
            return jsonify({
                'success': False,
                'error': f'Erro ao procurar ficheiro Wialong: {str(e_busca)}',
                'instrucoes': f'Por favor, coloque o ficheiro "Wialong.xlsx" ou "Wialong.xlsm" na pasta Wialon junto à aplicação.'
            }), 500
        
        if not caminho_wialong:
            return jsonify({
                'success': False,
                'error': 'Ficheiro Wialong não encontrado automaticamente',
                'instrucoes': f'Por favor, coloque o ficheiro "Wialong.xlsx" ou "Wialong.xlsm" na pasta Wialon junto à aplicação (C:\\Users\\henri\\Desktop\\Projeto\\web_app_old_2\\Wialon).'
            }), 404
        
        # Executar atualização (sem perguntas interativas)
        print(f"Tentando atualizar Wialong: {caminho_wialong} para data {data_planeamento}")
        
        # Verificar se o ficheiro existe antes de tentar atualizar
        import os
        if not os.path.exists(caminho_wialong):
            return jsonify({
                'success': False,
                'error': f'Ficheiro não encontrado: {caminho_wialong}',
                'instrucoes': 'Verifique se o ficheiro existe no caminho indicado.'
            }), 404
        
        try:
            print(f"Iniciando atualização do ficheiro Wialong...")
            sucesso = atualizar_wialong(caminho_wialong, data_planeamento, limpar_antigos=False, modo_silencioso=True)
            print(f"Resultado da atualização: {sucesso}")
            
            if sucesso:
                # A abertura já foi feita dentro da função atualizar_wialong
                # Não abrir novamente aqui para evitar duplicação
                print("✓ Processo concluído")
                
                return jsonify({
                    'success': True,
                    'message': f'Ficheiro Wialong atualizado com sucesso para a data {data_planeamento}',
                    'ficheiro': caminho_wialong
                })
            else:
                # Verificar se não há dados
                conn = get_db()
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT COUNT(*) as total
                    FROM encomenda_viatura ev
                    WHERE ev.data_associacao = ?
                ''', (data_planeamento,))
                total = cursor.fetchone()[0]
                conn.close()
                
                print(f"Total de encomendas para {data_planeamento}: {total}")
                
                if total == 0:
                    return jsonify({
                        'success': False,
                        'error': f'Nenhuma encomenda atribuída para a data {data_planeamento}'
                    }), 400
                else:
                    # Verificar se é erro de permissão
                    return jsonify({
                        'success': False,
                        'error': 'Erro ao atualizar ficheiro. Verifique se o ficheiro não está aberto no Excel ou se tem permissões de escrita. Verifique também os logs do servidor para mais detalhes.'
                    }), 500
        except PermissionError as e_perm:
            import traceback
            error_details = traceback.format_exc()
            print(f"Erro de permissão ao atualizar Wialong: {error_details}")
            error_msg = str(e_perm)
            if "Ficheiro está em uso" in error_msg or "permissões de escrita" in error_msg:
                return jsonify({
                    'success': False,
                    'error': error_msg
                }), 500
            else:
                return jsonify({
                    'success': False,
                    'error': f'Erro ao atualizar ficheiro. Verifique se o ficheiro não está aberto no Excel ou se tem permissões de escrita.\n\nDica: Feche o ficheiro Wialong se estiver aberto no Excel.'
                }), 500
        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            print(f"Erro detalhado ao atualizar Wialong: {error_details}")
            error_msg = str(e)
            error_type = type(e).__name__
            
            # Mensagens de erro mais específicas
            if "PermissionError" in error_type or "permission" in error_msg.lower() or "em uso" in error_msg.lower():
                return jsonify({
                    'success': False,
                    'error': 'O ficheiro está aberto no Excel ou não tem permissões de escrita.\n\nPor favor, feche o ficheiro Wialong.xlsm no Excel e tente novamente.',
                    'tipo_erro': 'PermissionError'
                }), 500
            elif "FileNotFoundError" in error_type or "não encontrado" in error_msg.lower():
                return jsonify({
                    'success': False,
                    'error': f'Ficheiro não encontrado: {caminho_wialong}',
                    'tipo_erro': 'FileNotFoundError'
                }), 404
            elif "openpyxl" in error_msg.lower() or "load_workbook" in error_msg.lower():
                return jsonify({
                    'success': False,
                    'error': f'Erro ao abrir o ficheiro Excel. Verifique se o ficheiro não está corrompido.\n\nErro: {error_msg}',
                    'tipo_erro': 'ExcelError'
                }), 500
            else:
                return jsonify({
                    'success': False,
                    'error': f'Erro ao atualizar ficheiro.\n\nErro: {error_msg}\n\nTipo: {error_type}\n\nVerifique os logs do servidor para mais detalhes.',
                    'tipo_erro': error_type,
                    'detalhes': error_details[:500] if len(error_details) > 500 else error_details
                }), 500
            
    except Exception as e:
        import traceback
        print(f"Erro ao atualizar Wialong via API: {e}")
        print(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/encomendas-motorista-data', methods=['GET'])
def get_encomendas_motorista_data():
    """Obter encomendas de um motorista para uma data específica 
    ou para o último dia anterior com serviço (antes de uma data de referência)
    Busca pelo NOME DO MOTORISTA, não pela matrícula"""
    try:
        viatura_motorista_id = request.args.get('viatura_motorista_id', type=int)
        nome_motorista = request.args.get('nome_motorista', '').strip()
        data_str = request.args.get('data')  # ainda suportado, se vier força essa data
        data_referencia = request.args.get('data_referencia')  # nova: data limite (exclusiva) para procurar o último serviço
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Se foi fornecido nome_motorista, buscar todos os cards desse motorista
        if nome_motorista:
            cursor.execute('''
                SELECT id FROM viatura_motorista 
                WHERE nome_motorista = ? AND ativo = 1
            ''', (nome_motorista,))
            cards_motorista = [row[0] for row in cursor.fetchall()]
            if not cards_motorista:
                conn.close()
                return jsonify([])  # motorista não encontrado
        elif viatura_motorista_id:
            # Se não há nome mas há ID, usar apenas esse ID
            cards_motorista = [viatura_motorista_id]
        else:
            return jsonify({'error': 'Parâmetros inválidos: forneça nome_motorista ou viatura_motorista_id'}), 400

        # Se não for fornecida data, encontrar a última data em que este motorista teve serviço
        if not data_str:
            if data_referencia:
                # Último dia ANTERIOR à data de referência (buscar em todos os cards do motorista)
                placeholders = ','.join(['?'] * len(cards_motorista))
                cursor.execute(f'''
                    SELECT MAX(data_associacao) 
                    FROM encomenda_viatura 
                    WHERE viatura_motorista_id IN ({placeholders}) AND data_associacao < ?
                ''', (*cards_motorista, data_referencia))
            else:
                # Caso não haja data de referência, usar simplesmente o último dia com serviço
                placeholders = ','.join(['?'] * len(cards_motorista))
                cursor.execute(f'''
                    SELECT MAX(data_associacao) 
                    FROM encomenda_viatura 
                    WHERE viatura_motorista_id IN ({placeholders})
                ''', tuple(cards_motorista))

            row = cursor.fetchone()
            if not row or not row[0]:
                conn.close()
                return jsonify([])  # sem serviço anterior
            data_str = row[0]
        
        # Buscar encomendas de todos os cards desse motorista na data encontrada
        placeholders = ','.join(['?'] * len(cards_motorista))
        cursor.execute(f'''
            SELECT 
                pp.cliente,
                pp.local_carga,
                pp.material,
                ev.data_associacao
            FROM encomenda_viatura ev
            INNER JOIN pedidos_pendentes pp ON ev.pedido_tipo = 'P' AND ev.pedido_id = pp.id
            WHERE ev.viatura_motorista_id IN ({placeholders}) AND ev.data_associacao = ?
            ORDER BY pp.cliente ASC
        ''', (*cards_motorista, data_str))
        
        encomendas = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return jsonify(encomendas)
    except Exception as e:
        import traceback
        print(f"Erro ao buscar encomendas do motorista: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/historico-entregas', methods=['GET'])
def get_historico_entregas():
    """Obter histórico de entregas (encomendas atribuídas) com filtro por intervalo de datas"""
    try:
        data_inicio = request.args.get('data_inicio', None)
        data_fim = request.args.get('data_fim', None)
        conn = get_db()
        cursor = conn.cursor()
        
        # Construir query base - usar COALESCE para garantir que os campos sejam retornados
        # IMPORTANTE: usar aliases explícitos para garantir nomes corretos
        query = '''
            SELECT 
                ev.data_associacao as data_associacao,
                vm.matricula || ' + ' || vm.codigo || ' - ' || vm.nome_motorista as viatura_motorista,
                COALESCE(pp.cliente, pe.cliente, '') as cliente,
                COALESCE(pp.local_carga, pe.local_carga, '') as local_carga,
                COALESCE(pp.material, pe.material, '') as material
            FROM encomenda_viatura ev
            INNER JOIN viatura_motorista vm ON ev.viatura_motorista_id = vm.id
            LEFT JOIN pedidos_pendentes pp ON ev.pedido_tipo = 'P' AND ev.pedido_id = pp.id
            LEFT JOIN pedidos_entregues pe ON ev.pedido_tipo = 'E' AND ev.pedido_id = pe.id
            WHERE (pp.id IS NOT NULL OR pe.id IS NOT NULL)
        '''
        
        params = []
        
        if data_inicio:
            query += ' AND ev.data_associacao >= ?'
            params.append(data_inicio)
        
        if data_fim:
            query += ' AND ev.data_associacao <= ?'
            params.append(data_fim)
        
        # Se não houver filtros, mostrar últimos 30 dias
        if not data_inicio and not data_fim:
            query += ' AND ev.data_associacao >= date(\'now\', \'-30 days\')'
        
        query += ' ORDER BY ev.data_associacao DESC, vm.matricula ASC'
        
        if params:
            cursor.execute(query, tuple(params))
        else:
            cursor.execute(query)
        
        # Converter para dicionário
        historico = []
        rows = cursor.fetchall()
        
        # Debug: verificar colunas retornadas
        if rows:
            columns = [description[0] for description in cursor.description]
            print(f"DEBUG - Colunas retornadas pela query SQL: {columns}")
            first_row = dict(rows[0])
            print(f"DEBUG - Primeira linha do banco: {first_row}")
            print(f"DEBUG - Chaves disponíveis: {list(first_row.keys())}")
        
        for row in rows:
            row_dict = dict(row)
            
            # O servidor está retornando 'data' e 'local_descarga', mas precisamos mapear para
            # 'data_associacao' e 'local_carga' que o frontend espera
            # Aceitar ambos os formatos para compatibilidade
            data_assoc = (row_dict.get('data_associacao') or 
                         row_dict.get('data') or '')
            
            local_carga = (row_dict.get('local_carga') or 
                          row_dict.get('local_descarga') or '')
            
            # Converter data para string
            if data_assoc:
                if isinstance(data_assoc, date):
                    data_assoc = data_assoc.isoformat()
                elif isinstance(data_assoc, datetime):
                    data_assoc = data_assoc.date().isoformat()
                elif isinstance(data_assoc, str):
                    # Já é string, manter
                    pass
                else:
                    data_assoc = str(data_assoc)
            else:
                data_assoc = ''
            
            # Garantir que sempre retornamos com os nomes corretos que o frontend espera
            historico.append({
                'data_associacao': data_assoc,
                'viatura_motorista': row_dict.get('viatura_motorista', '') or '',
                'cliente': row_dict.get('cliente', '') or '',
                'local_carga': local_carga,
                'material': row_dict.get('material', '') or ''
            })
        
        print(f"DEBUG - Total de registros processados: {len(historico)}")
        if historico:
            print(f"DEBUG - Primeiro registro FINAL que será enviado: {historico[0]}")
            print(f"DEBUG - Chaves do primeiro registro final: {list(historico[0].keys())}")
        
        conn.close()
        return jsonify(historico)
    except Exception as e:
        import traceback
        print(f"Erro ao buscar histórico: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/analise-clientes', methods=['GET'])
def analise_clientes():
    """Análise de clientes e utilização de frota para um período específico."""
    try:
        # Aceitar data_inicio e data_fim, ou ano como fallback
        data_inicio = request.args.get('data_inicio')
        data_fim = request.args.get('data_fim')
        
        if data_inicio and data_fim:
            inicio = data_inicio
            fim = data_fim
        else:
            # Fallback para ano (compatibilidade com código antigo)
            ano = request.args.get('ano', type=int) or date.today().year
            inicio = f"{ano}-01-01"
            fim = f"{ano}-12-31"

        conn = get_db()
        cursor = conn.cursor()

        # Top clientes/local de carga: total de cargas, média mensal, meses ativos
        cursor.execute('''
            SELECT 
                COALESCE(cliente, '') AS cliente,
                COALESCE(local_carga, '') AS local_carga,
                COUNT(*) AS total_cargas,
                COUNT(DISTINCT strftime('%m', data_entrega)) AS meses_ativo
            FROM pedidos_pendentes
            WHERE data_entrega BETWEEN ? AND ?
            GROUP BY cliente, local_carga
            ORDER BY total_cargas DESC, cliente ASC
            LIMIT 50
        ''', (inicio, fim))

        clientes_rows = cursor.fetchall()
        clientes = []
        for row in clientes_rows:
            total = row['total_cargas']
            meses_ativo = row['meses_ativo'] or 1
            # Calcular média mensal baseada no período real
            from datetime import datetime
            data_inicio_obj = datetime.strptime(inicio, '%Y-%m-%d')
            data_fim_obj = datetime.strptime(fim, '%Y-%m-%d')
            dias_periodo = (data_fim_obj - data_inicio_obj).days + 1
            meses_periodo = max(1, dias_periodo / 30.0)  # Aproximação: 30 dias por mês
            media_mensal = total / meses_periodo
            clientes.append({
                'cliente': row['cliente'],
                'local_carga': row['local_carga'],
                'total_cargas': total,
                'meses_ativo': meses_ativo,
                'media_mensal': media_mensal
            })

        # Distribuição mensal: total de cargas e nº de clientes únicos
        cursor.execute('''
            SELECT 
                strftime('%m', data_entrega) AS mes,
                COUNT(*) AS total_cargas,
                COUNT(DISTINCT cliente) AS clientes_unicos
            FROM pedidos_pendentes
            WHERE data_entrega BETWEEN ? AND ?
            GROUP BY mes
            ORDER BY mes
        ''', (inicio, fim))

        mensal_rows = cursor.fetchall()
        mensal = []
        for row in mensal_rows:
            mes_num = int(row['mes'])
            mensal.append({
                'mes': mes_num,
                'mes_label': f"{mes_num:02d}",
                'total_cargas': row['total_cargas'],
                'clientes_unicos': row['clientes_unicos']
            })
        # Análise de viaturas / motoristas
        cursor.execute('''
            SELECT 
                vm.id,
                vm.matricula,
                vm.codigo,
                vm.nome_motorista,
                vm.matricula || ' + ' || vm.codigo || ' - ' || vm.nome_motorista AS viatura,
                COUNT(*) AS total_cargas,
                COUNT(DISTINCT ev.data_associacao) AS dias_servico,
                COUNT(DISTINCT pp.cliente) AS clientes_diferentes
            FROM encomenda_viatura ev
            INNER JOIN viatura_motorista vm ON ev.viatura_motorista_id = vm.id
            INNER JOIN pedidos_pendentes pp ON ev.pedido_tipo = 'P' AND ev.pedido_id = pp.id
            WHERE ev.data_associacao BETWEEN ? AND ?
            GROUP BY vm.id
            ORDER BY total_cargas DESC, viatura ASC
        ''', (inicio, fim))

        viaturas_rows = cursor.fetchall()
        viaturas = []
        for row in viaturas_rows:
            total_cargas = row['total_cargas']
            dias_servico = row['dias_servico'] or 1
            media_cargas_dia = total_cargas / dias_servico if dias_servico > 0 else 0
            viaturas.append({
                'viatura': row['viatura'],
                'matricula': row['matricula'],
                'codigo': row['codigo'],
                'nome_motorista': row['nome_motorista'],
                'total_cargas': total_cargas,
                'dias_servico': dias_servico,
                'clientes_diferentes': row['clientes_diferentes'],
                'media_cargas_dia': round(media_cargas_dia, 2)
            })

        # Análise de tempo em oficina (por matrícula de trator e galera separadamente)
        # Buscar trocas de conjunto com motivo
        cursor.execute('''
            SELECT 
                vm_origem.matricula AS matricula_origem,
                vm_origem.codigo AS codigo_origem,
                vm_destino.matricula AS matricula_destino,
                vm_destino.codigo AS codigo_destino,
                tcl.data_associacao AS data_troca,
                tcl.motivo,
                COUNT(*) AS vezes_trocado
            FROM troca_conjunto_log tcl
            INNER JOIN viatura_motorista vm_origem ON tcl.viatura_origem_id = vm_origem.id
            INNER JOIN viatura_motorista vm_destino ON tcl.viatura_destino_id = vm_destino.id
            WHERE tcl.data_associacao BETWEEN ? AND ? AND tcl.motivo IS NOT NULL AND tcl.motivo != ''
            GROUP BY vm_origem.matricula, vm_origem.codigo, vm_destino.matricula, vm_destino.codigo, tcl.motivo
        ''', (inicio, fim))
        
        trocas_rows = cursor.fetchall()
        
        # Agrupar por matrícula (trator) e código (galera) separadamente
        tempo_oficina_tratores = {}
        tempo_oficina_galeras = {}
        
        for row in trocas_rows:
            matricula_origem = row['matricula_origem']
            codigo_origem = row['codigo_origem']
            motivo = row['motivo'] or 'Sem motivo especificado'
            vezes = row['vezes_trocado']
            
            # Análise por trator (matrícula)
            if matricula_origem:
                if matricula_origem not in tempo_oficina_tratores:
                    tempo_oficina_tratores[matricula_origem] = {
                        'matricula': matricula_origem,
                        'total_trocas': 0,
                        'motivos': {}
                    }
                tempo_oficina_tratores[matricula_origem]['total_trocas'] += vezes
                if motivo not in tempo_oficina_tratores[matricula_origem]['motivos']:
                    tempo_oficina_tratores[matricula_origem]['motivos'][motivo] = 0
                tempo_oficina_tratores[matricula_origem]['motivos'][motivo] += vezes
            
            # Análise por galera (código)
            if codigo_origem:
                if codigo_origem not in tempo_oficina_galeras:
                    tempo_oficina_galeras[codigo_origem] = {
                        'codigo': codigo_origem,
                        'total_trocas': 0,
                        'motivos': {}
                    }
                tempo_oficina_galeras[codigo_origem]['total_trocas'] += vezes
                if motivo not in tempo_oficina_galeras[codigo_origem]['motivos']:
                    tempo_oficina_galeras[codigo_origem]['motivos'][motivo] = 0
                tempo_oficina_galeras[codigo_origem]['motivos'][motivo] += vezes
        
        # Converter para listas ordenadas
        tempo_oficina_tratores_list = sorted(
            tempo_oficina_tratores.values(),
            key=lambda x: x['total_trocas'],
            reverse=True
        )
        tempo_oficina_galeras_list = sorted(
            tempo_oficina_galeras.values(),
            key=lambda x: x['total_trocas'],
            reverse=True
        )

        # Análise de eficiência: carga média por dia útil
        dias_uteis_ano = 0
        cursor.execute('''
            SELECT COUNT(DISTINCT data_associacao) as dias
            FROM encomenda_viatura
            WHERE data_associacao BETWEEN ? AND ?
        ''', (inicio, fim))
        dias_uteis_row = cursor.fetchone()
        dias_uteis_ano = dias_uteis_row[0] if dias_uteis_row else 0

        # Top 10 clientes
        top_clientes = clientes[:10] if len(clientes) > 10 else clientes

        conn.close()

        return jsonify({
            'data_inicio': inicio,
            'data_fim': fim,
            'clientes': clientes,
            'mensal': mensal,
            'viaturas': viaturas,
            'tempo_oficina_tratores': tempo_oficina_tratores_list,
            'tempo_oficina_galeras': tempo_oficina_galeras_list,
            'dias_uteis_ano': dias_uteis_ano,
            'top_clientes': top_clientes
        })
    except Exception as e:
        import traceback
        print(f"Erro na análise de clientes: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/reordenar-encomendas-motorista', methods=['POST'])
def reordenar_encomendas_motorista():
    """Reordenar encomendas dentro do mesmo card (por encomenda_viatura.id e data)"""
    try:
        data = request.json
        data_associacao = data.get('data_associacao')
        ids_ordenados = data.get('ids', [])  # IDs (encomenda_viatura.id) na nova ordem
        
        if not data_associacao or not ids_ordenados:
            return jsonify({'success': False, 'error': 'Dados incompletos (data_associacao e ids obrigatórios)'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Atualizar a ordem de cada encomenda (por id e data, funciona com atribuicao_id ou viatura_motorista_id)
        for ordem, encomenda_id in enumerate(ids_ordenados, start=1):
            cursor.execute('''
                UPDATE encomenda_viatura 
                SET ordem = ?
                WHERE id = ? AND data_associacao = ?
            ''', (ordem, encomenda_id, data_associacao))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True})
    except Exception as e:
        import traceback
        print(f"Erro ao reordenar encomendas: {e}")
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== ROTAS PARA REVERTER AÇÕES ====================

@app.route('/api/acoes-reverter', methods=['GET'])
def get_acoes_reverter():
    """Obter lista de ações recentes que podem ser revertidas"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Buscar últimas 50 ações, ordenadas por data mais recente
        cursor.execute('''
            SELECT id, tipo_acao, descricao, dados_acao, data_acao, revertido
            FROM historico_acoes
            ORDER BY data_acao DESC
            LIMIT 50
        ''')
        
        acoes = []
        for row in cursor.fetchall():
            acoes.append({
                'id': row[0],
                'tipo_acao': row[1],
                'descricao': row[2],
                'dados_acao': row[3],
                'data_acao': row[4],
                'revertido': bool(row[5])
            })
        
        conn.close()
        return jsonify(acoes)
    except Exception as e:
        import traceback
        print(f"Erro ao obter ações: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/analises', methods=['GET'])
def get_analises():
    """Obter dados agregados para análises"""
    try:
        data_inicio = request.args.get('data_inicio')
        data_fim = request.args.get('data_fim')
        motorista_id = request.args.get('motorista_id', '')
        cliente = request.args.get('cliente', '')
        material = request.args.get('material', '')
        
        if not data_inicio or not data_fim:
            return jsonify({'error': 'Data início e data fim são obrigatórias'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Construir query base
        where_conditions = ['ev.data_associacao BETWEEN ? AND ?']
        params = [data_inicio, data_fim]
        
        if motorista_id:
            where_conditions.append('ev.viatura_motorista_id = ?')
            params.append(motorista_id)
        
        if cliente:
            where_conditions.append('pp.cliente = ? OR pe.cliente = ?')
            params.extend([cliente, cliente])
        
        if material:
            where_conditions.append('(pp.material = ? OR pe.material = ?)')
            params.extend([material, material])
        
        where_clause = ' AND '.join(where_conditions)
        
        # Resumo geral
        cursor.execute(f'''
            SELECT 
                COUNT(DISTINCT ev.id) as total_entregas,
                COUNT(DISTINCT ev.viatura_motorista_id) as total_motoristas,
                COUNT(DISTINCT COALESCE(pp.cliente, pe.cliente)) as total_clientes
            FROM encomenda_viatura ev
            LEFT JOIN pedidos_pendentes pp ON ev.pedido_id = pp.id AND ev.pedido_tipo = 'P'
            LEFT JOIN pedidos_entregues pe ON ev.pedido_id = pe.id AND ev.pedido_tipo = 'E'
            WHERE {where_clause}
        ''', params)
        
        resumo_row = cursor.fetchone()
        total_entregas = resumo_row['total_entregas'] if resumo_row else 0
        total_motoristas = resumo_row['total_motoristas'] if resumo_row else 0
        total_clientes = resumo_row['total_clientes'] if resumo_row else 0
        
        # Calcular média diária
        from datetime import datetime, timedelta
        inicio = datetime.strptime(data_inicio, '%Y-%m-%d')
        fim = datetime.strptime(data_fim, '%Y-%m-%d')
        dias = (fim - inicio).days + 1
        media_diaria = total_entregas / dias if dias > 0 else 0
        
        # Entregas por dia
        cursor.execute(f'''
            SELECT 
                ev.data_associacao as data,
                COUNT(ev.id) as total
            FROM encomenda_viatura ev
            LEFT JOIN pedidos_pendentes pp ON ev.pedido_id = pp.id AND ev.pedido_tipo = 'P'
            LEFT JOIN pedidos_entregues pe ON ev.pedido_id = pe.id AND ev.pedido_tipo = 'E'
            WHERE {where_clause}
            GROUP BY ev.data_associacao
            ORDER BY ev.data_associacao
        ''', params)
        
        entregas_por_dia = []
        for row in cursor.fetchall():
            entregas_por_dia.append({
                'data': row['data'],
                'total': row['total']
            })
        
        # Entregas por motorista
        cursor.execute(f'''
            SELECT 
                vm.nome_motorista || ' (' || vm.matricula || ')' as motorista,
                COUNT(ev.id) as total
            FROM encomenda_viatura ev
            INNER JOIN viatura_motorista vm ON ev.viatura_motorista_id = vm.id
            LEFT JOIN pedidos_pendentes pp ON ev.pedido_id = pp.id AND ev.pedido_tipo = 'P'
            LEFT JOIN pedidos_entregues pe ON ev.pedido_id = pe.id AND ev.pedido_tipo = 'E'
            WHERE {where_clause}
            GROUP BY vm.id, vm.nome_motorista, vm.matricula
            ORDER BY total DESC
            LIMIT 20
        ''', params)
        
        entregas_por_motorista = []
        for row in cursor.fetchall():
            entregas_por_motorista.append({
                'motorista': row['motorista'],
                'total': row['total']
            })
        
        # Disponibilidades forçadas no período
        cursor.execute('''
            SELECT 
                ha.id,
                ha.descricao,
                ha.data_acao,
                ha.dados_acao
            FROM historico_acoes ha
            WHERE ha.tipo_acao = 'DISPONIBILIDADE_FORCADA'
            AND DATE(ha.data_acao) BETWEEN ? AND ?
            ORDER BY ha.data_acao DESC
        ''', (data_inicio, data_fim))
        
        disponibilidades_forcadas = []
        rows_fetch = cursor.fetchall()
        print(f"DEBUG - get_analises: Encontradas {len(rows_fetch)} linhas de disponibilidades forçadas")
        
        for row in rows_fetch:
            print(f"DEBUG - Processando linha: id={row['id']}, descricao={row['descricao']}, dados_acao={row['dados_acao']}")
            try:
                dados = json.loads(row['dados_acao']) if row['dados_acao'] else {}
                print(f"DEBUG - Dados parseados: {dados}")
            except Exception as e:
                print(f"DEBUG - Erro ao fazer parse do JSON: {e}, dados_acao={row['dados_acao']}")
                dados = {}
            
            # Converter data_acao para string ISO se for datetime
            data_acao_str = row['data_acao']
            if hasattr(data_acao_str, 'isoformat'):
                data_acao_str = data_acao_str.isoformat()
            elif isinstance(data_acao_str, str):
                # Já é string
                pass
            else:
                data_acao_str = str(data_acao_str)
            
            item = {
                'id': row['id'],
                'descricao': row['descricao'],
                'data': data_acao_str,
                'nome_motorista': dados.get('nome_motorista', '') if dados else '',
                'matricula': dados.get('matricula', '') if dados else '',
                'status_anterior': dados.get('status_anterior', '') if dados else '',
                'data_status': dados.get('data_status', '') if dados else ''
            }
            print(f"DEBUG - Item criado: {item}")
            disponibilidades_forcadas.append(item)
        
        print(f"DEBUG - Disponibilidades forçadas encontradas: {len(disponibilidades_forcadas)}")
        if len(disponibilidades_forcadas) > 0:
            print(f"DEBUG - Primeira disponibilidade forçada: {disponibilidades_forcadas[0]}")
        
        # Entregas por cliente
        cursor.execute(f'''
            SELECT 
                COALESCE(pp.cliente, pe.cliente) as cliente,
                COUNT(ev.id) as total
            FROM encomenda_viatura ev
            LEFT JOIN pedidos_pendentes pp ON ev.pedido_id = pp.id AND ev.pedido_tipo = 'P'
            LEFT JOIN pedidos_entregues pe ON ev.pedido_id = pe.id AND ev.pedido_tipo = 'E'
            WHERE {where_clause} AND COALESCE(pp.cliente, pe.cliente) IS NOT NULL
            GROUP BY COALESCE(pp.cliente, pe.cliente)
            ORDER BY total DESC
            LIMIT 20
        ''', params)
        
        entregas_por_cliente = []
        for row in cursor.fetchall():
            entregas_por_cliente.append({
                'cliente': row['cliente'],
                'total': row['total']
            })
        
        # Entregas por material
        cursor.execute(f'''
            SELECT 
                COALESCE(pp.material, pe.material) as material,
                COUNT(ev.id) as total
            FROM encomenda_viatura ev
            LEFT JOIN pedidos_pendentes pp ON ev.pedido_id = pp.id AND ev.pedido_tipo = 'P'
            LEFT JOIN pedidos_entregues pe ON ev.pedido_id = pe.id AND ev.pedido_tipo = 'E'
            WHERE {where_clause} AND COALESCE(pp.material, pe.material) IS NOT NULL
            GROUP BY COALESCE(pp.material, pe.material)
            ORDER BY total DESC
            LIMIT 20
        ''', params)
        
        entregas_por_material = []
        for row in cursor.fetchall():
            entregas_por_material.append({
                'material': row['material'],
                'total': row['total']
            })
        
        # Noite fora: dias em que cada motorista ficou fora (sem duplicados por data)
        cursor.execute('''
            SELECT nf.data, nf.motorista_id, m.nome as nome_motorista
            FROM motorista_noite_fora nf
            JOIN motoristas m ON nf.motorista_id = m.id
            WHERE nf.data BETWEEN ? AND ?
            ORDER BY m.nome, nf.data
        ''', (data_inicio, data_fim))
        noite_fora_rows = cursor.fetchall()
        noite_fora_por_motorista = {}  # motorista_id -> { nome, dias: set of date strings }
        for row in noite_fora_rows:
            mid = row['motorista_id']
            if mid not in noite_fora_por_motorista:
                noite_fora_por_motorista[mid] = {'motorista_id': mid, 'nome_motorista': row['nome_motorista'], 'dias': []}
            d = row['data'] if isinstance(row['data'], str) else (row['data'].isoformat() if hasattr(row['data'], 'isoformat') else str(row['data']))
            if d not in noite_fora_por_motorista[mid]['dias']:
                noite_fora_por_motorista[mid]['dias'].append(d)
        noite_fora_list = sorted(noite_fora_por_motorista.values(), key=lambda x: x['nome_motorista'])
        for item in noite_fora_list:
            item['dias'].sort()
            item['total_dias'] = len(item['dias'])
        
        conn.close()
        
        return jsonify({
            'resumo': {
                'total_entregas': total_entregas,
                'total_motoristas': total_motoristas,
                'total_clientes': total_clientes,
                'media_diaria': round(media_diaria, 2),
                'total_disponibilidades_forcadas': len(disponibilidades_forcadas)
            },
            'entregas_por_dia': entregas_por_dia,
            'entregas_por_motorista': entregas_por_motorista,
            'entregas_por_cliente': entregas_por_cliente,
            'entregas_por_material': entregas_por_material,
            'disponibilidades_forcadas': disponibilidades_forcadas,
            'noite_fora_por_motorista': noite_fora_list
        })
    except Exception as e:
        import traceback
        print(f"Erro ao obter análises: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/historico-alteracoes', methods=['GET'])
def get_historico_alteracoes():
    """Obter histórico completo de alterações para Anti-Crianças"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Buscar todas as ações, ordenadas por data mais recente
        cursor.execute('''
            SELECT id, tipo_acao, descricao, dados_acao, data_acao, revertido
            FROM historico_acoes
            ORDER BY data_acao DESC
            LIMIT 200
        ''')
        
        acoes = []
        for row in cursor.fetchall():
            acoes.append({
                'id': row[0],
                'tipo_acao': row[1],
                'descricao': row[2],
                'dados_acao': row[3],
                'data_acao': row[4],
                'revertido': bool(row[5])
            })
        
        conn.close()
        return jsonify(acoes)
    except Exception as e:
        import traceback
        print(f"Erro ao obter histórico de alterações: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/reverter-acao/<int:acao_id>', methods=['POST'])
def reverter_acao(acao_id):
    """Reverter uma ação específica"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Buscar a ação
        cursor.execute('''
            SELECT id, tipo_acao, descricao, dados_acao, revertido
            FROM historico_acoes
            WHERE id = ?
        ''', (acao_id,))
        
        acao = cursor.fetchone()
        if not acao:
            conn.close()
            return jsonify({'success': False, 'error': 'Ação não encontrada'}), 404
        
        # Permitir reverter múltiplas vezes (toggle)
        # Não bloquear se já foi revertido
        
        tipo_acao = acao[1]
        dados_json = json.loads(acao[3])
        ja_foi_revertido = bool(acao[4])  # Guardar estado atual para lógica condicional se necessário
        
        print(f"DEBUG - Reverter ação {acao_id}: tipo={tipo_acao}, já_revertido={ja_foi_revertido}")
        
        # Reverter a ação baseado no tipo
        if tipo_acao == 'APAGAR_CARD_DIA':
            # Recriar encomendas e remover status EXCLUIDO_DIA
            viatura_motorista_id = dados_json.get('viatura_motorista_id')
            data_associacao = dados_json.get('data_associacao')
            encomendas = dados_json.get('encomendas', [])
            
            # Remover status EXCLUIDO_DIA
            cursor.execute('''
                DELETE FROM viatura_motorista_status
                WHERE viatura_motorista_id = ? AND data_status = ? AND status = 'EXCLUIDO_DIA'
            ''', (viatura_motorista_id, data_associacao))
            
            # Recriar encomendas
            for encomenda in encomendas:
                cursor.execute('''
                    INSERT INTO encomenda_viatura (pedido_id, pedido_tipo, viatura_motorista_id, data_associacao, ordem)
                    VALUES (?, ?, ?, ?, ?)
                ''', (encomenda['pedido_id'], encomenda['pedido_tipo'], viatura_motorista_id, data_associacao, encomenda.get('ordem', 0)))
        
        elif tipo_acao == 'APAGAR_CARD_PERMANENTE':
            # Recriar card e restaurar encomendas, status e matrículas temporárias
            viatura_motorista_id = dados_json.get('viatura_motorista_id')
            encomendas = dados_json.get('encomendas_removidas', [])
            matricula = dados_json.get('matricula')
            codigo = dados_json.get('codigo')
            nome_motorista = dados_json.get('nome_motorista')
            ordem = dados_json.get('ordem')
            temporario = dados_json.get('temporario', 0)
            data_temporaria = dados_json.get('data_temporaria')
            status_removidos = dados_json.get('status_removidos', [])
            matriculas_temp = dados_json.get('matriculas_temp_removidas', [])
            matriculas_detalhadas = dados_json.get('matriculas_detalhadas_removidas', [])
            observacoes_temp = dados_json.get('observacoes_temp_removidas', [])
            data_apagamento = dados_json.get('data_apagamento', date.today().isoformat())
            
            # Garantir que campos obrigatórios não são None ou vazios
            # IMPORTANTE: verificar explicitamente None primeiro, depois verificar se é string vazia
            if matricula is None:
                matricula = ''
            elif not isinstance(matricula, str):
                matricula = str(matricula) if matricula else ''
            
            if codigo is None:
                codigo = ''
            elif not isinstance(codigo, str):
                codigo = str(codigo) if codigo else ''
            
            if nome_motorista is None:
                nome_motorista = ''
            elif not isinstance(nome_motorista, str):
                nome_motorista = str(nome_motorista) if nome_motorista else ''
            
            if ordem is None:
                ordem = 0
            elif not isinstance(ordem, (int, float)):
                try:
                    ordem = int(ordem) if ordem else 0
                except:
                    ordem = 0
            
            if temporario is None:
                temporario = 0
            elif not isinstance(temporario, (int, bool)):
                try:
                    temporario = int(temporario) if temporario else 0
                except:
                    temporario = 0
            
            # Debug
            print(f"DEBUG - Reverter APAGAR_CARD_PERMANENTE:")
            print(f"  viatura_motorista_id: {viatura_motorista_id}")
            print(f"  matricula: {matricula}")
            print(f"  codigo: {codigo}")
            print(f"  nome_motorista: {nome_motorista}")
            print(f"  encomendas a restaurar: {len(encomendas)}")
            print(f"  status a restaurar: {len(status_removidos)}")
            print(f"  matriculas_temp a restaurar: {len(matriculas_temp)}")
            print(f"  matriculas_detalhadas a restaurar: {len(matriculas_detalhadas)}")
            print(f"  observacoes_temp a restaurar: {len(observacoes_temp)}")
            
            # Verificar se o card ainda existe e seu estado atual
            cursor.execute('SELECT id, ativo, data_desativacao FROM viatura_motorista WHERE id = ?', (viatura_motorista_id,))
            card_existe = cursor.fetchone()
            
            if not card_existe:
                # Recriar o card com os dados originais
                # Não usar o ID original, deixar o SQLite gerar um novo
                # Validação final antes de inserir
                if codigo is None or (isinstance(codigo, str) and codigo.strip() == ''):
                    print(f"ERRO: codigo é None ou vazio! Valor: {repr(codigo)}")
                    codigo = 'N/A'  # Valor padrão se estiver vazio
                if matricula is None or (isinstance(matricula, str) and matricula.strip() == ''):
                    print(f"ERRO: matricula é None ou vazia! Valor: {repr(matricula)}")
                    matricula = 'N/A'  # Valor padrão se estiver vazio
                if nome_motorista is None or (isinstance(nome_motorista, str) and nome_motorista.strip() == ''):
                    print(f"ERRO: nome_motorista é None ou vazio! Valor: {repr(nome_motorista)}")
                    nome_motorista = 'N/A'  # Valor padrão se estiver vazio
                
                print(f"DEBUG - Valores finais antes de INSERT:")
                print(f"  matricula: {repr(matricula)} (tipo: {type(matricula)})")
                print(f"  codigo: {repr(codigo)} (tipo: {type(codigo)})")
                print(f"  nome_motorista: {repr(nome_motorista)} (tipo: {type(nome_motorista)})")
                
                cursor.execute('''
                    INSERT INTO viatura_motorista (matricula, codigo, nome_motorista, ativo, ordem, temporario, data_temporaria, data_desativacao)
                    VALUES (?, ?, ?, 1, ?, ?, ?, NULL)
                ''', (matricula, codigo, nome_motorista, ordem, temporario, data_temporaria))
                novo_vm_id = cursor.lastrowid
                print(f"DEBUG - Card recriado com novo ID: {novo_vm_id} (original era {viatura_motorista_id})")
                # Atualizar referências nas encomendas, status e matrículas temporárias
                viatura_motorista_id = novo_vm_id
            else:
                card_ativo = card_existe[1]
                card_data_desativacao = card_existe[2]
                
                # Se já foi revertido (card está ativo), reverter novamente deve restaurar tudo novamente
                # Se o card está inativo, reativar
                if not card_ativo or card_data_desativacao:
                    # Reativar e limpar data_desativacao
                    cursor.execute('UPDATE viatura_motorista SET ativo = 1, data_desativacao = NULL WHERE id = ?', (viatura_motorista_id,))
                    print(f"DEBUG - Card reativado: {viatura_motorista_id}")
                else:
                    # Card já está ativo, apenas garantir que está correto
                    print(f"DEBUG - Card já está ativo: {viatura_motorista_id}")
            
            # Recriar encomendas futuras (apenas as que foram removidas, ou seja, >= data_apagamento)
            for encomenda in encomendas:
                # Verificar se a encomenda não já existe
                cursor.execute('''
                    SELECT id FROM encomenda_viatura
                    WHERE pedido_id = ? AND pedido_tipo = ? AND viatura_motorista_id = ? AND data_associacao = ?
                ''', (encomenda['pedido_id'], encomenda['pedido_tipo'], viatura_motorista_id, encomenda['data_associacao']))
                
                if not cursor.fetchone():
                    cursor.execute('''
                        INSERT INTO encomenda_viatura (pedido_id, pedido_tipo, viatura_motorista_id, data_associacao, ordem)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (encomenda['pedido_id'], encomenda['pedido_tipo'], viatura_motorista_id, encomenda['data_associacao'], encomenda.get('ordem', 0)))
            
            # Recriar status futuros
            for status in status_removidos:
                cursor.execute('''
                    INSERT INTO viatura_motorista_status 
                    (viatura_motorista_id, status, observacao_status, data_status, data_inicio, data_fim)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    viatura_motorista_id,
                    status.get('status'),
                    status.get('observacao_status'),
                    status.get('data_status'),
                    status.get('data_inicio'),
                    status.get('data_fim')
                ))
            
            # Recriar matrículas temporárias futuras
            for mat_temp in matriculas_temp:
                cursor.execute('''
                    INSERT INTO matricula_temporaria 
                    (viatura_motorista_id, matricula_temporaria, codigo_temporaria, data_associacao)
                    VALUES (?, ?, ?, ?)
                ''', (
                    viatura_motorista_id,
                    mat_temp.get('matricula_temporaria'),
                    mat_temp.get('codigo_temporaria'),
                    mat_temp.get('data_associacao')
                ))
            
            # Recriar matrículas temporárias detalhadas futuras
            for mat_det in matriculas_detalhadas:
                cursor.execute('''
                    INSERT INTO matricula_temporaria_detalhada 
                    (viatura_motorista_id, matricula_trator, matricula_galera, data_associacao)
                    VALUES (?, ?, ?, ?)
                ''', (
                    viatura_motorista_id,
                    mat_det.get('matricula_trator'),
                    mat_det.get('matricula_galera'),
                    mat_det.get('data_associacao')
                ))
            
            # Recriar observações temporárias futuras
            for obs_temp in observacoes_temp:
                cursor.execute('''
                    INSERT INTO observacao_temporaria 
                    (viatura_motorista_id, observacao, data_associacao)
                    VALUES (?, ?, ?)
                ''', (
                    viatura_motorista_id,
                    obs_temp.get('observacao'),
                    obs_temp.get('data_associacao')
                ))
        
        elif tipo_acao == 'ALTERAR_MATRICULA':
            # Reverter alteração de matrícula (remover matrículas temporárias do dia)
            viatura_motorista_id = dados_json.get('viatura_motorista_id')
            data_associacao = dados_json.get('data_associacao', date.today().isoformat())
            
            # Remover matrículas temporárias detalhadas do dia
            cursor.execute('''
                DELETE FROM matricula_temporaria_detalhada 
                WHERE viatura_motorista_id = ? AND data_associacao = ?
            ''', (viatura_motorista_id, data_associacao))
            
            # Remover observação temporária do dia (se existir)
            cursor.execute('''
                DELETE FROM observacao_temporaria 
                WHERE viatura_motorista_id = ? AND data_associacao = ?
            ''', (viatura_motorista_id, data_associacao))
        
        elif tipo_acao == 'MOVER_ENCOMENDA':
            # Reverter movimento de encomenda
            pedido_id = dados_json.get('pedido_id')
            pedido_tipo = dados_json.get('pedido_tipo')
            viatura_origem_id = dados_json.get('viatura_origem_id')
            viatura_destino_id = dados_json.get('viatura_destino_id')
            data_associacao = dados_json.get('data_associacao')
            ordem_original = dados_json.get('ordem_original')
            
            # Remover da viatura destino
            cursor.execute('''
                DELETE FROM encomenda_viatura
                WHERE pedido_id = ? AND pedido_tipo = ? AND viatura_motorista_id = ? AND data_associacao = ?
            ''', (pedido_id, pedido_tipo, viatura_destino_id, data_associacao))
            
            # Recriar na viatura origem
            cursor.execute('''
                INSERT INTO encomenda_viatura (pedido_id, pedido_tipo, viatura_motorista_id, data_associacao, ordem)
                VALUES (?, ?, ?, ?, ?)
            ''', (pedido_id, pedido_tipo, viatura_origem_id, data_associacao, ordem_original))
        
        elif tipo_acao == 'REMOVER_PEDIDO':
            # Recriar pedido e suas atribuições
            pedido_id = dados_json.get('pedido_id')
            tipo = dados_json.get('tipo')
            tabela = 'pedidos_pendentes' if tipo == 'pendente' else 'pedidos_entregues'
            
            # Recriar pedido
            cursor.execute(f'''
                INSERT INTO {tabela} (cliente, local_carga, material, data_entrega, observacoes)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                dados_json.get('cliente', ''),
                dados_json.get('local_carga', ''),
                dados_json.get('material', ''),
                dados_json.get('data_entrega', ''),
                dados_json.get('observacoes', '')
            ))
            novo_pedido_id = cursor.lastrowid
            
            # Recriar atribuições
            atribuicoes = dados_json.get('atribuicoes', [])
            for atrib in atribuicoes:
                origem_tipo = 'P' if tipo == 'pendente' else 'E'
                cursor.execute('''
                    INSERT INTO encomenda_viatura (pedido_id, pedido_tipo, viatura_motorista_id, data_associacao, ordem)
                    VALUES (?, ?, ?, ?, ?)
                ''', (novo_pedido_id, origem_tipo, atrib['viatura_motorista_id'], atrib['data_associacao'], 0))
        
        elif tipo_acao == 'ALTERAR_DATA_PEDIDO':
            # Reverter alteração de data
            pedido_id = dados_json.get('pedido_id')
            tipo = dados_json.get('tipo')
            data_antiga = dados_json.get('data_antiga')
            tabela = 'pedidos_pendentes' if tipo == 'pendente' else 'pedidos_entregues'
            
            cursor.execute(f'''
                UPDATE {tabela}
                SET data_entrega = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (data_antiga, pedido_id))
        
        elif tipo_acao == 'ATRIBUIR_ENCOMENDA':
            # Remover atribuição
            pedido_id = dados_json.get('pedido_id')
            pedido_tipo = dados_json.get('pedido_tipo')
            viatura_motorista_id = dados_json.get('viatura_motorista_id')
            data_associacao = dados_json.get('data_associacao')
            
            cursor.execute('''
                DELETE FROM encomenda_viatura
                WHERE pedido_id = ? AND pedido_tipo = ? AND viatura_motorista_id = ? AND data_associacao = ?
            ''', (pedido_id, pedido_tipo, viatura_motorista_id, data_associacao))
        
        elif tipo_acao == 'REMOVER_ATRIBUICAO':
            # Recriar atribuição
            pedido_id = dados_json.get('pedido_id')
            pedido_tipo = dados_json.get('pedido_tipo')
            viatura_motorista_id = dados_json.get('viatura_motorista_id')
            data_associacao = dados_json.get('data_associacao')
            ordem = dados_json.get('ordem', 0)
            
            cursor.execute('''
                INSERT INTO encomenda_viatura (pedido_id, pedido_tipo, viatura_motorista_id, data_associacao, ordem)
                VALUES (?, ?, ?, ?, ?)
            ''', (pedido_id, pedido_tipo, viatura_motorista_id, data_associacao, ordem))
        
        # Toggle do estado revertido (permite reverter múltiplas vezes)
        novo_estado_revertido = 0 if ja_foi_revertido else 1
        cursor.execute('''
            UPDATE historico_acoes
            SET revertido = ?
            WHERE id = ?
        ''', (novo_estado_revertido, acao_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True})
    except Exception as e:
        import traceback
        print(f"Erro ao reverter ação: {e}")
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500

def registrar_acao(tipo_acao, descricao, dados):
    """Registar uma ação no histórico para possível reversão"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO historico_acoes (tipo_acao, descricao, dados_acao)
            VALUES (?, ?, ?)
        ''', (tipo_acao, descricao, json.dumps(dados)))
        
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Erro ao registar ação: {e}")

# ==================== FIM DAS ROTAS ====================

if __name__ == '__main__':
    # Inicializar banco de dados
    init_db()
    
    # Obter IP local para exibir na mensagem
    import socket
    try:
        # Conectar a um servidor externo para descobrir o IP local
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip_local = s.getsockname()[0]
        s.close()
    except:
        ip_local = "127.0.0.1"
    
    # Executar servidor
    print("=" * 60)
@app.route('/api/viatura-motorista/<int:viatura_id>/servico-dia-anterior', methods=['GET'])
def get_servico_dia_anterior(viatura_id):
    """Obter serviço do dia anterior de uma viatura/motorista"""
    try:
        data_str = request.args.get('data')
        if not data_str:
            return jsonify({'error': 'Data não fornecida'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Buscar encomendas atribuídas à viatura na data especificada
        cursor.execute('''
            SELECT 
                ev.pedido_id,
                ev.pedido_tipo,
                ev.ordem,
                COALESCE(pp.cliente, pe.cliente) as cliente,
                COALESCE(pp.local_carga, pe.local_carga) as local_carga,
                COALESCE(pp.material, pe.material) as material
            FROM encomenda_viatura ev
            LEFT JOIN pedidos_pendentes pp ON ev.pedido_tipo = 'P' AND ev.pedido_id = pp.id
            LEFT JOIN pedidos_entregues pe ON ev.pedido_tipo = 'E' AND ev.pedido_id = pe.id
            WHERE ev.viatura_motorista_id = ? AND ev.data_associacao = ?
            ORDER BY ev.ordem ASC
        ''', (viatura_id, data_str))
        
        encomendas = cursor.fetchall()
        conn.close()
        
        # Converter para lista de dicionários
        resultado = []
        for e in encomendas:
            resultado.append({
                'cliente': e[3] or '',
                'local_carga': e[4] or '',
                'material': e[5] or ''
            })
        
        return jsonify(resultado)
    except Exception as e:
        import traceback
        print(f"Erro ao buscar serviço do dia anterior: {e}")
        print(traceback.format_exc())
        if 'conn' in locals():
            try:
                conn.close()
            except:
                pass
        return jsonify({'error': str(e)}), 500

@app.route('/api/viatura-motorista/<int:viatura_id>/ultimo-servico', methods=['GET'])
def get_ultimo_servico(viatura_id):
    """Obter o último dia em que a viatura/motorista teve serviço atribuído (anterior à data atual)"""
    try:
        from datetime import date
        
        data_atual = date.today()
        data_atual_str = data_atual.isoformat()
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Buscar a última data em que houve serviço atribuído (anterior à data atual)
        cursor.execute('''
            SELECT 
                ev.data_associacao,
                COUNT(*) as total_encomendas
            FROM encomenda_viatura ev
            WHERE ev.viatura_motorista_id = ? AND ev.data_associacao < ?
            GROUP BY ev.data_associacao
            ORDER BY ev.data_associacao DESC
            LIMIT 1
        ''', (viatura_id, data_atual_str))
        
        ultima_data = cursor.fetchone()
        
        if not ultima_data:
            return jsonify({
                'data': None,
                'encomendas': []
            })
        
        data_ultima = ultima_data[0]
        
        # Buscar todas as encomendas dessa data
        cursor.execute('''
            SELECT 
                ev.pedido_id,
                ev.pedido_tipo,
                ev.ordem,
                COALESCE(pp.cliente, pe.cliente) as cliente,
                COALESCE(pp.local_carga, pe.local_carga) as local_carga,
                COALESCE(pp.material, pe.material) as material
            FROM encomenda_viatura ev
            LEFT JOIN pedidos_pendentes pp ON ev.pedido_tipo = 'P' AND ev.pedido_id = pp.id
            LEFT JOIN pedidos_entregues pe ON ev.pedido_tipo = 'E' AND ev.pedido_id = pe.id
            WHERE ev.viatura_motorista_id = ? AND ev.data_associacao = ?
            ORDER BY ev.ordem ASC
        ''', (viatura_id, data_ultima))
        
        encomendas = cursor.fetchall()
        conn.close()
        
        # Converter para lista de dicionários
        resultado = []
        for e in encomendas:
            resultado.append({
                'cliente': e[3] or '',
                'local_carga': e[4] or '',
                'material': e[5] or ''
            })
        
        return jsonify({
            'data': data_ultima,
            'encomendas': resultado
        })
    except Exception as e:
        import traceback
        print(f"Erro ao buscar último serviço: {e}")
        print(traceback.format_exc())
        if 'conn' in locals():
            try:
                conn.close()
            except:
                pass
        return jsonify({'error': str(e)}), 500

@app.route('/api/atribuicao/<int:atribuicao_id>/ultimo-servico', methods=['GET'])
def get_ultimo_servico_atribuicao(atribuicao_id):
    """Obter o último dia em que o conjunto (atribuição) teve serviço atribuído (anterior à data atual)"""
    try:
        from datetime import date
        
        data_atual = date.today()
        data_atual_str = data_atual.isoformat()
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Obter conjunto_id da atribuição
        cursor.execute('SELECT conjunto_id FROM atribuicoes_motoristas WHERE id = ?', (atribuicao_id,))
        atribuicao_row = cursor.fetchone()
        
        if not atribuicao_row:
            conn.close()
            return jsonify({
                'data': None,
                'encomendas': []
            })
        
        conjunto_id = atribuicao_row[0]
        
        # Buscar a última data em que houve serviço atribuído a este conjunto (anterior à data atual)
        # Usar atribuicao_id ou conjunto_id para encontrar encomendas
        cursor.execute('''
            SELECT 
                ev.data_associacao,
                COUNT(*) as total_encomendas
            FROM encomenda_viatura ev
            WHERE (ev.atribuicao_id = ? OR ev.atribuicao_id IN (
                SELECT id FROM atribuicoes_motoristas WHERE conjunto_id = ?
            ))
            AND ev.data_associacao < ?
            GROUP BY ev.data_associacao
            ORDER BY ev.data_associacao DESC
            LIMIT 1
        ''', (atribuicao_id, conjunto_id, data_atual_str))
        
        ultima_data = cursor.fetchone()
        
        if not ultima_data:
            conn.close()
            return jsonify({
                'data': None,
                'encomendas': []
            })
        
        data_ultima = ultima_data[0]
        
        # Buscar todas as encomendas dessa data para este conjunto
        cursor.execute('''
            SELECT 
                ev.pedido_id,
                ev.pedido_tipo,
                ev.ordem,
                COALESCE(pp.cliente, pe.cliente) as cliente,
                COALESCE(pp.local_carga, pe.local_carga) as local_carga,
                COALESCE(pp.material, pe.material) as material
            FROM encomenda_viatura ev
            LEFT JOIN pedidos_pendentes pp ON ev.pedido_tipo = 'P' AND ev.pedido_id = pp.id
            LEFT JOIN pedidos_entregues pe ON ev.pedido_tipo = 'E' AND ev.pedido_id = pe.id
            WHERE (ev.atribuicao_id = ? OR ev.atribuicao_id IN (
                SELECT id FROM atribuicoes_motoristas WHERE conjunto_id = ?
            ))
            AND ev.data_associacao = ?
            ORDER BY ev.ordem ASC
        ''', (atribuicao_id, conjunto_id, data_ultima))
        
        encomendas = cursor.fetchall()
        conn.close()
        
        # Converter para lista de dicionários
        resultado = []
        for e in encomendas:
            resultado.append({
                'cliente': e[3] or '',
                'local_carga': e[4] or '',
                'material': e[5] or ''
            })
        
        return jsonify({
            'data': data_ultima,
            'encomendas': resultado
        })
    except Exception as e:
        import traceback
        print(f"Erro ao buscar último serviço (atribuição): {e}")
        print(traceback.format_exc())
        if 'conn' in locals():
            try:
                conn.close()
            except:
                pass
        return jsonify({'error': str(e)}), 500

# Verificar dependências na inicialização
def verificar_dependencias():
    """Verifica se todas as dependências estão instaladas"""
    dependencias_ok = True
    
    # Verificar openpyxl
    try:
        import openpyxl
        print(f"✓ openpyxl disponível: versão {openpyxl.__version__}")
    except ImportError:
        print("⚠ AVISO: openpyxl não está instalado.")
        print("   Execute: pip install openpyxl")
        print("   Ou: pip install -r requirements.txt")
        dependencias_ok = False
    
    return dependencias_ok

# ==================== ENDPOINTS PARA NOVA ESTRUTURA ====================

@app.route('/api/motoristas', methods=['GET'])
def get_motoristas():
    """Obter todos os motoristas"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM motoristas WHERE ativo = 1 ORDER BY nome ASC')
    motoristas = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(motoristas)

@app.route('/api/tratores', methods=['GET'])
def get_tratores():
    """Obter todos os tratores"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM tratores WHERE ativo = 1 ORDER BY matricula ASC')
    tratores = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(tratores)

@app.route('/api/cisternas', methods=['GET'])
def get_cisternas():
    """Obter todas as cisternas"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM cisternas WHERE ativo = 1 ORDER BY matricula ASC')
    cisternas = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(cisternas)

@app.route('/api/conjuntos-habituais', methods=['GET'])
def get_conjuntos_habituais():
    """Obter todos os conjuntos habituais com informações relacionadas"""
    buscar_todos = request.args.get('todos', 'false').lower() == 'true'
    conn = get_db()
    cursor = conn.cursor()
    
    if buscar_todos:
        # Retornar todos os conjuntos (ativos e inativos)
        cursor.execute('''
            SELECT 
                c.id,
                c.nome,
                c.ordem,
                c.ativo,
                t.matricula as trator_matricula,
                t.codigo as trator_codigo,
                cis.matricula as cisterna_matricula,
                cis.codigo as cisterna_codigo,
                m.nome as motorista_nome
            FROM conjuntos_habituais c
            LEFT JOIN tratores t ON c.trator_id = t.id
            LEFT JOIN cisternas cis ON c.cisterna_id = cis.id
            LEFT JOIN motoristas m ON c.motorista_id = m.id
            ORDER BY c.ativo DESC, c.ordem ASC, c.nome ASC
        ''')
    else:
        # Retornar apenas conjuntos ativos (comportamento padrão)
        cursor.execute('''
            SELECT 
                c.id,
                c.nome,
                c.ordem,
                c.ativo,
                t.matricula as trator_matricula,
                t.codigo as trator_codigo,
                cis.matricula as cisterna_matricula,
                cis.codigo as cisterna_codigo,
                m.nome as motorista_nome
            FROM conjuntos_habituais c
            LEFT JOIN tratores t ON c.trator_id = t.id
            LEFT JOIN cisternas cis ON c.cisterna_id = cis.id
            LEFT JOIN motoristas m ON c.motorista_id = m.id
            WHERE c.ativo = 1
            ORDER BY c.ordem ASC, c.nome ASC
        ''')
    
    conjuntos = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(conjuntos)

@app.route('/api/atribuicoes-motoristas', methods=['GET'])
def get_atribuicoes_motoristas():
    """Obter atribuições de motoristas para uma data"""
    data_str = request.args.get('data', date.today().isoformat())
    conn = get_db()
    cursor = conn.cursor()
    
    # Buscar atribuições e conjuntos
    cursor.execute('''
        SELECT 
            a.id,
            a.conjunto_id,
            a.motorista_id,
            c.nome as conjunto_nome,
            t.matricula as trator_matricula,
            cis.matricula as cisterna_matricula,
            m.nome as motorista_nome
        FROM atribuicoes_motoristas a
        INNER JOIN conjuntos_habituais c ON a.conjunto_id = c.id
        LEFT JOIN tratores t ON c.trator_id = t.id
        LEFT JOIN cisternas cis ON c.cisterna_id = cis.id
        LEFT JOIN motoristas m ON a.motorista_id = m.id
        WHERE a.data_atribuicao = ?
        ORDER BY c.ordem ASC
    ''', (data_str,))
    
    atribuicoes = [dict(row) for row in cursor.fetchall()]
    
    # Buscar motoristas disponíveis para cada conjunto
    cursor.execute('SELECT id, nome FROM motoristas WHERE ativo = 1 ORDER BY nome ASC')
    motoristas = [dict(row) for row in cursor.fetchall()]
    
    # Adicionar motoristas disponíveis a cada atribuição
    for atrib in atribuicoes:
        atrib['motoristas_disponiveis'] = motoristas
    
    conn.close()
    return jsonify(atribuicoes)

@app.route('/api/atribuicoes-motoristas', methods=['POST'])
def criar_atribuicao_motorista():
    """Criar nova atribuição de motorista"""
    data = request.json
    conjunto_id = data.get('conjunto_id')
    data_atribuicao = data.get('data_atribuicao', date.today().isoformat())
    motorista_id = data.get('motorista_id')
    
    if not conjunto_id:
        return jsonify({'success': False, 'error': 'conjunto_id é obrigatório'}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Verificar se já existe
    cursor.execute('''
        SELECT id FROM atribuicoes_motoristas 
        WHERE conjunto_id = ? AND data_atribuicao = ?
    ''', (conjunto_id, data_atribuicao))
    
    if cursor.fetchone():
        conn.close()
        return jsonify({'success': False, 'error': 'Atribuição já existe para esta data'}), 400
    
    # Criar atribuição
    cursor.execute('''
        INSERT INTO atribuicoes_motoristas (conjunto_id, data_atribuicao, motorista_id)
        VALUES (?, ?, ?)
    ''', (conjunto_id, data_atribuicao, motorista_id))
    
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'id': cursor.lastrowid})

@app.route('/api/atribuicoes-motoristas/<int:atribuicao_id>', methods=['PUT'])
def atualizar_atribuicao_motorista(atribuicao_id):
    """Atualizar atribuição de motorista"""
    data = request.json
    motorista_id = data.get('motorista_id')
    
    conn = get_db()
    cursor = conn.cursor()
    
    if motorista_id:
        cursor.execute('''
            UPDATE atribuicoes_motoristas 
            SET motorista_id = ? 
            WHERE id = ?
        ''', (motorista_id, atribuicao_id))
    else:
        cursor.execute('''
            UPDATE atribuicoes_motoristas 
            SET motorista_id = NULL 
            WHERE id = ?
        ''', (atribuicao_id,))
    
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/atribuicoes-motoristas/<int:atribuicao_id>', methods=['DELETE'])
def remover_atribuicao_motorista(atribuicao_id):
    """Remover atribuição de motorista"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM atribuicoes_motoristas WHERE id = ?', (atribuicao_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/cards-planeamento', methods=['GET'])
def get_cards_planeamento():
    """Obter cards de planeamento baseados em atribuicoes_motoristas"""
    try:
        data_str = request.args.get('data', date.today().isoformat())
        data_consulta = date.fromisoformat(data_str)
        data_atual = date.today()
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Lógica: Conjuntos inativos só aparecem em datas anteriores à data de desativação
        # - Histórico (data < hoje): mostrar todos os conjuntos, mesmo os inativos (para preservar histórico)
        # - Presente/Futuro (data >= hoje): mostrar apenas os ativos
        #   Se um conjunto foi inativado hoje, não aparece hoje nem no futuro, mas aparece no passado
        if data_consulta < data_atual:
            # Histórico: mostrar todos os conjuntos, mesmo os inativos
            # Mas se um conjunto foi inativado antes desta data, não mostrar
            condicao_ativo = """(
                c.ativo = 1 
                OR 
                (c.ativo = 0 AND (c.data_desativacao IS NULL OR c.data_desativacao > ?))
            )"""
            params = (data_str, data_str)
        else:
            # Presente/Futuro: mostrar apenas os ativos
            condicao_ativo = "c.ativo = 1"
            params = (data_str,)
        
        # Dia anterior (para "fora - continuação do dia anterior"); numero_noites_fora: 1=azul, 2=roxo
        from datetime import timedelta
        data_anterior = (data_consulta - timedelta(days=1)).isoformat()
        cursor.execute('''
            SELECT data, motorista_id, COALESCE(numero_noites_fora, 1) as numero_noites_fora
            FROM motorista_noite_fora WHERE data IN (?, ?)
        ''', (data_str, data_anterior))
        passa_noite_dict = {}   # motorista_id -> N (número de noites neste dia, 1, 2, 3, ...)
        fora_continuacao_dict = {}  # motorista_id -> N (número de noites no dia anterior)
        for r in cursor.fetchall():
            data_r, mid, raw = r[0], r[1], r[2]
            num = max(1, int(raw) if raw is not None else 1)
            if data_r == data_str:
                passa_noite_dict[mid] = num
            else:
                fora_continuacao_dict[mid] = num
        
        # Buscar todas as atribuições do dia (criar automaticamente se não existirem)
        cursor.execute(f'''
            SELECT 
                a.id as atribuicao_id,
                a.conjunto_id,
                COALESCE(a.motorista_id, c.motorista_id) as motorista_id,
                c.id as conjunto_id_full,
                c.nome as conjunto_nome,
                c.ordem,
                t.matricula as trator_matricula,
                t.codigo as trator_codigo,
                cis.matricula as cisterna_matricula,
                cis.codigo as cisterna_codigo,
                m.nome as motorista_nome,
                m_h.nome as motorista_habitual_nome
            FROM conjuntos_habituais c
            LEFT JOIN atribuicoes_motoristas a ON a.conjunto_id = c.id AND a.data_atribuicao = ?
            LEFT JOIN tratores t ON c.trator_id = t.id
            LEFT JOIN cisternas cis ON c.cisterna_id = cis.id
            LEFT JOIN motoristas m ON COALESCE(a.motorista_id, c.motorista_id) = m.id
            LEFT JOIN motoristas m_h ON c.motorista_id = m_h.id
            WHERE {condicao_ativo}
            ORDER BY c.ordem ASC
        ''', params)
        
        atribuicoes = cursor.fetchall()
        print(f"DEBUG - get_cards_planeamento: Encontrados {len(atribuicoes)} conjuntos para data {data_str}")
        if len(atribuicoes) > 0:
            print(f"DEBUG - Primeira linha: {dict(atribuicoes[0])}")
        cards = []
        
        for row in atribuicoes:
            try:
                atrib = dict(row)
                atribuicao_id = atrib['atribuicao_id']
                conjunto_id = atrib['conjunto_id_full']
                
                if not conjunto_id:
                    print(f"DEBUG - AVISO: conjunto_id_full é None para linha: {atrib}")
                    continue
                
                # Se não existe atribuição para este dia, criar automaticamente com motorista habitual
                if not atribuicao_id:
                    motorista_id = atrib.get('motorista_id')  # Já vem do COALESCE acima
                    cursor.execute('''
                        INSERT INTO atribuicoes_motoristas (conjunto_id, data_atribuicao, motorista_id)
                        VALUES (?, ?, ?)
                    ''', (conjunto_id, data_str, motorista_id))
                    conn.commit()
                    atribuicao_id = cursor.lastrowid
                    atrib['atribuicao_id'] = atribuicao_id
                
                # Buscar motorista habitual do conjunto
                cursor.execute('SELECT motorista_id FROM conjuntos_habituais WHERE id = ?', (conjunto_id,))
                conjunto_row = cursor.fetchone()
                motorista_habitual_id = conjunto_row[0] if conjunto_row else None
                
                # Buscar nome do motorista habitual
                motorista_habitual_nome = None
                if motorista_habitual_id:
                    cursor.execute('SELECT nome FROM motoristas WHERE id = ?', (motorista_habitual_id,))
                    motorista_habitual_row = cursor.fetchone()
                    motorista_habitual_nome = motorista_habitual_row[0] if motorista_habitual_row else None
                
                # Buscar status do motorista para esta data
                # Primeiro, buscar o viatura_motorista_id através do conjunto_id
                # (cada conjunto tem um trator e cisterna, que estão associados a viatura_motorista)
                status_card = 'Normal'
                observacao_status = None
                data_inicio_status = None
                data_fim_status = None
                
                # Buscar viatura_motorista_id através do conjunto
                # Como os conjuntos têm trator_id e cisterna_id, precisamos encontrar o viatura_motorista
                # que corresponde a esse conjunto. Mas como não há ligação direta, vamos buscar pelo nome do motorista
                # A tabela viatura_motorista tem nome_motorista, não motorista_id
                if motorista_habitual_id:
                    # Primeiro buscar o nome do motorista
                    cursor.execute('SELECT nome FROM motoristas WHERE id = ?', (motorista_habitual_id,))
                    motorista_row = cursor.fetchone()
                    if motorista_row:
                        nome_motorista = motorista_row[0]
                        # Buscar viatura_motorista pelo nome_motorista
                        cursor.execute('''
                            SELECT id FROM viatura_motorista 
                            WHERE nome_motorista = ? AND ativo = 1
                            LIMIT 1
                        ''', (nome_motorista,))
                        vm_row = cursor.fetchone()
                        if vm_row:
                            vm_id = vm_row[0]
                            # Buscar status para esta data
                            cursor.execute('''
                                SELECT status, observacao_status, data_inicio, data_fim
                                FROM viatura_motorista_status
                                WHERE viatura_motorista_id = ?
                                AND (
                                    (data_status = ?) OR
                                    (status IN ('Ferias', 'Baixa', 'OutrosTrabalhos') AND data_inicio IS NOT NULL AND data_fim IS NOT NULL 
                                     AND ? >= data_inicio AND ? <= data_fim)
                                )
                                ORDER BY 
                                    CASE WHEN data_status = ? THEN 0 ELSE 1 END,
                                    created_at DESC
                                LIMIT 1
                            ''', (vm_id, data_str, data_str, data_str, data_str))
                            
                            status_row = cursor.fetchone()
                            if status_row:
                                status_card = status_row[0] if status_row[0] else 'Normal'
                                observacao_status = status_row[1]
                                data_inicio_status = status_row[2]
                                data_fim_status = status_row[3]
                
                # Criar estrutura do card compatível com o frontend atual
                card = {
                    'id': atribuicao_id,  # Usar atribuicao_id como ID do card
                    'atribuicao_id': atribuicao_id,
                    'conjunto_id': conjunto_id,
                    'matricula': f"{atrib.get('trator_matricula', '')} + {atrib.get('cisterna_matricula', '')}",
                    'codigo': atrib.get('trator_codigo', '') or atrib.get('cisterna_codigo', ''),
                    'nome_motorista': atrib.get('motorista_nome', motorista_habitual_nome or 'Não atribuído'),
                    'motorista_id': atrib.get('motorista_id') or motorista_habitual_id,
                    'motorista_habitual_id': motorista_habitual_id,
                    'motorista_habitual_nome': motorista_habitual_nome,
                    'conjunto_nome': atrib.get('conjunto_nome', ''),
                    'trator_matricula': atrib.get('trator_matricula', ''),
                    'cisterna_matricula': atrib.get('cisterna_matricula', ''),
                    'ordem': atrib.get('ordem', 0),
                    'status': status_card,
                    'observacao_status': observacao_status,
                    'data_inicio': data_inicio_status,
                    'data_fim': data_fim_status,
                    'passa_noite_fora': (atrib.get('motorista_id') or motorista_habitual_id) in passa_noite_dict,
                    'numero_noites_fora': passa_noite_dict.get((atrib.get('motorista_id') or motorista_habitual_id), 0),
                    'fora_continuacao': (atrib.get('motorista_id') or motorista_habitual_id) in fora_continuacao_dict,
                    'fora_continuacao_nivel': fora_continuacao_dict.get((atrib.get('motorista_id') or motorista_habitual_id), 0),
                    'encomendas': []
                }
                
                # Buscar encomendas associadas a esta atribuição
                try:
                    cursor.execute('''
                        SELECT ev.*, 
                               pp.cliente,
                               pp.local_carga,
                               pp.local_descarga,
                               pp.material,
                               pp.observacoes,
                               pp.prioridade
                        FROM encomenda_viatura ev
                        LEFT JOIN pedidos_pendentes pp ON ev.pedido_tipo = 'P' AND ev.pedido_id = pp.id
                        WHERE ev.atribuicao_id = ? AND ev.data_associacao = ?
                        ORDER BY COALESCE(ev.ordem, 999999), ev.id ASC
                    ''', (atribuicao_id, data_str))
                except sqlite3.OperationalError as err:
                    if 'local_descarga' in str(err) or 'no such column' in str(err).lower() or 'prioridade' in str(err):
                        cursor.execute('''
                            SELECT ev.*, 
                                   pp.cliente,
                                   pp.local_carga,
                                   pp.material,
                                   pp.observacoes
                            FROM encomenda_viatura ev
                            LEFT JOIN pedidos_pendentes pp ON ev.pedido_tipo = 'P' AND ev.pedido_id = pp.id
                            WHERE ev.atribuicao_id = ? AND ev.data_associacao = ?
                            ORDER BY COALESCE(ev.ordem, 999999), ev.id ASC
                        ''', (atribuicao_id, data_str))
                    else:
                        raise
                
                raw_rows = cursor.fetchall()
                # Garantir local_descarga e prioridade: buscar da BD se em falta
                pedido_ids_p = [dict(r).get('pedido_id') for r in raw_rows if dict(r).get('pedido_tipo') == 'P' and dict(r).get('pedido_id')]
                descarga_por_id = {}
                prioridade_por_id = {}
                if pedido_ids_p:
                    try:
                        placeholders = ','.join('?' * len(pedido_ids_p))
                        cursor.execute('SELECT id, local_descarga, COALESCE(prioridade, 0) FROM pedidos_pendentes WHERE id IN (%s)' % placeholders, pedido_ids_p)
                        for r in cursor.fetchall():
                            descarga_por_id[r[0]] = (r[1] or '').strip()
                            prioridade_por_id[r[0]] = 1 if (r[2] and int(r[2]) == 1) else 0
                    except sqlite3.OperationalError:
                        try:
                            cursor.execute('SELECT id, local_descarga FROM pedidos_pendentes WHERE id IN (%s)' % placeholders, pedido_ids_p)
                            for r in cursor.fetchall():
                                descarga_por_id[r[0]] = (r[1] or '').strip()
                        except sqlite3.OperationalError:
                            pass
                encomendas = []
                for e in raw_rows:
                    row = dict(e)
                    pid = row.get('pedido_id')
                    if row.get('pedido_tipo') == 'P' and pid:
                        if pid in descarga_por_id:
                            row['local_descarga'] = descarga_por_id[pid] or row.get('local_descarga') or ''
                        elif 'local_descarga' not in row or row.get('local_descarga') is None:
                            row['local_descarga'] = ''
                        if pid in prioridade_por_id:
                            row['prioridade'] = prioridade_por_id[pid]
                        elif 'prioridade' not in row or row.get('prioridade') is None:
                            row['prioridade'] = 0
                    else:
                        if 'local_descarga' not in row or row.get('local_descarga') is None:
                            row['local_descarga'] = ''
                        if 'prioridade' not in row or row.get('prioridade') is None:
                            row['prioridade'] = 0
                    # Construir descricao com local_descarga em primeiro
                    if row.get('pedido_tipo') == 'P' and (row.get('cliente') or row.get('material')):
                        ld = (row.get('local_descarga') or '').strip()
                        lc = (row.get('local_carga') or '').strip() or ''
                        cli = (row.get('cliente') or '').strip() or ''
                        mat = (row.get('material') or '').strip() or ''
                        partes = []
                        if ld:
                            partes.append(ld)
                        if lc:
                            partes.append(lc)
                        if cli:
                            partes.append(cli)
                        if mat:
                            partes.append(mat)
                        row['descricao'] = ' | '.join(partes) if partes else ('Encomenda ' + str(row.get('pedido_id', '')))
                    else:
                        row['descricao'] = row.get('descricao') or ('Encomenda ' + str(row.get('pedido_id', '')))
                    encomendas.append(row)
                card['encomendas'] = encomendas
                
                cards.append(card)
            except Exception as e:
                print(f"DEBUG - Erro ao processar card: {e}")
                import traceback
                print(traceback.format_exc())
                continue
        
        # Adicionar cards de transportadoras ativas para esta data
        cursor.execute('''
            SELECT t.* 
            FROM transportadoras t
            JOIN transportadoras_ativacao ta ON t.id = ta.transportadora_id
            WHERE t.ativo = 1 
            AND ta.data_ativacao = ?
            AND ta.ativo = 1
            ORDER BY t.nome ASC
        ''', (data_str,))
        
        transportadoras = cursor.fetchall()
        for trans in transportadoras:
            trans_dict = dict(trans)
            # Criar card de transportadora
            # Para transportadoras, vamos usar um atribuicao_id especial baseado no transportadora_id
            # Mas como não existe em atribuicoes_motoristas, vamos buscar encomendas que não têm atribuicao_id válido
            # Por enquanto, vamos deixar encomendas vazias e verificar depois como são atribuídas
            card_transportadora = {
                'id': f"trans_{trans_dict['id']}",
                'atribuicao_id': None,
                'conjunto_id': None,
                'matricula': '',
                'codigo': '',
                'nome_motorista': trans_dict['nome'],
                'motorista_id': None,
                'motorista_habitual_id': None,
                'motorista_habitual_nome': None,
                'conjunto_nome': '',
                'trator_matricula': '',
                'cisterna_matricula': '',
                'ordem': 9999,  # Transportadoras aparecem no final
                'status': 'Normal',
                'encomendas': [],
                'is_transportadora': True,
                'transportadora_id': trans_dict['id']
            }
            
            # Buscar encomendas atribuídas a esta transportadora
            # Como as transportadoras não têm atribuicao_id real, vamos buscar encomendas
            # que não têm atribuicao_id válido (NULL ou que não existe em atribuicoes_motoristas)
            # Mas isso não é específico para esta transportadora, então por enquanto vamos deixar vazio
            # e verificar depois como as encomendas são realmente atribuídas
            
            cards.append(card_transportadora)
        
        conn.close()
        print(f"DEBUG - get_cards_planeamento: Retornando {len(cards)} cards (incluindo {len(transportadoras)} transportadoras)")
        return jsonify(cards)
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"ERRO em get_cards_planeamento: {e}")
        print(error_trace)
        if conn:
            try:
                conn.close()
            except:
                pass
        return jsonify({'error': str(e), 'trace': error_trace}), 500

@app.route('/api/noite-fora', methods=['POST'])
def set_noite_fora():
    """Uma noite por dia: carregar no dia D = 1.ª noite (azul) e passa a D+1. No D+1 carregar = 2.ª noite (outra cor) e passa a D+2. Quando deixar de carregar, termina."""
    conn = None
    try:
        data = request.get_json() or {}
        data_str = data.get('data')
        atribuicao_id = data.get('atribuicao_id')
        desmarcar = data.get('desmarcar') is True
        if not data_str or not atribuicao_id:
            return jsonify({'success': False, 'error': 'data e atribuicao_id obrigatórios'}), 400
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT motorista_id FROM atribuicoes_motoristas WHERE id = ?', (atribuicao_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return jsonify({'success': False, 'error': 'Atribuição não encontrada'}), 404
        motorista_id = row[0]
        if not motorista_id:
            conn.close()
            return jsonify({'success': False, 'error': 'Atribuição sem motorista'}), 400
        if desmarcar:
            cursor.execute('DELETE FROM motorista_noite_fora WHERE data = ? AND motorista_id = ?', (data_str, motorista_id))
            conn.commit()
            conn.close()
            return jsonify({'success': True, 'numero_noites_fora': 0})
        # Valor deste dia = dia anterior + 1 (ou 1 se não houver dia anterior)
        data_consulta = date.fromisoformat(data_str)
        data_anterior = (data_consulta - timedelta(days=1)).isoformat()  # timedelta importado no topo
        cursor.execute(
            'SELECT COALESCE(numero_noites_fora, 1) FROM motorista_noite_fora WHERE data = ? AND motorista_id = ?',
            (data_anterior, motorista_id)
        )
        r = cursor.fetchone()
        prev_val = max(0, int(r[0]) if r and r[0] is not None else 0)
        next_val = prev_val + 1
        cursor.execute(
            'INSERT OR REPLACE INTO motorista_noite_fora (data, motorista_id, numero_noites_fora) VALUES (?, ?, ?)',
            (data_str, motorista_id, next_val)
        )
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'numero_noites_fora': next_val})
    except Exception as e:
        try:
            if conn:
                conn.close()
        except Exception:
            pass
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/conjuntos-habituais/<int:conjunto_id>', methods=['DELETE'])
def remover_conjunto_habitual(conjunto_id):
    """Remover conjunto habitual (soft delete)"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('UPDATE conjuntos_habituais SET ativo = 0 WHERE id = ?', (conjunto_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/conjuntos-habituais', methods=['POST'])
def criar_conjunto_habitual():
    """Criar novo conjunto habitual"""
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO conjuntos_habituais (nome, trator_id, cisterna_id, motorista_id, ordem, ativo, observacoes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (
        data.get('nome'),
        data.get('trator_id'),
        data.get('cisterna_id'),
        data.get('motorista_id'),
        data.get('ordem', 0),
        data.get('ativo', 1),
        data.get('observacoes', '')
    ))
    
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'id': cursor.lastrowid})

@app.route('/api/conjuntos-habituais/<int:conjunto_id>', methods=['PUT'])
def atualizar_conjunto_habitual(conjunto_id):
    """Atualizar conjunto habitual (atualização parcial - apenas campos fornecidos)"""
    try:
        data = request.json
        if not data:
            return jsonify({'success': False, 'error': 'Dados não fornecidos'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar se o conjunto existe
        cursor.execute('SELECT * FROM conjuntos_habituais WHERE id = ?', (conjunto_id,))
        conjunto_existente = cursor.fetchone()
        if not conjunto_existente:
            conn.close()
            return jsonify({'success': False, 'error': 'Conjunto não encontrado'}), 404
        
        # Construir UPDATE dinâmico apenas com campos fornecidos
        campos_update = []
        valores_update = []
        
        if 'nome' in data:
            campos_update.append('nome = ?')
            valores_update.append(data['nome'])
        if 'trator_id' in data:
            campos_update.append('trator_id = ?')
            valores_update.append(data['trator_id'])
        if 'cisterna_id' in data:
            campos_update.append('cisterna_id = ?')
            valores_update.append(data['cisterna_id'])
        if 'motorista_id' in data:
            campos_update.append('motorista_id = ?')
            valores_update.append(data['motorista_id'])
        if 'ordem' in data:
            campos_update.append('ordem = ?')
            valores_update.append(data['ordem'])
        if 'ativo' in data:
            campos_update.append('ativo = ?')
            valores_update.append(data['ativo'])
            # Se está a inativar (ativo = 0), guardar data de desativação
            # Se está a ativar (ativo = 1), limpar data de desativação
            if data['ativo'] == 0:
                campos_update.append('data_desativacao = ?')
                valores_update.append(date.today().isoformat())
            elif data['ativo'] == 1:
                campos_update.append('data_desativacao = ?')
                valores_update.append(None)
        if 'observacoes' in data:
            campos_update.append('observacoes = ?')
            valores_update.append(data['observacoes'])
        
        if not campos_update:
            conn.close()
            return jsonify({'success': False, 'error': 'Nenhum campo para atualizar'}), 400
        
        # Adicionar conjunto_id no final para o WHERE
        valores_update.append(conjunto_id)
        
        # Executar UPDATE
        query = f'UPDATE conjuntos_habituais SET {", ".join(campos_update)} WHERE id = ?'
        cursor.execute(query, valores_update)
        
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        import traceback
        print(f"Erro ao atualizar conjunto: {e}")
        print(traceback.format_exc())
        if 'conn' in locals():
            try:
                conn.close()
            except:
                pass
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/conjuntos-habituais/<int:conjunto_id>', methods=['GET'])
def get_conjunto_habitual(conjunto_id):
    """Obter conjunto habitual específico"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM conjuntos_habituais WHERE id = ?
    ''', (conjunto_id,))
    conjunto = cursor.fetchone()
    conn.close()
    
    if conjunto:
        return jsonify(dict(conjunto))
    return jsonify({'error': 'Conjunto não encontrado'}), 404

# ==================== ENDPOINTS PARA MOTORISTAS ====================

@app.route('/api/motoristas', methods=['POST'])
def criar_motorista():
    """Criar novo motorista"""
    try:
        # Verificar se é JSON
        if not request.is_json:
            return jsonify({'error': 'Content-Type deve ser application/json'}), 400
        
        data = request.get_json(silent=True)
        if not data:
            return jsonify({'error': 'Dados não fornecidos ou JSON inválido'}), 400
        
        nome_completo = (data.get('nome_completo') or '').strip()
        nome_abreviado = (data.get('nome_abreviado') or '').strip()
        nome = (data.get('nome') or '').strip()
        if not nome_completo and not nome:
            return jsonify({'error': 'Nome completo ou Nome é obrigatório'}), 400
        nome_display = nome_abreviado or nome_completo or nome
        nome_display = nome_display.strip()
        
        # Garantir que a tabela existe
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar se a tabela existe
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='motoristas'")
        if not cursor.fetchone():
            conn.close()
            # Criar tabela se não existir
            init_db()
            conn = get_db()
            cursor = conn.cursor()
        
        data_nasc = data.get('data_nascimento') or None
        data_adm = data.get('data_admissao') or None
        num_func = (data.get('numero_funcionario') or '').strip() or None
        
        try:
            cursor.execute('''
                INSERT INTO motoristas (nome, telefone, email, ativo, observacoes, data_nascimento, data_admissao, numero_funcionario, nome_completo, nome_abreviado)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                nome_display,
                data.get('telefone') or None,
                data.get('email') or None,
                data.get('ativo', 1),
                data.get('observacoes') or None,
                data_nasc,
                data_adm,
                num_func,
                nome_completo or None,
                nome_abreviado or None
            ))
            
            conn.commit()
            motorista_id = cursor.lastrowid
            conn.close()
            return jsonify({'success': True, 'id': motorista_id})
        except sqlite3.IntegrityError as e:
            conn.close()
            error_str = str(e)
            if 'UNIQUE constraint' in error_str:
                return jsonify({'error': 'Já existe um motorista com este nome'}), 400
            return jsonify({'error': f'Erro de integridade: {error_str}'}), 400
        except sqlite3.OperationalError as e:
            conn.close()
            error_str = str(e)
            print(f"Erro operacional SQL: {error_str}")
            
            # Se a tabela não existir, criar e tentar novamente
            if 'no such table' in error_str.lower():
                try:
                    init_db()
                    # Tentar novamente após criar a tabela
                    conn = get_db()
                    cursor = conn.cursor()
                    cursor.execute('''
                        INSERT INTO motoristas (nome, telefone, email, ativo, observacoes, data_nascimento, data_admissao, numero_funcionario, nome_completo, nome_abreviado)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        nome_display,
                        data.get('telefone') or None,
                        data.get('email') or None,
                        data.get('ativo', 1),
                        data.get('observacoes') or None,
                        data_nasc, data_adm, num_func,
                        nome_completo or None,
                        nome_abreviado or None
                    ))
                    conn.commit()
                    motorista_id = cursor.lastrowid
                    conn.close()
                    return jsonify({'success': True, 'id': motorista_id})
                except Exception as e2:
                    conn.close()
                    return jsonify({'error': f'Erro ao criar tabela e inserir: {str(e2)}'}), 500
            
            # Se a coluna não existir, adicionar e tentar novamente
            if 'no column named' in error_str.lower() or 'no such column' in error_str.lower():
                try:
                    # Recriar init_db para adicionar colunas em falta
                    init_db()
                    # Tentar novamente após adicionar colunas
                    conn = get_db()
                    cursor = conn.cursor()
                    cursor.execute('''
                        INSERT INTO motoristas (nome, telefone, email, ativo, observacoes, data_nascimento, data_admissao, numero_funcionario, nome_completo, nome_abreviado)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        nome_display,
                        data.get('telefone') or None,
                        data.get('email') or None,
                        data.get('ativo', 1),
                        data.get('observacoes') or None,
                        data_nasc, data_adm, num_func,
                        nome_completo or None,
                        nome_abreviado or None
                    ))
                    conn.commit()
                    motorista_id = cursor.lastrowid
                    conn.close()
                    return jsonify({'success': True, 'id': motorista_id})
                except Exception as e2:
                    conn.close()
                    return jsonify({'error': f'Erro ao adicionar colunas e inserir: {str(e2)}'}), 500
            
            return jsonify({'error': f'Erro na base de dados: {error_str}'}), 500
    except Exception as e:
        import traceback
        error_msg = str(e)
        error_trace = traceback.format_exc()
        print(f"Erro ao criar motorista: {error_msg}")
        print(error_trace)
        return jsonify({'error': f'Erro ao criar motorista: {error_msg}'}), 500

@app.route('/api/motoristas/<int:motorista_id>', methods=['PUT'])
def atualizar_motorista(motorista_id):
    """Atualizar motorista"""
    try:
        if not request.is_json:
            return jsonify({'error': 'Content-Type deve ser application/json'}), 400
        
        data = request.get_json(silent=True)
        if not data:
            return jsonify({'error': 'Dados não fornecidos ou JSON inválido'}), 400
        
        nome_completo = (data.get('nome_completo') or '').strip()
        nome_abreviado = (data.get('nome_abreviado') or '').strip()
        nome = (data.get('nome') or '').strip()
        if not nome_completo and not nome:
            return jsonify({'error': 'Nome completo ou Nome é obrigatório'}), 400
        nome_display = nome_abreviado or nome_completo or nome
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar se o motorista existe
        cursor.execute('SELECT id FROM motoristas WHERE id = ?', (motorista_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'error': 'Motorista não encontrado'}), 404
        
        data_nasc = data.get('data_nascimento') or None
        data_adm = data.get('data_admissao') or None
        num_func = (data.get('numero_funcionario') or '').strip() or None
        
        try:
            cursor.execute('''
                UPDATE motoristas 
                SET nome = ?, telefone = ?, email = ?, ativo = ?, observacoes = ?,
                    data_nascimento = ?, data_admissao = ?, numero_funcionario = ?,
                    nome_completo = ?, nome_abreviado = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (
                nome_display.strip(),
                data.get('telefone') or None,
                data.get('email') or None,
                data.get('ativo', 1),
                data.get('observacoes') or None,
                data_nasc, data_adm, num_func,
                nome_completo or None,
                nome_abreviado or None,
                motorista_id
            ))
            
            conn.commit()
            conn.close()
            return jsonify({'success': True})
        except sqlite3.IntegrityError as e:
            conn.close()
            if 'UNIQUE constraint' in str(e):
                return jsonify({'error': 'Já existe um motorista com este nome'}), 400
            return jsonify({'error': f'Erro de integridade: {str(e)}'}), 400
    except Exception as e:
        import traceback
        error_msg = str(e)
        print(f"Erro ao atualizar motorista: {error_msg}")
        print(traceback.format_exc())
        return jsonify({'error': f'Erro ao atualizar motorista: {error_msg}'}), 500

@app.route('/api/motoristas/<int:motorista_id>', methods=['GET'])
def get_motorista(motorista_id):
    """Obter motorista específico"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM motoristas WHERE id = ?', (motorista_id,))
    motorista = cursor.fetchone()
    conn.close()
    
    if motorista:
        return jsonify(dict(motorista))
    return jsonify({'error': 'Motorista não encontrado'}), 404

@app.route('/api/motoristas/<int:motorista_id>', methods=['DELETE'])
def remover_motorista(motorista_id):
    """Remover motorista (soft delete)"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('UPDATE motoristas SET ativo = 0 WHERE id = ?', (motorista_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ==================== ENDPOINTS PARA TRATORES ====================

@app.route('/api/tratores', methods=['POST'])
def criar_trator():
    """Criar novo trator"""
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO tratores (matricula, codigo, marca, modelo, ano, ativo, observacoes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (
        data.get('matricula'),
        data.get('codigo'),
        data.get('marca'),
        data.get('modelo'),
        data.get('ano'),
        data.get('ativo', 1),
        data.get('observacoes', '')
    ))
    
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'id': cursor.lastrowid})

@app.route('/api/tratores/<int:trator_id>', methods=['PUT'])
def atualizar_trator(trator_id):
    """Atualizar trator"""
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE tratores 
        SET matricula = ?, codigo = ?, marca = ?, modelo = ?, ano = ?, ativo = ?, observacoes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (
        data.get('matricula'),
        data.get('codigo'),
        data.get('marca'),
        data.get('modelo'),
        data.get('ano'),
        data.get('ativo', 1),
        data.get('observacoes', ''),
        trator_id
    ))
    
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/tratores/<int:trator_id>', methods=['GET'])
def get_trator(trator_id):
    """Obter trator específico"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM tratores WHERE id = ?', (trator_id,))
    trator = cursor.fetchone()
    conn.close()
    
    if trator:
        return jsonify(dict(trator))
    return jsonify({'error': 'Trator não encontrado'}), 404

@app.route('/api/tratores/<int:trator_id>', methods=['DELETE'])
def remover_trator(trator_id):
    """Remover trator (soft delete)"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('UPDATE tratores SET ativo = 0 WHERE id = ?', (trator_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ==================== ENDPOINTS PARA CISTERNAS ====================

@app.route('/api/cisternas', methods=['POST'])
def criar_cisterna():
    """Criar nova cisterna"""
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO cisternas (matricula, codigo, capacidade, tipo, ativo, observacoes)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (
        data.get('matricula'),
        data.get('codigo'),
        data.get('capacidade'),
        data.get('tipo'),
        data.get('ativo', 1),
        data.get('observacoes', '')
    ))
    
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'id': cursor.lastrowid})

@app.route('/api/cisternas/<int:cisterna_id>', methods=['PUT'])
def atualizar_cisterna(cisterna_id):
    """Atualizar cisterna"""
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE cisternas 
        SET matricula = ?, codigo = ?, capacidade = ?, tipo = ?, ativo = ?, observacoes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (
        data.get('matricula'),
        data.get('codigo'),
        data.get('capacidade'),
        data.get('tipo'),
        data.get('ativo', 1),
        data.get('observacoes', ''),
        cisterna_id
    ))
    
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/cisternas/<int:cisterna_id>', methods=['GET'])
def get_cisterna(cisterna_id):
    """Obter cisterna específica"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM cisternas WHERE id = ?', (cisterna_id,))
    cisterna = cursor.fetchone()
    conn.close()
    
    if cisterna:
        return jsonify(dict(cisterna))
    return jsonify({'error': 'Cisterna não encontrada'}), 404

@app.route('/api/cisternas/<int:cisterna_id>', methods=['DELETE'])
def remover_cisterna(cisterna_id):
    """Remover cisterna (soft delete)"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('UPDATE cisternas SET ativo = 0 WHERE id = ?', (cisterna_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/atualizar-wialong-upload', methods=['POST'])
def atualizar_wialong_upload():
    """Atualizar ficheiro Wialong via upload - processa ficheiro do utilizador e devolve atualizado"""
    try:
        # Verificar se há ficheiro no upload
        if 'ficheiro' not in request.files:
            return jsonify({
                'success': False,
                'error': 'Nenhum ficheiro enviado'
            }), 400
        
        ficheiro = request.files['ficheiro']
        if ficheiro.filename == '':
            return jsonify({
                'success': False,
                'error': 'Nenhum ficheiro selecionado'
            }), 400
        
        # Verificar extensão
        if not (ficheiro.filename.lower().endswith('.xlsx') or ficheiro.filename.lower().endswith('.xlsm')):
            return jsonify({
                'success': False,
                'error': 'Ficheiro deve ser .xlsx ou .xlsm'
            }), 400
        
        # Obter data
        data_planeamento = request.form.get('data', date.today().isoformat())
        
        # Ler ficheiro para memória
        ficheiro_bytes = ficheiro.read()
        nome_ficheiro = ficheiro.filename
        
        # Importar função de processamento
        import sys
        import os
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        
        from enviar_para_wialong import atualizar_wialong_memoria
        
        # Processar ficheiro
        print(f"Processando ficheiro enviado: {nome_ficheiro} para data {data_planeamento}")
        ficheiro_processado = atualizar_wialong_memoria(ficheiro_bytes, nome_ficheiro, data_planeamento)
        
        if ficheiro_processado is None:
            return jsonify({
                'success': False,
                'error': 'Erro ao processar ficheiro. Verifique se há encomendas atribuídas para a data selecionada.'
            }), 500
        
        # Devolver ficheiro para download
        nome_download = f"Wialong_atualizado_{data_planeamento}.{nome_ficheiro.split('.')[-1]}"
        
        return send_file(
            ficheiro_processado,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=nome_download
        )
        
    except Exception as e:
        import traceback
        print(f"Erro ao processar upload Wialong: {e}")
        print(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# ========== ENDPOINTS DE ADMINISTRAÇÃO ==========

@app.route('/admin/utilizadores', methods=['GET'])
def listar_utilizadores():
    """Listar todos os utilizadores ativos e bloqueados"""
    # Verificar código de administração
    codigo = request.cookies.get('admin_code') or request.args.get('code')
    if codigo != '1990':
        return jsonify({'error': 'Acesso negado'}), 403
    
    with lock_sessoes:
        utilizadores_ativos = []
        for session_id, info in sessoes_ativas.items():
            utilizadores_ativos.append({
                'session_id': session_id,
                'ip': info['ip'],
                'ultima_atividade': info['ultima_atividade'].isoformat(),
                'user_agent': info['user_agent'],
                'pagina_atual': info['pagina_atual'],
                'metodo': info['metodo'],
                'tempo_inativo': str(datetime.now() - info['ultima_atividade']).split('.')[0],
                'bloqueado': False
            })
        
        utilizadores_bloqueados = []
        # Adicionar utilizadores bloqueados por session_id
        for session_id, info in sessoes_bloqueadas_info.items():
            utilizadores_bloqueados.append({
                'session_id': session_id,
                'ip': info['ip'],
                'data_bloqueio': info.get('data_bloqueio', ''),
                'user_agent': info.get('user_agent', 'Desconhecido'),
                'pagina_atual': info.get('pagina_atual', 'N/A'),
                'metodo': info.get('metodo', 'N/A'),
                'bloqueado': True,
                'tipo_bloqueio': 'session'
            })
        
        # Adicionar IPs bloqueados diretamente (casos antigos sem session_id)
        for ip_bloqueado in ips_bloqueados:
            # Verificar se este IP já está na lista de bloqueados por session
            ja_na_lista = any(u['ip'] == ip_bloqueado for u in utilizadores_bloqueados)
            if not ja_na_lista:
                utilizadores_bloqueados.append({
                    'session_id': None,
                    'ip': ip_bloqueado,
                    'data_bloqueio': 'Antes da atualização',
                    'user_agent': 'Desconhecido',
                    'pagina_atual': 'N/A',
                    'metodo': 'N/A',
                    'bloqueado': True,
                    'tipo_bloqueio': 'ip'
                })
        
        return jsonify({
            'ativos': utilizadores_ativos,
            'bloqueados': utilizadores_bloqueados
        })

@app.route('/admin/utilizadores/<session_id>', methods=['DELETE'])
def bloquear_utilizador(session_id):
    """Bloquear/desconectar um utilizador"""
    # Verificar código de administração
    codigo = request.cookies.get('admin_code') or request.args.get('code')
    if codigo != '1990':
        return jsonify({'error': 'Acesso negado'}), 403
    
    with lock_sessoes:
        if session_id in sessoes_ativas:
            # Guardar informação antes de bloquear
            info = sessoes_ativas[session_id].copy()
            info['data_bloqueio'] = datetime.now().isoformat()
            sessoes_bloqueadas_info[session_id] = info
            
            # Também bloquear o IP diretamente para garantir que fica bloqueado mesmo sem session_id
            ip = info.get('ip')
            if ip:
                ips_bloqueados.add(ip)
                # Guardar alterações no ficheiro
                guardar_ips_bloqueados()
            
            sessoes_bloqueadas.add(session_id)
            sessoes_ativas.pop(session_id, None)
            return jsonify({'success': True, 'message': 'Utilizador bloqueado com sucesso'})
        return jsonify({'error': 'Sessão não encontrada'}), 404

@app.route('/admin/utilizadores/<session_id>/desbloquear', methods=['POST'])
def desbloquear_utilizador(session_id):
    """Desbloquear um utilizador por session_id"""
    # Verificar código de administração
    codigo = request.cookies.get('admin_code') or request.args.get('code')
    if codigo != '1990':
        return jsonify({'error': 'Acesso negado'}), 403
    
    with lock_sessoes:
        if session_id in sessoes_bloqueadas:
            sessoes_bloqueadas.discard(session_id)
            # Remover informação de bloqueio
            sessoes_bloqueadas_info.pop(session_id, None)
            return jsonify({'success': True, 'message': 'Utilizador desbloqueado com sucesso'})
        return jsonify({'error': 'Sessão não encontrada ou já desbloqueada'}), 404

@app.route('/admin/utilizadores/ip/<path:ip>/desbloquear', methods=['POST'])
def desbloquear_ip(ip):
    """Desbloquear um IP diretamente"""
    # Verificar código de administração
    codigo = request.cookies.get('admin_code') or request.args.get('code')
    if codigo != '1990':
        return jsonify({'error': 'Acesso negado'}), 403
    
    # Decodificar o IP (pode ter sido codificado na URL)
    from urllib.parse import unquote
    ip = unquote(ip)
    print(f"Tentando desbloquear IP: {ip}")
    print(f"IPs bloqueados atuais: {ips_bloqueados}")
    
    with lock_sessoes:
        desbloqueado = False
        
        # Remover IP da lista de bloqueados
        if ip in ips_bloqueados:
            ips_bloqueados.discard(ip)
            desbloqueado = True
            print(f"IP {ip} removido de ips_bloqueados")
            # Guardar alterações no ficheiro
            guardar_ips_bloqueados()
        
        # Também verificar se há session_ids bloqueados com este IP
        sessoes_para_desbloquear = []
        for session_id, info in sessoes_bloqueadas_info.items():
            if info.get('ip') == ip:
                sessoes_para_desbloquear.append(session_id)
        
        for session_id in sessoes_para_desbloquear:
            sessoes_bloqueadas.discard(session_id)
            sessoes_bloqueadas_info.pop(session_id, None)
            desbloqueado = True
            print(f"Sessão {session_id} desbloqueada")
        
        print(f"IPs bloqueados após remoção: {ips_bloqueados}")
        
        if desbloqueado:
            return jsonify({'success': True, 'message': f'IP {ip} desbloqueado com sucesso'})
        
        return jsonify({'error': f'IP {ip} não encontrado ou já desbloqueado. IPs bloqueados: {list(ips_bloqueados)}'}), 404

@app.route('/admin/utilizadores/ip/<path:ip>/adicionar', methods=['POST'])
def adicionar_ip_bloqueado(ip):
    """Adicionar um IP à lista de bloqueados (para casos antigos)"""
    # Verificar código de administração
    codigo = request.cookies.get('admin_code') or request.args.get('code')
    if codigo != '1990':
        return jsonify({'error': 'Acesso negado'}), 403
    
    # Decodificar o IP (pode ter sido codificado na URL)
    from urllib.parse import unquote
    ip = unquote(ip)
    print(f"Adicionando IP bloqueado: {ip}")
    
    with lock_sessoes:
        ips_bloqueados.add(ip)
        print(f"IPs bloqueados agora: {ips_bloqueados}")
        # Guardar alterações no ficheiro
        guardar_ips_bloqueados()
        return jsonify({'success': True, 'message': f'IP {ip} adicionado à lista de bloqueados'})

@app.route('/admin/utilizadores', methods=['DELETE'])
def bloquear_todos_utilizadores():
    """Bloquear todos os utilizadores ativos"""
    # Verificar código de administração
    codigo = request.cookies.get('admin_code') or request.args.get('code')
    if codigo != '1990':
        return jsonify({'error': 'Acesso negado'}), 403
    
    with lock_sessoes:
        for session_id, info in list(sessoes_ativas.items()):
            # Guardar informação antes de bloquear
            info_bloqueio = info.copy()
            info_bloqueio['data_bloqueio'] = datetime.now().isoformat()
            sessoes_bloqueadas_info[session_id] = info_bloqueio
            
            # Também bloquear o IP diretamente
            ip = info.get('ip')
            if ip:
                ips_bloqueados.add(ip)
            
            sessoes_bloqueadas.add(session_id)
        
        # Guardar todos os IPs bloqueados no ficheiro
        if ips_bloqueados:
            guardar_ips_bloqueados()
        
        sessoes_ativas.clear()
        return jsonify({'success': True, 'message': 'Todos os utilizadores foram bloqueados'})

# ==================== GESTÃO DE UTILIZADORES (APENAS ADMIN) ====================

@app.route('/api/utilizadores', methods=['GET'])
@admin_required
def listar_utilizadores_sistema():
    """Listar todos os utilizadores do sistema (apenas admin)"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, username, nome, email, is_admin, ativo, 
               created_at, updated_at, last_login
        FROM utilizadores
        ORDER BY created_at DESC
    ''')
    utilizadores = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    # Converter booleanos e timestamps
    for u in utilizadores:
        u['is_admin'] = bool(u['is_admin'])
        u['ativo'] = bool(u['ativo'])
    
    return jsonify(utilizadores)

@app.route('/api/utilizadores', methods=['POST'])
@admin_required
def criar_utilizador():
    """Criar novo utilizador (apenas admin)"""
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    nome = data.get('nome', '').strip()
    email = data.get('email', '').strip()
    is_admin = data.get('is_admin', False)
    
    if not username or not password or not nome:
        return jsonify({'success': False, 'error': 'Username, password e nome são obrigatórios'}), 400
    
    if len(password) < 4:
        return jsonify({'success': False, 'error': 'Password deve ter pelo menos 4 caracteres'}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Verificar se username já existe
    cursor.execute('SELECT id FROM utilizadores WHERE username = ?', (username,))
    if cursor.fetchone():
        conn.close()
        return jsonify({'success': False, 'error': 'Username já existe'}), 400
    
    # Criar utilizador
    password_hash = hash_password(password)
    cursor.execute('''
        INSERT INTO utilizadores (username, password_hash, nome, email, is_admin, ativo)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (username, password_hash, nome, email, 1 if is_admin else 0, 1))
    
    conn.commit()
    user_id = cursor.lastrowid
    conn.close()
    
    return jsonify({'success': True, 'id': user_id})

@app.route('/api/utilizadores/<int:user_id>', methods=['PUT'])
@admin_required
def atualizar_utilizador(user_id):
    """Atualizar utilizador (apenas admin)"""
    data = request.get_json()
    nome = data.get('nome', '').strip()
    email = data.get('email', '').strip()
    is_admin = data.get('is_admin', False)
    ativo = data.get('ativo', True)
    password = data.get('password', '').strip()
    
    if not nome:
        return jsonify({'success': False, 'error': 'Nome é obrigatório'}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Verificar se utilizador existe
    cursor.execute('SELECT id FROM utilizadores WHERE id = ?', (user_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'success': False, 'error': 'Utilizador não encontrado'}), 404
    
    # Atualizar utilizador
    if password:
        if len(password) < 4:
            conn.close()
            return jsonify({'success': False, 'error': 'Password deve ter pelo menos 4 caracteres'}), 400
        password_hash = hash_password(password)
        cursor.execute('''
            UPDATE utilizadores 
            SET nome = ?, email = ?, is_admin = ?, ativo = ?, 
                password_hash = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (nome, email, 1 if is_admin else 0, 1 if ativo else 0, password_hash, user_id))
    else:
        cursor.execute('''
            UPDATE utilizadores 
            SET nome = ?, email = ?, is_admin = ?, ativo = ?, 
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (nome, email, 1 if is_admin else 0, 1 if ativo else 0, user_id))
    
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})

@app.route('/api/utilizadores/<int:user_id>', methods=['DELETE'])
@admin_required
def remover_utilizador(user_id):
    """Remover utilizador (soft delete - apenas admin)"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Verificar se utilizador existe
    cursor.execute('SELECT id FROM utilizadores WHERE id = ?', (user_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'success': False, 'error': 'Utilizador não encontrado'}), 404
    
    # Soft delete (marcar como inativo)
    cursor.execute('UPDATE utilizadores SET ativo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', (user_id,))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})

@app.route('/api/utilizadores/<int:user_id>', methods=['GET'])
@admin_required
def obter_utilizador(user_id):
    """Obter utilizador específico (apenas admin)"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, username, nome, email, is_admin, ativo, 
               created_at, updated_at, last_login
        FROM utilizadores
        WHERE id = ?
    ''', (user_id,))
    user = cursor.fetchone()
    conn.close()
    
    if not user:
        return jsonify({'error': 'Utilizador não encontrado'}), 404
    
    user_dict = dict(user)
    user_dict['is_admin'] = bool(user_dict['is_admin'])
    user_dict['ativo'] = bool(user_dict['ativo'])
    
    return jsonify(user_dict)

@app.route('/admin/dashboard')
def admin_dashboard():
    """Página de administração para ver e gerir utilizadores"""
    # Verificar código secreto via cookie ou parâmetro
    codigo = request.cookies.get('admin_code') or request.args.get('code')
    if codigo != '1990':
        return jsonify({'error': 'Acesso negado. Código de administração necessário.'}), 403
    
    response = make_response(render_template('admin_dashboard.html'))
    # Definir cookie de administração válido por 1 hora
    response.set_cookie('admin_code', '1990', max_age=3600)
    return response

# ==================== ROTAS BASE DE DADOS DE CLIENTES ====================

@app.route('/api/clientes-locais', methods=['GET'])
def get_clientes_locais():
    """Obter todos os clientes e locais de descarga"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM clientes_locais 
            WHERE ativo = 1 
            ORDER BY cliente ASC, local_descarga ASC
        ''')
        clientes = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return jsonify(clientes)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/clientes-locais', methods=['POST'])
def adicionar_cliente_local():
    """Adicionar novo cliente e local de descarga"""
    try:
        data = request.get_json()
        cliente = data.get('cliente', '').strip()
        local_descarga = data.get('local_descarga', '').strip()
        
        if not cliente or not local_descarga:
            return jsonify({'error': 'Cliente e local de descarga são obrigatórios'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar se já existe
        cursor.execute('''
            SELECT id FROM clientes_locais 
            WHERE cliente = ? AND local_descarga = ?
        ''', (cliente, local_descarga))
        
        if cursor.fetchone():
            conn.close()
            return jsonify({'error': 'Este cliente e local de descarga já existem'}), 400
        
        # Inserir novo
        cursor.execute('''
            INSERT INTO clientes_locais (cliente, local_descarga, ativo)
            VALUES (?, ?, 1)
        ''', (cliente, local_descarga))
        
        conn.commit()
        novo_id = cursor.lastrowid
        conn.close()
        
        return jsonify({'id': novo_id, 'cliente': cliente, 'local_descarga': local_descarga, 'success': True}), 201
    except Exception as e:
        import traceback
        print(f"Erro ao adicionar cliente/local: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/clientes-locais/<int:cliente_id>', methods=['DELETE'])
def remover_cliente_local(cliente_id):
    """Remover (desativar) cliente e local de descarga"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE clientes_locais 
            SET ativo = 0, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (cliente_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/clientes-locais/<int:cliente_id>', methods=['PUT'])
def atualizar_cliente_local(cliente_id):
    """Atualizar cliente e local de descarga"""
    try:
        data = request.get_json()
        cliente = data.get('cliente', '').strip()
        local_descarga = data.get('local_descarga', '').strip()
        
        if not cliente or not local_descarga:
            return jsonify({'error': 'Cliente e local de descarga são obrigatórios'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar se já existe outro registo com o mesmo cliente e local
        cursor.execute('''
            SELECT id FROM clientes_locais 
            WHERE cliente = ? AND local_descarga = ? AND id != ?
        ''', (cliente, local_descarga, cliente_id))
        
        if cursor.fetchone():
            conn.close()
            return jsonify({'error': 'Este cliente e local de descarga já existem'}), 400
        
        # Atualizar
        cursor.execute('''
            UPDATE clientes_locais 
            SET cliente = ?, local_descarga = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (cliente, local_descarga, cliente_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/clientes-locais/clientes', methods=['GET'])
def get_clientes():
    """Obter lista única de clientes"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT DISTINCT cliente 
            FROM clientes_locais 
            WHERE ativo = 1 
            ORDER BY cliente ASC
        ''')
        clientes = [row[0] for row in cursor.fetchall()]
        conn.close()
        return jsonify(clientes)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/clientes-locais/locais', methods=['GET'])
def get_locais_por_cliente():
    """Obter locais de descarga por cliente. Devolve { id, local_descarga } para permitir filtrar materiais."""
    try:
        cliente = request.args.get('cliente', '')
        conn = get_db()
        cursor = conn.cursor()
        
        if cliente:
            cursor.execute('''
                SELECT id, local_descarga 
                FROM clientes_locais 
                WHERE cliente = ? AND ativo = 1 
                ORDER BY local_descarga ASC
            ''', (cliente,))
        else:
            cursor.execute('''
                SELECT id, local_descarga 
                FROM clientes_locais 
                WHERE ativo = 1 
                ORDER BY local_descarga ASC
            ''')
        
        locais = [{'id': row[0], 'local_descarga': row[1]} for row in cursor.fetchall()]
        conn.close()
        return jsonify(locais)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== ROTAS BASE DE DADOS DE LOCAIS DE CARGA ====================

# Locais de carga por cliente/local — registar ANTES de /api/locais-carga/<int:...> para não dar 404
@app.route('/api/locais-carga-cliente-local/<int:cliente_local_id>', methods=['GET'])
def get_locais_carga_cliente_local_by_id(cliente_local_id):
    """GET /api/locais-carga-cliente-local/18 — locais de carga associados a este cliente/local."""
    try:
        return jsonify(_get_locais_carga_cliente_local_impl(cliente_local_id))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/locais-carga-cliente-local', methods=['GET'])
def get_locais_carga_cliente_local():
    """Locais de carga por cliente/local. Query: cliente_local_id=."""
    try:
        cliente_local_id = request.args.get('cliente_local_id', type=int)
        if cliente_local_id is None:
            return jsonify({'error': 'cliente_local_id obrigatório'}), 400
        return jsonify(_get_locais_carga_cliente_local_impl(cliente_local_id))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/locais-carga-cliente-local', methods=['PUT'])
def put_locais_carga_cliente_local():
    """Associar locais de carga a um cliente/local. Body: { cliente_local_id: int, local_carga_ids: [int, ...] }"""
    try:
        data = request.get_json() or {}
        cliente_local_id = data.get('cliente_local_id')
        if cliente_local_id is None:
            return jsonify({'error': 'cliente_local_id obrigatório'}), 400
        cliente_local_id = int(cliente_local_id)
        local_carga_ids = data.get('local_carga_ids') or []
        if not isinstance(local_carga_ids, list):
            local_carga_ids = []
        local_carga_ids = [int(x) for x in local_carga_ids if x is not None]
        conn = get_db()
        _ensure_cliente_local_materiais_tables(conn)
        cursor = conn.cursor()
        cursor.execute('DELETE FROM cliente_local_locais_carga WHERE cliente_local_id = ?', (cliente_local_id,))
        for lid in local_carga_ids:
            cursor.execute(
                'INSERT INTO cliente_local_locais_carga (cliente_local_id, local_carga_id) VALUES (?, ?)',
                (cliente_local_id, lid)
            )
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

print('[OK] Rotas /api/locais-carga-cliente-local (GET by id, GET query, PUT) registadas.')

@app.route('/api/locais-carga', methods=['GET'])
def get_locais_carga():
    """Obter todos os locais de carga"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM locais_carga 
            WHERE ativo = 1 
            ORDER BY nome ASC
        ''')
        locais = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return jsonify(locais)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/locais-carga', methods=['POST'])
def adicionar_local_carga():
    """Adicionar novo local de carga"""
    try:
        data = request.get_json()
        nome = data.get('nome', '').strip()
        descricao = data.get('descricao', '').strip()
        
        if not nome:
            return jsonify({'error': 'Nome do local de carga é obrigatório'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar se já existe
        cursor.execute('SELECT id FROM locais_carga WHERE nome = ?', (nome,))
        if cursor.fetchone():
            conn.close()
            return jsonify({'error': 'Este local de carga já existe'}), 400
        
        # Inserir novo
        cursor.execute('''
            INSERT INTO locais_carga (nome, descricao, ativo)
            VALUES (?, ?, 1)
        ''', (nome, descricao))
        
        conn.commit()
        novo_id = cursor.lastrowid
        conn.close()
        
        return jsonify({'id': novo_id, 'nome': nome, 'descricao': descricao, 'success': True}), 201
    except Exception as e:
        import traceback
        print(f"Erro ao adicionar local de carga: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/locais-carga/<int:local_id>', methods=['DELETE'])
def remover_local_carga(local_id):
    """Remover (desativar) local de carga"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE locais_carga 
            SET ativo = 0, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (local_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/locais-carga/<int:local_id>', methods=['PUT'])
def atualizar_local_carga(local_id):
    """Atualizar local de carga"""
    try:
        data = request.get_json()
        nome = data.get('nome', '').strip()
        descricao = data.get('descricao', '').strip()
        
        if not nome:
            return jsonify({'error': 'Nome do local de carga é obrigatório'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar se já existe outro registo com o mesmo nome
        cursor.execute('SELECT id FROM locais_carga WHERE nome = ? AND id != ?', (nome, local_id))
        if cursor.fetchone():
            conn.close()
            return jsonify({'error': 'Este local de carga já existe'}), 400
        
        # Atualizar
        cursor.execute('''
            UPDATE locais_carga 
            SET nome = ?, descricao = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (nome, descricao, local_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/locais-carga/<int:local_id>/materiais', methods=['GET'])
def get_local_carga_materiais(local_id):
    """Obter IDs dos materiais que este local de carga carrega"""
    try:
        conn = get_db()
        _ensure_cliente_local_materiais_tables(conn)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT material_id FROM local_carga_materiais
            WHERE local_carga_id = ?
            ORDER BY material_id
        ''', (local_id,))
        ids = [row[0] for row in cursor.fetchall()]
        conn.close()
        return jsonify(ids)
    except Exception as e:
        import traceback
        print(f"Erro get_local_carga_materiais: {e}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/locais-carga/<int:local_id>/materiais', methods=['PUT'])
def put_local_carga_materiais(local_id):
    """Definir materiais que este local de carga carrega (lista de IDs)"""
    try:
        data = request.get_json()
        material_ids = data.get('material_ids') or []
        if not isinstance(material_ids, list):
            material_ids = []
        material_ids = [int(x) for x in material_ids if x is not None]
        conn = get_db()
        _ensure_cliente_local_materiais_tables(conn)
        cursor = conn.cursor()
        cursor.execute('DELETE FROM local_carga_materiais WHERE local_carga_id = ?', (local_id,))
        for mid in material_ids:
            cursor.execute(
                'INSERT INTO local_carga_materiais (local_carga_id, material_id) VALUES (?, ?)',
                (local_id, mid)
            )
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== ROTAS BASE DE DADOS DE MATERIAIS ====================

@app.route('/api/materiais', methods=['GET'])
def get_materiais():
    """Obter todos os materiais"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM materiais 
            WHERE ativo = 1 
            ORDER BY nome ASC
        ''')
        materiais = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return jsonify(materiais)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/materiais-permitidos', methods=['GET'])
def get_materiais_permitidos():
    """Materiais permitidos para criar carga: filtrados por cliente/local de descarga e/ou local de carga.
    Query: cliente_local_id (id de clientes_locais), local_carga_id.
    Se não houver restrições configuradas (listas vazias), devolve todos os materiais ativos."""
    try:
        cliente_local_id = request.args.get('cliente_local_id', type=int)
        local_carga_id = request.args.get('local_carga_id', type=int)
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM materiais WHERE ativo = 1 ORDER BY nome ASC
        ''')
        todos = [dict(row) for row in cursor.fetchall()]
        ids_permitidos = None  # None = todos
        if cliente_local_id:
            cursor.execute(
                'SELECT material_id FROM cliente_local_materiais WHERE cliente_local_id = ?',
                (cliente_local_id,)
            )
            ids_cl = {row[0] for row in cursor.fetchall()}
            if ids_cl:
                ids_permitidos = ids_cl if ids_permitidos is None else ids_permitidos & ids_cl
        if local_carga_id:
            cursor.execute(
                'SELECT material_id FROM local_carga_materiais WHERE local_carga_id = ?',
                (local_carga_id,)
            )
            ids_lc = {row[0] for row in cursor.fetchall()}
            if ids_lc:
                ids_permitidos = ids_lc if ids_permitidos is None else ids_permitidos & ids_lc
        conn.close()
        if ids_permitidos is not None:
            todos = [m for m in todos if m['id'] in ids_permitidos]
        return jsonify(todos)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/locais-carga-por-material', methods=['GET'])
def get_locais_carga_por_material():
    """Locais de carga que carregam o material indicado (para filtrar dropdown ao criar encomenda).
    Query: material_id=int ou material_nome=string. Se não indicar material, devolve todos os locais ativos."""
    try:
        material_id = request.args.get('material_id', type=int)
        material_nome = (request.args.get('material_nome') or '').strip()
        conn = get_db()
        _ensure_cliente_local_materiais_tables(conn)
        cursor = conn.cursor()
        if material_id is None and material_nome:
            cursor.execute('SELECT id FROM materiais WHERE ativo = 1 AND nome = ?', (material_nome,))
            row = cursor.fetchone()
            material_id = row[0] if row else None
        if material_id is None:
            cursor.execute('SELECT id, nome, descricao FROM locais_carga WHERE ativo = 1 ORDER BY nome ASC')
            locais = [dict(row) for row in cursor.fetchall()]
        else:
            cursor.execute('''
                SELECT lc.id, lc.nome, lc.descricao
                FROM locais_carga lc
                INNER JOIN local_carga_materiais lcm ON lcm.local_carga_id = lc.id AND lcm.material_id = ?
                WHERE lc.ativo = 1
                ORDER BY lc.nome ASC
            ''', (material_id,))
            locais = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return jsonify(locais)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/materiais', methods=['POST'])
def adicionar_material():
    """Adicionar novo material"""
    try:
        data = request.get_json()
        nome = data.get('nome', '').strip()
        descricao = data.get('descricao', '').strip()
        
        if not nome:
            return jsonify({'error': 'Nome do material é obrigatório'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar se já existe
        cursor.execute('SELECT id FROM materiais WHERE nome = ?', (nome,))
        if cursor.fetchone():
            conn.close()
            return jsonify({'error': 'Este material já existe'}), 400
        
        # Inserir novo
        cursor.execute('''
            INSERT INTO materiais (nome, descricao, ativo)
            VALUES (?, ?, 1)
        ''', (nome, descricao))
        
        conn.commit()
        novo_id = cursor.lastrowid
        conn.close()
        
        return jsonify({'id': novo_id, 'nome': nome, 'descricao': descricao, 'success': True}), 201
    except Exception as e:
        import traceback
        print(f"Erro ao adicionar material: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/materiais/<int:material_id>', methods=['DELETE'])
def remover_material(material_id):
    """Remover (desativar) material"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE materiais 
            SET ativo = 0, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (material_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/materiais/<int:material_id>', methods=['PUT'])
def atualizar_material(material_id):
    """Atualizar material"""
    try:
        data = request.get_json()
        nome = data.get('nome', '').strip()
        descricao = data.get('descricao', '').strip()
        
        if not nome:
            return jsonify({'error': 'Nome do material é obrigatório'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar se já existe outro registo com o mesmo nome
        cursor.execute('SELECT id FROM materiais WHERE nome = ? AND id != ?', (nome, material_id))
        if cursor.fetchone():
            conn.close()
            return jsonify({'error': 'Este material já existe'}), 400
        
        # Atualizar
        cursor.execute('''
            UPDATE materiais 
            SET nome = ?, descricao = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (nome, descricao, material_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== ROTAS CONJUNTOS COMPATÍVEIS ====================

@app.route('/api/conjuntos-compatives', methods=['GET'])
def get_conjuntos_compatives():
    """Obter todos os conjuntos compatíveis"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT cc.*, t.matricula as trator_matricula, t.codigo as trator_codigo,
                   c.matricula as cisterna_matricula, c.codigo as cisterna_codigo
            FROM conjuntos_compatives cc
            JOIN tratores t ON cc.trator_id = t.id
            JOIN cisternas c ON cc.cisterna_id = c.id
            ORDER BY t.matricula ASC, c.matricula ASC
        ''')
        conjuntos = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return jsonify(conjuntos)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/conjuntos-compatives', methods=['POST'])
def adicionar_conjunto_compative():
    """Adicionar novo conjunto compatível"""
    try:
        data = request.get_json()
        trator_id = data.get('trator_id')
        cisterna_id = data.get('cisterna_id')
        autorizado = data.get('autorizado', True)
        observacoes = data.get('observacoes', '').strip()
        
        if not trator_id or not cisterna_id:
            return jsonify({'error': 'Trator e cisterna são obrigatórios'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar se já existe
        cursor.execute('SELECT id FROM conjuntos_compatives WHERE trator_id = ? AND cisterna_id = ?', (trator_id, cisterna_id))
        if cursor.fetchone():
            conn.close()
            return jsonify({'error': 'Este conjunto já existe'}), 400
        
        # Inserir novo
        cursor.execute('''
            INSERT INTO conjuntos_compatives (trator_id, cisterna_id, autorizado, observacoes)
            VALUES (?, ?, ?, ?)
        ''', (trator_id, cisterna_id, 1 if autorizado else 0, observacoes))
        
        conn.commit()
        novo_id = cursor.lastrowid
        conn.close()
        
        return jsonify({'id': novo_id, 'success': True}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/conjuntos-compatives/<int:conjunto_id>', methods=['PUT'])
def atualizar_conjunto_compative(conjunto_id):
    """Atualizar conjunto compatível"""
    try:
        data = request.get_json()
        autorizado = data.get('autorizado', True)
        observacoes = data.get('observacoes', '').strip()
        
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE conjuntos_compatives 
            SET autorizado = ?, observacoes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (1 if autorizado else 0, observacoes, conjunto_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/conjuntos-compatives/<int:conjunto_id>', methods=['DELETE'])
def remover_conjunto_compative(conjunto_id):
    """Remover conjunto compatível"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM conjuntos_compatives WHERE id = ?', (conjunto_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/conjuntos-compatives/verificar', methods=['GET'])
def verificar_conjunto_compative():
    """Verificar se um conjunto (trator + cisterna) está autorizado"""
    try:
        trator_id = request.args.get('trator_id')
        cisterna_id = request.args.get('cisterna_id')
        
        if not trator_id or not cisterna_id:
            return jsonify({'error': 'Trator e cisterna são obrigatórios'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT autorizado FROM conjuntos_compatives 
            WHERE trator_id = ? AND cisterna_id = ?
        ''', (trator_id, cisterna_id))
        
        resultado = cursor.fetchone()
        conn.close()
        
        if resultado:
            return jsonify({'autorizado': bool(resultado['autorizado'])})
        else:
            return jsonify({'autorizado': False})  # Se não existir, não autorizado
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== ROTAS TRANSPORTADORAS ====================

@app.route('/api/transportadoras', methods=['GET'])
def get_transportadoras():
    """Obter todas as transportadoras"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM transportadoras 
            ORDER BY nome ASC
        ''')
        transportadoras = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return jsonify(transportadoras)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/transportadoras', methods=['POST'])
def adicionar_transportadora():
    """Adicionar nova transportadora"""
    try:
        data = request.get_json()
        nome = data.get('nome', '').strip()
        observacoes = data.get('observacoes', '').strip()
        
        if not nome:
            return jsonify({'error': 'Nome da transportadora é obrigatório'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar se já existe
        cursor.execute('SELECT id FROM transportadoras WHERE nome = ?', (nome,))
        if cursor.fetchone():
            conn.close()
            return jsonify({'error': 'Esta transportadora já existe'}), 400
        
        # Inserir novo
        cursor.execute('''
            INSERT INTO transportadoras (nome, ativo, observacoes)
            VALUES (?, 1, ?)
        ''', (nome, observacoes))
        
        conn.commit()
        novo_id = cursor.lastrowid
        conn.close()
        
        return jsonify({'id': novo_id, 'nome': nome, 'success': True}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/transportadoras/<int:transportadora_id>', methods=['PUT'])
def atualizar_transportadora(transportadora_id):
    """Atualizar transportadora"""
    try:
        data = request.get_json()
        nome = data.get('nome', '').strip()
        ativo = data.get('ativo', True)
        observacoes = data.get('observacoes', '').strip()
        
        if not nome:
            return jsonify({'error': 'Nome da transportadora é obrigatório'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar se já existe outro com o mesmo nome
        cursor.execute('SELECT id FROM transportadoras WHERE nome = ? AND id != ?', (nome, transportadora_id))
        if cursor.fetchone():
            conn.close()
            return jsonify({'error': 'Esta transportadora já existe'}), 400
        
        cursor.execute('''
            UPDATE transportadoras 
            SET nome = ?, ativo = ?, observacoes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (nome, 1 if ativo else 0, observacoes, transportadora_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/transportadoras/<int:transportadora_id>', methods=['DELETE'])
def remover_transportadora(transportadora_id):
    """Remover (desativar) transportadora"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE transportadoras 
            SET ativo = 0, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (transportadora_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/transportadoras/<int:transportadora_id>/ativar', methods=['POST'])
def ativar_transportadora_data(transportadora_id):
    """Ativar transportadora para uma data específica"""
    try:
        data = request.get_json()
        data_ativacao = data.get('data_ativacao')
        
        if not data_ativacao:
            return jsonify({'error': 'Data de ativação é obrigatória'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar se transportadora existe
        cursor.execute('SELECT id FROM transportadoras WHERE id = ?', (transportadora_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'error': 'Transportadora não encontrada'}), 404
        
        # Inserir ou atualizar ativação
        cursor.execute('''
            INSERT OR REPLACE INTO transportadoras_ativacao 
            (transportadora_id, data_ativacao, ativo)
            VALUES (?, ?, 1)
        ''', (transportadora_id, data_ativacao))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/transportadoras/<int:transportadora_id>/desativar', methods=['POST'])
def desativar_transportadora_data(transportadora_id):
    """Desativar transportadora para uma data específica (só se não tiver encomendas atribuídas)"""
    try:
        data = request.get_json()
        data_ativacao = data.get('data_ativacao')
        
        if not data_ativacao:
            return jsonify({'error': 'Data é obrigatória'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Verificar se a transportadora está ativa para esta data
        cursor.execute('''
            SELECT id FROM transportadoras_ativacao 
            WHERE transportadora_id = ? AND data_ativacao = ? AND ativo = 1
        ''', (transportadora_id, data_ativacao))
        
        ativacao = cursor.fetchone()
        if not ativacao:
            conn.close()
            return jsonify({'error': 'Transportadora não está ativa para esta data'}), 400
        
        # Verificar se há encomendas atribuídas a esta transportadora nesta data
        # As transportadoras aparecem como cards com id = "trans_{transportadora_id}"
        # Mas as encomendas são atribuídas através de atribuicao_id na tabela encomenda_viatura
        # Como as transportadoras não têm atribuicao_id real, precisamos verificar de outra forma.
        # Vamos verificar se há encomendas na data que não têm atribuicao_id válido
        # (atribuicao_id NULL ou que não existe em atribuicoes_motoristas)
        # Isso indicaria que podem ser de transportadoras
        cursor.execute('''
            SELECT COUNT(*) as total
            FROM encomenda_viatura ev
            LEFT JOIN atribuicoes_motoristas am ON ev.atribuicao_id = am.id AND am.data_atribuicao = ?
            WHERE ev.data_associacao = ?
            AND (ev.atribuicao_id IS NULL OR am.id IS NULL)
        ''', (data_ativacao, data_ativacao))
        
        resultado = cursor.fetchone()
        total_encomendas = resultado['total'] if resultado else 0
        
        # Se há encomendas sem atribuicao_id válido, pode ser que sejam de transportadoras
        # Mas não podemos ter certeza de que são desta transportadora específica
        # Por segurança, vamos bloquear se houver qualquer encomenda sem atribuicao_id válido
        # na data, pois pode ser de transportadoras
        if total_encomendas > 0:
            conn.close()
            return jsonify({
                'success': False,
                'error': f'Não é possível desativar a transportadora. Existem {total_encomendas} encomenda(s) atribuída(s) para esta data que podem estar associadas a transportadoras. Remova as encomendas primeiro.'
            }), 400
        
        # Se não há encomendas, pode desativar
        cursor.execute('''
            UPDATE transportadoras_ativacao 
            SET ativo = 0
            WHERE transportadora_id = ? AND data_ativacao = ?
        ''', (transportadora_id, data_ativacao))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/transportadoras/ativas', methods=['GET'])
def get_transportadoras_ativas():
    """Obter transportadoras ativas para uma data específica"""
    try:
        data = request.args.get('data')
        
        if not data:
            return jsonify({'error': 'Data é obrigatória'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT t.* 
            FROM transportadoras t
            JOIN transportadoras_ativacao ta ON t.id = ta.transportadora_id
            WHERE t.ativo = 1 
            AND ta.data_ativacao = ?
            AND ta.ativo = 1
            ORDER BY t.nome ASC
        ''', (data,))
        
        transportadoras = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return jsonify(transportadoras)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== RELATÓRIO DE BAIXAS E FÉRIAS ====================

@app.route('/api/relatorio-baixas-ferias', methods=['GET'])
def get_relatorio_baixas_ferias():
    """Obter relatório de dias de baixa e férias por motorista"""
    try:
        data_inicio = request.args.get('data_inicio')
        data_fim = request.args.get('data_fim')
        
        if not data_inicio or not data_fim:
            return jsonify({'error': 'Data início e data fim são obrigatórias'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Buscar todos os status de férias e baixa no período
        cursor.execute('''
            SELECT 
                vm.id,
                vm.matricula,
                vm.codigo,
                vm.nome_motorista,
                vms.status,
                vms.data_status,
                vms.data_inicio,
                vms.data_fim
            FROM viatura_motorista_status vms
            JOIN viatura_motorista vm ON vms.viatura_motorista_id = vm.id
            WHERE vms.status IN ('Ferias', 'Baixa', 'OutrosTrabalhos')
            AND vms.data_status >= ? AND vms.data_status <= ?
            ORDER BY vm.nome_motorista, vms.data_status
        ''', (data_inicio, data_fim))
        
        registos = cursor.fetchall()
        
        # Agrupar por motorista e status
        relatorio = {}
        from datetime import datetime, timedelta
        
        for reg in registos:
            motorista_id = reg['id']
            nome_motorista = reg['nome_motorista']
            matricula = reg['matricula']
            codigo = reg['codigo']
            status = reg['status']
            data_status = reg['data_status']
            data_inicio_periodo = reg['data_inicio']
            data_fim_periodo = reg['data_fim']
            
            chave = f"{motorista_id}_{nome_motorista}_{matricula}_{codigo}"
            
            if chave not in relatorio:
                relatorio[chave] = {
                    'motorista_id': motorista_id,
                    'nome_motorista': nome_motorista,
                    'matricula': matricula,
                    'codigo': codigo,
                    'dias_ferias': 0,
                    'dias_baixa': 0,
                    'periodos_ferias': [],
                    'periodos_baixa': []
                }
            
            # Se tiver data_inicio e data_fim, calcular dias do período
            if data_inicio_periodo and data_fim_periodo:
                try:
                    inicio = datetime.strptime(data_inicio_periodo, '%Y-%m-%d').date()
                    fim = datetime.strptime(data_fim_periodo, '%Y-%m-%d').date()
                    
                    # Contar apenas dias úteis (segunda a sexta)
                    dias_uteis = 0
                    data_atual = inicio
                    while data_atual <= fim:
                        if data_atual.weekday() < 5:  # 0=segunda, 4=sexta
                            dias_uteis += 1
                        data_atual += timedelta(days=1)
                    
                    periodo = {
                        'inicio': data_inicio_periodo,
                        'fim': data_fim_periodo,
                        'dias': dias_uteis
                    }
                    
                    if status == 'Ferias':
                        relatorio[chave]['dias_ferias'] += dias_uteis
                        relatorio[chave]['periodos_ferias'].append(periodo)
                    elif status == 'Baixa':
                        relatorio[chave]['dias_baixa'] += dias_uteis
                        relatorio[chave]['periodos_baixa'].append(periodo)
                except:
                    # Se houver erro ao calcular, contar apenas 1 dia
                    if status == 'Ferias':
                        relatorio[chave]['dias_ferias'] += 1
                    elif status == 'Baixa':
                        relatorio[chave]['dias_baixa'] += 1
            else:
                # Se não tiver período, contar apenas 1 dia
                if status == 'Ferias':
                    relatorio[chave]['dias_ferias'] += 1
                elif status == 'Baixa':
                    relatorio[chave]['dias_baixa'] += 1
        
        # Converter para lista e ordenar
        resultado = list(relatorio.values())
        resultado.sort(key=lambda x: x['nome_motorista'])
        
        conn.close()
        return jsonify(resultado)
    except Exception as e:
        import traceback
        print(f"Erro ao gerar relatório: {e}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

# Handler de erros global para garantir que sempre retorna JSON
# Mas apenas para endpoints de API, não para páginas HTML
@app.errorhandler(404)
def not_found(error):
    # Se for uma requisição para uma página HTML, retornar página 404
    if request.path.startswith('/admin/dashboard'):
        return render_template('admin_dashboard.html')
    # Para outros endpoints, retornar JSON
    return jsonify({'error': 'Endpoint não encontrado'}), 404

@app.errorhandler(500)
def internal_error(error):
    import traceback
    error_msg = str(error)
    error_trace = traceback.format_exc()
    print(f"Erro interno 500: {error_msg}")
    print(error_trace)
    return jsonify({'error': 'Erro interno do servidor. Verifique os logs do servidor.'}), 500

@app.errorhandler(Exception)
def handle_exception(e):
    import traceback
    error_msg = str(e)
    error_trace = traceback.format_exc()
    print(f"Exceção não tratada: {error_msg}")
    print(error_trace)
    return jsonify({'error': f'Erro: {error_msg}'}), 500

# Inicializar BD quando o app é carregado por gunicorn (ex.: Render) — em local usa-se init_db() no __main__
if __name__ != '__main__' and os.environ.get('PORT'):
    try:
        init_db()
        print('[OK] BD inicializada (produção/Render)')
    except Exception as e:
        print(f'[AVISO] init_db em produção: {e}')

if __name__ == '__main__':
    # Inicializar banco de dados
    init_db()
    
    import socket
    import subprocess
    hostname = socket.gethostname()
    ip_local = socket.gethostbyname(hostname)
    tailscale_ip = None
    try:
        for cmd in [['tailscale', 'ip', '-4'], ['tailscale', 'ip', '--4'], ['tailscale.exe', 'ip', '-4']]:
            try:
                r = subprocess.run(cmd, capture_output=True, text=True, timeout=3)
                if r.returncode == 0 and r.stdout and r.stdout.strip():
                    ip = (r.stdout.strip().split() or [r.stdout.strip()])[0]
                    if ip and ip.startswith('100.'):
                        tailscale_ip = ip
                        break
            except Exception:
                pass
    except Exception:
        pass
    if tailscale_ip:
        app.config['TAILSCALE_IP'] = tailscale_ip
    
    print("SERVIDOR DE PLANEAMENTO DE CARGAS")
    print("=" * 60)
    
    # Verificar dependências
    print("Verificando dependências...")
    verificar_dependencias()
    print("=" * 60)
    
    # Configurar acesso pela internet via Cloudflare Tunnel
    # DESATIVADO: Use ServeZero ou outro túnel externamente
    # Para usar Cloudflare, execute cloudflared manualmente em outra janela
    url_publica = None
    app.config['URL_PUBLICA'] = None

    _dir = os.path.dirname(os.path.abspath(__file__))
    # Por defeito: túnel Cloudflare (sem token, funciona em redes corporativas). Ngrok só se existir usar_ngrok.txt
    usar_ngrok_automatico = os.path.exists(os.path.join(_dir, 'usar_ngrok.txt'))
    if not usar_ngrok_automatico:
        print("🌐 Acesso fora da rede: túnel Cloudflare (aguarde ~15 s para a URL). Para usar ngrok, crie usar_ngrok.txt.")
    if os.path.exists(os.path.join(_dir, 'ngrok_desativado.txt')):
        usar_ngrok_automatico = False
    if os.environ.get('NO_NGROK', '').strip().lower() in ('1', 'true', 'yes'):
        usar_ngrok_automatico = False

    usar_cloudflare_automatico = False  # quick tunnel é iniciado em thread quando url_publica é None

    if usar_ngrok_automatico:
        try:
            import subprocess
            import time
            import json
            import atexit
            
            print("🌐 Configurando acesso pela internet via ngrok...")
            
            # Verificar se ngrok está instalado
            ngrok_path = None
            possible_paths = ['ngrok', 'ngrok.exe']
            
            # Verificar se está no diretório atual
            if os.path.exists('ngrok.exe'):
                ngrok_path = 'ngrok.exe'
            else:
                # Verificar se está no PATH
                for path in possible_paths:
                    try:
                        result = subprocess.run([path, 'version'], capture_output=True, timeout=5)
                        if result.returncode == 0:
                            ngrok_path = path
                            break
                    except:
                        pass
            
            # Tentar usar pyngrok como alternativa
            usar_pyngrok = False
            if not ngrok_path:
                try:
                    from pyngrok import ngrok as pyngrok_module
                    usar_pyngrok = True
                    print("✅ pyngrok encontrado (alternativa ao ngrok.exe)")
                except ImportError:
                    print("⚠️  ngrok não encontrado. Tentando instalar pyngrok...")
                    try:
                        import subprocess
                        import sys
                        subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'pyngrok', '-q'])
                        from pyngrok import ngrok as pyngrok_module
                        usar_pyngrok = True
                        print("✅ pyngrok instalado e pronto!")
                    except:
                        print("⚠️  Não foi possível instalar pyngrok automaticamente.")
                        print("   Para instalar manualmente:")
                        print("   1. Execute: pip install pyngrok")
                        print("   2. Ou baixe ngrok.exe de: https://ngrok.com/download")
                        print("   Por agora, o servidor está disponível apenas na rede local.")
            
            if usar_pyngrok:
                try:
                    # Token e ficheiro de config para evitar erros de certificado (proxy/corporate)
                    ngrok_token_file = os.path.join(os.path.dirname(__file__), 'ngrok_token.txt')
                    ngrok_token = None
                    if os.path.exists(ngrok_token_file):
                        try:
                            with open(ngrok_token_file, 'r', encoding='utf-8') as f:
                                ngrok_token = f.read().strip()
                                if ngrok_token:
                                    pyngrok_module.set_auth_token(ngrok_token)
                                    print(f"✅ Token ngrok configurado ({len(ngrok_token)} caracteres)")
                        except Exception as e:
                            print(f"⚠️  Erro ao ler token: {e}")
                    
                    if not ngrok_token:
                        token_path_abs = os.path.abspath(ngrok_token_file)
                        print("⚠️  Token ngrok em falta. Para acesso pela internet:")
                        print(f"    1. Registe-se em https://dashboard.ngrok.com/signup e copie o seu authtoken")
                        print(f"    2. Crie o ficheiro: {token_path_abs}")
                        print(f"    3. Coloque dentro uma única linha com o token (sem aspas nem espaços extras)")
                        raise RuntimeError("Token ngrok em falta")
                    
                    # Config ngrok: v3. Forçar bypass ao proxy corporativo (evita x509 / korgn.su.lennut.com)
                    ngrok_config_path = os.path.join(os.path.dirname(__file__), 'ngrok_config.yml')
                    config_abs = os.path.abspath(ngrok_config_path)
                    _dir = os.path.dirname(os.path.abspath(__file__))
                    ca_pem = os.path.join(_dir, 'ngrok_corporate_ca.pem')
                    connect_cas_value = 'host'
                    if os.path.isfile(ca_pem):
                        ca_path_yaml = os.path.abspath(ca_pem).replace('\\', '/')
                        connect_cas_value = f'"{ca_path_yaml}"'
                        print(f"✅ A usar certificado CA corporativo: {ca_pem}")
                    try:
                        with open(ngrok_config_path, 'w', encoding='utf-8') as f:
                            f.write('version: "3"\n')
                            f.write('agent:\n')
                            f.write(f'  authtoken: "{ngrok_token}"\n')
                            f.write(f'  connect_cas: {connect_cas_value}\n')
                            f.write('  region: eu\n')
                            # Forçar sem proxy (proxy corporativo quebra TLS para tunnel.us.ngrok.com)
                            f.write('  proxy_url: ""\n')
                    except Exception as e:
                        print(f"⚠️  Erro ao escrever config ngrok: {e}")
                    # Forçar bypass total ao proxy: ngrok deve ligar direto a tunnel.us.ngrok.com
                    _proxy_vars = ('NO_PROXY', 'no_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy')
                    _proxy_antes = {k: os.environ.get(k) for k in _proxy_vars}
                    for k in _proxy_vars:
                        os.environ.pop(k, None)
                    os.environ['NO_PROXY'] = '*'
                    os.environ['no_proxy'] = '*'
                    try:
                        from pyngrok import conf as pyngrok_conf
                        pyngrok_config = pyngrok_conf.PyngrokConfig(config_path=config_abs)
                        public_url = pyngrok_module.connect(5000, pyngrok_config=pyngrok_config)
                    except (AttributeError, TypeError):
                        public_url = pyngrok_module.connect(5000)
                    finally:
                        for k in _proxy_vars:
                            os.environ.pop(k, None)
                        for k, v in _proxy_antes.items():
                            if v is not None:
                                os.environ[k] = v
                    
                    url_publica = str(public_url) if public_url else None
                    if url_publica:
                        app.config['URL_PUBLICA'] = url_publica
                        print(f"✅ Túnel ngrok criado com sucesso!")
                        print(f"🌍 URL Pública (Internet): {url_publica}")
                        print(f"   ⚠️  Esta URL muda a cada reinício do servidor!")
                        print(f"   🔒 Certifique-se de que o sistema de login está ativo.")
                except Exception as e:
                    err_str = str(e).lower()
                    print(f"⚠️  Erro ao criar túnel com pyngrok: {e}")
                    print("   Por agora, o servidor está disponível apenas na rede local.")
                    if 'x509' in err_str or 'certificate' in err_str or 'korgn' in err_str or 'unknown authority' in err_str:
                        print("   Rede corporativa com proxy/DPI (ex.: korgn.su.lennut.com) intercepta HTTPS.")
                        print("   Opções:")
                        print("   1. Usar telemóvel em DADOS MÓVEIS como hotspot e ligar o PC a esse Wi-Fi (ngrok passa a funcionar).")
                        print("   2. Pedir ao IT o certificado CA corporativo (root CA), gravar como ngrok_corporate_ca.pem nesta pasta.")
                        print("   3. Desativar ngrok: crie ngrok_desativado.txt nesta pasta (o túnel Cloudflare será usado em alternativa).")
            elif not ngrok_path:
                print("⚠️  ngrok não encontrado. Acesso pela internet não disponível.")
                print("   Para instalar:")
                print("   1. Baixe de: https://ngrok.com/download")
                print("   2. Coloque ngrok.exe nesta pasta")
                print("   3. Ou instale pyngrok: pip install pyngrok")
                print("   Por agora, o servidor está disponível apenas na rede local.")
            else:
                print(f"✅ ngrok encontrado: {ngrok_path}")
                
                ngrok_token_file = os.path.join(os.path.dirname(__file__), 'ngrok_token.txt')
                ngrok_config_path = os.path.join(os.path.dirname(__file__), 'ngrok_config.yml')
                ngrok_token = None
                
                if os.path.exists(ngrok_token_file):
                    try:
                        with open(ngrok_token_file, 'r', encoding='utf-8') as f:
                            ngrok_token = f.read().strip()
                            if ngrok_token:
                                print(f"✅ Token ngrok carregado do ficheiro ({len(ngrok_token)} caracteres)")
                                # Escrever config com root_cas: trusted (evita erros de certificado)
                                with open(ngrok_config_path, 'w', encoding='utf-8') as cf:
                                    cf.write('version: "2"\n')
                                    cf.write(f'authtoken: "{ngrok_token}"\n')
                                    cf.write('root_cas: trusted\n')
                                    cf.write('region: us\n')
                                config_abs = os.path.abspath(ngrok_config_path)
                    except Exception as e:
                        print(f"⚠️  Erro ao ler token: {e}")
                        config_abs = None
                else:
                    config_abs = None
                
                # Iniciar ngrok em background (usar config com root_cas: trusted se existir)
                print("🚀 Criando túnel ngrok (URL aleatória)...")
                cmd = [ngrok_path, 'http', '5000']
                if config_abs and os.path.exists(ngrok_config_path):
                    cmd.extend(['--config', config_abs])
                ngrok_process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True
                )
                
                # Registrar função para encerrar ngrok ao sair
                def encerrar_ngrok():
                    try:
                        if ngrok_process and ngrok_process.poll() is None:
                            ngrok_process.terminate()
                            ngrok_process.wait(timeout=5)
                    except:
                        pass
                
                atexit.register(encerrar_ngrok)
                
                # Aguardar ngrok iniciar e obter URL
                time.sleep(3)
                
                # Tentar obter URL da API do ngrok
                try:
                    import urllib.request
                    response = urllib.request.urlopen('http://localhost:4040/api/tunnels', timeout=5)
                    data = json.loads(response.read().decode())
                    
                    if data.get('tunnels') and len(data['tunnels']) > 0:
                        url_publica = data['tunnels'][0]['public_url']
                        app.config['URL_PUBLICA'] = url_publica
                        print(f"✅ Túnel ngrok criado com sucesso!")
                        print(f"🌍 URL Pública (Internet): {url_publica}")
                        print(f"   ⚠️  Esta URL muda a cada reinício do servidor!")
                        print(f"   ⚠️  Esta URL permite acesso de qualquer lugar na internet!")
                        print(f"   🔒 Certifique-se de que o sistema de login está ativo.")
                        print(f"   💡 Para ver a URL novamente: http://localhost:4040")
                    else:
                        print("⚠️  ngrok iniciado, mas URL ainda não disponível.")
                        print("   Aguarde alguns segundos e verifique: http://localhost:4040")
                except Exception as e:
                    print("⚠️  ngrok iniciado, mas não foi possível obter URL automaticamente.")
                    print("   Verifique a URL em: http://localhost:4040")
                    print("   Ou veja a janela do ngrok se abriu.")
                
        except Exception as e:
            error_msg = str(e)
            print(f"⚠️  Erro ao configurar ngrok: {error_msg}")
            print("   O servidor continuará disponível apenas na rede local.")
            print("   Verifique se tem conexão à internet e ngrok instalado.")
    
    # Túnel Cloudflare: só iniciar DEPOIS do Flask estar a escutar (em thread com atraso)
    def _iniciar_cloudflared_apos_servidor():
        import time
        import subprocess
        import atexit
        global url_publica
        try:
            import re
            import queue
            import urllib.request
            import ssl
            # Esperar o Flask estar a escutar em 127.0.0.1:5000
            flask_ready = False
            for _ in range(45):
                time.sleep(1)
                try:
                    req = urllib.request.Request('http://127.0.0.1:5000/tunnel-ok', headers={'User-Agent': 'TunnelReady/1'})
                    with urllib.request.urlopen(req, timeout=3) as r:
                        if r.status == 200:
                            flask_ready = True
                            break
                except Exception:
                    pass
            if not flask_ready:
                return
            _base = os.path.dirname(os.path.abspath(__file__))
            cloudflared_exe = os.path.join(_base, 'cloudflared.exe')
            cloudflared_path = None
            for path in ['cloudflared', 'cloudflared.exe', cloudflared_exe]:
                try:
                    r = subprocess.run([path, 'version'], capture_output=True, timeout=5)
                    if r.returncode == 0:
                        cloudflared_path = path
                        break
                except Exception:
                    pass
            if not cloudflared_path and os.name == 'nt':
                try:
                    ctx = ssl.create_default_context()
                    req = urllib.request.Request('https://api.github.com/repos/cloudflare/cloudflared/releases/latest', headers={'Accept': 'application/vnd.github.v3+json'})
                    with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
                        data = json.loads(resp.read().decode())
                    for asset in data.get('assets', []):
                        name = (asset.get('name') or '').lower()
                        if 'windows' in name and 'amd64' in name and (name.endswith('.exe') or 'exe' in name):
                            with urllib.request.urlopen(asset.get('browser_download_url'), timeout=60, context=ctx) as resp2:
                                with open(cloudflared_exe, 'wb') as f:
                                    f.write(resp2.read())
                            cloudflared_path = cloudflared_exe
                            break
                except Exception:
                    pass
            if not cloudflared_path:
                return
            # Diretório de config vazio: quick tunnel falha se existir config em .cloudflared
            import tempfile
            _cf_config_dir = tempfile.mkdtemp(prefix='cf_tunnel_')
            _cf_env = os.environ.copy()
            _cf_env['CLOUDFLARED_CONFIG_DIR'] = _cf_config_dir
            print("🌐 A iniciar Cloudflare Tunnel (servidor já está no ar)...")
            cf_process = subprocess.Popen(
                [cloudflared_path, 'tunnel', '--url', 'http://127.0.0.1:5000'],
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1, env=_cf_env, cwd=_cf_config_dir
            )
            output_queue = queue.Queue()
            def _read_cf():
                try:
                    for line in iter(cf_process.stdout.readline, ''):
                        if line:
                            output_queue.put(line)
                except Exception:
                    pass
            threading.Thread(target=_read_cf, daemon=True).start()
            for _ in range(45):
                time.sleep(1)
                if cf_process.poll() is not None:
                    break
                try:
                    while True:
                        line = output_queue.get_nowait()
                        m = re.search(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com', line)
                        if m:
                            url_publica = m.group(0).strip().rstrip(').')
                            app.config['URL_PUBLICA'] = url_publica
                            break
                except queue.Empty:
                    pass
                if url_publica:
                    break
            if url_publica:
                time.sleep(8)  # Dar tempo ao Cloudflare registar o túnel
                ok = False
                for _ in range(5):
                    try:
                        req = urllib.request.Request(
                            url_publica + '/tunnel-ok',
                            headers={'User-Agent': 'Mozilla/5.0 (tunnel-check)'}
                        )
                        with urllib.request.urlopen(req, timeout=15, context=ssl.create_default_context()) as r:
                            body = r.read()
                            ok = (r.status == 200 and body.startswith(b'OK'))
                        if ok:
                            break
                    except Exception:
                        pass
                    time.sleep(5)
                if ok:
                    print(f"✅ Túnel Cloudflare ativo e a responder!")
                    print(f"🌍 Abrir fora da rede (telemóvel/dados): {url_publica}")
                    print(f"   Login: {url_publica}/  (teste: {url_publica}/tunnel-ok)")
                else:
                    # Cloudflare deu URL mas verificação falhou (rede pode bloquear trycloudflare.com). Tentar localhost.run (SSH).
                    print(f"⚠️  Túnel Cloudflare criado mas não respondeu (a rede pode bloquear trycloudflare.com). A tentar localhost.run...")
                    _lh_url = None
                    try:
                        _ssh_cmd = ['ssh', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=NUL' if os.name == 'nt' else 'UserKnownHostsFile=/dev/null', '-o', 'ConnectTimeout=20', '-R', '80:localhost:5000', 'nokey@localhost.run']
                        _p = subprocess.Popen(_ssh_cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
                        for _ in range(30):
                            time.sleep(1)
                            if _p.poll() is not None:
                                break
                            try:
                                _line = _p.stdout.readline()
                                if not _line:
                                    continue
                                _line = _line.strip()
                                # localhost.run emite JSON {"domain":"xxx.localhost.run",...} ou "Connect to http://xxx.localhost.run"
                                if '"domain"' in _line or 'Connect to' in _line:
                                    try:
                                        _j = json.loads(_line)
                                        _dom = (_j.get('domain') or '').strip()
                                        if _dom and '.localhost.run' in _dom and 'admin' not in _dom.lower():
                                            _lh_url = 'https://' + _dom.replace('http://', '').replace('https://', '').strip()
                                            break
                                    except Exception:
                                        pass
                                if 'Connect to ' in _line:
                                    _m2 = re.search(r'Connect to (https?://[^\s"\']+\.localhost\.run)', _line)
                                    if _m2 and 'admin' not in _m2.group(1).lower():
                                        _lh_url = _m2.group(1).strip().rstrip(').,;')
                                        break
                                _m = re.search(r'https?://([a-zA-Z0-9][a-zA-Z0-9.-]*)\.localhost\.run', _line)
                                if _m and 'admin' not in _m.group(1).lower():
                                    _lh_url = _m.group(0).strip().rstrip(').,;')
                                    break
                            except Exception:
                                pass
                        if _lh_url:
                            _cf_url_backup = url_publica  # guardar Cloudflare para alternativa
                            url_publica = _lh_url
                            app.config['URL_PUBLICA'] = url_publica
                            if _cf_url_backup:
                                app.config['URL_PUBLICA_ALT'] = _cf_url_backup
                            print(f"✅ Túnel localhost.run ativo!")
                            print(f"🌍 Abrir fora da rede: {url_publica}")
                            if _cf_url_backup:
                                print(f"   Se não abrir: no telemóvel em DADOS MÓVEIS use: {_cf_url_backup}")
                            try:
                                cf_process.terminate()
                                cf_process.wait(timeout=3)
                            except Exception:
                                pass
                            def _fechar_ssh():
                                try:
                                    if _p.poll() is None:
                                        _p.terminate()
                                        _p.wait(timeout=5)
                                except Exception:
                                    pass
                            atexit.register(_fechar_ssh)
                        else:
                            _p.terminate()
                            try:
                                _p.wait(timeout=2)
                            except Exception:
                                pass
                    except Exception as _e:
                        pass
                    if not _lh_url:
                        print(f"🌍 URL Cloudflare (pode não funcionar nesta rede): {url_publica}")
                        print(f"   Tente no telemóvel em DADOS MÓVEIS, ou noutra rede. Se falhar: use hotspot do telemóvel no PC e reinicie a app.")
                def _fechar_cf():
                    try:
                        if cf_process.poll() is None:
                            cf_process.terminate()
                            cf_process.wait(timeout=5)
                    except Exception:
                        pass
                atexit.register(_fechar_cf)
            else:
                try:
                    cf_process.terminate()
                    cf_process.wait(timeout=3)
                except Exception:
                    pass
        except Exception as e:
            print(f"   ⚠️  Túnel Cloudflare: {e}")
    
    if url_publica is None:
        threading.Thread(target=_iniciar_cloudflared_apos_servidor, daemon=True).start()
        print("   💡 Túnel Cloudflare: aguarde ~15 s. Depois abra no browser  http://127.0.0.1:5000/qr  para ver o link e o QR code (telemóvel).")
    
    if usar_cloudflare_automatico:
        try:
            import subprocess
            import json
            import atexit
            import time
            import threading
            
            print("🌐 Configurando acesso pela internet via Cloudflare Tunnel...")
            
            # Verificar se cloudflared está instalado
            cloudflared_path = None
            possible_paths = ['cloudflared', 'cloudflared.exe']
            
            # Verificar se está no PATH
            for path in possible_paths:
                try:
                    result = subprocess.run([path, 'version'], capture_output=True, timeout=5)
                    if result.returncode == 0:
                        cloudflared_path = path
                        break
                except:
                    pass
            
            if not cloudflared_path:
                print("⚠️  cloudflared não encontrado. Acesso pela internet não disponível.")
                print("   Para instalar:")
                print("   1. Baixe de: https://github.com/cloudflare/cloudflared/releases")
                print("   2. Ou execute: INSTALAR_CLOUDFLARED.bat")
                print("   3. Depois reinicie o servidor")
                print("   Por agora, o servidor está disponível apenas na rede local.")
            else:
                print(f"✅ cloudflared encontrado: {cloudflared_path}")
            
            # Verificar se existe domínio/subdomínio configurado
            cloudflare_domain_file = os.path.join(os.path.dirname(__file__), 'cloudflare_domain.txt')
            cloudflare_domain = None
            
            if os.path.exists(cloudflare_domain_file):
                try:
                    with open(cloudflare_domain_file, 'r', encoding='utf-8') as f:
                        cloudflare_domain = f.read().strip()
                        cloudflare_domain = cloudflare_domain.replace(' ', '').replace('\n', '').replace('\r', '').replace('\t', '')
                        if cloudflare_domain:
                            print(f"✅ Subdomínio Cloudflare configurado: {cloudflare_domain}")
                        else:
                            cloudflare_domain = None
                except Exception as e:
                    print(f"⚠️  Erro ao ler subdomínio: {e}")
                    cloudflare_domain = None
            
            # Criar túnel Cloudflare
            try:
                cloudflared_process = None
                
                if cloudflare_domain:
                    # Usar subdomínio personalizado (URL fixa)
                    print(f"🚀 Criando túnel com subdomínio fixo: {cloudflare_domain}...")
                    # Para usar túnel nomeado com subdomínio, precisa criar/configurar arquivo de configuração
                    # OU usar o método mais simples: tunnel run com configuração inline
                    
                    # Verificar se existe túnel "pragosa"
                    try:
                        check_result = subprocess.run(
                            [cloudflared_path, 'tunnel', 'list'],
                            capture_output=True,
                            text=True,
                            timeout=5
                        )
                        tem_tunel_pragosa = 'pragosa' in check_result.stdout
                    except:
                        tem_tunel_pragosa = False
                    
                    if tem_tunel_pragosa:
                        # Usar túnel nomeado "pragosa" - já está configurado
                        print(f"✅ Túnel 'pragosa' encontrado - usando configuração existente")
                        print(f"   O ficheiro config.yml já está configurado com: {cloudflare_domain}")
                        
                        # Rodar túnel nomeado (usa config.yml existente)
                        try:
                            cloudflared_process = subprocess.Popen(
                                [cloudflared_path, 'tunnel', 'run', 'pragosa'],
                                stdout=subprocess.PIPE,
                                stderr=subprocess.STDOUT,
                                text=True
                            )
                        except Exception as config_error:
                            print(f"⚠️  Erro ao iniciar túnel: {config_error}")
                            print(f"   Tentando método alternativo...")
                            # Fallback: usar método simples
                            cloudflared_process = subprocess.Popen(
                                [cloudflared_path, 'tunnel', '--url', f'http://localhost:5000', '--hostname', cloudflare_domain],
                                stdout=subprocess.PIPE,
                                stderr=subprocess.STDOUT,
                                text=True
                            )
                    else:
                        # Sem túnel nomeado, usar método simples
                        cloudflared_process = subprocess.Popen(
                            [cloudflared_path, 'tunnel', '--url', f'http://localhost:5000', '--hostname', cloudflare_domain],
                            stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT,
                            text=True
                        )
                    
                    # Dar tempo para o túnel iniciar e verificar erros
                    time.sleep(3)
                    
                    # Verificar se processo ainda está rodando (se não, houve erro)
                    if cloudflared_process.poll() is not None:
                        # Processo terminou, ler output para ver erro
                        try:
                            output = cloudflared_process.stdout.read()
                            error_msg = output[:500] if output else 'Erro desconhecido'
                            print(f"⚠️  Erro ao iniciar túnel: {error_msg}")
                            print(f"   Tentando método alternativo...")
                            # Tentar método mais simples sem hostname específico
                            cloudflared_process = subprocess.Popen(
                                [cloudflared_path, 'tunnel', '--url', 'http://localhost:5000'],
                                stdout=subprocess.DEVNULL,
                                stderr=subprocess.DEVNULL
                            )
                            url_publica = None  # Não definir URL, mas processo continua
                            print(f"⚠️  Túnel iniciado sem subdomínio fixo.")
                            print(f"   Configure manualmente ou use URL aleatória.")
                        except:
                            raise Exception("cloudflared terminou inesperadamente. Verifique se o subdomínio está configurado corretamente.")
                    else:
                        url_publica = f"https://{cloudflare_domain}"
                        print(f"✅ Túnel Cloudflare criado com sucesso!")
                        print(f"🌍 URL Pública (Internet): {url_publica}")
                        print(f"   ✅ Esta URL será sempre a mesma!")
                        print(f"   ⚠️  Esta URL permite acesso de qualquer lugar na internet!")
                        print(f"   🔒 Certifique-se de que o sistema de login está ativo.")
                else:
                    # Usar URL aleatória (quick tunnel)
                    print(f"🚀 Criando túnel rápido (URL aleatória)...")
                    print("   Aguardando URL do túnel (pode demorar alguns segundos)...")
                    
                    # Iniciar cloudflared em background e ler URL do output
                    cloudflared_process = subprocess.Popen(
                        [cloudflared_path, 'tunnel', '--url', 'http://localhost:5000'],
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        text=True,
                        bufsize=1
                    )
                    
                    # Ler output usando threading (melhor para Windows)
                    import re
                    import queue
                    url_encontrada = False
                    url_publica_temp = None
                    output_queue = queue.Queue()
                    
                    def read_output():
                        """Thread para ler output do cloudflared"""
                        try:
                            for line in iter(cloudflared_process.stdout.readline, ''):
                                if line:
                                    output_queue.put(line)
                        except:
                            pass
                    
                    # Iniciar thread de leitura
                    reader_thread = threading.Thread(target=read_output, daemon=True)
                    reader_thread.start()
                    
                    # Aguardar URL por até 30 segundos
                    max_tentativas = 30
                    for tentativa in range(max_tentativas):
                        time.sleep(1)
                        
                        # Verificar se processo terminou
                        if cloudflared_process.poll() is not None:
                            # Processo terminou, tentar ler última linha da queue
                            try:
                                while True:
                                    line = output_queue.get_nowait()
                                    url_match = re.search(r'https://[^\s]+\.trycloudflare\.com', line)
                                    if url_match:
                                        url_publica_temp = url_match.group(0)
                                        url_encontrada = True
                                        break
                            except queue.Empty:
                                pass
                            
                            if not url_encontrada:
                                raise Exception("cloudflared terminou antes de obter URL")
                            break
                        
                        # Tentar ler da queue
                        try:
                            while True:
                                line = output_queue.get_nowait()
                                url_match = re.search(r'https://[^\s]+\.trycloudflare\.com', line)
                                if url_match:
                                    url_publica_temp = url_match.group(0)
                                    url_encontrada = True
                                    break
                        except queue.Empty:
                            pass
                        
                        if url_encontrada:
                            break
                    
                    if url_encontrada and url_publica_temp:
                        url_publica = url_publica_temp
                        print(f"✅ Túnel Cloudflare criado com sucesso!")
                        print(f"🌍 URL Pública (Internet): {url_publica}")
                        print(f"   ⚠️  Esta URL muda a cada reinício do servidor.")
                        print(f"   💡 Para URL fixa, configure um subdomínio (ver COMO_CONFIGURAR_CLOUDFLARE.txt)")
                        print(f"   ⚠️  Esta URL permite acesso de qualquer lugar na internet!")
                        print(f"   🔒 Certifique-se de que o sistema de login está ativo.")
                    else:
                        # Se não encontrou URL, manter processo rodando e informar
                        print(f"⚠️  Não foi possível extrair URL automaticamente do output.")
                        print(f"   O túnel está rodando em background.")
                        print(f"   Verifique manualmente executando: cloudflared tunnel --url http://localhost:5000")
                        print(f"   OU configure um subdomínio fixo executando: EXECUTAR_CONFIGURACAO_COMPLETA.bat")
                        url_publica = None  # Não definir URL, mas processo continua rodando
                
                # Guardar referência ao processo para fechar depois
                cloudflared_process_ref = cloudflared_process
                
                # Registrar função para fechar cloudflared ao sair
                def fechar_cloudflared():
                    try:
                        if cloudflared_process_ref and cloudflared_process_ref.poll() is None:
                            cloudflared_process_ref.terminate()
                            cloudflared_process_ref.wait(timeout=5)
                            print("\n🔒 Túnel Cloudflare fechado")
                    except:
                        try:
                            if cloudflared_process_ref:
                                cloudflared_process_ref.kill()
                        except:
                            pass
                
                atexit.register(fechar_cloudflared)
                
            except FileNotFoundError:
                print("⚠️  cloudflared não encontrado no sistema.")
                print("   Para instalar:")
                print("   1. Baixe de: https://github.com/cloudflare/cloudflared/releases")
                print("   2. Ou execute: INSTALAR_CLOUDFLARED.bat")
                print("   3. Adicione ao PATH ou coloque na pasta do projeto")
            except Exception as cloudflare_error:
                error_msg = str(cloudflare_error)
                print(f"⚠️  Erro ao configurar Cloudflare Tunnel: {error_msg}")
                print("   O servidor continuará disponível apenas na rede local.")
                print("   Verifique se tem conexão à internet e cloudflared instalado.")
        except Exception as e:
            error_msg = str(e)
            print(f"⚠️  Erro ao configurar Cloudflare Tunnel: {error_msg}")
            print("   O servidor continuará disponível apenas na rede local.")
            print("   Verifique se tem conexão à internet e tente novamente.")
    else:
        if url_publica is not None:
            print("ℹ️  Cloudflare Tunnel automático desativado (ngrok ativo).")
        # Se url_publica é None, já foi mostrada a dica de instalar cloudflared no fallback
    
    print(f"Servidor iniciado em:")
    print(f"  - Local: http://127.0.0.1:5000")
    print(f"  - Rede Local: http://{ip_local}:5000")
    if tailscale_ip:
        print(f"  - Tailscale (outra rede): http://{tailscale_ip}:5000")
    if url_publica:
        print(f"  - Internet: {url_publica}")
    print(f"Banco de dados: {DATABASE}")
    print("=" * 60)
    print(f"Telemovel na MESMA Wi-Fi:  http://{ip_local}:5000")
    if url_publica:
        print(f"ABRIR FORA DA REDE (telemovel/dados):  {url_publica}")
    elif tailscale_ip:
        print(f"Telemovel noutra rede:  http://{tailscale_ip}:5000  (Tailscale)")
    else:
        print("Fora da rede: aguarde a URL do túnel (Cloudflare) acima em ~15 s, ou use Tailscale.")
    if not url_publica:
        print("")
        print(">>> ABRIR NO TELEMOVEL (facil, sem instalar nada):")
        print("    No telemovel: desligue o Wi-Fi e use DADOS MOVEIS. Depois abra no browser")
        print("    a URL Cloudflare que apareceu acima (ou em  http://127.0.0.1:5000/acesso-remoto ).")
        print("")
    print("=" * 60)
    
    # Abrir navegador automaticamente após 2 segundos
    import threading
    import webbrowser
    import time
    
    # Variável para controlar se já abriu o navegador
    navegador_aberto = {'aberto': False}
    
    def abrir_navegador():
        time.sleep(2)  # Aguardar servidor iniciar
        if not navegador_aberto['aberto']:
            navegador_aberto['aberto'] = True
            webbrowser.open('http://127.0.0.1:5000')
    
    threading.Thread(target=abrir_navegador, daemon=True).start()
    
    # Corrigir nome do Igor Silva para Ígor Silva
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE viatura_motorista 
            SET nome_motorista = 'Ígor Silva'
            WHERE nome_motorista = 'Igor Silva' AND matricula = 'AT57JF'
        ''')
        if cursor.rowcount > 0:
            conn.commit()
            print(f"✓ Nome corrigido: Igor Silva → Ígor Silva ({cursor.rowcount} registo(s) atualizado(s))")
        conn.close()
    except Exception as e:
        print(f"⚠ Aviso ao corrigir nome: {e}")
    
    # Usar 0.0.0.0 para permitir acesso de qualquer computador na rede
    # debug=False para evitar reloads que abrem o navegador múltiplas vezes
    # Handler de erros global para garantir que sempre retorna JSON
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Endpoint não encontrado'}), 404

    @app.errorhandler(500)
    def internal_error(error):
        import traceback
        print(f"Erro interno: {error}")
        print(traceback.format_exc())
        return jsonify({'error': 'Erro interno do servidor'}), 500

    @app.errorhandler(Exception)
    def handle_exception(e):
        import traceback
        print(f"Exceção não tratada: {e}")
        print(traceback.format_exc())
        return jsonify({'error': f'Erro: {str(e)}'}), 500
    
    app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)


















