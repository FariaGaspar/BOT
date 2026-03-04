// Sistema de Planeamento de Cargas - JavaScript
// Funcionalidades estilo Excel

// ==================== SISTEMA DE JANELAS (DASHBOARD) ====================
function mostrarJanela(nomeJanela) {
    // Fechar menu hambúrguer
    fecharMenuHamburger();
    
    // Esconder TODAS as janelas primeiro
    document.querySelectorAll('.janela-dashboard').forEach(janela => {
        janela.style.display = 'none';
    });
    
    // Mostrar container do dashboard
    const dashboardContainer = document.querySelector('.dashboard-container');
    if (dashboardContainer) {
        dashboardContainer.style.display = 'flex';
        dashboardContainer.style.flexDirection = 'column';
    }
    
    // Mostrar apenas a janela selecionada
    const janela = document.getElementById(`janela-${nomeJanela}`);
    if (janela) {
        janela.style.display = 'flex'; // Usar flex para manter o layout correto
        
        // Carregar dados da janela se necessário
        switch(nomeJanela) {
            case 'motoristas':
                carregarMotoristas();
                break;
            case 'tratores':
                carregarTratores();
                break;
            case 'cisternas':
                carregarCisternas();
                break;
            case 'conjuntos-habituais':
                carregarConjuntos();
                break;
            case 'atribuir-motoristas':
                carregarConjuntosAtribuicao();
                break;
            case 'clientes-locais':
                carregarClientesLocais();
                break;
            case 'materiais':
                carregarMateriais();
                break;
            case 'locais-carga':
                carregarLocaisCarga();
                break;
            case 'conjuntos-compatives':
                carregarConjuntosCompatives();
                break;
            case 'transportadoras':
                carregarTransportadoras();
                break;
            case 'planeamento-diario':
                garantirCabecalhoEncomendasPendentes();
                atualizarLista();
                carregarEncomendasPendentesDia();
                carregarViaturasMotoristas();
                break;
        }
    }
}

function fecharJanela(nomeJanela) {
    const janela = document.getElementById(`janela-${nomeJanela}`);
    if (janela) {
        janela.style.display = 'none';
    }
    
    // Se não houver nenhuma janela aberta, esconder dashboard
    const janelasAbertas = document.querySelectorAll('.janela-dashboard[style*="display: flex"], .janela-dashboard[style*="display:flex"], .janela-dashboard[style*="display: block"], .janela-dashboard[style*="display:block"]');
    if (janelasAbertas.length === 0) {
        const dashboardContainer = document.querySelector('.dashboard-container');
        if (dashboardContainer) {
            dashboardContainer.style.display = 'none';
        }
        // Mostrar menu novamente
        document.getElementById('menuHamburgerModal').style.display = 'block';
    }
}

// ==================== GESTÃO DE MOTORISTAS ====================
async function carregarMotoristas() {
    try {
        const response = await fetch('/api/motoristas');
        const motoristas = await response.json();
        renderizarMotoristas(motoristas);
    } catch (error) {
        console.error('Erro ao carregar motoristas:', error);
    }
}

function renderizarMotoristas(motoristas) {
    const tbody = document.getElementById('motoristasBody');
    if (!tbody) return;
    
    if (!motoristas || motoristas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty">Nenhum motorista cadastrado</td></tr>';
        return;
    }
    
    tbody.innerHTML = motoristas.map(m => `
        <tr>
            <td>${m.nome || 'N/A'}</td>
            <td>${m.telefone || '-'}</td>
            <td>${m.email || '-'}</td>
            <td>${m.ativo ? '✅ Ativo' : '❌ Inativo'}</td>
            <td>
                <button onclick="editarMotorista(${m.id})" class="btn btn-sm">✏️</button>
                <button onclick="removerMotorista(${m.id})" class="btn btn-sm btn-danger">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function adicionarMotorista() {
    document.getElementById('modalMotoristaTitulo').textContent = 'Adicionar Motorista';
    document.getElementById('formMotorista').reset();
    document.getElementById('motoristaId').value = '';
    document.getElementById('motoristaAtivo').checked = true;
    document.getElementById('modalMotorista').style.display = 'block';
}

function formatDateForInput(val) {
    if (!val) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

async function editarMotorista(id) {
    try {
        const response = await fetch(`/api/motoristas/${id}`);
        const motorista = await response.json();
        
        document.getElementById('modalMotoristaTitulo').textContent = 'Editar Motorista';
        document.getElementById('motoristaId').value = motorista.id;
        document.getElementById('motoristaNomeCompleto').value = motorista.nome_completo || motorista.nome || '';
        document.getElementById('motoristaNomeAbreviado').value = motorista.nome_abreviado || '';
        document.getElementById('motoristaNumeroFuncionario').value = motorista.numero_funcionario || '';
        document.getElementById('motoristaDataNascimento').value = formatDateForInput(motorista.data_nascimento);
        document.getElementById('motoristaDataAdmissao').value = formatDateForInput(motorista.data_admissao);
        document.getElementById('motoristaTelefone').value = motorista.telefone || '';
        document.getElementById('motoristaEmail').value = motorista.email || '';
        document.getElementById('motoristaAtivo').checked = motorista.ativo !== 0;
        document.getElementById('motoristaObservacoes').value = motorista.observacoes || '';
        
        document.getElementById('modalMotorista').style.display = 'block';
    } catch (error) {
        console.error('Erro ao carregar motorista:', error);
        alert('Erro ao carregar dados do motorista');
    }
}

function fecharModalMotorista() {
    document.getElementById('modalMotorista').style.display = 'none';
}

async function salvarMotorista(event) {
    event.preventDefault();
    
    try {
        const nomeCompleto = document.getElementById('motoristaNomeCompleto').value.trim();
        const nomeAbreviado = document.getElementById('motoristaNomeAbreviado').value.trim();
        const dados = {
            nome_completo: nomeCompleto || null,
            nome_abreviado: nomeAbreviado || null,
            numero_funcionario: document.getElementById('motoristaNumeroFuncionario').value.trim() || null,
            data_nascimento: document.getElementById('motoristaDataNascimento').value || null,
            data_admissao: document.getElementById('motoristaDataAdmissao').value || null,
            telefone: document.getElementById('motoristaTelefone').value.trim() || null,
            email: document.getElementById('motoristaEmail').value.trim() || null,
            ativo: document.getElementById('motoristaAtivo').checked ? 1 : 0,
            observacoes: document.getElementById('motoristaObservacoes').value.trim() || null
        };
        
        if (!nomeCompleto) {
            alert('Por favor, preencha o nome completo do motorista.');
            return;
        }
        
        const id = document.getElementById('motoristaId').value;
        const url = id ? `/api/motoristas/${id}` : '/api/motoristas';
        const method = id ? 'PUT' : 'POST';
        
        console.log('Enviando dados:', dados);
        console.log('URL:', url);
        console.log('Method:', method);
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        
        // Verificar o tipo de conteúdo da resposta
        const contentType = response.headers.get('content-type');
        console.log('Content-Type:', contentType);
        console.log('Status:', response.status);
        
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Resposta não é JSON:', text.substring(0, 500));
            alert('❌ Erro: O servidor retornou uma resposta inválida. Verifique a consola (F12) para mais detalhes.');
            return;
        }
        
        const result = await response.json();
        console.log('Resposta do servidor:', result);
        
        if (response.ok) {
            fecharModalMotorista();
            carregarMotoristas();
            alert('✅ Motorista guardado com sucesso!');
        } else {
            const errorMsg = result.error || result.message || 'Erro desconhecido';
            console.error('Erro do servidor:', errorMsg);
            alert('❌ Erro ao guardar: ' + errorMsg);
        }
    } catch (error) {
        console.error('Erro ao guardar motorista:', error);
        alert('❌ Erro ao guardar motorista: ' + error.message);
    }
}

async function removerMotorista(id) {
    if (!confirm('Tem certeza que deseja remover este motorista?')) return;
    
    try {
        const response = await fetch(`/api/motoristas/${id}`, { method: 'DELETE' });
        if (response.ok) {
            carregarMotoristas();
        } else {
            alert('Erro ao remover motorista');
        }
    } catch (error) {
        console.error('Erro ao remover motorista:', error);
        alert('Erro ao remover motorista');
    }
}

// ==================== GESTÃO DE TRATORES ====================
async function carregarTratores() {
    try {
        const response = await fetch('/api/tratores');
        const tratores = await response.json();
        renderizarTratores(tratores);
    } catch (error) {
        console.error('Erro ao carregar tratores:', error);
    }
}

function renderizarTratores(tratores) {
    const tbody = document.getElementById('tratoresBody');
    if (!tbody) return;
    
    if (!tratores || tratores.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty">Nenhum trator cadastrado</td></tr>';
        return;
    }
    
    tbody.innerHTML = tratores.map(t => `
        <tr>
            <td>${t.matricula || 'N/A'}</td>
            <td>${t.codigo || '-'}</td>
            <td>${t.marca || '-'}</td>
            <td>${t.modelo || '-'}</td>
            <td>${t.ano || '-'}</td>
            <td>${t.ativo ? '✅ Ativo' : '❌ Inativo'}</td>
            <td>
                <button onclick="editarTrator(${t.id})" class="btn btn-sm">✏️</button>
                <button onclick="removerTrator(${t.id})" class="btn btn-sm btn-danger">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function adicionarTrator() {
    document.getElementById('modalTratorTitulo').textContent = 'Adicionar Trator';
    document.getElementById('formTrator').reset();
    document.getElementById('tratorId').value = '';
    document.getElementById('tratorAtivo').checked = true;
    document.getElementById('modalTrator').style.display = 'block';
}

async function editarTrator(id) {
    try {
        const response = await fetch(`/api/tratores/${id}`);
        const trator = await response.json();
        
        document.getElementById('modalTratorTitulo').textContent = 'Editar Trator';
        document.getElementById('tratorId').value = trator.id;
        document.getElementById('tratorMatricula').value = trator.matricula || '';
        document.getElementById('tratorCodigo').value = trator.codigo || '';
        document.getElementById('tratorMarca').value = trator.marca || '';
        document.getElementById('tratorModelo').value = trator.modelo || '';
        document.getElementById('tratorAno').value = trator.ano || '';
        document.getElementById('tratorAtivo').checked = trator.ativo !== 0;
        document.getElementById('tratorObservacoes').value = trator.observacoes || '';
        
        document.getElementById('modalTrator').style.display = 'block';
    } catch (error) {
        console.error('Erro ao carregar trator:', error);
        alert('Erro ao carregar dados do trator');
    }
}

function fecharModalTrator() {
    document.getElementById('modalTrator').style.display = 'none';
}

async function salvarTrator(event) {
    event.preventDefault();
    
    const dados = {
        matricula: document.getElementById('tratorMatricula').value.toUpperCase(),
        codigo: document.getElementById('tratorCodigo').value,
        marca: document.getElementById('tratorMarca').value,
        modelo: document.getElementById('tratorModelo').value,
        ano: document.getElementById('tratorAno').value ? parseInt(document.getElementById('tratorAno').value) : null,
        ativo: document.getElementById('tratorAtivo').checked ? 1 : 0,
        observacoes: document.getElementById('tratorObservacoes').value
    };
    
    const id = document.getElementById('tratorId').value;
    const url = id ? `/api/tratores/${id}` : '/api/tratores';
    const method = id ? 'PUT' : 'POST';
    
    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        
        if (response.ok) {
            fecharModalTrator();
            carregarTratores();
        } else {
            const error = await response.json();
            alert('Erro ao guardar: ' + (error.error || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro ao guardar trator:', error);
        alert('Erro ao guardar trator');
    }
}

async function removerTrator(id) {
    if (!confirm('Tem certeza que deseja remover este trator?')) return;
    
    try {
        const response = await fetch(`/api/tratores/${id}`, { method: 'DELETE' });
        if (response.ok) {
            carregarTratores();
        } else {
            alert('Erro ao remover trator');
        }
    } catch (error) {
        console.error('Erro ao remover trator:', error);
        alert('Erro ao remover trator');
    }
}

// ==================== GESTÃO DE CISTERNAS ====================
async function carregarCisternas() {
    try {
        const response = await fetch('/api/cisternas');
        const cisternas = await response.json();
        renderizarCisternas(cisternas);
    } catch (error) {
        console.error('Erro ao carregar cisternas:', error);
    }
}

function renderizarCisternas(cisternas) {
    const tbody = document.getElementById('cisternasBody');
    if (!tbody) return;
    
    if (!cisternas || cisternas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">Nenhuma cisterna cadastrada</td></tr>';
        return;
    }
    
    tbody.innerHTML = cisternas.map(c => `
        <tr>
            <td>${c.matricula || 'N/A'}</td>
            <td>${c.codigo || '-'}</td>
            <td>${c.capacidade || '-'}</td>
            <td>${c.tipo || '-'}</td>
            <td>${c.ativo ? '✅ Ativo' : '❌ Inativo'}</td>
            <td>
                <button onclick="editarCisterna(${c.id})" class="btn btn-sm">✏️</button>
                <button onclick="removerCisterna(${c.id})" class="btn btn-sm btn-danger">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function adicionarCisterna() {
    document.getElementById('modalCisternaTitulo').textContent = 'Adicionar Cisterna';
    document.getElementById('formCisterna').reset();
    document.getElementById('cisternaId').value = '';
    document.getElementById('cisternaAtivo').checked = true;
    document.getElementById('modalCisterna').style.display = 'block';
}

async function editarCisterna(id) {
    try {
        const response = await fetch(`/api/cisternas/${id}`);
        const cisterna = await response.json();
        
        document.getElementById('modalCisternaTitulo').textContent = 'Editar Cisterna';
        document.getElementById('cisternaId').value = cisterna.id;
        document.getElementById('cisternaMatricula').value = cisterna.matricula || '';
        document.getElementById('cisternaCodigo').value = cisterna.codigo || '';
        document.getElementById('cisternaCapacidade').value = cisterna.capacidade || '';
        document.getElementById('cisternaTipo').value = cisterna.tipo || '';
        document.getElementById('cisternaAtivo').checked = cisterna.ativo !== 0;
        document.getElementById('cisternaObservacoes').value = cisterna.observacoes || '';
        
        document.getElementById('modalCisterna').style.display = 'block';
    } catch (error) {
        console.error('Erro ao carregar cisterna:', error);
        alert('Erro ao carregar dados da cisterna');
    }
}

function fecharModalCisterna() {
    document.getElementById('modalCisterna').style.display = 'none';
}

async function salvarCisterna(event) {
    event.preventDefault();
    
    const dados = {
        matricula: document.getElementById('cisternaMatricula').value.toUpperCase(),
        codigo: document.getElementById('cisternaCodigo').value,
        capacidade: document.getElementById('cisternaCapacidade').value ? parseFloat(document.getElementById('cisternaCapacidade').value) : null,
        tipo: document.getElementById('cisternaTipo').value,
        ativo: document.getElementById('cisternaAtivo').checked ? 1 : 0,
        observacoes: document.getElementById('cisternaObservacoes').value
    };
    
    const id = document.getElementById('cisternaId').value;
    const url = id ? `/api/cisternas/${id}` : '/api/cisternas';
    const method = id ? 'PUT' : 'POST';
    
    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        
        if (response.ok) {
            fecharModalCisterna();
            carregarCisternas();
        } else {
            const error = await response.json();
            alert('Erro ao guardar: ' + (error.error || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro ao guardar cisterna:', error);
        alert('Erro ao guardar cisterna');
    }
}

async function removerCisterna(id) {
    if (!confirm('Tem certeza que deseja remover esta cisterna?')) return;
    
    try {
        const response = await fetch(`/api/cisternas/${id}`, { method: 'DELETE' });
        if (response.ok) {
            carregarCisternas();
        } else {
            alert('Erro ao remover cisterna');
        }
    } catch (error) {
        console.error('Erro ao remover cisterna:', error);
        alert('Erro ao remover cisterna');
    }
}

// ==================== GESTÃO DE CONJUNTOS HABITUAIS ====================
async function carregarConjuntos() {
    try {
        const response = await fetch('/api/conjuntos-habituais');
        const conjuntos = await response.json();
        renderizarConjuntos(conjuntos);
    } catch (error) {
        console.error('Erro ao carregar conjuntos:', error);
    }
}

async function carregarConjuntosAtribuicao() {
    try {
        // Buscar todos os conjuntos (ativos e inativos) para poder inativar/ativar
        const response = await fetch('/api/conjuntos-habituais?todos=true');
        const conjuntos = await response.json();
        renderizarConjuntosAtribuicao(conjuntos);
    } catch (error) {
        console.error('Erro ao carregar conjuntos:', error);
    }
}

function renderizarConjuntos(conjuntos) {
    const tbody = document.getElementById('conjuntosBody');
    if (!tbody) return;
    
    if (!conjuntos || conjuntos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">Nenhum conjunto habitual</td></tr>';
        return;
    }
    
    tbody.innerHTML = conjuntos.map(conjunto => `
        <tr>
            <td>${conjunto.nome || 'Sem nome'}</td>
            <td>${conjunto.trator_matricula || 'N/A'}</td>
            <td>${conjunto.cisterna_matricula || 'N/A'}</td>
            <td>${conjunto.motorista_nome || 'Não atribuído'}</td>
            <td>${conjunto.ordem || 0}</td>
            <td>
                <button onclick="editarConjunto(${conjunto.id})" class="btn btn-sm">✏️</button>
                <button onclick="removerConjunto(${conjunto.id})" class="btn btn-sm btn-danger">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function renderizarConjuntosAtribuicao(conjuntos) {
    const tbody = document.getElementById('conjuntosAtribuicaoBody');
    if (!tbody) return;
    
    if (!conjuntos || conjuntos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">Nenhum conjunto habitual</td></tr>';
        return;
    }
    
    tbody.innerHTML = conjuntos.map(conjunto => {
        const isAtivo = conjunto.ativo !== 0;
        const statusClass = isAtivo ? 'status-ativo' : 'status-inativo';
        const statusText = isAtivo ? 'Ativo' : 'Inativo';
        const statusIcon = isAtivo ? '✅' : '❌';
        
        return `
        <tr class="${!isAtivo ? 'linha-inativa' : ''}">
            <td>${conjunto.nome || 'Sem nome'}</td>
            <td>${conjunto.trator_matricula || 'N/A'}</td>
            <td>${conjunto.cisterna_matricula || 'N/A'}</td>
            <td>${conjunto.motorista_nome || 'Não atribuído'}</td>
            <td><span class="${statusClass}">${statusIcon} ${statusText}</span></td>
            <td>
                <button onclick="alternarStatusConjunto(${conjunto.id}, ${isAtivo ? 'false' : 'true'})" 
                        class="btn btn-sm ${isAtivo ? 'btn-warning' : 'btn-success'}"
                        title="${isAtivo ? 'Inativar conjunto' : 'Ativar conjunto'}">
                    ${isAtivo ? '⏸️ Inativar' : '▶️ Ativar'}
                </button>
            </td>
        </tr>
        `;
    }).join('');
}

async function alternarStatusConjunto(conjuntoId, novoStatus) {
    const acao = novoStatus ? 'ativar' : 'inativar';
    const confirmacao = novoStatus 
        ? 'Tem certeza que deseja ativar este conjunto?'
        : 'Tem certeza que deseja inativar este conjunto?\n\n⚠️ O conjunto será ocultado dos planeamentos futuros, mas o histórico anterior será preservado.';
    
    if (!confirm(confirmacao)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/conjuntos-habituais/${conjuntoId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ativo: novoStatus ? 1 : 0 })
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                alert(`✅ Conjunto ${acao === 'ativar' ? 'ativado' : 'inativado'} com sucesso!`);
                carregarConjuntosAtribuicao();
            } else {
                alert('❌ Erro ao ' + acao + ' conjunto: ' + (result.error || 'Erro desconhecido'));
            }
        } else {
            const error = await response.json();
            alert('❌ Erro ao ' + acao + ' conjunto: ' + (error.error || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro ao alternar status do conjunto:', error);
        alert('❌ Erro ao ' + acao + ' conjunto: ' + error.message);
    }
}

async function carregarAtribuicoesDia() {
    try {
        const data = document.getElementById('dataPlaneamento').value;
        
        // Carregar conjuntos e atribuições
        const [conjuntosRes, atribuicoesRes] = await Promise.all([
            fetch('/api/conjuntos-habituais'),
            fetch(`/api/atribuicoes-motoristas?data=${data}`)
        ]);
        
        const conjuntos = await conjuntosRes.json();
        const atribuicoes = await atribuicoesRes.json();
        
        // Criar atribuições para conjuntos que não têm atribuição nesta data
        const conjuntosComAtribuicao = new Set(atribuicoes.map(a => a.conjunto_id));
        const conjuntosSemAtribuicao = conjuntos.filter(c => !conjuntosComAtribuicao.has(c.id));
        
        // Criar atribuições faltantes
        for (const conjunto of conjuntosSemAtribuicao) {
            await fetch('/api/atribuicoes-motoristas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conjunto_id: conjunto.id,
                    data_atribuicao: data,
                    motorista_id: conjunto.motorista_id || null
                })
            });
        }
        
        // Recarregar atribuições
        const atribuicoesAtualizadas = await fetch(`/api/atribuicoes-motoristas?data=${data}`).then(r => r.json());
        renderizarAtribuicoes(atribuicoesAtualizadas);
    } catch (error) {
        console.error('Erro ao carregar atribuições:', error);
    }
}

function renderizarAtribuicoes(atribuicoes) {
    const tbody = document.getElementById('atribuicoesBody');
    if (!tbody) return;
    
    if (!atribuicoes || atribuicoes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="empty">Nenhuma atribuição para este dia</td></tr>';
        return;
    }
    
    tbody.innerHTML = atribuicoes.map(atrib => `
        <tr>
            <td>${atrib.conjunto_nome || 'N/A'}</td>
            <td>
                <select onchange="atualizarAtribuicao(${atrib.id}, this.value)" style="width: 100%;">
                    <option value="">Selecionar motorista...</option>
                    ${atrib.motoristas_disponiveis ? atrib.motoristas_disponiveis.map(m => 
                        `<option value="${m.id}" ${m.id === atrib.motorista_id ? 'selected' : ''}>${m.nome}</option>`
                    ).join('') : ''}
                </select>
            </td>
            <td>
                <button onclick="removerAtribuicao(${atrib.id})" class="btn btn-sm btn-danger">🗑️</button>
            </td>
        </tr>
    `).join('');
}

async function adicionarConjunto() {
    document.getElementById('modalConjuntoTitulo').textContent = 'Adicionar Conjunto Habitual';
    document.getElementById('formConjunto').reset();
    document.getElementById('conjuntoId').value = '';
    document.getElementById('conjuntoOrdem').value = '0';
    document.getElementById('conjuntoAtivo').checked = true;
    
    // Carregar opções de tratores, cisternas e motoristas
    await carregarOpcoesConjunto();
    
    document.getElementById('modalConjunto').style.display = 'block';
}

async function editarConjunto(id) {
    try {
        const response = await fetch(`/api/conjuntos-habituais/${id}`);
        const conjunto = await response.json();
        
        document.getElementById('modalConjuntoTitulo').textContent = 'Editar Conjunto Habitual';
        document.getElementById('conjuntoId').value = conjunto.id;
        document.getElementById('conjuntoNome').value = conjunto.nome || '';
        document.getElementById('conjuntoOrdem').value = conjunto.ordem || 0;
        document.getElementById('conjuntoAtivo').checked = conjunto.ativo !== 0;
        document.getElementById('conjuntoObservacoes').value = conjunto.observacoes || '';
        
        // Carregar opções e selecionar valores
        await carregarOpcoesConjunto();
        document.getElementById('conjuntoTratorId').value = conjunto.trator_id || '';
        document.getElementById('conjuntoCisternaId').value = conjunto.cisterna_id || '';
        document.getElementById('conjuntoMotoristaId').value = conjunto.motorista_id || '';
        
        document.getElementById('modalConjunto').style.display = 'block';
    } catch (error) {
        console.error('Erro ao carregar conjunto:', error);
        alert('Erro ao carregar dados do conjunto');
    }
}

async function carregarOpcoesConjunto() {
    try {
        const [tratoresRes, cisternasRes, motoristasRes] = await Promise.all([
            fetch('/api/tratores'),
            fetch('/api/cisternas'),
            fetch('/api/motoristas')
        ]);
        
        const tratores = await tratoresRes.json();
        const cisternas = await cisternasRes.json();
        const motoristas = await motoristasRes.json();
        
        // Preencher tratores
        const selectTrator = document.getElementById('conjuntoTratorId');
        selectTrator.innerHTML = '<option value="">Selecionar trator...</option>';
        tratores.forEach(t => {
            const option = document.createElement('option');
            option.value = t.id;
            option.textContent = `${t.matricula}${t.codigo ? ' - ' + t.codigo : ''}`;
            selectTrator.appendChild(option);
        });
        
        // Preencher cisternas
        const selectCisterna = document.getElementById('conjuntoCisternaId');
        selectCisterna.innerHTML = '<option value="">Selecionar cisterna...</option>';
        cisternas.forEach(c => {
            const option = document.createElement('option');
            option.value = c.id;
            option.textContent = `${c.matricula}${c.codigo ? ' - ' + c.codigo : ''}`;
            selectCisterna.appendChild(option);
        });
        
        // Preencher motoristas
        const selectMotorista = document.getElementById('conjuntoMotoristaId');
        selectMotorista.innerHTML = '<option value="">Nenhum (atribuir depois)</option>';
        motoristas.forEach(m => {
            const option = document.createElement('option');
            option.value = m.id;
            option.textContent = m.nome;
            selectMotorista.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar opções:', error);
    }
}

function fecharModalConjunto() {
    document.getElementById('modalConjunto').style.display = 'none';
}

async function salvarConjunto(event) {
    event.preventDefault();
    
    const dados = {
        nome: document.getElementById('conjuntoNome').value,
        trator_id: parseInt(document.getElementById('conjuntoTratorId').value),
        cisterna_id: parseInt(document.getElementById('conjuntoCisternaId').value),
        motorista_id: document.getElementById('conjuntoMotoristaId').value ? parseInt(document.getElementById('conjuntoMotoristaId').value) : null,
        ordem: parseInt(document.getElementById('conjuntoOrdem').value) || 0,
        ativo: document.getElementById('conjuntoAtivo').checked ? 1 : 0,
        observacoes: document.getElementById('conjuntoObservacoes').value
    };
    
    const id = document.getElementById('conjuntoId').value;
    const url = id ? `/api/conjuntos-habituais/${id}` : '/api/conjuntos-habituais';
    const method = id ? 'PUT' : 'POST';
    
    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        
        if (response.ok) {
            fecharModalConjunto();
            carregarConjuntos();
            carregarConjuntosAtribuicao();
        } else {
            const error = await response.json();
            alert('Erro ao guardar: ' + (error.error || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro ao guardar conjunto:', error);
        alert('Erro ao guardar conjunto');
    }
}

async function removerConjunto(id) {
    if (!confirm('Tem certeza que deseja remover este conjunto?')) return;
    
    try {
        const response = await fetch(`/api/conjuntos-habituais/${id}`, { method: 'DELETE' });
        if (response.ok) {
            carregarConjuntos();
        }
    } catch (error) {
        console.error('Erro ao remover conjunto:', error);
    }
}

async function atualizarAtribuicao(atribuicaoId, motoristaId) {
    try {
        const response = await fetch(`/api/atribuicoes-motoristas/${atribuicaoId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ motorista_id: motoristaId || null })
        });
        if (response.ok) {
            carregarAtribuicoesDia();
        }
    } catch (error) {
        console.error('Erro ao atualizar atribuição:', error);
    }
}

async function removerAtribuicao(id) {
    if (!confirm('Tem certeza que deseja remover esta atribuição?')) return;
    
    try {
        const response = await fetch(`/api/atribuicoes-motoristas/${id}`, { method: 'DELETE' });
        if (response.ok) {
            carregarAtribuicoesDia();
        }
    } catch (error) {
        console.error('Erro ao remover atribuição:', error);
    }
}

let currentData = {
    planeamento: [],
    pendentes: [],
    entregues: []
};

let sortState = {
    planeamento: { column: null, direction: 'asc' },
    pendentes: { column: null, direction: 'asc' },
    entregues: { column: null, direction: 'asc' }
};

let filterState = {
    planeamento: {},
    pendentes: {},
    entregues: {}
};

// ==================== CONTROLO DE VISUALIZAÇÃO PARA DATAS ANTERIORES ====================

// Variável para guardar se o código de desbloqueio foi inserido corretamente
let codigoDesbloqueioAtivo = false;
const CODIGO_SECRETO = '1990';

/**
 * Verifica se a data selecionada é anterior à data atual
 */
function isDataAnterior(dataSelecionada) {
    if (!dataSelecionada) return false;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataSel = new Date(dataSelecionada);
    dataSel.setHours(0, 0, 0, 0);
    return dataSel < hoje;
}

/**
 * Verifica se pode fazer movimentos (drag and drop) na data atual
 */
function podeFazerMovimentos() {
    try {
        const dataInput = document.getElementById('dataPlaneamento');
        if (!dataInput || !dataInput.value) {
            return true; // Se não houver data, permitir movimentos
        }
        
        const dataSelecionada = dataInput.value;
        const isAnterior = isDataAnterior(dataSelecionada);
        
        // Se for data anterior, só permitir se o código foi inserido
        if (isAnterior) {
            return codigoDesbloqueioAtivo;
        }
        
        // Datas atuais ou futuras sempre permitem movimentos
        return true;
    } catch (error) {
        console.error('Erro ao verificar se pode fazer movimentos:', error);
        return true; // Por segurança, permitir movimentos se houver erro
    }
}

/**
 * Reseta o desbloqueio quando a data muda
 */
function resetarDesbloqueio() {
    codigoDesbloqueioAtivo = false;
    atualizarIndicadorVisualizacao();
}

/**
 * Atualiza o indicador visual de modo apenas visualização
 */
function atualizarIndicadorVisualizacao() {
    const dataInput = document.getElementById('dataPlaneamento');
    if (!dataInput) {
        console.log('atualizarIndicadorVisualizacao: dataInput não encontrado');
        return;
    }
    
    const dataSelecionada = dataInput.value;
    const isAnterior = isDataAnterior(dataSelecionada);
    
    // Obter o container do indicador (já existe no HTML)
    const indicadorContainer = document.getElementById('indicadorVisualizacao');
    if (!indicadorContainer) {
        console.log('atualizarIndicadorVisualizacao: indicadorContainer não encontrado');
        return;
    }
    
    // Limpar conteúdo anterior
    indicadorContainer.innerHTML = '';
    indicadorContainer.style.display = 'none';
    
    console.log('atualizarIndicadorVisualizacao:', { dataSelecionada, isAnterior, codigoDesbloqueioAtivo });
    
    if (isAnterior) {
        indicadorContainer.style.display = 'flex';
        indicadorContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';
            
            if (codigoDesbloqueioAtivo) {
            const indicador = document.createElement('div');
            indicador.style.cssText = 'background: #4CAF50; color: white; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: bold;';
            indicador.textContent = '🔓 Modo Desbloqueado';
            indicadorContainer.appendChild(indicador);
            } else {
                const botaoDesbloquear = document.createElement('button');
            botaoDesbloquear.textContent = '🔓 Desbloquear modo de visualização';
            botaoDesbloquear.style.cssText = 'background: #ff9800; border: none; color: white; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; cursor: pointer; transition: background 0.3s;';
            botaoDesbloquear.onmouseover = function() { this.style.background = '#f57c00'; };
            botaoDesbloquear.onmouseout = function() { this.style.background = '#ff9800'; };
                botaoDesbloquear.onclick = abrirModalCodigoAutorizacao;
            indicadorContainer.appendChild(botaoDesbloquear);
        }
    }
}

/**
 * Abre o modal para inserir código de autorização
 */
function abrirModalCodigoAutorizacao() {
    const modal = document.getElementById('codigoAutorizacaoModal');
    if (modal) {
        modal.style.display = 'block';
        const input = document.getElementById('codigoAutorizacaoInput');
        if (input) {
            input.value = '';
            input.focus();
        }
    }
}

/**
 * Fecha o modal de código de autorização
 */
function fecharModalCodigoAutorizacao() {
    const modal = document.getElementById('codigoAutorizacaoModal');
    if (modal) {
        modal.style.display = 'none';
        const input = document.getElementById('codigoAutorizacaoInput');
        if (input) {
            input.value = '';
        }
    }
}

/**
 * Valida e processa o código de autorização
 */
function submeterCodigoAutorizacao() {
    // Verificar se há ação pendente para executar após desbloquear
    const hasPendingAction = window.pendingApagarCardAction !== undefined;
    const input = document.getElementById('codigoAutorizacaoInput');
    if (!input) return;
    
    const codigo = input.value.trim();
    
    if (codigo === CODIGO_SECRETO) {
        codigoDesbloqueioAtivo = true;
        fecharModalCodigoAutorizacao();
        atualizarIndicadorVisualizacao();
        
        // Executar ação pendente se houver
        if (window.pendingApagarCardAction && typeof window.pendingApagarCardAction === 'function') {
            const acao = window.pendingApagarCardAction;
            window.pendingApagarCardAction = undefined; // Limpar antes de executar
            acao();
        } else if (window.pendingAntiCriancasAction && typeof window.pendingAntiCriancasAction === 'function') {
            const acao = window.pendingAntiCriancasAction;
            window.pendingAntiCriancasAction = undefined; // Limpar antes de executar
            acao();
        } else {
            // Se não houver ação pendente, mostrar menu hambúrguer
            // (só mostrar se não houver nenhuma janela visível)
            const janelasVisiveis = document.querySelectorAll('.janela[style*="display: block"], .janela[style*="display:block"]');
            if (janelasVisiveis.length === 0) {
                document.getElementById('menuHamburgerModal').style.display = 'block';
            }
        }
        
        // Recarregar os dados para atualizar o estado dos cards
        const dataInput = document.getElementById('dataPlaneamento');
        if (dataInput && dataInput.value) {
            carregarEncomendasPendentesDia();
            carregarViaturasMotoristas();
        }
    } else {
        alert('❌ Código incorreto. Tente novamente.');
        input.value = '';
        input.focus();
    }
}

// ==================== INICIALIZAÇÃO ====================

document.addEventListener('DOMContentLoaded', function() {
    // Garantir que TODAS as janelas estão escondidas no início
    document.querySelectorAll('.janela-dashboard').forEach(janela => {
        janela.style.display = 'none';
    });
    
    // Garantir que o dashboard está escondido
    const dashboardContainer = document.querySelector('.dashboard-container');
    if (dashboardContainer) {
        dashboardContainer.style.display = 'none';
    }
    
    // Restaurar data guardada (para que F5 não volte ao dia atual) ou usar hoje
    const dataInput = document.getElementById('dataPlaneamento');
    const STORAGE_KEY = 'dataPlaneamento';
    if (dataInput) {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        const validDate = /^\d{4}-\d{2}-\d{2}$/.test(saved);
        if (validDate) {
            dataInput.value = saved;
        } else if (!dataInput.value) {
            const today = new Date().toISOString().split('T')[0];
            dataInput.value = today;
            sessionStorage.setItem(STORAGE_KEY, today);
        }
    }
    
    // Botão hambúrguer sempre visível
    const menuHamburger = document.getElementById('menuHamburger');
    if (menuHamburger) {
        menuHamburger.style.display = 'flex';
    }
    
    // Garantir que a data está definida antes de carregar dados
    if (dataInput && !dataInput.value) {
        const today = new Date().toISOString().split('T')[0];
        dataInput.value = today;
        sessionStorage.setItem(STORAGE_KEY, today);
    }
    
    // NÃO carregar dados iniciais automaticamente - só quando escolher uma janela
    // Os dados serão carregados quando o utilizador escolher uma opção do menu
    
    // Adicionar event listeners
    if (dataInput) {
        dataInput.addEventListener('change', function() {
            sessionStorage.setItem(STORAGE_KEY, dataInput.value || '');
            resetarDesbloqueio(); // Resetar desbloqueio quando a data mudar
            atualizarIndicadorVisualizacao(); // Atualizar indicador
            atualizarLista();
            carregarEncomendasPendentesDia();
            carregarViaturasMotoristas();
        });
        
        // Também escutar input para resetar imediatamente
        dataInput.addEventListener('input', function() {
            resetarDesbloqueio(); // Resetar desbloqueio quando a data mudar
            atualizarIndicadorVisualizacao(); // Atualizar indicador
        });
    }
    
    // Inicializar indicador visual
    atualizarIndicadorVisualizacao();
    
    // Inicializar redimensionamento de colunas
    inicializarRedimensionamentoColunas();
    
    // Remover seleção de encomenda ao clicar fora da tabela
    document.addEventListener('click', function(event) {
        // Verificar se o clique foi fora da tabela de encomendas pendentes
        const tabelaEncomendas = document.getElementById('encomendasPendentesTable');
        const menuContexto = document.getElementById('contextMenuEncomenda');
        const modalAlterarData = document.getElementById('alterarDataModal');
        
        // Não remover seleção se:
        // - Clicou dentro da tabela
        // - Clicou no menu de contexto
        // - Clicou no modal de alterar data
        if (tabelaEncomendas && tabelaEncomendas.contains(event.target)) {
            return; // Clicou dentro da tabela, não fazer nada
        }
        
        if (menuContexto && menuContexto.contains(event.target)) {
            return; // Clicou no menu de contexto, não fazer nada
        }
        
        if (modalAlterarData && (modalAlterarData.contains(event.target) || modalAlterarData.style.display === 'block')) {
            return; // Clicou no modal, não fazer nada
        }
        
        // Se chegou aqui, clicou fora - remover seleção
        if (encomendaSelecionada && encomendaSelecionada.row) {
            encomendaSelecionada.row.classList.remove('encomenda-selecionada');
        }
        encomendaSelecionada = null;
    });
});

// ==================== CARREGAMENTO DE DADOS ====================

/** Atualiza os dados (planeamento, pendentes, motoristas) para a data atualmente selecionada, sem alterar a data. */
function atualizarDadosSemMudarData() {
    const dataInput = document.getElementById('dataPlaneamento');
    if (!dataInput || !dataInput.value) {
        return;
    }
    atualizarIndicadorVisualizacao();
    atualizarLista();
    carregarEncomendasPendentesDia();
    carregarViaturasMotoristas();
}

async function carregarTodosDados() {
    await Promise.all([
        carregarPlaneamento(),
        carregarPendentes(),
        carregarEntregues()
    ]);
}

async function carregarPlaneamento() {
    try {
        const tbody = document.getElementById('planeamentoBody');
        if (!tbody) return; // Elemento não existe, pular
        
        const data = document.getElementById('dataPlaneamento').value;
        const response = await fetch(`/api/planeamento-diario?data=${data}`);
        const dados = await response.json();
        currentData.planeamento = dados;
        renderizarTabelaPlaneamento(dados);
    } catch (error) {
        console.error('Erro ao carregar planeamento:', error);
        const tbody = document.getElementById('planeamentoBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty">Erro ao carregar dados</td></tr>';
        }
    }
}

async function carregarPendentes() {
    try {
        const tbody = document.getElementById('pendentesBody');
        if (!tbody) return; // Elemento não existe, pular
        
        const response = await fetch('/api/pedidos-pendentes');
        const dados = await response.json();
        currentData.pendentes = dados;
        renderizarTabelaPendentes(dados);
    } catch (error) {
        console.error('Erro ao carregar pendentes:', error);
        const tbody = document.getElementById('pendentesBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty">Erro ao carregar dados</td></tr>';
        }
    }
}

async function carregarEntregues() {
    try {
        const tbody = document.getElementById('entreguesBody');
        if (!tbody) return; // Elemento não existe, pular
        
        const response = await fetch('/api/pedidos-entregues');
        const dados = await response.json();
        currentData.entregues = dados;
        renderizarTabelaEntregues(dados);
    } catch (error) {
        console.error('Erro ao carregar entregues:', error);
        const tbody = document.getElementById('entreguesBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty">Erro ao carregar dados</td></tr>';
        }
    }
}

// ==================== RENDERIZAÇÃO DE TABELAS ====================

function renderizarTabelaPlaneamento(dados) {
    const tbody = document.getElementById('planeamentoBody');
    if (!tbody) return; // Elemento não existe, pular
    
    if (dados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">Nenhum planeamento para esta data</td></tr>';
        return;
    }
    
    tbody.innerHTML = dados.map(item => `
        <tr data-id="${item.id}" 
            data-checkbox-marcado="${item.checkbox_marcado ? '1' : '0'}"
            data-linha-listbox="${item.linha_listbox || ''}"
            data-viatura-id="${item.viatura_id || ''}"
            onclick="toggleCheckbox(${item.id})"
            oncontextmenu="event.preventDefault(); mostrarContextMenuPlaneamento(event, ${item.id});">
            <td><input type="checkbox" ${item.checkbox_marcado ? 'checked' : ''} onclick="event.stopPropagation(); toggleCheckbox(${item.id})"></td>
            <td>${item.encomenda_texto || ''}</td>
            <td>${item.cliente || ''}</td>
            <td>${item.material || ''}</td>
            <td>${item.origem_tipo || ''}</td>
            <td>${item.origem_id || ''}</td>
        </tr>
    `).join('');
}

function renderizarTabelaPendentes(dados) {
    const tbody = document.getElementById('pendentesBody');
    if (!tbody) return; // Elemento não existe, pular
    
    if (dados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">Nenhum pedido pendente</td></tr>';
        return;
    }
    
    tbody.innerHTML = dados.map(item => `
        <tr data-id="${item.id}">
            <td>${item.id}</td>
            <td>${item.local_carga || ''}</td>
            <td>${item.cliente || ''}</td>
            <td>${item.material || ''}</td>
            <td>${item.observacoes || ''}</td>
            <td>${item.data_entrega || ''}</td>
            <td>
                <button onclick="editarPedido('pendente', ${item.id})" class="btn btn-sm btn-primary">Editar</button>
                <button onclick="removerPedido('pendente', ${item.id})" class="btn btn-sm btn-danger">Remover</button>
            </td>
        </tr>
    `).join('');
}

function renderizarTabelaEntregues(dados) {
    const tbody = document.getElementById('entreguesBody');
    if (!tbody) return; // Elemento não existe, pular
    
    if (dados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">Nenhum pedido entregue</td></tr>';
        return;
    }
    
    tbody.innerHTML = dados.map(item => `
        <tr data-id="${item.id}">
            <td>${item.id}</td>
            <td>${item.cliente || ''}</td>
            <td>${item.local_carga || ''}</td>
            <td>${item.material || ''}</td>
            <td>${item.data_entrega || ''}</td>
            <td>
                <button onclick="editarPedido('entregue', ${item.id})" class="btn btn-sm btn-primary">Editar</button>
                <button onclick="removerPedido('entregue', ${item.id})" class="btn btn-sm btn-danger">Remover</button>
            </td>
        </tr>
    `).join('');
}

// ==================== FUNÇÕES AUXILIARES ====================

function atualizarLista() {
    const data = document.getElementById('dataPlaneamento').value;
    if (!data) {
        console.warn('Data não definida');
        return;
    }
    
    console.log('🔄 Atualizando lista para a data:', data);
    carregarPlaneamento();
}

function toggleCheckbox(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (!row) return;
    
    const checkbox = row.querySelector('input[type="checkbox"]');
    const novoEstado = checkbox.checked;
    
    fetch('/api/atualizar-checkbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, checkbox_marcado: novoEstado })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            row.setAttribute('data-checkbox-marcado', novoEstado ? '1' : '0');
        } else {
            checkbox.checked = !novoEstado;
            alert('Erro ao atualizar checkbox');
        }
    })
    .catch(error => {
        console.error('Erro:', error);
        checkbox.checked = !novoEstado;
        alert('Erro ao atualizar checkbox');
    });
}

// ==================== CARREGAMENTO DE ENCOMENDAS PENDENTES DO DIA ====================

/** Garantir que a tabela de encomendas pendentes tem 5 colunas no thead (Cliente, Local de Descarga, Local de Carga, Material, Observações) */
function garantirCabecalhoEncomendasPendentes() {
    const table = document.getElementById('encomendasPendentesTable');
    if (!table) return;
    let thead = table.querySelector('thead');
    if (!thead) {
        thead = document.createElement('thead');
        table.insertBefore(thead, table.querySelector('tbody'));
    }
    const tr = thead.querySelector('tr');
    const headers = ['Cliente', 'Local de Descarga', 'Local de Carga', 'Material', 'Observações'];
    if (!tr || tr.cells.length !== 5) {
        thead.innerHTML = '<tr>' + headers.map((h, i) => {
            const w = i === 0 || i === 1 ? '20%' : i === 2 ? '25%' : i === 3 ? '20%' : '15%';
            return `<th style="width: ${w};">${h}</th>`;
        }).join('') + '</tr>';
    }
}

async function carregarEncomendasPendentesDia(nocache, criadosParaMerge) {
    try {
        const dataInput = document.getElementById('dataPlaneamento');
        if (!dataInput) {
            console.error('Elemento dataPlaneamento não encontrado');
            return;
        }
        const data = dataInput.value;
        if (!data) {
            console.error('Data não definida');
            return;
        }
        let url = `/api/encomendas-pendentes-dia?data=${encodeURIComponent(data)}`;
        if (nocache) url += '&_=' + Date.now();
        const response = await fetch(url);
        const dados = await response.json();
        
        // Se acabámos de criar encomendas, fazer merge dos dados criados (garantir local_descarga)
        if (criadosParaMerge && Array.isArray(criadosParaMerge) && criadosParaMerge.length > 0) {
            const porId = {};
            criadosParaMerge.forEach(c => { porId[c.id] = c; });
            if (dados.dia_atual && Array.isArray(dados.dia_atual)) {
                dados.dia_atual = dados.dia_atual.map(item => {
                    const criado = porId[item.id];
                    if (criado) {
                        return { ...item, local_descarga: criado.local_descarga || item.local_descarga || '', localDescarga: criado.local_descarga || item.localDescarga || '' };
                    }
                    return item;
                });
            }
            if (dados.dias_futuros && typeof dados.dias_futuros === 'object') {
                Object.keys(dados.dias_futuros).forEach(dataKey => {
                    dados.dias_futuros[dataKey] = (dados.dias_futuros[dataKey] || []).map(item => {
                        const criado = porId[item.id];
                        if (criado) {
                            return { ...item, local_descarga: criado.local_descarga || item.local_descarga || '', localDescarga: criado.local_descarga || item.localDescarga || '' };
                        }
                        return item;
                    });
                });
            }
        }
        
        // Verificar se a resposta é o novo formato (com dias_futuros) ou o formato antigo
        if (dados.dia_atual !== undefined && dados.dias_futuros !== undefined) {
            renderizarEncomendasPendentesComFuturos(dados.dia_atual, dados.dias_futuros);
        } else {
            // Formato antigo - compatibilidade
            renderizarEncomendasPendentes(dados);
        }
        
        // Adicionar drop zone após renderizar
        setTimeout(() => {
            adicionarDropZoneEncomendasPendentes();
            atualizarIndicadorVisualizacao();
        }, 100);
    } catch (error) {
        console.error('Erro ao carregar encomendas:', error);
        const tbody = document.getElementById('encomendasPendentesBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty">Erro ao carregar encomendas</td></tr>';
        }
    }
}

function renderizarEncomendasPendentesComFuturos(encomendasDia, encomendasFuturas) {
    garantirCabecalhoEncomendasPendentes();
    const tbody = document.getElementById('encomendasPendentesBody');
    if (!tbody) {
        console.error('Elemento encomendasPendentesBody não encontrado');
        return;
    }
    
    // Guardar ID da encomenda selecionada antes de re-renderizar
    const pedidoIdSelecionado = encomendaSelecionada ? encomendaSelecionada.id : null;
    
    // Verificar se pode fazer movimentos
    let podeMover = true;
    try {
        podeMover = podeFazerMovimentos();
    } catch (error) {
        console.error('Erro ao verificar se pode fazer movimentos:', error);
        podeMover = true;
    }
    
    const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const sortByLocalDescarga = (a, b) => {
        const x = (a.local_descarga || a.localDescarga || '').trim().toLowerCase();
        const y = (b.local_descarga || b.localDescarga || '').trim().toLowerCase();
        if (!x && !y) return 0;
        if (!x) return 1;
        if (!y) return -1;
        return x.localeCompare(y, 'pt');
    };
    
    let html = '';
    
    // Renderizar encomendas do dia atual (ordem alfabética por local de descarga, zebra nas linhas)
    if (encomendasDia && encomendasDia.length > 0) {
        const diaOrdenado = [...encomendasDia].sort(sortByLocalDescarga);
        diaOrdenado.forEach((item, idx) => {
            const estaSelecionado = pedidoIdSelecionado === item.id;
            const classeSelecionada = estaSelecionado ? ' encomenda-selecionada' : '';
            const prioridade = item.prioridade === 1 || item.prioridade === true;
            const classePrioridade = prioridade ? ' encomenda-prioridade' : '';
            const zebra = idx % 2 === 0 ? ' zebra-impar' : ' zebra-par';
            html += `
            <tr data-id="${item.id}" 
                data-tipo="P" 
                data-pedido-id="${item.id}"
                data-data-entrega="${item.data_entrega || ''}"
                data-prioridade="${prioridade ? '1' : '0'}"
                draggable="${podeMover ? 'true' : 'false'}"
                class="encomenda-draggable${zebra} ${!podeMover ? 'visualizacao-only' : ''}${classeSelecionada}${classePrioridade}"
                ondragstart="handleDragStart(event)"
                ondragend="handleDragEnd(event)"
                oncontextmenu="event.preventDefault(); mostrarContextMenu(event, ${item.id}, '${(item.data_entrega || '').replace(/'/g, "\\'")}', ${prioridade ? 'true' : 'false'});">
                <td>${esc(item.cliente)}</td>
                <td>${esc(item.local_descarga || item.localDescarga)}</td>
                <td>${esc(item.local_carga || item.cliente)}</td>
                <td>${esc(item.material)}</td>
                <td>${esc(item.observacoes)}</td>
            </tr>`;
        });
    } else {
        html += '<tr><td colspan="5" class="empty">Nenhuma encomenda pendente para esta data</td></tr>';
    }
    
    // Encomendas dos próximos dias (zebra nas linhas)
    if (encomendasFuturas && Object.keys(encomendasFuturas).length > 0) {
        const datasOrdenadas = Object.keys(encomendasFuturas).sort();
        datasOrdenadas.forEach(dataFutura => {
            const encomendas = encomendasFuturas[dataFutura];
            const dataFormatada = new Date(dataFutura + 'T00:00:00').toLocaleDateString('pt-PT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            html += `<tr class="dia-futuro-header"><td colspan="5">📆 ${dataFormatada}</td></tr>`;
            const futurasOrdenadas = [...(encomendas || [])].sort(sortByLocalDescarga);
            futurasOrdenadas.forEach((item, idx) => {
                const estaSelecionado = pedidoIdSelecionado === item.id;
                const classeSelecionada = estaSelecionado ? ' encomenda-selecionada' : '';
                const prioridade = item.prioridade === 1 || item.prioridade === true;
                const classePrioridade = prioridade ? ' encomenda-prioridade' : '';
                const zebra = idx % 2 === 0 ? ' zebra-impar' : ' zebra-par';
                html += `
                <tr data-id="${item.id}" 
                    data-tipo="P" 
                    data-pedido-id="${item.id}"
                    data-data-entrega="${item.data_entrega || ''}"
                    data-prioridade="${prioridade ? '1' : '0'}"
                    data-dia-futuro="true"
                    draggable="false"
                    title="Use «Antecipar» para mover para o dia atual e depois atribuir ao card"
                    class="encomenda-draggable encomenda-futura encomenda-dia-futuro-no-drag${zebra} ${!podeMover ? 'visualizacao-only' : ''}${classeSelecionada}${classePrioridade}"
                    ondragstart="handleDragStart(event)"
                    ondragend="handleDragEnd(event)"
                    oncontextmenu="event.preventDefault(); mostrarContextMenu(event, ${item.id}, '${(item.data_entrega || '').replace(/'/g, "\\'")}', ${prioridade ? 'true' : 'false'});">
                    <td>${esc(item.cliente)}</td>
                    <td>${esc(item.local_descarga || item.localDescarga)}</td>
                    <td>${esc(item.local_carga || item.cliente)}</td>
                    <td>${esc(item.material)}</td>
                    <td>
                        ${esc(item.observacoes)}
                        <button onclick="anteciparEncomenda(${item.id}, '${(item.data_entrega || '').replace(/'/g, "\\'")}', '${(document.getElementById('dataPlaneamento') && document.getElementById('dataPlaneamento').value) || ''}')" 
                                class="btn btn-sm btn-success btn-antecipar-compact"
                                title="Antecipar para hoje">⏫ Antecipar</button>
                    </td>
                </tr>`;
            });
        });
    }
    
    tbody.innerHTML = html;
    
    // Reaplicar seleção após renderizar
    if (pedidoIdSelecionado) {
        const rowSelecionada = tbody.querySelector(`tr[data-pedido-id="${pedidoIdSelecionado}"]`);
        if (rowSelecionada) {
            encomendaSelecionada = {
                id: pedidoIdSelecionado,
                dataEntrega: rowSelecionada.getAttribute('data-data-entrega'),
                row: rowSelecionada
            };
        } else {
            encomendaSelecionada = null;
        }
    }
    
    // Garantir que os handlers estão definidos no tbody
    tbody.setAttribute('ondragover', 'return handleDragOverPendentesInline(event)');
    tbody.setAttribute('ondrop', 'return handleDropBackInline(event)');
    tbody.setAttribute('ondragleave', 'handleDragLeavePendentesInline(event)');
    
    // Adicionar drop zone em toda a coluna de encomendas pendentes
    adicionarDropZoneColunaEncomendas();
    
    // Atualizar indicador visual após renderizar
    atualizarIndicadorVisualizacao();
}

// Função para antecipar encomenda
window.anteciparEncomenda = async function(pedidoId, dataOriginal, dataNova) {
    if (!confirm(`Tem certeza que deseja antecipar esta encomenda de ${dataOriginal} para ${dataNova}?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/pedidos-pendentes/${pedidoId}/antecipar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data_original: dataOriginal,
                data_nova: dataNova
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            alert('✅ Encomenda antecipada com sucesso!');
            await carregarEncomendasPendentesDia();
        } else {
            alert('❌ Erro ao antecipar encomenda: ' + (result.error || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro ao antecipar encomenda:', error);
        alert('❌ Erro ao antecipar encomenda');
    }
};

function renderizarEncomendasPendentes(dados) {
    garantirCabecalhoEncomendasPendentes();
    const tbody = document.getElementById('encomendasPendentesBody');
    if (!tbody) {
        console.error('Elemento encomendasPendentesBody não encontrado');
        return;
    }
    
    // Guardar ID da encomenda selecionada antes de re-renderizar
    const pedidoIdSelecionado = encomendaSelecionada ? encomendaSelecionada.id : null;
    
    if (!dados || dados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty">Nenhuma encomenda pendente para esta data</td></tr>';
        encomendaSelecionada = null; // Limpar seleção se não houver dados
        return;
    }
    
    // Verificar se pode fazer movimentos (com tratamento de erro)
    let podeMover = true;
    try {
        podeMover = podeFazerMovimentos();
    } catch (error) {
        console.error('Erro ao verificar se pode fazer movimentos:', error);
        podeMover = true; // Por segurança, permitir movimentos se houver erro
    }
    
    const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const sortByLocalDescarga = (a, b) => {
        const x = (a.local_descarga || a.localDescarga || '').trim().toLowerCase();
        const y = (b.local_descarga || b.localDescarga || '').trim().toLowerCase();
        if (!x && !y) return 0;
        if (!x) return 1;
        if (!y) return -1;
        return x.localeCompare(y, 'pt');
    };
    const dadosOrdenados = [...dados].sort(sortByLocalDescarga);
    let html = '';
    dadosOrdenados.forEach((item, idx) => {
        const estaSelecionado = pedidoIdSelecionado === item.id;
        const classeSelecionada = estaSelecionado ? ' encomenda-selecionada' : '';
        const prioridade = item.prioridade === 1 || item.prioridade === true;
        const classePrioridade = prioridade ? ' encomenda-prioridade' : '';
        const zebra = idx % 2 === 0 ? ' zebra-impar' : ' zebra-par';
        html += `
        <tr data-id="${item.id}" 
            data-tipo="P" 
            data-pedido-id="${item.id}"
            data-data-entrega="${item.data_entrega || ''}"
            data-prioridade="${prioridade ? '1' : '0'}"
            draggable="${podeMover ? 'true' : 'false'}"
            class="encomenda-draggable${zebra} ${!podeMover ? 'visualizacao-only' : ''}${classeSelecionada}${classePrioridade}"
            ondragstart="handleDragStart(event)"
            ondragend="handleDragEnd(event)"
            oncontextmenu="event.preventDefault(); mostrarContextMenu(event, ${item.id}, '${(item.data_entrega || '').replace(/'/g, "\\'")}', ${prioridade ? 'true' : 'false'});">
            <td>${esc(item.cliente)}</td>
            <td>${esc(item.local_descarga || item.localDescarga)}</td>
            <td>${esc(item.local_carga || item.cliente)}</td>
            <td>${esc(item.material)}</td>
            <td>${esc(item.observacoes)}</td>
        </tr>`;
    });
    tbody.innerHTML = html;
    
    // Reaplicar seleção após renderizar
    if (pedidoIdSelecionado) {
        const rowSelecionada = tbody.querySelector(`tr[data-pedido-id="${pedidoIdSelecionado}"]`);
        if (rowSelecionada) {
            encomendaSelecionada = {
                id: pedidoIdSelecionado,
                dataEntrega: rowSelecionada.getAttribute('data-data-entrega'),
                row: rowSelecionada
            };
        } else {
            // Se a encomenda selecionada não existe mais, limpar seleção
            encomendaSelecionada = null;
        }
    }
    
    // Garantir que os handlers estão definidos no tbody
    tbody.setAttribute('ondragover', 'return handleDragOverPendentesInline(event)');
    tbody.setAttribute('ondrop', 'return handleDropBackInline(event)');
    tbody.setAttribute('ondragleave', 'handleDragLeavePendentesInline(event)');
    
    // Adicionar drop zone em toda a coluna de encomendas pendentes
    adicionarDropZoneColunaEncomendas();
    
    // Atualizar indicador visual após renderizar
    atualizarIndicadorVisualizacao();
}

// ==================== DRAG AND DROP ====================

let draggedEncomenda = null;
let draggedEncomendaBack = null;

function handleDragStart(e) {
    // Não permitir arrastar encomendas de dias futuros (evitar duplicação; usar Antecipar primeiro)
    if (e.target.getAttribute('data-dia-futuro') === 'true') {
        e.preventDefault();
        return false;
    }
    // Verificar se pode fazer movimentos (bloquear datas anteriores)
    if (!podeFazerMovimentos()) {
        e.preventDefault();
        return false;
    }
    
    draggedEncomenda = {
        id: parseInt(e.target.getAttribute('data-pedido-id')),
        tipo: e.target.getAttribute('data-tipo'),
        cliente: e.target.cells[0].textContent,
        material: e.target.cells[3].textContent
    };
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.outerHTML);
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedEncomenda = null;
    
    // Remover todas as classes de drag over
    document.querySelectorAll('.drop-zone').forEach(el => {
        el.classList.remove('drag-over');
    });
    
    // Remover estilo verde de todos os cards
    document.querySelectorAll('.motorista-card').forEach(card => {
        card.classList.remove('drag-over-encomenda');
    });
}

function handleDragStartBack(e) {
    // Verificar se pode fazer movimentos (bloquear datas anteriores)
    if (!podeFazerMovimentos()) {
        e.preventDefault();
        return false;
    }
    
    // Prevenir que o drag seja iniciado em elementos filhos (como o botão de remover)
    if (e.target.classList.contains('remover-encomenda') || e.target.closest('.remover-encomenda')) {
        e.preventDefault();
        return false;
    }
    
    // Encontrar o card da encomenda
    const elemento = e.target.closest('.encomenda-card');
    
    if (!elemento || !elemento.classList.contains('encomenda-card')) {
        e.preventDefault();
        return false;
    }
    
    // Obter dados do card
    const pedidoId = parseInt(elemento.getAttribute('data-pedido-id'));
    const pedidoTipo = elemento.getAttribute('data-pedido-tipo');
    const viaturaId = parseInt(elemento.getAttribute('data-viatura-origem-id'));
    const atribuicaoId = parseInt(elemento.getAttribute('data-atribuicao-id')) || 0;
    
    if (!pedidoId || !pedidoTipo) {
        e.preventDefault();
        return false;
    }
    
        draggedEncomendaBack = {
            pedido_id: pedidoId,
            pedido_tipo: pedidoTipo,
        viatura_id: viaturaId,
        atribuicao_id: atribuicaoId
    };
    
    elemento.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(draggedEncomendaBack));
    e.dataTransfer.setData('text/html', elemento.outerHTML);
}

function handleDragEndBack(e) {
    const elemento = e.target.closest('.encomenda-card') || e.target;
    if (elemento) {
        elemento.classList.remove('dragging');
    }
    
    // Remover todas as classes de drag over
    document.querySelectorAll('.drop-zone').forEach(el => {
        el.classList.remove('drag-over');
    });
    document.querySelectorAll('.motorista-encomendas').forEach(el => {
        el.classList.remove('drag-over');
    });
    
    // Remover estilo verde de todos os cards
    document.querySelectorAll('.motorista-card').forEach(card => {
        card.classList.remove('drag-over-encomenda');
    });
    
    // NÃO limpar draggedEncomendaBack aqui - será limpo no handleDrop ou handleDropBack
    // Se o drop não aconteceu, será limpo após um pequeno delay
    setTimeout(() => {
        if (draggedEncomendaBack) {
            draggedEncomendaBack = null;
        }
    }, 100);
}

// Adicionar event listeners para drag and drop nas viaturas
function adicionarDragAndDropListeners() {
    const tbody = document.getElementById('viaturasMotoristasBody');
    if (!tbody) return;
    
    const rows = tbody.querySelectorAll('tr[data-id]');
    rows.forEach(row => {
        const dropZone = row.querySelector('.encomendas-atribuidas');
        if (dropZone) {
            dropZone.addEventListener('dragover', handleDragOver);
            dropZone.addEventListener('drop', handleDrop);
            dropZone.addEventListener('dragleave', handleDragLeave);
            dropZone.classList.add('drop-zone');
        }
    });
}

function handleDragOver(e) {
    // Verificar se pode fazer movimentos (bloquear datas anteriores)
    const podeMover = podeFazerMovimentos();
    if (!podeMover) {
        e.dataTransfer.dropEffect = 'none';
        return;
    }
    
    // Se não há nenhuma encomenda sendo arrastada, não permitir drop
    if (!draggedEncomenda && !draggedEncomendaBack) {
        return;
    }
    
    // Encontrar a zona de drop
    const dropZone = e.target.closest('.motorista-encomendas[data-drop-zone="true"]') || e.currentTarget;
    
    // Verificar se a zona de drop está desabilitada (motorista indisponível)
    if (dropZone.classList.contains('disabled')) {
        e.dataTransfer.dropEffect = 'none';
        return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    dropZone.classList.add('drag-over');
    
    // Adicionar estilo verde ao card quando arrasta encomenda (pendente ou de outra viatura)
    const card = dropZone.closest('.motorista-card');
    if (card) {
        // Verificar se é uma encomenda de outra viatura (não da mesma)
        if (draggedEncomendaBack) {
            const viaturaDestinoId = parseInt(dropZone.getAttribute('data-viatura-id'));
            if (draggedEncomendaBack.viatura_id !== viaturaDestinoId) {
                card.classList.add('drag-over-encomenda');
            }
        } else if (draggedEncomenda) {
            // Encomenda pendente
            card.classList.add('drag-over-encomenda');
        }
    }
}

function handleDragLeave(e) {
    const dropZone = e.currentTarget;
    dropZone.classList.remove('drag-over');
    
    // Remover estilo verde do card quando sai da zona de drop
    const card = dropZone.closest('.motorista-card');
    if (card) {
        card.classList.remove('drag-over-encomenda');
    }
}

async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Verificar se pode fazer movimentos (bloquear datas anteriores)
    if (!podeFazerMovimentos()) {
        return;
    }
    
    // Encontrar a zona de drop
    const dropZone = e.target.closest('.motorista-encomendas[data-drop-zone="true"]') || e.currentTarget;
    dropZone.classList.remove('drag-over');
    
    // Verificar se a zona de drop está desabilitada
    if (dropZone.classList.contains('disabled')) {
        return;
    }
    
    // Verificar se o card está bloqueado por férias
    const card = dropZone.closest('.motorista-card');
    if (!card) return;
    
    if (card.classList.contains('ferias-bloqueado')) {
        return;
    }
    
    const cardId = parseInt(card.getAttribute('data-id'));
    const atribuicaoId = parseInt(card.getAttribute('data-atribuicao-id')) || null;
    if (isNaN(cardId)) return;
    
    // Remover estilo verde de todos os cards
    document.querySelectorAll('.motorista-card').forEach(card => {
        card.classList.remove('drag-over-encomenda');
    });
    
    if (draggedEncomenda) {
        // Atribuir encomenda pendente à viatura (usar atribuicao_id se o card tiver)
        try {
            const data = document.getElementById('dataPlaneamento').value;
            const body = {
                data_associacao: data,
                pedido_id: draggedEncomenda.id,
                pedido_tipo: draggedEncomenda.tipo
            };
            if (atribuicaoId) body.atribuicao_id = atribuicaoId;
            else body.viatura_motorista_id = cardId;
            const response = await fetch('/api/atribuir-encomenda', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                // Recarregar dados (nocache para cards mostrarem local_descarga)
                await carregarEncomendasPendentesDia();
                await carregarViaturasMotoristas(true);
            } else {
                alert('Erro ao atribuir encomenda: ' + (result.error || 'Erro desconhecido'));
            }
        } catch (error) {
            console.error('Erro ao atribuir encomenda:', error);
            alert('Erro ao atribuir encomenda');
        }
        
        draggedEncomenda = null;
    } else if (draggedEncomendaBack) {
        // Mover encomenda de uma viatura para outra
        // Usar uma abordagem alternativa: remover da viatura antiga e atribuir à nova
        try {
            // Verificar se draggedEncomendaBack existe e tem os dados necessários
            if (!draggedEncomendaBack || !draggedEncomendaBack.pedido_id || !draggedEncomendaBack.pedido_tipo || !draggedEncomendaBack.atribuicao_id) {
                console.error('Dados incompletos ou null:', draggedEncomendaBack);
                draggedEncomendaBack = null;
                return;
            }
            
            // Guardar os dados antes de qualquer operação assíncrona
            const encomendaData = {
                pedido_id: draggedEncomendaBack.pedido_id,
                pedido_tipo: draggedEncomendaBack.pedido_tipo,
                atribuicao_id: draggedEncomendaBack.atribuicao_id,
                viatura_id: draggedEncomendaBack.viatura_id
            };
            
            // Verificar se está a mover para a mesma viatura - se sim, é uma reordenação
            if (cardId === encomendaData.viatura_id) {
                // Reordenar encomendas dentro do mesmo card
                await reordenarEncomendasNoCard(cardId, dropZone, e);
                draggedEncomendaBack = null;
                return;
            }
            
            const data = document.getElementById('dataPlaneamento').value;
            
            // Se for data anterior e o código foi desbloqueado, enviar o código
            let codigoAutorizacao = null;
            const isAnterior = isDataAnterior(data);
            if (isAnterior && codigoDesbloqueioAtivo) {
                codigoAutorizacao = CODIGO_SECRETO;
            }
            
            // Primeiro, remover a atribuição antiga
            let response = await fetch(`/api/remover-atribuicao/${encomendaData.atribuicao_id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ codigo_autorizacao: codigoAutorizacao })
            });
            
            // Verificar se a resposta é JSON
            let contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Resposta não é JSON ao remover atribuição:', {
                    status: response.status,
                    statusText: response.statusText,
                    contentType: contentType,
                    body: text.substring(0, 500)
                });
                alert(`Erro ${response.status} ao remover atribuição. Verifique o console (F12) para mais detalhes.`);
                draggedEncomendaBack = null;
                return;
            }
            
            let result = await response.json();
            
            // Se o servidor pedir código e ainda não temos desbloqueado, usar modal
            if (response.status === 403 && result.error && (result.error.includes('1990') || result.error.includes('código de autorização') || result.error.includes('autorização'))) {
                if (!codigoDesbloqueioAtivo) {
                    abrirModalCodigoAutorizacao();
                    draggedEncomendaBack = null;
                    return;
                } else {
                    codigoAutorizacao = CODIGO_SECRETO;
                    // Tentar novamente com o código
                    response = await fetch(`/api/remover-atribuicao/${draggedEncomendaBack.atribuicao_id}`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ codigo_autorizacao: codigoAutorizacao })
                    });
                    contentType = response.headers.get('content-type');
                    if (!contentType || !contentType.includes('application/json')) {
                        const text = await response.text();
                        console.error('Resposta não é JSON:', text.substring(0, 200));
                        alert('Erro ao remover atribuição. Verifique o console para mais detalhes.');
                        draggedEncomendaBack = null;
                        return;
                    }
                    result = await response.json();
                }
            }
            
            if (!response.ok || !result.success) {
                const errorMsg = result.error || 'Erro desconhecido ao remover atribuição';
                console.error('Erro ao remover atribuição:', errorMsg, result);
                alert('Erro ao remover atribuição: ' + errorMsg);
                draggedEncomendaBack = null;
                return;
            }
            
            // Depois, atribuir à nova viatura
            const atribuicaoId = parseInt(dropZone.getAttribute('data-atribuicao-id')) || null;
            const requestBody = {
                data_associacao: data,
                pedido_id: draggedEncomendaBack.pedido_id,
                pedido_tipo: draggedEncomendaBack.pedido_tipo
            };
            
            if (atribuicaoId) {
                requestBody.atribuicao_id = atribuicaoId;
            } else {
                requestBody.viatura_motorista_id = cardId;
            }
            
            response = await fetch('/api/atribuir-encomenda', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            
            contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Resposta não é JSON ao atribuir encomenda:', {
                    status: response.status,
                    statusText: response.statusText,
                    contentType: contentType,
                    body: text.substring(0, 500)
                });
                alert(`Erro ${response.status} ao atribuir encomenda. Verifique o console (F12) para mais detalhes.`);
                draggedEncomendaBack = null;
                return;
            }
            
            result = await response.json();
            
            if (response.ok && result.success) {
                // Recarregar dados (nocache para cards mostrarem local_descarga)
                await carregarEncomendasPendentesDia();
                await carregarViaturasMotoristas(true);
            } else {
                const errorMsg = result.error || 'Erro desconhecido ao atribuir encomenda';
                console.error('Erro ao atribuir encomenda:', errorMsg, result);
                alert('Erro ao atribuir encomenda: ' + errorMsg);
            }
        } catch (error) {
            console.error('Erro ao mover encomenda:', error);
            alert('Erro ao mover encomenda: ' + (error.message || 'Erro de conexão'));
        }
        
        draggedEncomendaBack = null;
    }
}

function handleDragOverBack(e) {
    // Verificar se pode fazer movimentos (bloquear datas anteriores)
    if (!podeFazerMovimentos()) {
        e.dataTransfer.dropEffect = 'none';
        return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
}

async function handleDropBack(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Verificar se pode fazer movimentos (bloquear datas anteriores)
    if (!podeFazerMovimentos()) {
        return;
    }
    
    // Remover classe drag-over de todos os elementos
    document.querySelectorAll('.drop-zone-encomendas').forEach(el => {
        el.classList.remove('drop-zone-encomendas');
    });
    
    if (!draggedEncomendaBack) return;
    
    // Guardar dados da encomenda antes de qualquer operação assíncrona
    const encomendaData = {
        pedido_id: draggedEncomendaBack.pedido_id,
        pedido_tipo: draggedEncomendaBack.pedido_tipo
    };
    
    const data = document.getElementById('dataPlaneamento').value;
    
    try {
        // Se for data anterior e o código foi desbloqueado, enviar o código
        let codigoAutorizacao = null;
        const isAnterior = isDataAnterior(data);
        if (isAnterior && codigoDesbloqueioAtivo) {
            codigoAutorizacao = CODIGO_SECRETO;
        }
        
        // Usar a API que remove por atribuicao_id (se tiver) ou por pedido_id
        let atribuicaoId = draggedEncomendaBack?.atribuicao_id;
        let response;
        let result;
        
        if (atribuicaoId) {
            // Usar a API existente que remove por ID
            response = await fetch(`/api/remover-atribuicao/${atribuicaoId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ codigo_autorizacao: codigoAutorizacao })
            });
        } else {
            // Usar a API por pedido_id + data
            response = await fetch('/api/remover-atribuicao-por-pedido', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pedido_id: encomendaData.pedido_id,
                    pedido_tipo: encomendaData.pedido_tipo,
                    data_associacao: data,
                    codigo_autorizacao: codigoAutorizacao
                })
            });
        }
        
        // Verificar se a resposta é JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Resposta não é JSON:', text.substring(0, 200));
            alert('Erro: O servidor retornou uma resposta inválida. Verifique o console para mais detalhes.');
            draggedEncomendaBack = null;
            return;
        }
        
        result = await response.json();
        
        // Se o servidor pedir código e ainda não temos desbloqueado, usar modal
        if (response.status === 403 && result.error && (result.error.includes('1990') || result.error.includes('código de autorização') || result.error.includes('autorização'))) {
            // Se já temos o código desbloqueado, usar diretamente
            if (!codigoDesbloqueioAtivo) {
                // Abrir modal para pedir código
                abrirModalCodigoAutorizacao();
                draggedEncomendaBack = null;
                return; // Cancelar esta operação, o utilizador pode tentar novamente depois de desbloquear
            } else {
                codigoAutorizacao = CODIGO_SECRETO;
            }
            
            // Tentar novamente com o código
            if (atribuicaoId) {
                response = await fetch(`/api/remover-atribuicao/${atribuicaoId}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ codigo_autorizacao: codigoAutorizacao })
                });
            } else {
                response = await fetch('/api/remover-atribuicao-por-pedido', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        pedido_id: encomendaData.pedido_id,
                        pedido_tipo: encomendaData.pedido_tipo,
                        data_associacao: data,
                        codigo_autorizacao: codigoAutorizacao
                    })
                });
            }
            
            // Verificar se a resposta é JSON
            const contentTypeRetry = response.headers.get('content-type');
            if (!contentTypeRetry || !contentTypeRetry.includes('application/json')) {
                const text = await response.text();
                console.error('Resposta não é JSON:', text.substring(0, 200));
                alert('Erro: O servidor retornou uma resposta inválida. Verifique o console para mais detalhes.');
                draggedEncomendaBack = null;
                return;
            }
            
            result = await response.json();
        }
        
        if (response.ok && result.success) {
            // Recarregar dados - a encomenda deve voltar para a lista de pendentes
            await carregarEncomendasPendentesDia();
            await carregarViaturasMotoristas();
        } else {
            const errorMsg = result.error || 'Erro desconhecido';
            console.error('Erro ao remover atribuição:', errorMsg, result);
            alert('Erro ao remover atribuição: ' + errorMsg);
        }
    } catch (error) {
        console.error('Erro ao remover atribuição:', error);
        alert('Erro ao remover atribuição: ' + (error.message || 'Erro de conexão'));
    }
    
    draggedEncomendaBack = null;
}

// Adicionar drop zone na tabela de encomendas pendentes para receber encomendas de volta
// Função para adicionar drop zone em toda a coluna de encomendas
function adicionarDropZoneColunaEncomendas() {
    const colunaEncomendas = document.getElementById('colunaEncomendas');
    if (!colunaEncomendas) return;
    
    // Remover listeners anteriores para evitar duplicados
    colunaEncomendas.removeEventListener('dragover', handleDragOverColunaEncomendas);
    colunaEncomendas.removeEventListener('drop', handleDropColunaEncomendas);
    colunaEncomendas.removeEventListener('dragleave', handleDragLeaveColunaEncomendas);
    colunaEncomendas.removeEventListener('dragenter', handleDragEnterColunaEncomendas);
    
    // Adicionar novos listeners na coluna inteira
    // Usar capture phase para garantir que captura antes dos elementos filhos
    colunaEncomendas.addEventListener('dragover', handleDragOverColunaEncomendas, true);
    colunaEncomendas.addEventListener('drop', handleDropColunaEncomendas, true);
    colunaEncomendas.addEventListener('dragleave', handleDragLeaveColunaEncomendas, true);
    colunaEncomendas.addEventListener('dragenter', handleDragEnterColunaEncomendas, true);
    
    // Também adicionar aos elementos filhos principais para garantir cobertura total
    const tableContainer = colunaEncomendas.querySelector('.table-container');
    const table = colunaEncomendas.querySelector('table');
    const tbody = colunaEncomendas.querySelector('tbody');
    
    [tableContainer, table, tbody].forEach(element => {
        if (element) {
            element.addEventListener('dragover', handleDragOverColunaEncomendas, true);
            element.addEventListener('drop', handleDropColunaEncomendas, true);
            element.addEventListener('dragenter', handleDragEnterColunaEncomendas, true);
        }
    });
}

function handleDragEnterColunaEncomendas(e) {
    if (!podeFazerMovimentos()) return;
    if (draggedEncomendaBack) {
        e.preventDefault();
        const colunaEncomendas = document.getElementById('colunaEncomendas');
        if (colunaEncomendas) {
            colunaEncomendas.classList.add('drop-zone-active');
        }
    }
}

function handleDragOverColunaEncomendas(e) {
    if (!podeFazerMovimentos()) {
        e.dataTransfer.dropEffect = 'none';
        return;
    }
    
    if (draggedEncomendaBack) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        
        // Garantir que a classe está ativa
        const colunaEncomendas = document.getElementById('colunaEncomendas');
        if (colunaEncomendas) {
            colunaEncomendas.classList.add('drop-zone-active');
        }
    }
}

function handleDragLeaveColunaEncomendas(e) {
    // Só remover a classe se realmente sair da coluna (não apenas de um filho)
    const colunaEncomendas = document.getElementById('colunaEncomendas');
    if (!colunaEncomendas) return;
    
    // Verificar se o elemento relacionado ainda está dentro da coluna
    const relatedTarget = e.relatedTarget;
    if (!relatedTarget || !colunaEncomendas.contains(relatedTarget)) {
        // Verificar também se não está sobre nenhum elemento filho
        const rect = colunaEncomendas.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;
        
        // Se o cursor saiu dos limites da coluna, remover a classe
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            colunaEncomendas.classList.remove('drop-zone-active');
        }
    }
}

async function handleDropColunaEncomendas(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const colunaEncomendas = document.getElementById('colunaEncomendas');
    if (colunaEncomendas) {
        colunaEncomendas.classList.remove('drop-zone-active');
    }
    
    // Verificar se pode fazer movimentos (bloquear datas anteriores)
    if (!podeFazerMovimentos()) {
        return;
    }
    
    if (!draggedEncomendaBack) return;
    
    // Usar a mesma lógica do handleDropBackInline
    const encomendaData = {
        pedido_id: draggedEncomendaBack.pedido_id,
        pedido_tipo: draggedEncomendaBack.pedido_tipo
    };
    
    const data = document.getElementById('dataPlaneamento').value;
    
    try {
        let codigoAutorizacao = null;
        
        let response = await fetch('/api/remover-atribuicao-por-pedido', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pedido_id: encomendaData.pedido_id,
                pedido_tipo: encomendaData.pedido_tipo,
                data_associacao: data,
                codigo_autorizacao: codigoAutorizacao
            })
        });
        
        let result = await response.json();
        
        if (response.status === 403 && result.error && (result.error.includes('1990') || result.error.includes('código de autorização') || result.error.includes('autorização'))) {
            // Usar a função existente para pedir código
            abrirModalCodigoAutorizacao();
            // Aguardar código ser inserido (será chamado novamente após código)
            draggedEncomendaBack = null;
            return;
        }
        
        if (result.success) {
            await carregarEncomendasPendentesDia();
            await carregarViaturasMotoristas();
            draggedEncomendaBack = null;
        } else {
            alert('Erro ao remover atribuição: ' + (result.error || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro ao remover atribuição:', error);
        alert('Erro ao remover atribuição');
    }
    
    draggedEncomendaBack = null;
}

function adicionarDropZoneEncomendasPendentes() {
    const tbody = document.getElementById('encomendasPendentesBody');
    const table = document.getElementById('encomendasPendentesTable');
    const colunaEncomendas = document.getElementById('colunaEncomendas');
    
    if (!tbody || !table || !colunaEncomendas) return;
    
    // Função para adicionar classe de drop zone
    function adicionarDropZone(e) {
        // Verificar se pode fazer movimentos (bloquear datas anteriores)
        if (!podeFazerMovimentos()) {
            e.dataTransfer.dropEffect = 'none';
            return;
        }
        
        if (draggedEncomendaBack) {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            tbody.classList.add('drop-zone-encomendas');
            table.classList.add('drop-zone-encomendas');
            colunaEncomendas.classList.add('drop-zone-encomendas');
            
            // Remover estilo verde de todos os cards quando arrasta sobre pendentes
            document.querySelectorAll('.motorista-card').forEach(card => {
                card.classList.remove('drag-over-card');
            });
        }
    }
    
    // Função para remover classe de drop zone
    function removerDropZone(e) {
        if (draggedEncomendaBack) {
            tbody.classList.remove('drop-zone-encomendas');
            table.classList.remove('drop-zone-encomendas');
            colunaEncomendas.classList.remove('drop-zone-encomendas');
        }
    }
    
    // Adicionar listeners aos elementos
    [tbody, table, colunaEncomendas].forEach(element => {
        element.addEventListener('dragover', adicionarDropZone);
        element.addEventListener('dragleave', removerDropZone);
        element.addEventListener('drop', handleDropBack, false); // Bubble phase - depois dos cards
    });
}

// ==================== REDIMENSIONAMENTO DE COLUNAS ====================

function inicializarRedimensionamentoColunas() {
    const divisor = document.getElementById('colunaDivisor');
    const colunaEncomendas = document.getElementById('colunaEncomendas');
    const colunaViaturas = document.getElementById('colunaViaturas');
    
    if (!divisor || !colunaEncomendas || !colunaViaturas) return;
    
    // Carregar largura salva do localStorage
    const larguraSalva = localStorage.getItem('larguraColunaEncomendas');
    if (larguraSalva) {
        colunaEncomendas.style.width = larguraSalva + 'px';
        colunaEncomendas.style.flexShrink = '0';
    }
    
    let isDragging = false;
    let startX = 0;
    let startWidth = 0;
    
    divisor.addEventListener('mousedown', function(e) {
        isDragging = true;
        startX = e.clientX;
        startWidth = colunaEncomendas.offsetWidth;
        divisor.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        
        const diff = e.clientX - startX;
        const newWidth = startWidth + diff;
        const containerWidth = divisor.parentElement.offsetWidth;
        const divisorWidth = divisor.offsetWidth;
        const minWidth = 200;
        const maxWidth = containerWidth * 0.7;
        
        if (newWidth >= minWidth && newWidth <= maxWidth) {
            colunaEncomendas.style.width = newWidth + 'px';
            colunaEncomendas.style.flexShrink = '0';
        }
    });
    
    document.addEventListener('mouseup', function() {
        if (isDragging) {
            isDragging = false;
            divisor.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
            // Salvar largura no localStorage
            localStorage.setItem('larguraColunaEncomendas', colunaEncomendas.offsetWidth);
        }
    });
}

// ==================== CARREGAMENTO DE VIATURAS E MOTORISTAS ====================

async function carregarViaturasMotoristas(nocache) {
    try {
        const dataInput = document.getElementById('dataPlaneamento');
        if (!dataInput) {
            console.error('Elemento dataPlaneamento não encontrado');
            return;
        }
        const data = dataInput.value;
        if (!data) {
            console.error('Data não definida');
            return;
        }
        let url = `/api/cards-planeamento?data=${encodeURIComponent(data)}`;
        if (nocache) url += '&_=' + Date.now();
        const response = await fetch(url);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Erro ao buscar cards:', response.status, errorText);
            throw new Error(`Erro ${response.status}: ${errorText}`);
        }
        const dados = await response.json();
        console.log('DEBUG - Cards recebidos:', dados.length, dados);
        renderizarViaturasMotoristas(dados);
    } catch (error) {
        console.error('Erro ao carregar viaturas/motoristas:', error);
        const grid = document.getElementById('motoristasGrid');
        if (grid) {
            grid.innerHTML = '<div class="empty">Erro ao carregar viaturas/motoristas</div>';
        }
    }
}

function renderizarViaturasMotoristas(dados) {
    const grid = document.getElementById('motoristasGrid');
    if (!grid) {
        console.error('DEBUG - motoristasGrid não encontrado!');
        return;
    }
    
    console.log('DEBUG - renderizarViaturasMotoristas: Recebidos', dados.length, 'cards');
    if (dados.length === 0) {
        console.warn('DEBUG - Nenhum card recebido do servidor');
        grid.innerHTML = '<div class="empty">Nenhuma viatura/motorista cadastrada</div>';
        return;
    }
    
    // Não remover flags - event delegation funciona mesmo quando o conteúdo muda
    
    // Manter a ordem do servidor (já ordenada por ordem personalizada)
    // Não reordenar aqui para preservar a ordem personalizada do utilizador
    const dadosOrdenados = dados;
    const dataInput = document.getElementById('dataPlaneamento');
    const data = dataInput ? dataInput.value : '';
    
    // Verificar se pode fazer movimentos (com tratamento de erro)
    let podeMover = true;
    try {
        podeMover = podeFazerMovimentos();
    } catch (error) {
        console.error('Erro ao verificar se pode fazer movimentos:', error);
        podeMover = true; // Por segurança, permitir movimentos se houver erro
    }
    
    // Separar cards normais de transportadoras
    const cardsNormais = dadosOrdenados.filter(item => !item.is_transportadora);
    const cardsTransportadoras = dadosOrdenados.filter(item => item.is_transportadora);
    
    let htmlCards = cardsNormais.map(item => {
        const encomendas = item.encomendas || [];
        const status = (item.status || 'Normal').trim();
        const statusNormalizado = status.toLowerCase();
        // Determinar classe CSS do status
        let statusClass = '';
        if (statusNormalizado === 'ferias' || status === 'Ferias') {
            statusClass = 'status-ferias';
        } else if (statusNormalizado === 'baixa' || status === 'Baixa') {
            statusClass = 'status-baixa';
        } else if (statusNormalizado === 'outrostrabalhos' || status === 'OutrosTrabalhos') {
            statusClass = 'status-outros-trabalhos';
        } else if (statusNormalizado === 'disponivel' || status === 'Disponivel') {
            statusClass = 'status-disponivel';
        }
        const statusIcon = getStatusIcon(status);
        const statusTitle = getStatusTitle(status);
        
        // Verificar se o motorista está disponível (status Normal, Disponivel ou vazio, não Ferias, Baixa nem Outros trabalhos)
        const statusLower = status.toLowerCase();
        const indisponivel = statusLower === 'ferias' || status === 'Ferias' || statusLower === 'baixa' || status === 'Baixa' || statusLower === 'outrostrabalhos' || status === 'OutrosTrabalhos';
        const isDisponivel = !indisponivel && (status === 'Normal' || status === 'Disponivel' || status === '');
        const podeReceberEncomendas = isDisponivel;
        const estaDeFerias = statusLower === 'ferias' || status === 'Ferias';
        const estaDeBaixa = statusLower === 'baixa' || status === 'Baixa';
        const estaEmOutrosTrabalhos = statusLower === 'outrostrabalhos' || status === 'OutrosTrabalhos';
        
        // Usar atribuicao_id se disponível, senão usar id (compatibilidade)
        const cardId = item.atribuicao_id || item.id;
        const atribuicaoId = item.atribuicao_id || null; // Usar atribuicao_id se existir
        // Prioridade: matrícula temporária do dia (alterar matrícula) > conjunto (trator + cisterna) > item.matricula
        const temMatriculaTemp = item.matricula_trator_temp || item.matricula_galera_temp;
        const matriculaDisplay = temMatriculaTemp
            ? [item.matricula_trator_temp, item.matricula_galera_temp].filter(Boolean).join(' + ')
            : (item.trator_matricula && item.cisterna_matricula
                ? `${item.trator_matricula} + ${item.cisterna_matricula}`
                : (item.matricula || ''));
        
        // Se não há atribuicao_id, usar cardId como fallback (para compatibilidade com sistema antigo)
        const idParaUltimoServico = atribuicaoId || cardId;
        
        const passaNoiteFora = !!item.passa_noite_fora;
        const numNoites = Math.max(0, parseInt(item.numero_noites_fora, 10) || 0);
        const foraContinuacao = !!item.fora_continuacao;
        const nivelContinuacao = Math.max(0, parseInt(item.fora_continuacao_nivel, 10) || 0);
        const dataPlaneamento = (document.getElementById('dataPlaneamento') && document.getElementById('dataPlaneamento').value) || '';
        const mostraIconeNoiteFora = !estaDeFerias && !estaDeBaixa && !estaEmOutrosTrabalhos;
        const tituloNoiteFora = numNoites === 0 ? 'Marcar: passa noite fora (fica azul e passa ao dia seguinte). Duplo clique: desmarca.' : (numNoites === 1 ? '1.ª noite fora. Carregue no dia seguinte se continuar fora. Duplo clique: desmarca.' : 'Carregar aqui se continuar fora no dia seguinte. Duplo clique: desmarca.');
        const tituloContinuacao = nivelContinuacao >= 2 ? `Fora - ${nivelContinuacao}.ª noite. Carregar aqui se continuar fora amanhã. Duplo clique: desmarca.` : 'Fora - continuação. Carregar aqui se continuar fora (muda de cor e passa ao dia seguinte). Duplo clique: desmarca.';
        const classeNivelContinuacao = nivelContinuacao >= 2 ? ' nivel-2' : '';
        const textoBadgeNoites = numNoites >= 2 ? numNoites : '';
        const textoBadgeContinuacao = nivelContinuacao >= 2 ? nivelContinuacao : '';
        const btnContinuacao = mostraIconeNoiteFora ? `<button type="button" class="btn-noite-fora continuacao${classeNivelContinuacao}" onclick="handleNoiteForaClick(${cardId}, '${dataPlaneamento.replace(/'/g, "\\'")}')" oncontextmenu="event.preventDefault(); desmarcarNoiteFora(${cardId}, '${dataPlaneamento.replace(/'/g, "\\'")}')" title="${tituloContinuacao}">🌙${textoBadgeContinuacao ? `<span class="btn-noite-fora-badge">${textoBadgeContinuacao}</span>` : ''}</button>` : '';
        const iconNoiteFora = foraContinuacao
            ? btnContinuacao
            : (mostraIconeNoiteFora ? `<button type="button" class="btn-noite-fora ${numNoites >= 1 ? 'ativo' : ''} ${numNoites >= 2 ? 'nivel-2' : ''}" onclick="handleNoiteForaClick(${cardId}, '${dataPlaneamento.replace(/'/g, "\\'")}')" oncontextmenu="event.preventDefault(); desmarcarNoiteFora(${cardId}, '${dataPlaneamento.replace(/'/g, "\\'")}')" title="${tituloNoiteFora}">🌙${textoBadgeNoites ? `<span class="btn-noite-fora-badge">${textoBadgeNoites}</span>` : ''}</button>` : '');
        const horaInicioCedo = (item.hora_inicio_cedo || '').trim() || null;
        const textoInicioCedo = horaInicioCedo === '05:00' ? '5h' : (horaInicioCedo === '06:00' ? '6h' : '');
        const temAvariaAlteracao = item.avaria_alteracao === true || item.avaria_alteracao === 1;
        const avariaObservacao = (item.avaria_observacao || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const avariaObservacaoRaw = (item.avaria_observacao || '').trim();
        const avariaNotaRaw = (item.avaria_nota || '').trim();
        const avariaNotaEscaped = (item.avaria_nota || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const avariaObservacaoDataAttr = avariaObservacaoRaw.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r/g, '').replace(/\n/g, ' ');
        const avariaNotaDataAttr = avariaNotaRaw.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r/g, '').replace(/\n/g, ' ');
        const tituloBadgeAvaria = (avariaObservacaoRaw ? avariaObservacaoRaw + ' — ' : '') + 'Clique direito para adicionar ou editar nota';
        const linhaNota = avariaNotaRaw ? `<div class="card-avaria-nota">Nota: ${avariaNotaEscaped}</div>` : '';
        const badgeAvaria = temAvariaAlteracao ? `<div class="card-avaria-alteracao card-avaria-editavel" data-atribuicao-id="${item.atribuicao_id || cardId}" data-avaria-observacao="${avariaObservacaoDataAttr}" data-avaria-nota="${avariaNotaDataAttr}" title="${tituloBadgeAvaria.replace(/"/g, '&quot;')}" oncontextmenu="event.preventDefault(); event.stopPropagation(); abrirModalAvariaNota(event);">⚠️ Avaria/Alteração${avariaObservacao ? ': ' + avariaObservacao : ''}${linhaNota}</div>` : '';
        const _nAvaria = parseInt(item.avaria_apos_ordem, 10);
        const avariaAposOrdem = (item.avaria_apos_ordem != null && !isNaN(_nAvaria) && _nAvaria >= 0) ? _nAvaria : null;
        const inserirAvariaNoMeio = temAvariaAlteracao && encomendas.length > 0 && avariaAposOrdem != null && avariaAposOrdem > 0 && avariaAposOrdem < encomendas.length;
        const renderEncomenda = (e, index) => `
                        <div class="encomenda-card ${(e.prioridade === 1 || e.prioridade === true) ? 'encomenda-prioridade' : ''} ${e.carregado_dia_anterior ? 'encomenda-carregado-dia-anterior' : ''} ${!podeMover ? 'visualizacao-only' : ''}" 
                             data-pedido-id="${e.pedido_id}"
                             data-pedido-tipo="${e.pedido_tipo}"
                             data-viatura-origem-id="${item.id}"
                             data-atribuicao-id="${e.id}"
                             data-encomenda-viatura-id="${e.id}"
                             data-ordem="${e.ordem || index + 1}"
                             draggable="${podeMover ? 'true' : 'false'}"
                             ondragstart="handleDragStartBack(event)"
                             ondragend="handleDragEndBack(event)"
                             ondragover="handleDragOverEncomenda(event, ${cardId})"
                             ondragleave="handleDragLeaveEncomenda(event)"
                             ondrop="handleDropEncomenda(event, ${cardId}, ${e.id})"
                             oncontextmenu="event.preventDefault(); event.stopPropagation(); mostrarContextMenuEncomendaCarregado(event, ${e.id}, ${e.carregado_dia_anterior ? 'true' : 'false'});"
                             title="Clique direito: marcar/desmarcar carregado no dia anterior">
                            <div class="encomenda-conteudo">
                                <span class="encomenda-texto">${(e.descricao || 'Encomenda ' + e.pedido_id).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
                                ${e.observacoes ? `<div class="encomenda-observacoes" style="font-size: 11px; color: #666; margin-top: 4px; font-style: italic;">${(e.observacoes || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}
                            </div>
                        </div>
                    `;
        const blocoEncomendas = inserirAvariaNoMeio
            ? encomendas.slice(0, avariaAposOrdem).map((e, i) => renderEncomenda(e, i)).join('') + badgeAvaria + encomendas.slice(avariaAposOrdem).map((e, i) => renderEncomenda(e, avariaAposOrdem + i)).join('')
            : encomendas.map((e, index) => renderEncomenda(e, index)).join('');
        return `
            <div class="motorista-card ${!podeMover ? 'visualizacao-only' : ''} ${estaDeFerias ? 'ferias-bloqueado' : ''} ${estaDeBaixa ? 'baixa-bloqueado' : ''} ${estaEmOutrosTrabalhos ? 'outros-trabalhos-bloqueado' : ''} ${foraContinuacao ? 'card-fora-continuacao' : ''} ${temAvariaAlteracao ? 'card-tem-avaria' : ''}" data-id="${cardId}" data-atribuicao-id="${item.atribuicao_id || ''}" data-hora-saida="${horaInicioCedo || ''}">
                <div class="motorista-header">
                    <div class="motorista-info">
                        <div class="motorista-nome" 
                             onclick="mostrarUltimoServicoAtribuicao(${idParaUltimoServico}, '${(item.nome_motorista || '').replace(/'/g, "\\'")}', '${matriculaDisplay.replace(/'/g, "\\'")}')"
                             oncontextmenu="event.preventDefault(); mostrarContextMenuMotorista(event, ${cardId}, '${item.nome_motorista}', '${matriculaDisplay}');" 
                             title="Clique esquerdo: ver último serviço | Clique direito: opções"
                             style="cursor: pointer;">PTSA | ${matriculaDisplay}${item.codigo ? ' + ' + item.codigo : ''} - ${item.nome_motorista}</div>
                        ${(statusLower !== 'disponivel' && status !== 'Disponivel' && (item.observacao_status || '').trim()) ? `<div class="motorista-status-observacao" title="Observação do status">${(item.observacao_status || '').trim().replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</div>` : ''}
                    </div>
                    ${textoInicioCedo ? `<span class="badge-hora-saida" title="Hora de saída (clique direito no nome para alterar)">${textoInicioCedo}</span>` : ''}
                    ${iconNoiteFora}
                    <button class="btn-status ${statusClass}" 
                            onclick="abrirModalStatus(${cardId}, '${status.replace(/'/g, "\\'")}', '${(item.observacao_status || '').replace(/'/g, "\\'")}', '${(item.data_inicio || '').replace(/'/g, "\\'")}', '${(item.data_fim || '').replace(/'/g, "\\'")}')"
                            title="${statusTitle}${item.data_inicio && item.data_fim ? ' (' + item.data_inicio + ' a ' + item.data_fim + ')' : ''}">
                        ${statusIcon}
                    </button>
                </div>
                <div class="motorista-encomendas drop-zone ${encomendas.length === 0 ? 'empty' : ''} ${!podeMover ? 'visualizacao-only' : ''} ${estaDeFerias || estaDeBaixa || estaEmOutrosTrabalhos ? 'disabled' : ''}" 
                     data-drop-zone="true"
                     data-viatura-id="${cardId}"
                     data-atribuicao-id="${item.atribuicao_id || cardId}"
                     ondrop="handleDrop(event)"
                     ondragover="handleDragOver(event)"
                     ondragenter="handleDragOver(event)"
                     ondragleave="handleDragLeave(event)">
                    ${encomendas.length === 0 ? `<div class="servico-anterior-fundo" data-servico-anterior="pendente"></div>` : ''}
                    ${blocoEncomendas}
                </div>
                ${inserirAvariaNoMeio ? '' : badgeAvaria}
            </div>
        `;
    }).join('');
    
    // Adicionar cards de transportadoras (com estilo diferente)
    if (cardsTransportadoras.length > 0) {
        htmlCards += cardsTransportadoras.map(item => {
            const encomendas = item.encomendas || [];
            const cardId = item.id;
            
            return `
                <div class="motorista-card transportadora-card" data-id="${cardId}" data-transportadora-id="${item.transportadora_id}">
                    <div class="motorista-header">
                        <div class="motorista-info">
                            <div class="motorista-nome" style="color: #17a2b8; font-weight: 600;">
                                🚚 ${item.nome_motorista}
                            </div>
                        </div>
                    </div>
                    <div class="motorista-encomendas drop-zone ${encomendas.length === 0 ? 'empty' : ''}" 
                         data-drop-zone="true"
                         data-transportadora-id="${item.transportadora_id}"
                         ondrop="handleDrop(event)"
                         ondragover="handleDragOver(event)"
                         ondragenter="handleDragOver(event)"
                         ondragleave="handleDragLeave(event)">
                        ${encomendas.map((e, index) => `
                            <div class="encomenda-card ${(e.prioridade === 1 || e.prioridade === true) ? 'encomenda-prioridade' : ''}" 
                                 data-pedido-id="${e.pedido_id}"
                                 data-pedido-tipo="${e.pedido_tipo}"
                                 data-transportadora-id="${item.transportadora_id}"
                                 data-ordem="${e.ordem || index + 1}"
                                 draggable="true"
                                 ondragstart="handleDragStartBack(event)"
                                 ondragend="handleDragEndBack(event)">
                                <div class="encomenda-conteudo">
                                    <span class="encomenda-texto">${(e.descricao || 'Encomenda ' + e.pedido_id).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
                                    ${e.observacoes ? `<div class="encomenda-observacoes" style="font-size: 11px; color: #666; margin-top: 4px; font-style: italic;">${(e.observacoes || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    grid.innerHTML = htmlCards;
    
    // Último serviço será carregado apenas quando clicar no nome/matrícula do motorista
    
    // Adicionar listeners de drag and drop após renderizar
    setTimeout(() => {
        adicionarDragAndDropListeners();
        adicionarDropZoneEncomendasPendentes();
        
        // Adicionar event delegation para capturar dragstart de encomendas ANTES de tudo
        const grid = document.getElementById('motoristasGrid');
        if (grid) {
            // Remover handler anterior se existir
            if (grid._encomendaDragStartHandler) {
                grid.removeEventListener('dragstart', grid._encomendaDragStartHandler, true);
            }
            
            grid._encomendaDragStartHandler = function(e) {
                const encomendaCard = e.target.closest('.encomenda-card');
                if (encomendaCard && encomendaCard.getAttribute('draggable') === 'true') {
                    // Permitir que o dragstart continue normalmente
                    return true;
                }
            };
            
            grid.addEventListener('dragstart', grid._encomendaDragStartHandler, true);
        }
        
        // Adaptar colunas ao número de cards e ao espaço disponível
        aplicarColunasGridCards();
        // Ajustar altura dos cards para caberem todos no ecrã
        ajustarAlturaCards();
    }, 100);
    
    // Mostrar, de forma de fundo, o serviço do dia anterior em cada card sem encomendas hoje
    preencherServicoDiaAnteriorFundo();
}

// ==================== ADAPTAR COLUNAS DO GRID AO Nº DE CARDS ====================

function aplicarColunasGridCards() {
    const grid = document.getElementById('motoristasGrid');
    const colunaViaturas = document.getElementById('colunaViaturas');
    if (!grid || !colunaViaturas) return;
    
    const cards = grid.querySelectorAll('.motorista-card');
    const cardCount = cards.length;
    if (cardCount === 0) {
        grid.style.gridTemplateColumns = '';
        return;
    }
    
    const containerWidth = colunaViaturas.clientWidth || grid.parentElement.clientWidth || 800;
    const minColWidth = 200;
    const gap = 6;
    const padding = 12;
    const maxCols = 3; /* no máximo 3 cards por linha */
    const availableWidth = containerWidth - padding;
    const maxColsByWidth = Math.max(1, Math.floor((availableWidth + gap) / (minColWidth + gap)));
    const numCols = Math.min(maxCols, cardCount, maxColsByWidth);
    
    grid.style.gridTemplateColumns = `repeat(${numCols}, minmax(${minColWidth}px, 1fr))`;
}

// ==================== AJUSTE AUTOMÁTICO DE ALTURA DOS CARDS ====================

function ajustarAlturaCards() {
    const grid = document.getElementById('motoristasGrid');
    if (!grid) return;
    
    const cards = grid.querySelectorAll('.motorista-card');
    if (cards.length === 0) {
        grid.style.overflow = 'visible';
        return;
    }
    
    // Obter altura disponível do grid (altura do container pai)
    const colunaViaturas = document.getElementById('colunaViaturas');
    if (!colunaViaturas) return;
    
    const colunaRect = colunaViaturas.getBoundingClientRect();
    
    // Calcular altura disponível usando posição real do grid
    const gridRect = grid.getBoundingClientRect();
    const gridTop = gridRect.top;
    const colunaBottom = colunaRect.bottom;
    // Usar toda a altura disponível até o fundo da coluna
    const gridHeight = colunaBottom - gridTop;
    
    if (gridHeight <= 0) return;
    
    // Calcular número de colunas
    const primeiroCard = cards[0];
    if (!primeiroCard) return;
    
    // Forçar recalculo do layout
    void primeiroCard.offsetWidth;
    
    const cardRect = primeiroCard.getBoundingClientRect();
    const cardWidth = cardRect.width;
    const gridWidth = gridRect.width;
    const gap = 8; // gap do grid
    const padding = 10; // padding do grid (5px * 2)
    
    // Altura mínima 50: cards não esticam (sem 531/478), tamanho pelo conteúdo
    const alturaMinimaCard = 50;
    
    cards.forEach(card => {
        card.style.height = '';
        card.style.minHeight = '';
        card.style.maxHeight = '';
        card.style.overflow = '';
    });
    
    cards.forEach(card => {
        const encomendasArea = card.querySelector('.motorista-encomendas');
        if (encomendasArea) {
            encomendasArea.style.maxHeight = '';
            encomendasArea.style.overflowY = '';
            encomendasArea.style.flex = '';
        }
    });
    
    /* Manter grid a preencher a coluna sem scroll (altura vem do CSS: height 100%, grid-auto-rows 1fr) */
    grid.style.maxHeight = '';
    grid.style.height = '';
    grid.style.overflowY = '';
    grid.style.overflowX = '';
}

// Ajustar quando a janela é redimensionada
let resizeTimeout;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        aplicarColunasGridCards();
        ajustarAlturaCards();
    }, 250);
});

// Ajustar quando os cards são atualizados
const observerCards = new MutationObserver(function(mutations) {
    aplicarColunasGridCards();
    ajustarAlturaCards();
});

// Observar mudanças no grid
document.addEventListener('DOMContentLoaded', function() {
    const grid = document.getElementById('motoristasGrid');
    if (grid) {
        observerCards.observe(grid, { childList: true, subtree: true });
        // Ajustar inicialmente após um pequeno delay para garantir que o layout está renderizado
        setTimeout(() => {
            aplicarColunasGridCards();
            ajustarAlturaCards();
        }, 500);
    }
});

// A função ajustarAlturaCards já é chamada no renderizarViaturasMotoristas

// Debounce para ajuste automático ao redimensionar
function ajustarCardsComDebounce() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        aplicarColunasGridCards();
        ajustarAlturaCards();
    }, 150);
}

// Adicionar listener de resize global para ajuste automático
if (typeof window !== 'undefined') {
    window.addEventListener('resize', ajustarCardsComDebounce);
    // Também ajustar quando a janela é redimensionada ou quando o layout muda
    window.addEventListener('orientationchange', ajustarCardsComDebounce);
}
// e também será chamada quando a janela for redimensionada ou quando houver mudanças no grid

// ==================== FUNÇÕES DE STATUS ====================

function getStatusIcon(status) {
    const statusLower = (status || '').toLowerCase().trim();
    const icons = {
        'oficina': '🔧',
        'ferias': '🏖️',
        'baixa': '🏥',
        'disponivel': '✅',
        'atribuidooutrocarro': '🚗',
        'outrotratorgalera': '🚜',
        'normal': '⚪',
        '': '⚪'
    };
    // Se for Ferias (com F maiúsculo do backend), retornar ícone de férias
    if (status === 'Ferias' || statusLower === 'ferias') {
        return '🏖️';
    }
    // Se for Baixa (com B maiúsculo do backend), retornar ícone de baixa
    if (status === 'Baixa' || statusLower === 'baixa') {
        return '🏥';
    }
    // Se for Disponivel (com D maiúsculo do backend), retornar ícone de disponível
    if (status === 'Disponivel' || statusLower === 'disponivel') {
        return '✅';
    }
    if (status === 'OutrosTrabalhos' || statusLower === 'outrostrabalhos') {
        return '📋';
    }
    return icons[statusLower] || '⚪';
}

function getStatusTitle(status) {
    const statusLower = (status || '').toLowerCase().trim();
    // Se for Ferias (com F maiúsculo do backend), retornar título de férias
    if (status === 'Ferias' || statusLower === 'ferias') {
        return 'Motorista de Férias';
    }
    // Se for Baixa (com B maiúsculo do backend), retornar título de baixa
    if (status === 'Baixa' || statusLower === 'baixa') {
        return 'Motorista de Baixa';
    }
    // Se for Disponivel (com D maiúsculo do backend), retornar título de disponível
    if (status === 'Disponivel' || statusLower === 'disponivel') {
        return 'Motorista Disponível';
    }
    if (status === 'OutrosTrabalhos' || statusLower === 'outrostrabalhos') {
        return 'Em outros trabalhos';
    }
    const titles = {
        'oficina': 'Trator/Galera na Oficina',
        'atribuidooutrocarro': 'Atribuído a Outro Carro',
        'outrotratorgalera': 'Outro Trator Atribuído à Galera',
        'normal': 'Normal (Disponível)',
        '': 'Normal (Disponível)'
    };
    return titles[statusLower] || 'Normal (Disponível)';
}

var _noiteForaPending = null;

function handleNoiteForaClick(atribuicaoId, dataStr) {
    var key = atribuicaoId + '-' + (dataStr || '');
    var now = Date.now();
    if (_noiteForaPending && _noiteForaPending.key === key && (now - _noiteForaPending.time) < 400) {
        clearTimeout(_noiteForaPending.timeoutId);
        _noiteForaPending = null;
        desmarcarNoiteFora(atribuicaoId, dataStr, true);
        return;
    }
    if (_noiteForaPending) clearTimeout(_noiteForaPending.timeoutId);
    _noiteForaPending = {
        key: key,
        time: now,
        timeoutId: setTimeout(function() {
            _noiteForaPending = null;
            toggleNoiteFora(atribuicaoId, dataStr);
        }, 400)
    };
}

function escolherHoraSaida(atribuicaoId) {
    var id = parseInt(atribuicaoId, 10);
    if (isNaN(id) || id <= 0) {
        alert('Erro: atribuição inválida.');
        return;
    }
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay-hora-saida';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:9999;display:flex;align-items:center;justify-content:center;';
    var box = document.createElement('div');
    box.className = 'modal-hora-saida';
    box.style.cssText = 'background:#fff;border-radius:8px;padding:20px;box-shadow:0 4px 20px rgba(0,0,0,0.2);min-width:260px;';
    box.innerHTML = '<div style="margin-bottom:14px;font-weight:600;">Escolha a hora de saída</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
        '<button type="button" class="btn-hora-saida-5" style="padding:10px 20px;font-size:16px;cursor:pointer;border:1px solid #ccc;border-radius:6px;background:#f0f8f0;">5h</button>' +
        '<button type="button" class="btn-hora-saida-6" style="padding:10px 20px;font-size:16px;cursor:pointer;border:1px solid #ccc;border-radius:6px;background:#f0f8f0;">6h</button>' +
        '<button type="button" class="btn-hora-saida-normal" style="padding:10px 16px;font-size:14px;cursor:pointer;border:1px solid #ccc;border-radius:6px;background:#f5f5f5;">Normal</button>' +
        '</div>';
    function fechar() {
        overlay.remove();
    }
    box.querySelector('.btn-hora-saida-5').onclick = function() { fechar(); atualizarInicioCedo(id, '05:00'); };
    box.querySelector('.btn-hora-saida-6').onclick = function() { fechar(); atualizarInicioCedo(id, '06:00'); };
    box.querySelector('.btn-hora-saida-normal').onclick = function() { fechar(); atualizarInicioCedo(id, null); };
    overlay.appendChild(box);
    overlay.onclick = function(e) { if (e.target === overlay) fechar(); };
    document.body.appendChild(overlay);
}

async function atualizarInicioCedo(atribuicaoId, horaInicio) {
    var val = (horaInicio === '05:00' || horaInicio === '06:00') ? horaInicio : null;
    var id = parseInt(atribuicaoId, 10);
    if (isNaN(id) || id <= 0) {
        alert('Erro: atribuição inválida.');
        return;
    }
    var payload = { atribuicao_id: id, hora_inicio_cedo: val };
    var url1 = '/api/set-hora-saida';
    var url2 = '/api/atribuicao/' + id + '/inicio-cedo';
    var body1 = JSON.stringify(payload);
    var body2 = JSON.stringify({ hora_inicio_cedo: val });
    try {
        var response = await fetch(url1, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body1
        });
        if (response.status === 404) {
            response = await fetch(url2, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: body2
            });
        }
        var result = await response.json().catch(function() { return {}; });
        if (response.ok && result.success) {
            if (typeof carregarViaturasMotoristas === 'function') {
                carregarViaturasMotoristas();
            }
        } else {
            alert(result.error || 'Erro ao definir hora de saída.');
        }
    } catch (e) {
        console.error(e);
        alert('Erro ao comunicar com o servidor.');
    }
}

async function toggleNoiteFora(atribuicaoId, dataStr) {
    const data = (document.getElementById('dataPlaneamento') && document.getElementById('dataPlaneamento').value) || dataStr || '';
    if (!data) {
        alert('Selecione a data do planeamento.');
        return;
    }
    try {
        const response = await fetch('/api/noite-fora', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data, atribuicao_id: atribuicaoId })
        });
        const result = await response.json();
        if (result.success) {
            if (typeof carregarViaturasMotoristas === 'function') {
                carregarViaturasMotoristas();
            }
        } else {
            alert(result.error || 'Erro ao atualizar.');
        }
    } catch (e) {
        console.error(e);
        alert('Erro ao comunicar com o servidor.');
    }
}

async function desmarcarNoiteFora(atribuicaoId, dataStr, semConfirmar) {
    const data = (document.getElementById('dataPlaneamento') && document.getElementById('dataPlaneamento').value) || dataStr || '';
    if (!data) return;
    if (!semConfirmar && !confirm('Desmarcar noite(s) fora para este motorista?')) return;
    try {
        const response = await fetch('/api/noite-fora', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data, atribuicao_id: atribuicaoId, desmarcar: true })
        });
        const result = await response.json();
        if (result.success) {
            if (typeof carregarViaturasMotoristas === 'function') {
                carregarViaturasMotoristas();
            }
        } else {
            alert(result.error || 'Erro ao atualizar.');
        }
    } catch (e) {
        console.error(e);
        alert('Erro ao comunicar com o servidor.');
    }
}

function abrirModalStatus(viaturaId, statusAtual, observacaoAtual, dataInicio, dataFim) {
    document.getElementById('statusViaturaId').value = viaturaId;
    
    // Determinar status atual
    const statusLower = (statusAtual || '').toLowerCase();
    let statusValue = 'Disponivel';
    if (statusLower === 'ferias' || statusAtual === 'Ferias') {
        statusValue = 'Ferias';
    } else if (statusLower === 'baixa' || statusAtual === 'Baixa') {
        statusValue = 'Baixa';
    } else if (statusLower === 'outrostrabalhos' || statusAtual === 'OutrosTrabalhos') {
        statusValue = 'OutrosTrabalhos';
    }
    document.getElementById('statusSelect').value = statusValue;
    
    document.getElementById('statusObservacao').value = observacaoAtual || '';
    
    // Usar a data do planeamento (dia que o utilizador está a ver) como predefinição, não "hoje"
    const dataPlaneamento = document.getElementById('dataPlaneamento') ? document.getElementById('dataPlaneamento').value : null;
    const dataPredefinida = dataPlaneamento || new Date().toISOString().split('T')[0];
    const dataInicioInput = document.getElementById('statusDataInicio');
    const dataFimInput = document.getElementById('statusDataFim');
    
    // Pré-preencher datas: usar as datas existentes se houver, senão usar a data do planeamento
    if (dataInicioInput) {
        dataInicioInput.value = dataInicio || dataPredefinida;
    }
    if (dataFimInput) {
        dataFimInput.value = dataFim || dataPredefinida;
    }
    
    // Mostrar modal primeiro
    document.getElementById('statusModal').style.display = 'block';
    
    // IMPORTANTE: Chamar toggleStatusFields para mostrar/ocultar campos de férias
    // Usar setTimeout para garantir que os elementos existam após o modal ser exibido
    setTimeout(() => {
        toggleStatusFields();
    }, 100);
}

function toggleStatusFields() {
    const statusSelect = document.getElementById('statusSelect');
    const feriasFields = document.getElementById('feriasFields');
    const feriasFields2 = document.getElementById('feriasFields2');
    const statusDataInicio = document.getElementById('statusDataInicio');
    const statusDataFim = document.getElementById('statusDataFim');
    const feriasLabelInicio = document.getElementById('feriasLabelInicio');
    const feriasLabelFim = document.getElementById('feriasLabelFim');
    
    if (!statusSelect || !feriasFields || !feriasFields2) {
        return; // Elementos não encontrados ainda
    }
    
    if (statusSelect.value === 'Ferias' || statusSelect.value === 'Baixa' || statusSelect.value === 'OutrosTrabalhos') {
        feriasFields.style.display = 'block';
        feriasFields2.style.display = 'block';
        
        const labels = {
            'Ferias': { inicio: 'Data Início das Férias:', fim: 'Data Fim das Férias:' },
            'Baixa': { inicio: 'Data Início da Baixa:', fim: 'Data Fim da Baixa:' },
            'OutrosTrabalhos': { inicio: 'Data Início (outros trabalhos):', fim: 'Data Fim (outros trabalhos):' }
        };
        const lab = labels[statusSelect.value] || labels['Ferias'];
        if (feriasLabelInicio) feriasLabelInicio.textContent = lab.inicio;
        if (feriasLabelFim) feriasLabelFim.textContent = lab.fim;
        
        if (statusDataInicio) {
            statusDataInicio.required = true;
            // Se não tiver valor, pré-preencher com a data do planeamento (dia selecionado)
            if (!statusDataInicio.value) {
                const dataPredef = document.getElementById('dataPlaneamento') ? document.getElementById('dataPlaneamento').value : null;
                statusDataInicio.value = dataPredef || new Date().toISOString().split('T')[0];
            }
        }
        if (statusDataFim) {
            statusDataFim.required = true;
            // Se não tiver valor, pré-preencher com a data do planeamento (dia selecionado)
            if (!statusDataFim.value) {
                const dataPredef = document.getElementById('dataPlaneamento') ? document.getElementById('dataPlaneamento').value : null;
                statusDataFim.value = dataPredef || new Date().toISOString().split('T')[0];
            }
        }
    } else {
        feriasFields.style.display = 'none';
        feriasFields2.style.display = 'none';
        if (statusDataInicio) statusDataInicio.required = false;
        if (statusDataFim) statusDataFim.required = false;
    }
}

function fecharModalStatus() {
    document.getElementById('statusModal').style.display = 'none';
    document.getElementById('statusForm').reset();
}

// ==================== HISTÓRICO DE ENTREGAS ====================

function abrirModalHistorico() {
    document.getElementById('historicoModal').style.display = 'block';
    // Definir data padrão como hoje para ambas as datas
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('historicoDataInicio').value = hoje;
    document.getElementById('historicoDataFim').value = hoje;
    // Limpar filtros ao abrir
    limparFiltrosHistorico();
    carregarHistorico();
}

function fecharModalHistorico() {
    document.getElementById('historicoModal').style.display = 'none';
}

// Variável global para guardar dados originais do histórico
let dadosHistoricoCompletos = [];

/** Formata a coluna Avaria/Alteração no histórico: identifica avaria e mostra observação e nota. */
function formatarAvariaHistorico(item) {
    const temAvaria = item.avaria_alteracao === true || item.avaria_alteracao === 1;
    const obs = (item.avaria_observacao || '').trim();
    const nota = (item.avaria_nota || '').trim();
    if (!temAvaria && !obs && !nota) return '';
    const partes = [];
    if (temAvaria) partes.push('⚠️ Avaria/Alteração');
    if (obs) partes.push('Observação: ' + obs);
    if (nota) partes.push('Nota: ' + nota);
    return partes.join(' — ');
}

async function carregarHistorico() {
    try {
        const dataInicio = document.getElementById('historicoDataInicio').value;
        const dataFim = document.getElementById('historicoDataFim').value;
        
        if (!dataInicio || !dataFim) {
            return;
        }
        
        const response = await fetch(`/api/historico-entregas?data_inicio=${dataInicio}&data_fim=${dataFim}`);
        const dados = await response.json();
        
        // Debug: verificar dados recebidos
        console.log('DEBUG - Dados recebidos do servidor:', dados);
        if (dados.length > 0) {
            console.log('DEBUG - Primeiro registro recebido:', dados[0]);
            console.log('DEBUG - Campos do primeiro registro:', Object.keys(dados[0]));
        }
        
        const dadosNormalizados = dados.map(item => ({
            data_associacao: item.data_associacao || item.data || '',
            viatura_motorista: item.viatura_motorista || '',
            cliente: item.cliente || '',
            local_carga: item.local_carga || '',
            local_descarga: item.local_descarga || '',
            material: item.material || '',
            observacoes: item.observacoes || '',
            avaria_alteracao: item.avaria_alteracao === true || item.avaria_alteracao === 1,
            avaria_observacao: item.avaria_observacao || '',
            avaria_nota: item.avaria_nota || ''
        }));
        
        console.log('DEBUG - Dados normalizados:', dadosNormalizados);
        if (dadosNormalizados.length > 0) {
            console.log('DEBUG - Primeiro registro normalizado:', dadosNormalizados[0]);
        }
        
        // Guardar dados completos para filtros
        dadosHistoricoCompletos = dadosNormalizados;
        
        // Aplicar filtros (que podem estar vazios inicialmente)
        aplicarFiltrosHistorico();
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
        const tbody = document.getElementById('historicoBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty">Erro ao carregar histórico</td></tr>';
        }
        dadosHistoricoCompletos = [];
    }
}

function aplicarFiltrosHistorico() {
        const tbody = document.getElementById('historicoBody');
        if (!tbody) return;
        
    // Se não há dados carregados, não fazer nada
    if (!dadosHistoricoCompletos || dadosHistoricoCompletos.length === 0) {
            return;
        }
        
    // Obter valores dos filtros
    const filtroViatura = (document.getElementById('filtroViatura')?.value || '').toLowerCase().trim();
    const filtroCliente = (document.getElementById('filtroCliente')?.value || '').toLowerCase().trim();
    const filtroLocalCarga = (document.getElementById('filtroLocalCarga')?.value || '').toLowerCase().trim();
    const filtroMaterial = (document.getElementById('filtroMaterial')?.value || '').toLowerCase().trim();
    
    // Filtrar dados
    const dadosFiltrados = dadosHistoricoCompletos.filter(item => {
        const viatura = (item.viatura_motorista || '').toLowerCase();
        const cliente = (item.cliente || '').toLowerCase();
        const localCarga = (item.local_carga || '').toLowerCase();
        const material = (item.material || '').toLowerCase();
        
        const passaViatura = !filtroViatura || viatura.includes(filtroViatura);
        const passaCliente = !filtroCliente || cliente.includes(filtroCliente);
        const passaLocalCarga = !filtroLocalCarga || localCarga.includes(filtroLocalCarga);
        const passaMaterial = !filtroMaterial || material.includes(filtroMaterial);
        
        return passaViatura && passaCliente && passaLocalCarga && passaMaterial;
    });
    
    // Renderizar dados filtrados
    if (dadosFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty">Nenhum resultado encontrado com os filtros aplicados</td></tr>';
        return;
    }
    
    const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    tbody.innerHTML = dadosFiltrados.map(item => `
            <tr>
                <td>${esc(item.data_associacao)}</td>
                <td>${esc(item.viatura_motorista)}</td>
                <td>${esc(item.cliente)}</td>
                <td>${esc(item.local_carga)}</td>
                <td>${esc(item.local_descarga)}</td>
                <td>${esc(item.material)}</td>
                <td>${esc(item.observacoes)}</td>
                <td>${esc(formatarAvariaHistorico(item))}</td>
            </tr>
        `).join('');
}

function limparFiltrosHistorico() {
    document.getElementById('filtroViatura').value = '';
    document.getElementById('filtroCliente').value = '';
    document.getElementById('filtroLocalCarga').value = '';
    document.getElementById('filtroMaterial').value = '';
    aplicarFiltrosHistorico();
}

async function exportarHistorico() {
    try {
        const dataInicio = document.getElementById('historicoDataInicio').value;
        const dataFim = document.getElementById('historicoDataFim').value;
        
        // Usar dados filtrados se houver, senão carregar do servidor
        let dadosParaExportar = dadosHistoricoCompletos;
        
        // Aplicar filtros aos dados para exportação
        if (dadosParaExportar && dadosParaExportar.length > 0) {
            const filtroViatura = (document.getElementById('filtroViatura')?.value || '').toLowerCase().trim();
            const filtroCliente = (document.getElementById('filtroCliente')?.value || '').toLowerCase().trim();
            const filtroLocalCarga = (document.getElementById('filtroLocalCarga')?.value || '').toLowerCase().trim();
            const filtroMaterial = (document.getElementById('filtroMaterial')?.value || '').toLowerCase().trim();
            
            if (filtroViatura || filtroCliente || filtroLocalCarga || filtroMaterial) {
                dadosParaExportar = dadosParaExportar.filter(item => {
                    const viatura = (item.viatura_motorista || '').toLowerCase();
                    const cliente = (item.cliente || '').toLowerCase();
                    const localCarga = (item.local_carga || '').toLowerCase();
                    const material = (item.material || '').toLowerCase();
                    
                    const passaViatura = !filtroViatura || viatura.includes(filtroViatura);
                    const passaCliente = !filtroCliente || cliente.includes(filtroCliente);
                    const passaLocalCarga = !filtroLocalCarga || localCarga.includes(filtroLocalCarga);
                    const passaMaterial = !filtroMaterial || material.includes(filtroMaterial);
                    
                    return passaViatura && passaCliente && passaLocalCarga && passaMaterial;
                });
            }
        } else {
            // Se não há dados carregados, buscar do servidor
        const response = await fetch(`/api/historico-entregas?data_inicio=${dataInicio}&data_fim=${dataFim}`);
            dadosParaExportar = await response.json();
        }
        
        if (!dadosParaExportar || dadosParaExportar.length === 0) {
                alert('Nenhum dado para exportar');
                return;
            }
            
            // Criar workbook
            const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dadosParaExportar.map(item => ({
                'Data': item.data_associacao || '',
                'Viatura/Motorista': item.viatura_motorista || '',
                'Cliente': item.cliente || '',
                'Local de Carga': item.local_carga || '',
                'Local de Descarga': item.local_descarga || '',
                'Material': item.material || '',
                'Observações': item.observacoes || '',
                'Avaria/Alteração': formatarAvariaHistorico(item)
            })));
            
            XLSX.utils.book_append_sheet(wb, ws, 'Histórico');
            XLSX.writeFile(wb, `historico_${dataInicio}_${dataFim}.xlsx`);
    } catch (error) {
        console.error('Erro ao exportar histórico:', error);
        alert('Erro ao exportar histórico');
    }
}

// ==================== MODAL DE PEDIDOS ====================

function abrirModal(tipo) {
    document.getElementById('modalTitle').textContent = tipo === 'pendente' ? 'Adicionar Pedido Pendente' : 'Adicionar Pedido Entregue';
    document.getElementById('pedidoForm').reset();
    document.getElementById('pedidoTipo').value = tipo;  // Definir depois do reset para nao ser apagado
    
    // Carregar datalists da base de dados
    console.log('DEBUG - Carregando datalists ao abrir modal...');
    carregarClientesNoSelect();
    carregarMateriaisNoSelect();
    carregarLocaisCargaNoSelect();
    // Usar setTimeout para garantir que não há conflitos
    setTimeout(() => {
        carregarLocaisNoSelect(''); // Carregar todos os locais disponíveis
    }, 100);
    
    // Limpar campos de texto
    const inputCliente = document.getElementById('cliente');
    const inputLocal = document.getElementById('localDescarga');
    const inputMaterial = document.getElementById('material');
    const inputLocalCarga = document.getElementById('localCarga');
    
    if (inputCliente) inputCliente.value = '';
    if (inputLocal) inputLocal.value = '';
    if (inputMaterial) inputMaterial.value = '';
    if (inputLocalCarga) inputLocalCarga.value = '';
    
    // Adicionar listener para atualizar locais quando cliente mudar
    // Usar debounce para evitar múltiplas chamadas
    let timeoutLocais = null;
    if (inputCliente) {
        inputCliente.removeEventListener('input', atualizarLocaisPorCliente);
        inputCliente.addEventListener('input', function() {
            clearTimeout(timeoutLocais);
            timeoutLocais = setTimeout(() => {
                atualizarLocaisPorCliente();
                atualizarMateriaisPermitidos();
            }, 300); // Aguardar 300ms antes de atualizar
        });
    }
    var timeoutMateriais = null;
    function agendamentoMateriaisPermitidos() {
        clearTimeout(timeoutMateriais);
        timeoutMateriais = setTimeout(atualizarMateriaisPermitidos, 350);
    }
    if (inputLocal) {
        inputLocal.addEventListener('input', agendamentoMateriaisPermitidos);
        inputLocal.addEventListener('change', agendamentoMateriaisPermitidos);
    }
    if (inputLocalCarga) {
        inputLocalCarga.addEventListener('input', agendamentoMateriaisPermitidos);
        inputLocalCarga.addEventListener('change', agendamentoMateriaisPermitidos);
    }
    
    document.getElementById('pedidoModal').style.display = 'block';
    
    // Sugerir data de entrega padrão
    sugerirDataEntregaPadrao();
}

function fecharModal() {
    document.getElementById('pedidoModal').style.display = 'none';
    document.getElementById('pedidoForm').reset();
    // Limpar campos de busca
    const materialInput = document.getElementById('material');
    const materialSelecionado = document.getElementById('materialSelecionado');
    const materialLista = document.getElementById('materialLista');
    if (materialInput) materialInput.value = '';
    if (materialSelecionado) materialSelecionado.value = '';
    if (materialLista) materialLista.style.display = 'none';
    
    const localCargaInput = document.getElementById('cliente');
    const localCargaSelecionado = document.getElementById('localCargaSelecionado');
    const localCargaLista = document.getElementById('localCargaLista');
    if (localCargaInput) localCargaInput.value = '';
    if (localCargaSelecionado) localCargaSelecionado.value = '';
    if (localCargaLista) localCargaLista.style.display = 'none';
    
    const localInput = document.getElementById('localDescarga');
    const localSelecionado = document.getElementById('localDescargaSelecionado');
    const localLista = document.getElementById('localDescargaLista');
    if (localInput) localInput.value = '';
    if (localSelecionado) localSelecionado.value = '';
    if (localLista) localLista.style.display = 'none';
    // Se estava editando uma encomenda, remover seleção
    if (modoEdicaoEncomenda) {
        if (encomendaSelecionada && encomendaSelecionada.row) {
            encomendaSelecionada.row.classList.remove('encomenda-selecionada');
        }
        encomendaSelecionada = null;
    }
    // Resetar modo de edição
    modoEdicaoEncomenda = false;
    pedidoIdEditando = null;
}

function sugerirDataEntregaPadrao() {
    const dataPlaneamento = document.getElementById('dataPlaneamento').value;
    const campoEntrega = document.getElementById('dataEntrega');
    if (campoEntrega && !campoEntrega.value) {
        campoEntrega.value = dataPlaneamento || new Date().toISOString().split('T')[0];
    }
}

document.getElementById('pedidoForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Verificar se estamos em modo de edição
    if (modoEdicaoEncomenda && pedidoIdEditando) {
        // Modo de edição - atualizar pedido existente
        const clienteInput = document.getElementById('cliente');
        const localDescargaInput = document.getElementById('localDescarga');
        const materialInput = document.getElementById('material');
        const localCargaInput = document.getElementById('localCarga');
        
        const cliente = clienteInput ? clienteInput.value.trim() : '';
        const localDescarga = localDescargaInput ? localDescargaInput.value.trim() : '';
        const material = materialInput ? materialInput.value.trim() : '';
        const localCarga = localCargaInput ? localCargaInput.value.trim() : '';
        const observacoes = document.getElementById('observacoes').value.trim();
        const dataEntrega = document.getElementById('dataEntrega').value;
        
        if (!cliente) {
            alert('Por favor, digite ou selecione o Cliente!');
            clienteInput?.focus();
            return;
        }
        
        if (!localDescarga) {
            alert('Por favor, digite ou selecione o Local de Descarga!');
            localDescargaInput?.focus();
            return;
        }
        
        if (!material) {
            alert('Por favor, digite ou selecione o Material!');
            materialInput?.focus();
            return;
        }
        
        try {
            const response = await fetch(`/api/pedidos-pendentes/${pedidoIdEditando}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cliente: cliente,
                    local_carga: localCarga || cliente, // Se não especificado, usar o cliente
                    local_descarga: localDescarga,
                    material: material,
                    observacoes: observacoes,
                    data_entrega: dataEntrega
                })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                // Remover seleção
                if (encomendaSelecionada && encomendaSelecionada.row) {
                    encomendaSelecionada.row.classList.remove('encomenda-selecionada');
                }
                encomendaSelecionada = null;
                modoEdicaoEncomenda = false;
                pedidoIdEditando = null;
                
                fecharModal();
                await carregarEncomendasPendentesDia();
                alert('✅ Dados alterados com sucesso!');
            } else {
                alert('Erro ao alterar dados: ' + (result.error || 'Erro desconhecido'));
            }
        } catch (error) {
            console.error('Erro ao alterar dados:', error);
            alert('Erro ao alterar dados: ' + (error.message || 'Erro de conexão'));
        }
        return;
    }
    
    // Modo de criação - adicionar novo pedido (ler sempre do modal visível)
    const modal = document.getElementById('pedidoModal');
    const tipoEl = document.getElementById('pedidoTipo');
    const tipo = tipoEl ? tipoEl.value : '';
    const dataEntregaEl = document.getElementById('dataEntrega');
    const dataPlaneamentoEl = document.getElementById('dataPlaneamento');
    const dataEntrega = (dataEntregaEl && dataEntregaEl.value) ? dataEntregaEl.value : (dataPlaneamentoEl ? dataPlaneamentoEl.value : '');
    
    const clienteInput = modal ? modal.querySelector('#cliente') : document.getElementById('cliente');
    const localDescargaInput = modal ? modal.querySelector('#localDescarga') : document.getElementById('localDescarga');
    const materialInput = modal ? modal.querySelector('#material') : document.getElementById('material');
    const localCargaInput = modal ? modal.querySelector('#localCarga') : document.getElementById('localCarga');
    
    const cliente = (clienteInput && clienteInput.value) ? clienteInput.value.trim() : '';
    const localDescarga = (localDescargaInput && localDescargaInput.value) ? String(localDescargaInput.value).trim() : '';
    const material = (materialInput && materialInput.value) ? materialInput.value.trim() : '';
    const localCarga = (localCargaInput && localCargaInput.value) ? localCargaInput.value.trim() : '';
    const observacoes = (document.getElementById('observacoes') && document.getElementById('observacoes').value) ? document.getElementById('observacoes').value.trim() : '';
    const quantidadeStr = document.getElementById('quantidade') ? document.getElementById('quantidade').value : '1';
    let quantidade = parseInt(quantidadeStr, 10);
    if (isNaN(quantidade) || quantidade < 1) quantidade = 1;
    
    // Validação básica
    if (!cliente) {
        alert('Por favor, digite ou selecione o Cliente!');
        clienteInput?.focus();
        return;
    }
    
    if (!localDescarga) {
        alert('Por favor, digite ou selecione o Local de Descarga!');
        if (localDescargaInput) localDescargaInput.focus();
        return;
    }
    
    if (!material) {
        alert('Por favor, digite ou selecione o Material!');
        materialInput?.focus();
        return;
    }
    
    // Validar se os valores existem na base de dados (validação será feita no backend também)
    const clientesList = document.getElementById('clientesList');
    const locaisList = document.getElementById('locaisList');
    const materiaisList = document.getElementById('materiaisList');
    
    const clienteExiste = clientesList ? Array.from(clientesList.options).some(opt => opt.value === cliente) : true;
    const localExiste = locaisList ? Array.from(locaisList.options).some(opt => opt.value === localDescarga) : true;
    const materialExiste = materiaisList ? Array.from(materiaisList.options).some(opt => opt.value === material) : true;
    
    if (!clienteExiste || !localExiste || !materialExiste) {
        const mensagens = [];
        if (!clienteExiste) mensagens.push('Cliente');
        if (!localExiste) mensagens.push('Local de Descarga');
        if (!materialExiste) mensagens.push('Material');
        
        const confirmar = confirm(`⚠️ Atenção: ${mensagens.join(', ')} ${mensagens.length > 1 ? 'não estão' : 'não está'} na lista de valores cadastrados.\n\nO sistema validará no servidor. Deseja continuar?`);
        if (!confirmar) {
            return;
        }
    }
    
    // Payload com local_descarga explícito (exigido pelo backend)
    const dados = {
        cliente: cliente,
        local_descarga: localDescarga,
        local_carga: localCarga || cliente,
        material: material,
        observacoes: observacoes,
        data_entrega: dataEntrega,
        quantidade: quantidade
    };
    
    try {
        const endpoint = tipo === 'pendente' ? '/api/adicionar-pendente' : '/api/adicionar-entregue';
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        
        let result = {};
        try {
            result = await response.json();
        } catch (_) {
            result = { error: response.status === 401 ? 'Sessão expirada. Faça login novamente.' : 'Resposta inválida do servidor.' };
        }
        
        if (response.ok && result.success) {
            fecharModal();
            if (tipo === 'pendente') {
                await carregarPendentes();
                // Passar os registos criados (com local_descarga) para merge na lista
                await carregarEncomendasPendentesDia(true, result.criados || []);
            } else {
                await carregarEntregues();
            }
        } else {
            alert('Erro ao adicionar carga: ' + (result.error || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro ao adicionar pedido:', error);
        alert('Erro ao adicionar carga. Verifique a consola (F12) ou faça login novamente.');
    }
});

// ==================== FUNÇÕES DE VIATURA/MOTORISTA ====================

function abrirModalViaturaMotorista() {
    document.getElementById('viaturaMotoristaForm').reset();
    document.getElementById('viaturaMotoristaId').value = '';
    document.getElementById('viaturaMotoristaModal').style.display = 'block';
}

function fecharModalViaturaMotorista() {
    document.getElementById('viaturaMotoristaModal').style.display = 'none';
    document.getElementById('viaturaMotoristaForm').reset();
}

document.getElementById('viaturaMotoristaForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const id = document.getElementById('viaturaMotoristaId').value;
    const dados = {
        matricula: document.getElementById('vmMatricula').value.trim(),
        codigo: document.getElementById('vmCodigo').value.trim(),
        nome_motorista: document.getElementById('vmNome').value.trim()
    };
    
    if (!dados.matricula || !dados.codigo || !dados.nome_motorista) {
        alert('Todos os campos são obrigatórios!');
        return;
    }
    
    try {
        const url = id ? `/api/viatura-motorista/${id}` : '/api/viatura-motorista';
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            fecharModalViaturaMotorista();
            await carregarViaturasMotoristas();
        } else {
            alert('Erro ao salvar: ' + (result.error || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro ao salvar viatura/motorista:', error);
        alert('Erro ao salvar viatura/motorista');
    }
});

document.getElementById('statusForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const viaturaId = document.getElementById('statusViaturaId').value;
    const status = document.getElementById('statusSelect').value;
    const observacao = document.getElementById('statusObservacao').value;
    let dataInicio = document.getElementById('statusDataInicio').value;
    let dataFim = document.getElementById('statusDataFim').value;
    
    // Validar que viaturaId existe
    if (!viaturaId) {
        alert('Erro: ID da viatura não encontrado');
        return;
    }
    
    // Se for Férias, Baixa ou Outros trabalhos, validar datas
    if (status === 'Ferias' || status === 'Baixa' || status === 'OutrosTrabalhos') {
        // Se não houver datas, usar a data do planeamento (dia que o utilizador está a ver)
        const dataPredef = document.getElementById('dataPlaneamento') ? document.getElementById('dataPlaneamento').value : null;
        const dataFallback = dataPredef || new Date().toISOString().split('T')[0];
        if (!dataInicio) {
            dataInicio = dataFallback;
            document.getElementById('statusDataInicio').value = dataFallback;
        }
        
        if (!dataFim) {
            dataFim = dataFallback;
            document.getElementById('statusDataFim').value = dataFallback;
        }
        
        // Validar datas
        if (!dataInicio || !dataFim) {
            const tipoStatus = status === 'Ferias' ? 'férias' : (status === 'Baixa' ? 'baixa' : 'outros trabalhos');
            alert(`Por favor, preencha ambas as datas (início e fim ${status === 'OutrosTrabalhos' ? 'dos outros trabalhos' : 'da ' + tipoStatus})`);
            return;
        }
        
        if (dataInicio > dataFim) {
            alert('A data de início deve ser anterior ou igual à data de fim');
            return;
        }
    } else {
        // Se for Disponível, não precisa de datas
        dataInicio = null;
        dataFim = null;
    }
    
    try {
        // Preparar dados para envio
        const dadosEnvio = {
            status: status,
            observacao_status: observacao || null,
            data_inicio: dataInicio,
            data_fim: dataFim,
            data: document.getElementById('dataPlaneamento') ? document.getElementById('dataPlaneamento').value : new Date().toISOString().split('T')[0]
        };
        
        console.log('Enviando dados de status:', dadosEnvio);
        
        const response = await fetch(`/api/viatura-motorista/${viaturaId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dadosEnvio)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            let errorMsg = 'Erro desconhecido';
            try {
                const errorJson = JSON.parse(errorText);
                errorMsg = errorJson.error || errorText;
            } catch {
                errorMsg = errorText || `Erro ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMsg);
        }
        
        const result = await response.json();
        
        if (result.success) {
            fecharModalStatus();
            await carregarViaturasMotoristas();
        } else {
            throw new Error(result.error || 'Erro ao salvar');
        }
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        alert('Erro ao atualizar status: ' + (error.message || error));
    }
});

// Função removida - não é mais necessária pois sempre será Férias

// Materiais permitidos no modal de pedido (quando há cliente/local e/ou local de carga). null = mostrar todos (MATERIAIS_LISTA).
window._materiaisPermitidos = null;

// Lista de materiais disponíveis
const MATERIAIS_LISTA = [
    'Areia', 'Cimento AL', 'Cimento BL', 'Cimento Branco', 'Carbo 1000',
    'Filler', 'Soda', 'Cal viva', 'Gesso', 'Argamassa', 'Reboco', 'Cal',
    'lavar', 'Brita 1', 'Brita 2', 'Auto-nivelante', 'Ligante', 'Cimento', 'micro betão'
];

// Lista de clientes/locais de descarga disponíveis
const CLIENTES_LISTA = [
    'A.C Almeida', 'Alirações', 'Artebel uni. 1', 'Artebel uni. 2', 'Artecimel',
    'BA Vidro', 'Barreirinhas', 'Betão Liz - Alcantarilha', 'Betão Liz - Alcochete',
    'Betão Liz - Alfragide', 'Betão Liz - Alhandra', 'Betão Liz - Coimbra',
    'Betão Liz - Corroios', 'Betão Liz - Figueira da Foz', 'Betão Liz - Frielas',
    'Betão Liz - Leiria', 'Betão Liz - Loulé', 'Betão Liz - Loures',
    'Betão Liz - Mangualde', 'Betão Liz - Óbidos', 'Betão Liz - Pombal',
    'Betão Liz - Portela de Sintra', 'Betão Liz - Rio Maior', 'Betão Liz - Rio Tinto',
    'Betão Liz - Setúbal', 'Betão Liz - Tábua', 'Betão Liz - Vila Nova de Gaia',
    'Betão Liz - Viseu', 'Canas', 'Cano', 'Carbomin', 'Carbomin - Parapedra',
    'Central Alcácer do Sal', 'Central de Alenquer', 'Central de Almada',
    'Central de Caldas da Rainha', 'Central de Montemor-o-Novo', 'Central de Odiáxere',
    'Central de São Brás de Alportel', 'Central de Tojal', 'Central de Torres Vedras',
    'Cibra', 'Cimpor - Alhandra', 'Cimpor - Loulé', 'Cimpor - Souselas',
    'Colaliz - Aguada de Cima', 'Colaliz - Corroios', 'De Heus - Cartaxo',
    'Diera - Leça da Palmeira', 'Diera - Rio Maior', 'Diera - Santo Tirso',
    'Eco Impact - Ponte Sapatoa', 'F.V. Rações Gaeiras', 'Fassa', 'Fernando Brás',
    'Maquidias', 'Mater4', 'Mendes e Rodrigues', 'Microlime', 'Município do Redondo',
    'Nanta Alverca', 'Nanta Marco Canaveses', 'Nanta Ovar', 'Navigator - Setúbal',
    'Nelcarnes', 'Neves & Oliveira', 'Parapedra', 'Raporal (F.v)', 'Saisa', 'Secil',
    'Secil - Betão Caldas Da Rainha', 'Secil - Outão', 'Secil Betão Portalegre',
    'Secil Britas Escarpão', 'Secil Britas-Portimão', 'SecilTek - Cal e Argamassas',
    'SecilTek - Areias e Argamassas', 'SecilTek Montijo', 'SecilTek-Prébetão',
    'SEW-Eurodrive', 'Sifucel-Castelo Ventoso', 'Sifucel - Pataias', 'Sifucel Rio Maior',
    'SMAS Caldas Da Rainha', 'TMB', 'Trofa- De Heus', 'Vale Rodrigues', 'Vigobloco',
    'Raçalto', 'F.V. Arraiolos', 'CisterLuso', 'Nutritejo', 'Areipor', 'Rações Santiago',
    'Ribeiros-Beja', 'F.V. Benavente', 'Ribeira de Frades, Coimbra, Portugal',
    'Navigator - Fig. Da Foz', 'JMPC', 'SIAS', 'Saint Gobain-Weber Carregado',
    'F.V. Carregado', 'Liveplace - Palegessos', 'Liveplace-Viseu-Palegessos',
    'TMPB Poço do Bispo', 'CJR'
];

// Função para filtrar e mostrar lista de materiais (usa _materiaisPermitidos quando definido)
function listaMateriaisParaAutocomplete() {
    if (window._materiaisPermitidos && window._materiaisPermitidos.length) {
        return window._materiaisPermitidos.map(function (m) { return (m.nome || m).toString(); });
    }
    return MATERIAIS_LISTA;
}

// Função para filtrar e mostrar lista de materiais
function filtrarMateriais(busca) {
    const materialInput = document.getElementById('material');
    const materialLista = document.getElementById('materialLista');
    const materialSelecionado = document.getElementById('materialSelecionado');
    
    if (!materialInput || !materialLista) return;
    
    const buscaLower = busca.toLowerCase().trim();
    const materiaisDisponiveis = listaMateriaisParaAutocomplete();
    
    if (!buscaLower) {
        materialLista.style.display = 'none';
        if (materialSelecionado) materialSelecionado.value = '';
        return;
    }
    
    // Filtrar materiais que contêm o texto digitado
    const materiaisFiltrados = materiaisDisponiveis.filter(m => 
        m.toLowerCase().includes(buscaLower)
    );
    
    // Verificar se há correspondência exata
    const correspondeExato = materiaisDisponiveis.some(m => String(m).toLowerCase() === buscaLower);
    
    // Se não encontrou nenhum, mostrar apenas "Outros"
    if (materiaisFiltrados.length === 0) {
        const buscaEscapada = busca.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        materialLista.innerHTML = `
            <div class="material-lista-item outros" onclick="selecionarMaterial('Outros', '${buscaEscapada}')">
                Outros: ${busca}
            </div>
        `;
        materialLista.style.display = 'block';
        return;
    }
    
    // Mostrar materiais filtrados
    let html = '';
    materiaisFiltrados.forEach(material => {
        const materialEscapado = material.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        html += `<div class="material-lista-item" onclick="selecionarMaterial('${materialEscapado}', '')">${material}</div>`;
    });
    
    // Adicionar "Outros" se não houver correspondência exata
    if (!correspondeExato) {
        const buscaEscapada = busca.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        html += `<div class="material-lista-item outros" onclick="selecionarMaterial('Outros', '${buscaEscapada}')">Outros: ${busca}</div>`;
    }
    
    materialLista.innerHTML = html;
    materialLista.style.display = 'block';
}

function mostrarListaMateriais() {
    const materialInput = document.getElementById('material');
    const materialLista = document.getElementById('materialLista');
    
    if (!materialInput || !materialLista) return;
    
    if (materialInput.value.trim()) {
        filtrarMateriais(materialInput.value);
    } else {
        // Mostrar todos os materiais (permitidos ou lista fixa)
        const materiaisDisponiveis = listaMateriaisParaAutocomplete();
        let html = '';
        materiaisDisponiveis.forEach(material => {
            const nome = typeof material === 'string' ? material : (material.nome || '');
            const materialEscapado = nome.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            html += `<div class="material-lista-item" onclick="selecionarMaterial('${materialEscapado}', '')">${nome}</div>`;
        });
        materialLista.innerHTML = html;
        materialLista.style.display = 'block';
        // Resetar highlight quando mostrar lista
        autocompleteHighlightIndex = -1;
    }
}

function esconderListaMateriais() {
    // Pequeno delay para permitir clique na lista
    setTimeout(() => {
        const materialLista = document.getElementById('materialLista');
        if (materialLista) {
            materialLista.style.display = 'none';
        }
    }, 200);
}

function selecionarMaterial(material, valorOutros) {
    const materialInput = document.getElementById('material');
    const materialSelecionado = document.getElementById('materialSelecionado');
    const materialLista = document.getElementById('materialLista');
    
    if (material === 'Outros') {
        const valorFinal = valorOutros || materialInput.value.trim() || 'Outros';
        materialInput.value = valorFinal;
        materialSelecionado.value = valorFinal;
    } else {
        materialInput.value = material;
        materialSelecionado.value = material;
    }
    
    if (materialLista) {
        materialLista.style.display = 'none';
        // Limpar highlight
        const items = materialLista.querySelectorAll('.material-lista-item');
        items.forEach(item => item.classList.remove('highlighted'));
    }
    
    // Resetar índice de highlight
    autocompleteHighlightIndex = -1;
    
    // Mover foco para o próximo campo (Data Entrega)
    setTimeout(() => {
        const dataEntrega = document.getElementById('dataEntrega');
        if (dataEntrega) {
            dataEntrega.focus();
        }
    }, 50);
}

// Variáveis globais para controle de navegação por teclado
let autocompleteHighlightIndex = -1;
let autocompleteCurrentList = null;
let autocompleteCurrentType = null;

// Função genérica para lidar com navegação por teclado
function handleAutocompleteKeydown(event, tipo) {
    let listaId, selecionarFn;
    
    switch(tipo) {
        case 'material':
            listaId = 'materialLista';
            selecionarFn = (index) => {
                const lista = document.getElementById(listaId);
                if (!lista) return;
                const items = lista.querySelectorAll('.material-lista-item');
                if (items[index]) {
                    const onclick = items[index].getAttribute('onclick');
                    if (onclick) {
                        // Extrair os parâmetros do onclick
                        const match = onclick.match(/selecionarMaterial\('([^']*)',\s*'([^']*)'\)/);
                        if (match) {
                            selecionarMaterial(match[1], match[2]);
                        }
                    }
                }
            };
            break;
        case 'localCarga':
            listaId = 'localCargaLista';
            selecionarFn = (index) => {
                const lista = document.getElementById(listaId);
                if (!lista) return;
                const items = lista.querySelectorAll('.material-lista-item');
                if (items[index]) {
                    const onclick = items[index].getAttribute('onclick');
                    if (onclick) {
                        const match = onclick.match(/selecionarLocalCarga\('([^']*)',\s*'([^']*)'\)/);
                        if (match) {
                            selecionarLocalCarga(match[1], match[2]);
                        }
                    }
                }
            };
            break;
        case 'localDescarga':
            listaId = 'localDescargaLista';
            selecionarFn = (index) => {
                const lista = document.getElementById(listaId);
                if (!lista) return;
                const items = lista.querySelectorAll('.material-lista-item');
                if (items[index]) {
                    const onclick = items[index].getAttribute('onclick');
                    if (onclick) {
                        const match = onclick.match(/selecionarLocalDescarga\('([^']*)',\s*'([^']*)'\)/);
                        if (match) {
                            selecionarLocalDescarga(match[1], match[2]);
                        }
                    }
                }
            };
            break;
        default:
            return;
    }
    
    const lista = document.getElementById(listaId);
    if (!lista || lista.style.display === 'none') {
        autocompleteHighlightIndex = -1;
        return;
    }
    
    const items = lista.querySelectorAll('.material-lista-item');
    if (items.length === 0) return;
    
    // Atualizar referências globais
    autocompleteCurrentList = lista;
    autocompleteCurrentType = tipo;
    
    switch(event.key) {
        case 'ArrowDown':
            event.preventDefault();
            autocompleteHighlightIndex = (autocompleteHighlightIndex + 1) % items.length;
            updateHighlight(lista, items, autocompleteHighlightIndex);
            break;
        case 'ArrowUp':
            event.preventDefault();
            autocompleteHighlightIndex = autocompleteHighlightIndex <= 0 ? items.length - 1 : autocompleteHighlightIndex - 1;
            updateHighlight(lista, items, autocompleteHighlightIndex);
            break;
        case 'Enter':
            event.preventDefault();
            if (autocompleteHighlightIndex >= 0 && autocompleteHighlightIndex < items.length) {
                selecionarFn(autocompleteHighlightIndex);
            }
            break;
        case 'Tab':
            // Tab só seleciona se houver um item destacado
            if (autocompleteHighlightIndex >= 0 && autocompleteHighlightIndex < items.length) {
                event.preventDefault();
                selecionarFn(autocompleteHighlightIndex);
            }
            // Se não houver item destacado, deixa o Tab funcionar normalmente (navegar para próximo campo)
            break;
        case 'Escape':
            event.preventDefault();
            lista.style.display = 'none';
            autocompleteHighlightIndex = -1;
            items.forEach(item => item.classList.remove('highlighted'));
            break;
    }
}

function updateHighlight(lista, items, index) {
    items.forEach((item, i) => {
        if (i === index) {
            item.classList.add('highlighted');
            // Scroll para o item destacado
            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
            item.classList.remove('highlighted');
        }
    });
}

// Funções para filtrar e mostrar lista de locais de carga
function filtrarLocaisCarga(busca) {
    const localCargaInput = document.getElementById('cliente');
    const localCargaLista = document.getElementById('localCargaLista');
    const localCargaSelecionado = document.getElementById('localCargaSelecionado');
    
    if (!localCargaInput || !localCargaLista) return;
    
    const buscaLower = busca.toLowerCase().trim();
    
    if (!buscaLower) {
        localCargaLista.style.display = 'none';
        if (localCargaSelecionado) localCargaSelecionado.value = '';
        return;
    }
    
    // Filtrar locais de carga que contêm o texto digitado
    const locaisFiltrados = CLIENTES_LISTA.filter(c => 
        c.toLowerCase().includes(buscaLower)
    );
    
    // Verificar se há correspondência exata
    const correspondeExato = CLIENTES_LISTA.some(c => c.toLowerCase() === buscaLower);
    
    // Se não encontrou nenhum, mostrar apenas "Outros"
    if (locaisFiltrados.length === 0) {
        const buscaEscapada = busca.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        localCargaLista.innerHTML = `
            <div class="material-lista-item outros" onclick="selecionarLocalCarga('Outros', '${buscaEscapada}')">
                Outros: ${busca}
            </div>
        `;
        localCargaLista.style.display = 'block';
        return;
    }
    
    // Mostrar locais de carga filtrados
    let html = '';
    locaisFiltrados.forEach(local => {
        const localEscapado = local.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        html += `<div class="material-lista-item" onclick="selecionarLocalCarga('${localEscapado}', '')">${local}</div>`;
    });
    
    // Adicionar "Outros" se não houver correspondência exata
    if (!correspondeExato) {
        const buscaEscapada = busca.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        html += `<div class="material-lista-item outros" onclick="selecionarLocalCarga('Outros', '${buscaEscapada}')">Outros: ${busca}</div>`;
    }
    
    localCargaLista.innerHTML = html;
    localCargaLista.style.display = 'block';
    // Resetar highlight quando filtrar
    autocompleteHighlightIndex = -1;
}

function mostrarListaLocaisCarga() {
    const localCargaInput = document.getElementById('cliente');
    const localCargaLista = document.getElementById('localCargaLista');
    
    if (!localCargaInput || !localCargaLista) return;
    
    if (localCargaInput.value.trim()) {
        filtrarLocaisCarga(localCargaInput.value);
    } else {
        // Mostrar todos os locais de carga
        let html = '';
        CLIENTES_LISTA.forEach(local => {
            const localEscapado = local.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            html += `<div class="material-lista-item" onclick="selecionarLocalCarga('${localEscapado}', '')">${local}</div>`;
        });
        localCargaLista.innerHTML = html;
        localCargaLista.style.display = 'block';
        // Resetar highlight quando mostrar lista
        autocompleteHighlightIndex = -1;
    }
}

function esconderListaLocaisCarga() {
    setTimeout(() => {
        const localCargaLista = document.getElementById('localCargaLista');
        if (localCargaLista) {
            localCargaLista.style.display = 'none';
        }
    }, 200);
}

function selecionarLocalCarga(local, valorOutros) {
    const localCargaInput = document.getElementById('cliente');
    const localCargaSelecionado = document.getElementById('localCargaSelecionado');
    const localCargaLista = document.getElementById('localCargaLista');
    
    if (local === 'Outros') {
        const valorFinal = valorOutros || localCargaInput.value.trim() || 'Outros';
        localCargaInput.value = valorFinal;
        localCargaSelecionado.value = valorFinal;
    } else {
        localCargaInput.value = local;
        localCargaSelecionado.value = local;
    }
    
    if (localCargaLista) {
        localCargaLista.style.display = 'none';
        // Limpar highlight
        const items = localCargaLista.querySelectorAll('.material-lista-item');
        items.forEach(item => item.classList.remove('highlighted'));
    }
    
    // Resetar índice de highlight
    autocompleteHighlightIndex = -1;
    
    // Mover foco para o próximo campo (Cliente)
    setTimeout(() => {
        const clienteInput = document.getElementById('localDescarga');
        if (clienteInput) {
            clienteInput.focus();
        }
    }, 50);
}

// Funções para filtrar e mostrar lista de locais de descarga (Cliente)
function filtrarLocaisDescarga(busca) {
    const localInput = document.getElementById('localDescarga');
    const localLista = document.getElementById('localDescargaLista');
    const localSelecionado = document.getElementById('localDescargaSelecionado');
    
    if (!localInput || !localLista) return;
    
    const buscaLower = busca.toLowerCase().trim();
    
    if (!buscaLower) {
        localLista.style.display = 'none';
        if (localSelecionado) localSelecionado.value = '';
        return;
    }
    
    // Filtrar locais que contêm o texto digitado
    const locaisFiltrados = CLIENTES_LISTA.filter(l => 
        l.toLowerCase().includes(buscaLower)
    );
    
    // Verificar se há correspondência exata
    const correspondeExato = CLIENTES_LISTA.some(l => l.toLowerCase() === buscaLower);
    
    // Se não encontrou nenhum, mostrar apenas "Outros"
    if (locaisFiltrados.length === 0) {
        const buscaEscapada = busca.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        localLista.innerHTML = `
            <div class="material-lista-item outros" onclick="selecionarLocalDescarga('Outros', '${buscaEscapada}')">
                Outros: ${busca}
            </div>
        `;
        localLista.style.display = 'block';
        return;
    }
    
    // Mostrar locais filtrados
    let html = '';
    locaisFiltrados.forEach(local => {
        const localEscapado = local.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        html += `<div class="material-lista-item" onclick="selecionarLocalDescarga('${localEscapado}', '')">${local}</div>`;
    });
    
    // Adicionar "Outros" se não houver correspondência exata
    if (!correspondeExato) {
        const buscaEscapada = busca.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        html += `<div class="material-lista-item outros" onclick="selecionarLocalDescarga('Outros', '${buscaEscapada}')">Outros: ${busca}</div>`;
    }
    
    localLista.innerHTML = html;
    localLista.style.display = 'block';
    // Resetar highlight quando filtrar
    autocompleteHighlightIndex = -1;
}

function mostrarListaLocaisDescarga() {
    const localInput = document.getElementById('localDescarga');
    const localLista = document.getElementById('localDescargaLista');
    
    if (!localInput || !localLista) return;
    
    if (localInput.value.trim()) {
        filtrarLocaisDescarga(localInput.value);
    } else {
        // Mostrar todos os locais
        let html = '';
        CLIENTES_LISTA.forEach(local => {
            const localEscapado = local.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            html += `<div class="material-lista-item" onclick="selecionarLocalDescarga('${localEscapado}', '')">${local}</div>`;
        });
        localLista.innerHTML = html;
        localLista.style.display = 'block';
        // Resetar highlight quando mostrar lista
        autocompleteHighlightIndex = -1;
    }
}

function esconderListaLocaisDescarga() {
    setTimeout(() => {
        const localLista = document.getElementById('localDescargaLista');
        if (localLista) {
            localLista.style.display = 'none';
        }
    }, 200);
}

function selecionarLocalDescarga(local, valorOutros) {
    const localInput = document.getElementById('localDescarga');
    const localSelecionado = document.getElementById('localDescargaSelecionado');
    const localLista = document.getElementById('localDescargaLista');
    
    if (local === 'Outros') {
        const valorFinal = valorOutros || localInput.value.trim() || 'Outros';
        localInput.value = valorFinal;
        localSelecionado.value = valorFinal;
    } else {
        localInput.value = local;
        localSelecionado.value = local;
    }
    
    if (localLista) {
        localLista.style.display = 'none';
        // Limpar highlight
        const items = localLista.querySelectorAll('.material-lista-item');
        items.forEach(item => item.classList.remove('highlighted'));
    }
    
    // Resetar índice de highlight
    autocompleteHighlightIndex = -1;
    
    // Mover foco para o próximo campo (Material)
    setTimeout(() => {
        const materialInput = document.getElementById('material');
        if (materialInput) {
            materialInput.focus();
        }
    }, 50);
}

function adicionarViaturaMotorista() {
    abrirModalViaturaMotorista();
}

function adicionarPedido(tipo) {
    abrirModal(tipo);
}

async function removerEncomendaAtribuida(atribuicaoId, pedidoId, pedidoTipo, viaturaId) {
    if (!confirm('Tem certeza que deseja remover esta atribuição?')) {
        return;
    }
    
    try {
        const data = document.getElementById('dataPlaneamento').value;
        
        // Se for data anterior e o código foi desbloqueado, enviar o código
        let codigoAutorizacao = null;
        const isAnterior = isDataAnterior(data);
        if (isAnterior && codigoDesbloqueioAtivo) {
            codigoAutorizacao = CODIGO_SECRETO;
        }
        
        let response = await fetch(`/api/remover-atribuicao/${atribuicaoId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ codigo_autorizacao: codigoAutorizacao })
        });
        
        let result = await response.json();
        
        // Se o servidor pedir código e ainda não temos desbloqueado, usar modal
        if (response.status === 403 && result.error && (result.error.includes('1990') || result.error.includes('código de autorização') || result.error.includes('autorização'))) {
            // Se já temos o código desbloqueado, usar diretamente
            if (!codigoDesbloqueioAtivo) {
                // Abrir modal para pedir código
                abrirModalCodigoAutorizacao();
                return; // Cancelar esta operação, o utilizador pode tentar novamente depois de desbloquear
            } else {
                codigoAutorizacao = CODIGO_SECRETO;
            }
            
            // Tentar novamente com o código
            response = await fetch(`/api/remover-atribuicao/${atribuicaoId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ codigo_autorizacao: codigoAutorizacao })
            });
            result = await response.json();
        }
        
        if (response.ok && result.success) {
            await carregarEncomendasPendentesDia();
            await carregarViaturasMotoristas();
        } else {
            const errorMsg = result.error || 'Erro desconhecido';
            console.error('Erro ao remover atribuição:', errorMsg, result);
            alert('Erro ao remover atribuição: ' + errorMsg);
        }
    } catch (error) {
        console.error('Erro ao remover atribuição:', error);
        alert('Erro ao remover atribuição: ' + (error.message || 'Erro de conexão'));
    }
}

function pedirCodigoAutorizacao(mensagemErro) {
    return new Promise((resolve) => {
        const codigo = prompt(mensagemErro + '\n\nDigite o código de autorização:');
        resolve(codigo);
    });
}

// ==================== RESUMO DO DIA SEGUINTE (EMAIL OU DESCARREGAR) ====================

function descarregarResumoDia() {
    const dataInput = document.getElementById('dataPlaneamento');
    const data = dataInput ? dataInput.value : new Date().toISOString().split('T')[0];
    if (!data) {
        alert('Por favor, selecione uma data primeiro.');
        return;
    }
    window.location.href = '/api/resumo-dia-download?data=' + encodeURIComponent(data);
}

async function enviarResumoDiaEmail() {
    const dataInput = document.getElementById('dataPlaneamento');
    const data = dataInput ? dataInput.value : new Date().toISOString().split('T')[0];
    if (!data) {
        alert('Por favor, selecione uma data primeiro.');
        return;
    }
    var destinatarios = [];
    const btn = event && event.target;
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ A enviar...';
    }
    try {
        // 1) Tentar envio automático (usa EMAIL_RESUMO_DESTINO do servidor se estiver configurado)
        var body = { data: data };
        var response = await fetch('/api/enviar-resumo-dia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        var result = await response.json().catch(function() { return {}; });
        if (response.ok && result.success) {
            alert(result.message || 'Resumo do dia seguinte enviado por email com sucesso.');
            return;
        }
        if (response.status === 400 && result.error && result.error.indexOf('Nenhum destinatário') !== -1) {
            var emailsStr = prompt('Indique o(s) email(s) destinatário(s), separados por vírgula:', '');
            if (emailsStr === null) { return; }
            destinatarios = emailsStr.split(/[,;]/).map(function(e) { return e.trim(); }).filter(Boolean);
            if (destinatarios.length === 0) {
                alert('Tem de indicar pelo menos um email destinatário.');
                return;
            }
            body.destinatarios = destinatarios;
            response = await fetch('/api/enviar-resumo-dia', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            result = await response.json().catch(function() { return {}; });
        }
        if (response.ok && result.success) {
            alert(result.message || 'Resumo do dia seguinte enviado por email com sucesso.');
            return;
        }
        alert('Erro ao enviar resumo: ' + (result.error || response.statusText || 'Erro desconhecido'));
    } catch (err) {
        console.error(err);
        alert('Erro ao enviar resumo: ' + (err.message || 'Sem ligação ao servidor'));
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '📧 Resumo por email';
        }
    }
}

// ==================== ENVIAR PARA WIALONG ====================

async function enviarParaWialong() {
    const btnOriginal = event.target;
    const btnText = btnOriginal.innerHTML;
    
    try {
        const data = document.getElementById('dataPlaneamento').value;
        if (!data) {
            alert('Por favor, selecione uma data primeiro.');
            return;
        }
        
        // Criar input de ficheiro invisível
        const inputFile = document.createElement('input');
        inputFile.type = 'file';
        inputFile.accept = '.xlsx,.xlsm';
        inputFile.style.display = 'none';
        
        // Quando o utilizador selecionar o ficheiro
        inputFile.onchange = async function(e) {
            const ficheiro = e.target.files[0];
            if (!ficheiro) {
                btnOriginal.disabled = false;
                btnOriginal.innerHTML = btnText;
                return;
            }
            
            // Mostrar mensagem de carregamento
            btnOriginal.disabled = true;
            btnOriginal.innerHTML = '⏳ A processar...';
            
            // Criar FormData para enviar ficheiro
            const formData = new FormData();
            formData.append('ficheiro', ficheiro);
            formData.append('data', data);
            
            try {
                const response = await fetch('/api/atualizar-wialong-upload', {
                    method: 'POST',
                    body: formData
                });
                
                // Verificar se a resposta é um ficheiro (download) ou JSON (erro)
                const contentType = response.headers.get('content-type') || '';
                
                if (response.ok && contentType.includes('application/vnd.openxmlformats')) {
                    // Ficheiro processado - fazer download
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Wialong_atualizado_${data}.${ficheiro.name.split('.').pop()}`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    
                    alert('✅ Ficheiro Wialong processado e descarregado com sucesso!');
                } else {
                    // Erro - ler como texto primeiro (pode ser HTML de erro)
                    const text = await response.text();
                    let errorMsg = 'Erro desconhecido';
                    
                    if (response.status === 404) {
                        errorMsg = 'Endpoint não encontrado (404).\n\nPor favor:\n1. Pare o servidor Flask (Ctrl+C)\n2. Reinicie o servidor\n3. Recarregue esta página (Ctrl+F5)';
                    } else {
                        // Tentar parsear como JSON
                        try {
                            const result = JSON.parse(text);
                            errorMsg = result.error || 'Erro desconhecido';
                        } catch (jsonError) {
                            // Não é JSON, é HTML de erro
                            console.error('Resposta do servidor (HTML):', text.substring(0, 500));
                            if (text.includes('<!doctype') || text.includes('<html')) {
                                errorMsg = `Erro do servidor (${response.status}). O servidor retornou uma página de erro HTML.\n\nVerifique o terminal do servidor para mais detalhes.`;
                            } else {
                                errorMsg = `Erro do servidor (${response.status}): ${text.substring(0, 200)}`;
                            }
                        }
                    }
                    alert('❌ Erro ao processar ficheiro:\n\n' + errorMsg);
                }
            } catch (error) {
                console.error('Erro ao enviar ficheiro:', error);
                alert('❌ Erro ao enviar ficheiro:\n\n' + error.message + '\n\nVerifique a consola (F12) para mais detalhes.');
            } finally {
                // Restaurar botão
                btnOriginal.disabled = false;
                btnOriginal.innerHTML = btnText;
            }
        };
        
        // Adicionar ao DOM e clicar
        document.body.appendChild(inputFile);
        inputFile.click();
        document.body.removeChild(inputFile);
        
        return; // Sair aqui - o resto será feito no onchange
        
    } catch (error) {
        // Restaurar botão em caso de erro
        btnOriginal.disabled = false;
        btnOriginal.innerHTML = btnText;
        
        console.error('Erro ao enviar para Wialong:', error);
        let errorMsg = 'Erro de conexão';
        if (error.message) {
            errorMsg = error.message;
        } else if (error.toString) {
            errorMsg = error.toString();
        }
        alert('❌ Erro ao enviar para Wialong:\n\n' + errorMsg + '\n\nVerifique a consola do navegador (F12) para mais detalhes.');
    }
}

// ==================== FUNÇÕES DE DRAG CARD ====================

let draggedCard = null;

function handleDragCardStart(e, viaturaId) {
    draggedCard = viaturaId;
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragCardEnd(e) {
    draggedCard = null;
}

function handleDragCardOver(e) {
    if (draggedCard) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }
}

function handleDragCardDrop(e, viaturaIdDestino) {
    if (!draggedCard || draggedCard === viaturaIdDestino) {
        return;
    }
    
    e.preventDefault();
    
    // Reordenar viaturas
    fetch('/api/viatura-motorista/reordenar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            viatura_id_origem: draggedCard,
            viatura_id_destino: viaturaIdDestino
        })
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            carregarViaturasMotoristas();
        } else {
            alert('Erro ao reordenar: ' + (result.error || 'Erro desconhecido'));
        }
    })
    .catch(error => {
        console.error('Erro ao reordenar:', error);
        alert('Erro ao reordenar viaturas');
    });
}

// ==================== FUNÇÕES DE CONTEXTO ====================

// Variável para guardar a encomenda selecionada
let encomendaSelecionada = null;

async function togglePrioridadeEncomenda(pedidoId, marcarComoPrioridade) {
    try {
        const response = await fetch(`/api/pedidos-pendentes/${pedidoId}?prioridade=${marcarComoPrioridade ? 1 : 0}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prioridade: marcarComoPrioridade })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            await carregarEncomendasPendentesDia();
        } else {
            alert('Erro: ' + (result.error || 'Não foi possível alterar a prioridade'));
        }
    } catch (error) {
        console.error('Erro ao alterar prioridade:', error);
        alert('Erro ao alterar prioridade');
    }
}

function mostrarContextMenu(event, pedidoId, dataEntrega, isPrioridade) {
    event.preventDefault();
    event.stopPropagation();
    
    const row = event.target.closest('tr');
    if (!row) return;
    
    document.querySelectorAll('#encomendasPendentesBody tr').forEach(r => {
        r.classList.remove('encomenda-selecionada');
    });
    
    row.classList.add('encomenda-selecionada');
    encomendaSelecionada = {
        id: pedidoId,
        dataEntrega: dataEntrega,
        row: row
    };
    
    const menuAnterior = document.getElementById('contextMenuEncomenda');
    if (menuAnterior) menuAnterior.remove();
    
    const prioridade = isPrioridade === true || (typeof isPrioridade === 'undefined' && row.getAttribute('data-prioridade') === '1');
    const labelPrioridade = prioridade ? 'Remover prioridade' : '⭐ Marcar como prioridade';
    
    const menu = document.createElement('div');
    menu.id = 'contextMenuEncomenda';
    menu.className = 'context-menu';
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';
    menu.style.zIndex = '10001';
    
    menu.innerHTML = `
        <div class="context-menu-item" onclick="togglePrioridadeEncomenda(${pedidoId}, ${prioridade ? 'false' : 'true'}); fecharMenuContexto();">${prioridade ? '↩️ ' : ''}${labelPrioridade}</div>
        <div class="context-menu-item" onclick="alterarDataEncomenda(${pedidoId}); fecharMenuContexto();">📅 Alterar Data</div>
        <div class="context-menu-item" onclick="alterarDadosEncomenda(${pedidoId}); fecharMenuContexto();">✏️ Alterar Dados Encomenda</div>
        <div class="context-menu-item" onclick="apagarEncomenda(${pedidoId}); fecharMenuContexto();" style="color: #d32f2f;">🗑️ Apagar Encomenda</div>
    `;
    
    document.body.appendChild(menu);
    
    // Função para fechar o menu e remover seleção
    window.fecharMenuContexto = function() {
        const menuEl = document.getElementById('contextMenuEncomenda');
        if (menuEl) {
            menuEl.remove();
        }
        // Remover seleção visual quando fechar o menu
        if (encomendaSelecionada && encomendaSelecionada.row) {
            encomendaSelecionada.row.classList.remove('encomenda-selecionada');
        }
        encomendaSelecionada = null;
    };
    
    // Fechar menu ao clicar fora ou ao clicar em qualquer item
    const fecharMenu = (e) => {
        // Não fechar se clicar dentro do menu
        if (menu.contains(e.target)) {
            return;
        }
        fecharMenuContexto();
        document.removeEventListener('click', fecharMenu);
        document.removeEventListener('contextmenu', fecharMenu);
    };
    
    // Fechar após um pequeno delay para permitir o clique no item
    setTimeout(() => {
        document.addEventListener('click', fecharMenu, { once: false });
        document.addEventListener('contextmenu', fecharMenu, { once: false });
    }, 100);
}

function mostrarContextMenuPlaneamento(event, planeamentoId) {
    // Implementar menu de contexto se necessário
}

// Estado do modal de avaria (para poder guardar depois de o utilizador escrever a observação)
let avariaModalAtribuicaoId = null;
let avariaModalMarcar = false;

function abrirModalAvaria(atribuicaoId, marcar) {
    try {
        const menu = document.getElementById('contextMenuMotorista');
        if (menu) menu.remove();
        avariaModalAtribuicaoId = parseInt(atribuicaoId, 10);
        avariaModalMarcar = !!marcar;
        const modal = document.getElementById('avariaModal');
        if (modal) {
            modal.style.display = 'block';
            modal.style.visibility = 'visible';
            modal.style.zIndex = '10000';
            const input = document.getElementById('avariaObservacaoInput');
            if (input) {
                input.value = '';
                setTimeout(function() { input.focus(); }, 50);
            }
            return;
        }
        // Fallback se o modal não existir no DOM (ex.: cache antigo)
        const observacao = prompt('Observação (opcional) - ex.: atrelou outro trator, avaria a meio do serviço.', '') || '';
        if (observacao !== null) {
            guardarAvariaObservacaoComValores(atribuicaoId, true, observacao);
        }
    } catch (e) {
        console.error('abrirModalAvaria:', e);
        alert('Erro ao abrir o formulário de avaria. Tente recarregar a página.');
    }
}

function fecharModalAvaria() {
    avariaModalAtribuicaoId = null;
    avariaModalMarcar = false;
    const input = document.getElementById('avariaObservacaoInput');
    if (input) input.value = '';
    const modal = document.getElementById('avariaModal');
    if (modal) {
        modal.style.display = 'none';
        modal.style.zIndex = '';
    }
}

// Estado do modal da NOTA da avaria (observação não se altera, só a nota)
let avariaNotaModalAtribuicaoId = null;
let avariaNotaModalObservacao = '';

/** Clique direito no badge da avaria: abre o modal para adicionar ou editar a NOTA (a observação fica só de leitura). */
function abrirModalAvariaNota(event) {
    const badge = event.target && event.target.classList && event.target.classList.contains('card-avaria-alteracao')
        ? event.target
        : (event.target && event.target.closest ? event.target.closest('.card-avaria-alteracao') : null);
    if (!badge) return;
    const atribuicaoId = badge.getAttribute('data-atribuicao-id');
    const observacaoAtual = badge.getAttribute('data-avaria-observacao') || '';
    const notaAtual = badge.getAttribute('data-avaria-nota') || '';
    if (!atribuicaoId) return;
    avariaNotaModalAtribuicaoId = parseInt(atribuicaoId, 10);
    avariaNotaModalObservacao = observacaoAtual;
    const elObservacao = document.getElementById('avariaNotaModalObservacao');
    if (elObservacao) elObservacao.textContent = observacaoAtual || '(sem observação)';
    const inputNota = document.getElementById('avariaNotaInput');
    if (inputNota) {
        inputNota.value = notaAtual;
        inputNota.focus();
    }
    const modal = document.getElementById('avariaNotaModal');
    if (modal) {
        modal.style.display = 'block';
        modal.style.visibility = 'visible';
        modal.style.zIndex = '10000';
        setTimeout(function() { if (inputNota) inputNota.focus(); }, 50);
    }
}

function fecharModalAvariaNota() {
    avariaNotaModalAtribuicaoId = null;
    avariaNotaModalObservacao = '';
    const input = document.getElementById('avariaNotaInput');
    if (input) input.value = '';
    const modal = document.getElementById('avariaNotaModal');
    if (modal) { modal.style.display = 'none'; modal.style.zIndex = ''; }
}

async function guardarAvariaNota() {
    const id = avariaNotaModalAtribuicaoId;
    if (id == null || isNaN(id) || id <= 0) { fecharModalAvariaNota(); return; }
    const inputNota = document.getElementById('avariaNotaInput');
    const nota = (inputNota && inputNota.value) ? inputNota.value.trim() : '';
    fecharModalAvariaNota();
    const body = JSON.stringify({ avaria: true, avaria_observacao: avariaNotaModalObservacao, avaria_nota: nota });
    const urls = [`/api/atribuicao/${id}/avaria`, `/api/atribuicoes-motoristas/${id}/avaria`];
    for (const url of urls) {
        try {
            const response = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: body });
            const data = await response.json().catch(() => ({}));
            if (response.status === 404) continue;
            if (!response.ok) { alert(data.error || 'Erro ao atualizar.'); return; }
            await carregarViaturasMotoristas();
            return;
        } catch (e) { if (e.name !== 'TypeError') console.error(e); }
    }
    alert('Endpoint de avaria não encontrado.');
}

// Expor para onclick/oncontextmenu no HTML
if (typeof window !== 'undefined') {
    window.abrirModalAvaria = abrirModalAvaria;
    window.fecharModalAvaria = fecharModalAvaria;
    window.guardarAvariaObservacao = guardarAvariaObservacao;
    window.abrirModalAvariaNota = abrirModalAvariaNota;
    window.fecharModalAvariaNota = fecharModalAvariaNota;
    window.guardarAvariaNota = guardarAvariaNota;
}

async function guardarAvariaObservacaoComValores(id, marcar, observacao) {
    const idNum = parseInt(id, 10);
    if (isNaN(idNum) || idNum <= 0) return;
    const body = JSON.stringify({ avaria: !!marcar, avaria_observacao: (observacao || '').trim() });
    const urls = [`/api/atribuicao/${idNum}/avaria`, `/api/atribuicoes-motoristas/${idNum}/avaria`];
    for (const url of urls) {
        try {
            const response = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: body });
            const data = await response.json().catch(() => ({}));
            if (response.status === 404) continue;
            if (!response.ok) {
                alert(data.error || 'Erro ao atualizar.');
                return;
            }
            await carregarViaturasMotoristas();
            return;
        } catch (e) {
            if (e.name !== 'TypeError') console.error(e);
        }
    }
    alert('Endpoint de avaria não encontrado. Pare o servidor (Ctrl+C) e volte a executar: python app.py');
}

async function guardarAvariaObservacao() {
    const id = avariaModalAtribuicaoId;
    const marcar = avariaModalMarcar;
    if (id == null || isNaN(id) || id <= 0) {
        fecharModalAvaria();
        return;
    }
    const input = document.getElementById('avariaObservacaoInput');
    const observacao = (input && input.value) ? input.value.trim() : '';
    fecharModalAvaria();
    await guardarAvariaObservacaoComValores(id, marcar, observacao);
}

async function marcarAvariaAtribuicao(atribuicaoId, marcar) {
    const id = parseInt(atribuicaoId, 10);
    if (isNaN(id) || id <= 0) {
        alert('ID do card inválido. Tente recarregar a página.');
        return;
    }
    if (marcar) {
        abrirModalAvaria(atribuicaoId, true);
        return;
    }
    // Remover avaria: sem observação, chamar API diretamente
    const body = JSON.stringify({ avaria: false, avaria_observacao: '' });
    const urls = [`/api/atribuicao/${id}/avaria`, `/api/atribuicoes-motoristas/${id}/avaria`];
    for (const url of urls) {
        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: body
            });
            const data = await response.json().catch(() => ({}));
            if (response.status === 404) continue;
            if (!response.ok) {
                alert(data.error || 'Erro ao atualizar.');
                return;
            }
            await carregarViaturasMotoristas();
            return;
        } catch (e) {
            if (e.name !== 'TypeError') console.error(e);
        }
    }
    alert('Endpoint de avaria não encontrado. Pare o servidor (Ctrl+C) e volte a executar: python app.py');
}

async function toggleEncomendaCarregadoDiaAnterior(encomendaViaturaId, marcar) {
    try {
        const response = await fetch('/api/encomenda-carregado-dia-anterior', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ encomenda_viatura_id: encomendaViaturaId, marcar })
        });
        const result = await response.json();
        if (result.success) {
            await carregarViaturasMotoristas();
        } else {
            alert(result.error || 'Erro ao atualizar.');
        }
    } catch (e) {
        console.error(e);
        alert('Erro ao marcar/desmarcar carregado no dia anterior.');
    }
}

function mostrarContextMenuEncomendaCarregado(event, encomendaViaturaId, estaMarcado) {
    event.preventDefault();
    event.stopPropagation();
    const menuAnterior = document.getElementById('contextMenuEncomendaCarregado');
    if (menuAnterior) menuAnterior.remove();
    const isMarcado = (estaMarcado === true || estaMarcado === 'true');
    const menu = document.createElement('div');
    menu.id = 'contextMenuEncomendaCarregado';
    menu.className = 'context-menu';
    menu.style.cssText = 'position: fixed; background: white; border: 1px solid #ccc; border-radius: 4px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); z-index: 10000; padding: 5px 0; min-width: 220px;';
    const texto = isMarcado ? 'Desmarcar carregado no dia anterior' : 'Carregou no dia anterior';
    const item = document.createElement('div');
    item.className = 'context-menu-item';
    item.textContent = '🚛 ' + texto;
    item.style.cssText = 'padding: 8px 15px; cursor: pointer; font-size: 14px;';
    item.onmouseover = function() { this.style.backgroundColor = '#f0f0f0'; };
    item.onmouseout = function() { this.style.backgroundColor = 'transparent'; };
    item.onclick = function() {
        menu.remove();
        const id = parseInt(encomendaViaturaId, 10);
        if (!isNaN(id)) toggleEncomendaCarregadoDiaAnterior(id, !isMarcado);
    };
    menu.appendChild(item);
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';
    document.body.appendChild(menu);
    const fechar = (e) => {
        if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', fechar); document.removeEventListener('contextmenu', fechar); }
    };
    setTimeout(() => {
        document.addEventListener('click', fechar, { once: true });
        document.addEventListener('contextmenu', fechar, { once: true });
    }, 100);
}

function mostrarContextMenuMotorista(event, viaturaId, nomeMotorista, matricula) {
    event.preventDefault();
    event.stopPropagation();
    
    // Remover menu anterior se existir
    const menuAnterior = document.getElementById('contextMenuMotorista');
    if (menuAnterior) {
        menuAnterior.remove();
    }
    
    // Criar menu de contexto
    const menu = document.createElement('div');
    menu.id = 'contextMenuMotorista';
    menu.className = 'context-menu';
    menu.style.cssText = `
        position: fixed;
        background: white;
        border: 1px solid #ccc;
        border-radius: 4px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 10000;
        padding: 5px 0;
        min-width: 200px;
    `;
    
    // Verificar se este card tem avaria marcada (atribuicao_id = viaturaId nos cards de planeamento)
    const cardEl = document.querySelector(`.motorista-card[data-id="${viaturaId}"]`);
    const temAvaria = cardEl && cardEl.classList.contains('card-tem-avaria');
    const atribuicaoId = cardEl ? (parseInt(cardEl.getAttribute('data-atribuicao-id'), 10) || viaturaId) : viaturaId;
    const opcoes = [
        { texto: '✏️ Alterar Matrícula', acao: () => verificarEAbrirModalAlterarMatricula(viaturaId, matricula, nomeMotorista) },
        temAvaria
            ? { texto: '✅ Remover avaria/alteração', acao: () => marcarAvariaAtribuicao(viaturaId, false) }
            : { texto: '⚠️ Marcar avaria/alteração', acao: () => marcarAvariaAtribuicao(viaturaId, true) },
        { texto: '⏰ Hora de saída', acao: () => escolherHoraSaida(atribuicaoId) },
        { texto: '🗑️ Apagar Card', acao: () => confirmarApagarCardPermanente(viaturaId, nomeMotorista, matricula) }
    ];
    
    opcoes.forEach(opcao => {
        const item = document.createElement('div');
        item.className = 'context-menu-item';
        item.textContent = opcao.texto;
        item.style.cssText = `
            padding: 8px 15px;
            cursor: pointer;
            font-size: 14px;
        `;
        item.onmouseover = function() { this.style.backgroundColor = '#f0f0f0'; };
        item.onmouseout = function() { this.style.backgroundColor = 'transparent'; };
        item.onclick = function(e) {
            e.stopPropagation();
            e.preventDefault();
            const acao = opcao.acao;
            const texto = opcao.texto;
            menu.remove();
            // Chamar a ação após um pequeno delay para garantir que o menu foi removido e o clique terminou
            setTimeout(() => {
                try {
                    acao();
                } catch (error) {
                    console.error('Erro ao executar ação do menu:', error);
                    alert('Erro: ' + error.message);
                }
            }, 50);
        };
        menu.appendChild(item);
    });
    
    // Posicionar menu
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;
    
    document.body.appendChild(menu);
    
    // Fechar menu ao clicar fora
    const fecharMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', fecharMenu);
            document.removeEventListener('contextmenu', fecharMenu);
        }
    };
    
    setTimeout(() => {
        document.addEventListener('click', fecharMenu, { once: true });
        document.addEventListener('contextmenu', fecharMenu, { once: true });
    }, 100);
}

// ==================== FUNÇÃO DE REORDENAÇÃO DE ENCOMENDAS DENTRO DO MESMO CARD ====================

async function reordenarEncomendasNoCard(viaturaMotoristaId, dropZone, event) {
    try {
        // Obter todas as encomendas no card
        const encomendasCards = Array.from(dropZone.querySelectorAll('.encomenda-card'));
        
        // Obter a encomenda que foi arrastada
        const encomendaArrastada = draggedEncomendaBack ? 
            encomendasCards.find(card => 
                parseInt(card.getAttribute('data-atribuicao-id')) === draggedEncomendaBack.atribuicao_id
            ) : null;
        
        // Se não encontrou a encomenda arrastada, usar todas na ordem atual
        if (!encomendaArrastada) {
            const idsOrdenados = [];
            encomendasCards.forEach(card => {
                const atribuicaoId = parseInt(card.getAttribute('data-atribuicao-id'));
                if (atribuicaoId && !isNaN(atribuicaoId)) {
                    idsOrdenados.push(atribuicaoId);
                }
            });
            
            if (idsOrdenados.length === 0) {
                return;
            }
            
            const data = document.getElementById('dataPlaneamento').value;
            
            const response = await fetch('/api/reordenar-encomendas-motorista', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    viatura_motorista_id: viaturaMotoristaId,
                    data_associacao: data,
                    ids: idsOrdenados
                })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                await carregarViaturasMotoristas();
            } else {
                console.error('Erro ao reordenar encomendas:', result.error);
            }
            return;
        }
        
        // Remover a encomenda arrastada da lista
        const outrasEncomendas = encomendasCards.filter(card => card !== encomendaArrastada);
        
        // Encontrar a posição onde inserir baseado na posição Y do mouse
        const mouseY = event ? event.clientY : null;
        let posicaoInsercao = outrasEncomendas.length;
        
        if (mouseY !== null) {
            for (let i = 0; i < outrasEncomendas.length; i++) {
                const rect = outrasEncomendas[i].getBoundingClientRect();
                if (mouseY < rect.top + rect.height / 2) {
                    posicaoInsercao = i;
                    break;
                }
            }
        }
        
        // Construir a nova ordem
        const idsOrdenados = [];
        for (let i = 0; i < outrasEncomendas.length; i++) {
            if (i === posicaoInsercao) {
                const atribuicaoId = parseInt(encomendaArrastada.getAttribute('data-atribuicao-id'));
                if (atribuicaoId && !isNaN(atribuicaoId)) {
                    idsOrdenados.push(atribuicaoId);
                }
            }
            const atribuicaoId = parseInt(outrasEncomendas[i].getAttribute('data-atribuicao-id'));
            if (atribuicaoId && !isNaN(atribuicaoId)) {
                idsOrdenados.push(atribuicaoId);
            }
        }
        
        // Se a posição de inserção é no final
        if (posicaoInsercao >= outrasEncomendas.length) {
            const atribuicaoId = parseInt(encomendaArrastada.getAttribute('data-atribuicao-id'));
            if (atribuicaoId && !isNaN(atribuicaoId)) {
                idsOrdenados.push(atribuicaoId);
            }
        }
        
        if (idsOrdenados.length === 0) {
            return;
        }
        
        const data = document.getElementById('dataPlaneamento').value;
        
        const response = await fetch('/api/reordenar-encomendas-motorista', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                viatura_motorista_id: viaturaMotoristaId,
                data_associacao: data,
                ids: idsOrdenados
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            await carregarViaturasMotoristas();
        } else {
            console.error('Erro ao reordenar encomendas:', result.error);
            alert('Erro ao reordenar encomendas: ' + (result.error || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro ao reordenar encomendas:', error);
        alert('Erro ao reordenar encomendas');
    }
}

// ==================== FUNÇÕES DO MENU DE CONTEXTO DE MOTORISTA ====================

async function verificarEAbrirModalAlterarMatricula(viaturaId, matriculaAtual, nomeMotorista) {
    // Buscar informações do card para obter conjunto_id
    const data = document.getElementById('dataPlaneamento') ? document.getElementById('dataPlaneamento').value : new Date().toISOString().split('T')[0];
    try {
        const response = await fetch(`/api/cards-planeamento?data=${data}`);
        const cards = await response.json();
        const card = cards.find(c => (c.atribuicao_id && c.atribuicao_id == viaturaId) || c.id == viaturaId);
        
        if (card && card.conjunto_id) {
            // Buscar trator_id e cisterna_id do conjunto
            const conjuntoResponse = await fetch(`/api/conjuntos-habituais/${card.conjunto_id}`);
            if (conjuntoResponse.ok) {
                const conjunto = await conjuntoResponse.json();
                const tratorId = conjunto.trator_id;
                const cisternaId = conjunto.cisterna_id;
                
                // Verificar se o conjunto está autorizado
                const verificarResponse = await fetch(`/api/conjuntos-compatives/verificar?trator_id=${tratorId}&cisterna_id=${cisternaId}`);
                if (verificarResponse.ok) {
                    const resultado = await verificarResponse.json();
                    if (!resultado.autorizado) {
                        alert('❌ Este conjunto não está autorizado para alteração de matrículas. Por favor, autorize o conjunto em "Conjuntos Compatíveis" primeiro.');
                        return;
                    }
                }
            }
        }
        
        // Se passou na verificação ou não tem conjunto_id, abrir modal normalmente
        abrirModalAlterarMatricula(viaturaId, matriculaAtual, nomeMotorista);
    } catch (error) {
        console.error('Erro ao verificar autorização:', error);
        // Em caso de erro, permitir a alteração (não bloquear)
        abrirModalAlterarMatricula(viaturaId, matriculaAtual, nomeMotorista);
    }
}

function abrirModalAlterarMatricula(viaturaId, matriculaAtual, nomeMotorista) {
    console.log('Abrir modal alterar matrícula:', { viaturaId, matriculaAtual, nomeMotorista });
    
    // Função para encontrar ou criar o modal
    const encontrarOuCriarModal = () => {
        // Primeiro, tentar encontrar o modal existente
        let modal = document.getElementById('alterarMatriculaModal');
        if (modal) {
            console.log('Modal encontrado por getElementById');
            return modal;
        }
        
        // Tentar querySelector
        modal = document.querySelector('#alterarMatriculaModal');
        if (modal) {
            console.log('Modal encontrado por querySelector');
            return modal;
        }
        
        // Tentar encontrar por texto
        const todosModais = document.querySelectorAll('.modal');
        const modalPorTexto = Array.from(todosModais).find(m => {
            const texto = m.textContent || '';
            return texto.includes('Alterar Matrícula') && texto.includes('Matrícula do Trator');
        });
        
        if (modalPorTexto) {
            console.log('Modal encontrado por texto, atribuindo ID');
            modalPorTexto.id = 'alterarMatriculaModal';
            return modalPorTexto;
        }
        
        // Se não encontrou, criar o modal dinamicamente
        console.log('Modal não encontrado, criando dinamicamente...');
        modal = document.createElement('div');
        modal.id = 'alterarMatriculaModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close" onclick="fecharModalAlterarMatricula()">&times;</span>
                <h2>Alterar Matrícula (Apenas para o dia)</h2>
                <form id="alterarMatriculaForm">
                    <input type="hidden" id="alterarMatriculaViaturaId">
                    <div class="form-group">
                        <label>Matrícula Atual:</label>
                        <input type="text" id="alterarMatriculaAtual" readonly style="background: #f0f0f0;">
                    </div>
                    <div class="form-group">
                        <label>Matrícula do Trator:</label>
                        <input type="text" id="alterarMatriculaTrator" placeholder="Ex: 25ZO43" style="text-transform: uppercase;">
                        <small style="color: #666;">Deixe vazio para manter a original</small>
                    </div>
                    <div class="form-group">
                        <label>Matrícula da Galera:</label>
                        <input type="text" id="alterarMatriculaGalera" placeholder="Ex: 25ZO44" style="text-transform: uppercase;">
                        <small style="color: #666;">Deixe vazio para manter a original</small>
                    </div>
                    <div class="form-group">
                        <label>Observações (apenas para o dia):</label>
                        <textarea id="alterarMatriculaObservacao" rows="3" placeholder="Adicione observações temporárias para este dia..."></textarea>
                    </div>
                    <div class="form-group">
                        <label>Motorista:</label>
                        <input type="text" id="alterarMatriculaMotorista" readonly style="background: #f0f0f0;">
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Salvar</button>
                        <button type="button" onclick="fecharModalAlterarMatricula()" class="btn btn-secondary">Cancelar</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Adicionar event listener ao form
        const form = modal.querySelector('#alterarMatriculaForm');
        if (form) {
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                submeterAlterarMatricula();
            });
        }
        
        console.log('Modal criado dinamicamente');
        return modal;
    };
    
    // Função interna para abrir o modal (com retry)
    const abrirModal = (tentativa = 0) => {
        const modal = encontrarOuCriarModal();
        
        if (!modal) {
            if (tentativa < 5) {
                setTimeout(() => abrirModal(tentativa + 1), 200);
                return;
            }
            alert('Erro: Não foi possível criar o modal. Por favor, recarregue a página.');
            return;
        }
        
        try {
            const viaturaIdInput = document.getElementById('alterarMatriculaViaturaId');
            const matriculaAtualInput = document.getElementById('alterarMatriculaAtual');
            const matriculaTratorInput = document.getElementById('alterarMatriculaTrator');
            const matriculaGaleraInput = document.getElementById('alterarMatriculaGalera');
            const observacaoInput = document.getElementById('alterarMatriculaObservacao');
            const motoristaInput = document.getElementById('alterarMatriculaMotorista');
            
            if (!viaturaIdInput || !matriculaAtualInput || !matriculaTratorInput || !matriculaGaleraInput || !observacaoInput || !motoristaInput) {
                console.error('Campos do modal não encontrados');
                alert('Erro: Alguns campos do modal não foram encontrados');
                return;
            }
            
            viaturaIdInput.value = viaturaId;
            matriculaAtualInput.value = matriculaAtual || '';
            matriculaTratorInput.value = '';
            matriculaGaleraInput.value = '';
            observacaoInput.value = '';
            motoristaInput.value = nomeMotorista || '';
            
            // Buscar valores temporários da API se existirem
            const dataAtual = document.getElementById('dataPlaneamento') ? document.getElementById('dataPlaneamento').value : new Date().toISOString().split('T')[0];
            fetch(`/api/viatura-motorista?data=${dataAtual}`)
                .then(response => response.json())
                .then(dados => {
                    const viatura = dados.find(v => v.id == viaturaId);
                    if (viatura) {
                        if (viatura.matricula_trator_temp) {
                            matriculaTratorInput.value = viatura.matricula_trator_temp;
                        }
                        if (viatura.matricula_galera_temp) {
                            matriculaGaleraInput.value = viatura.matricula_galera_temp;
                        }
                        if (viatura.observacao_temporaria) {
                            observacaoInput.value = viatura.observacao_temporaria;
                        }
                    }
                })
                .catch(error => {
                    console.log('Não foi possível buscar valores temporários:', error);
                });
            
            modal.style.display = 'block';
            modal.style.zIndex = '10000';
            
            // Focar no campo de matrícula do trator
            setTimeout(() => {
                const inputTrator = document.getElementById('alterarMatriculaTrator');
                if (inputTrator) {
                    inputTrator.focus();
                }
            }, 100);
        } catch (error) {
            console.error('Erro ao abrir modal:', error);
            alert('Erro ao abrir modal: ' + error.message);
        }
    };
    
    // Aguardar que o DOM esteja pronto antes de tentar abrir
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => abrirModal(), 100);
        });
    } else {
        // DOM já está pronto, mas aguardar um pouco para garantir que todos os elementos estão disponíveis
        setTimeout(() => abrirModal(), 50);
    }
}

function fecharModalAlterarMatricula() {
    const modal = document.getElementById('alterarMatriculaModal');
    if (modal) {
        modal.style.display = 'none';
    }
    const form = document.getElementById('alterarMatriculaForm');
    if (form) {
        form.reset();
    }
}

function confirmarApagarCardPermanente(viaturaId, nomeMotorista, matricula) {
    console.log('Abrir modal apagar card:', { viaturaId, nomeMotorista, matricula });
    
    // Função para encontrar ou criar o modal
    const encontrarOuCriarModal = () => {
        // Primeiro, tentar encontrar o modal existente
        let modal = document.getElementById('confirmarApagarCardModal');
        if (modal) {
            console.log('Modal encontrado por getElementById');
            return modal;
        }
        
        // Tentar querySelector
        modal = document.querySelector('#confirmarApagarCardModal');
        if (modal) {
            console.log('Modal encontrado por querySelector');
            return modal;
        }
        
        // Tentar encontrar por texto
        const todosModais = document.querySelectorAll('.modal');
        const modalPorTexto = Array.from(todosModais).find(m => {
            const texto = m.textContent || '';
            return texto.includes('Confirmar Exclusão Permanente') || texto.includes('Apagar Permanentemente');
        });
        
        if (modalPorTexto) {
            console.log('Modal encontrado por texto, atribuindo ID');
            modalPorTexto.id = 'confirmarApagarCardModal';
            return modalPorTexto;
        }
        
        // Se não encontrou, criar o modal dinamicamente
        console.log('Modal não encontrado, criando dinamicamente...');
        modal = document.createElement('div');
        modal.id = 'confirmarApagarCardModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close" onclick="fecharModalConfirmarApagarCard()">&times;</span>
                <h2>⚠️ Confirmar Exclusão Permanente</h2>
                <p><strong>Atenção:</strong> Esta ação irá apagar o card permanentemente. Esta ação não pode ser desfeita!</p>
                <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0;">
                    <p><strong>Matrícula:</strong> <span id="confirmarApagarMatricula"></span></p>
                    <p><strong>Motorista:</strong> <span id="confirmarApagarMotorista"></span></p>
                </div>
                <p style="color: #dc3545;"><strong>Tem certeza que deseja continuar?</strong></p>
                <div class="form-actions">
                    <button type="button" onclick="confirmarApagarCardPermanenteAcao()" class="btn btn-danger">Sim, Apagar Permanentemente</button>
                    <button type="button" onclick="fecharModalConfirmarApagarCard()" class="btn btn-secondary">Cancelar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        console.log('Modal criado dinamicamente');
        return modal;
    };
    
    // Função interna para abrir o modal (com retry)
    const abrirModal = (tentativa = 0) => {
        const modal = encontrarOuCriarModal();
        
        if (!modal) {
            if (tentativa < 5) {
                setTimeout(() => abrirModal(tentativa + 1), 200);
                return;
            }
            alert('Erro: Não foi possível criar o modal. Por favor, recarregue a página.');
            return;
        }
        
        try {
            modal.style.display = 'block';
            modal.style.zIndex = '10000';
            
            const matriculaSpan = document.getElementById('confirmarApagarMatricula');
            const motoristaSpan = document.getElementById('confirmarApagarMotorista');
            
            if (matriculaSpan) {
                matriculaSpan.textContent = matricula || '';
            }
            if (motoristaSpan) {
                motoristaSpan.textContent = nomeMotorista || '';
            }
            // Guardar o ID para usar na ação
            modal.setAttribute('data-viatura-id', viaturaId);
        } catch (error) {
            console.error('Erro ao abrir modal:', error);
            alert('Erro ao abrir modal: ' + error.message);
        }
    };
    
    // Aguardar que o DOM esteja pronto antes de tentar abrir
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => abrirModal(), 100);
        });
    } else {
        // DOM já está pronto, mas aguardar um pouco para garantir que todos os elementos estão disponíveis
        setTimeout(() => abrirModal(), 50);
    }
}

function fecharModalConfirmarApagarCard() {
    document.getElementById('confirmarApagarCardModal').style.display = 'none';
}

async function confirmarApagarCardPermanenteAcao() {
    const modal = document.getElementById('confirmarApagarCardModal');
    const viaturaId = modal.getAttribute('data-viatura-id');
    
    if (!viaturaId) {
        alert('Erro: ID da viatura não encontrado');
        return;
    }
    
    // Verificar se precisa de código de autorização (para datas anteriores)
    const data = document.getElementById('dataPlaneamento').value;
    const isAnterior = isDataAnterior(data);
    let codigoAutorizacao = null;
    
    if (isAnterior && !codigoDesbloqueioAtivo) {
        // Pedir código de autorização
        abrirModalCodigoAutorizacao();
        // Guardar a ação para executar depois
        window.pendingApagarCardAction = () => confirmarApagarCardPermanenteAcao();
        fecharModalConfirmarApagarCard();
        return;
    }
    
    if (isAnterior && codigoDesbloqueioAtivo) {
        codigoAutorizacao = CODIGO_SECRETO;
    }
    
    try {
        const response = await fetch(`/api/viatura-motorista/${viaturaId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ codigo_autorizacao: codigoAutorizacao })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('Card apagado permanentemente com sucesso!');
            fecharModalConfirmarApagarCard();
            await carregarViaturasMotoristas();
        } else {
            if (response.status === 403 && result.error && (result.error.includes('1990') || result.error.includes('código de autorização'))) {
                abrirModalCodigoAutorizacao();
                window.pendingApagarCardAction = () => confirmarApagarCardPermanenteAcao();
                fecharModalConfirmarApagarCard();
            } else {
                throw new Error(result.error || 'Erro ao apagar card');
            }
        }
    } catch (error) {
        console.error('Erro ao apagar card:', error);
        alert('Erro ao apagar card: ' + (error.message || error));
    }
}

// Event listener para o formulário de alterar matrícula
// Usar uma função global para garantir que seja acessível
async function submeterAlterarMatricula() {
    const viaturaId = document.getElementById('alterarMatriculaViaturaId').value;
    const matriculaTrator = document.getElementById('alterarMatriculaTrator').value.trim().toUpperCase();
    const matriculaGalera = document.getElementById('alterarMatriculaGalera').value.trim().toUpperCase();
    const observacao = document.getElementById('alterarMatriculaObservacao').value.trim();
    const dataAtual = document.getElementById('dataPlaneamento').value;
    
    if (!viaturaId) {
        alert('Erro: ID da viatura não encontrado');
        return;
    }
    
    if (!matriculaTrator && !matriculaGalera && !observacao) {
        alert('Por favor, preencha pelo menos um campo (matrícula do trator, matrícula da galera ou observação)');
        return;
    }
    
    try {
        // Atualizar matrículas se preenchidas
        if (matriculaTrator || matriculaGalera) {
            const response = await fetch(`/api/viatura-motorista/${viaturaId}/matricula`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    matricula_trator: matriculaTrator,
                    matricula_galera: matriculaGalera,
                    data_associacao: dataAtual
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                let errorMsg = 'Erro desconhecido';
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMsg = errorJson.error || errorText;
                } catch {
                    errorMsg = errorText || `Erro ${response.status}: ${response.statusText}`;
                }
                throw new Error(errorMsg);
            }
        }
        
        // Atualizar observação se preenchida
        if (observacao !== undefined) {
            const responseObs = await fetch(`/api/viatura-motorista/${viaturaId}/observacao`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    observacao: observacao,
                    data_associacao: dataAtual
                })
            });
            
            if (!responseObs.ok) {
                const errorText = await responseObs.text();
                let errorMsg = 'Erro desconhecido';
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMsg = errorJson.error || errorText;
                } catch {
                    errorMsg = errorText || `Erro ${responseObs.status}: ${responseObs.statusText}`;
                }
                throw new Error(errorMsg);
            }
        }
        
        alert('Alterações salvas com sucesso! (Apenas para o dia atual)');
        fecharModalAlterarMatricula();
        // Recarregar os cards para mostrar as alterações
        await carregarViaturasMotoristas();
    } catch (error) {
        console.error('Erro ao alterar matrícula/observação:', error);
        alert('Erro ao salvar alterações: ' + (error.message || error));
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('alterarMatriculaForm');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            await submeterAlterarMatricula();
        });
    }
});

// ==================== FUNÇÕES DO MENU DE CONTEXTO DE ENCOMENDAS PENDENTES ====================

async function alterarDataEncomenda(pedidoId) {
    // Buscar a data atual do pedido para pré-preencher o calendário
    try {
        const response = await fetch(`/api/pedidos-pendentes`);
        const pedidos = await response.json();
        const pedido = pedidos.find(p => p.id === pedidoId);
        
        // Abrir modal com calendário
        abrirModalAlterarData(pedidoId, pedido ? pedido.data_entrega : null);
    } catch (error) {
        console.error('Erro ao buscar dados do pedido:', error);
        // Se houver erro, abrir modal sem data pré-preenchida
        abrirModalAlterarData(pedidoId, null);
    }
}

function abrirModalAlterarData(pedidoId, dataAtual) {
    const modal = document.getElementById('alterarDataModal');
    const inputData = document.getElementById('alterarDataInput');
    const pedidoIdInput = document.getElementById('alterarDataPedidoId');
    
    if (!modal || !inputData || !pedidoIdInput) {
        console.error('Elementos do modal não encontrados');
        return;
    }
    
    // Guardar o ID do pedido
    pedidoIdInput.value = pedidoId;
    
    // Pré-preencher com a data atual se existir
    if (dataAtual) {
        inputData.value = dataAtual;
    } else {
        // Se não houver data, usar a data de hoje
        const hoje = new Date().toISOString().split('T')[0];
        inputData.value = hoje;
    }
    
    // Definir data mínima como hoje (não permitir datas passadas)
    const hoje = new Date().toISOString().split('T')[0];
    inputData.setAttribute('min', hoje);
    
    // Mostrar modal
    modal.style.display = 'block';
    
    // Focar no input de data
    setTimeout(() => {
        inputData.focus();
        inputData.showPicker?.(); // Mostrar calendário automaticamente (se suportado pelo navegador)
    }, 100);
}

function fecharModalAlterarData() {
    const modal = document.getElementById('alterarDataModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Fechar modal ao clicar fora dele (apenas quando o modal estiver visível)
document.addEventListener('click', function(event) {
    const modal = document.getElementById('alterarDataModal');
    if (modal && modal.style.display === 'block' && event.target === modal) {
        fecharModalAlterarData();
    }
});

async function salvarNovaData(event) {
    event.preventDefault();
    
    const pedidoId = document.getElementById('alterarDataPedidoId').value;
    const novaData = document.getElementById('alterarDataInput').value;
    
    if (!novaData) {
        alert('Por favor, selecione uma data.');
        return;
    }
    
    // Validar que a data não é anterior à data atual
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataSelecionada = new Date(novaData);
    dataSelecionada.setHours(0, 0, 0, 0);
    
    if (dataSelecionada < hoje) {
        alert('❌ Não é possível alterar a data para um dia que já passou. Por favor, selecione uma data atual ou futura.');
        return;
    }
    
    try {
        const response = await fetch(`/api/pedidos-pendentes/${pedidoId}/data`, {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ data_entrega: novaData })
        });
        
        // Verificar se a resposta foi recebida
        if (!response) {
            throw new Error('Não foi possível conectar ao servidor. Verifique se o servidor está em execução.');
        }
        
        // Verificar se a resposta é JSON
        const contentType = response.headers.get('content-type');
        let result;
        
        if (contentType && contentType.includes('application/json')) {
            result = await response.json();
        } else {
            const text = await response.text();
            console.error('Resposta não é JSON:', {
                status: response.status,
                statusText: response.statusText,
                contentType: contentType,
                body: text.substring(0, 500)
            });
            throw new Error(`Erro ${response.status}: Resposta inválida do servidor`);
        }
        
        if (response.ok && result.success) {
            // Fechar modal
            fecharModalAlterarData();
            
            // Remover seleção
            if (encomendaSelecionada && encomendaSelecionada.row) {
                encomendaSelecionada.row.classList.remove('encomenda-selecionada');
            }
            encomendaSelecionada = null;
            
            // Recarregar dados (sem alert)
            await carregarEncomendasPendentesDia();
        } else {
            alert('Erro ao alterar data: ' + (result.error || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro ao alterar data:', error);
        if (error.message && error.message.includes('Failed to fetch')) {
            alert('❌ Erro de conexão: Não foi possível conectar ao servidor. Verifique se o servidor está em execução e tente novamente.');
        } else {
            alert('Erro ao alterar data: ' + (error.message || 'Erro de conexão'));
        }
    }
}

// Variável para controlar se estamos em modo de edição
let modoEdicaoEncomenda = false;
let pedidoIdEditando = null;

async function alterarDadosEncomenda(pedidoId) {
    try {
        // Buscar dados atuais do pedido
        const response = await fetch(`/api/pedidos-pendentes`);
        const pedidos = await response.json();
        const pedido = pedidos.find(p => p.id === pedidoId);
        
        if (!pedido) {
            alert('Pedido não encontrado');
            return;
        }
        
        // Marcar que estamos em modo de edição
        modoEdicaoEncomenda = true;
        pedidoIdEditando = pedidoId;
        
        // Abrir modal de edição (reutilizar modal existente)
        document.getElementById('modalTitle').textContent = 'Alterar Dados da Encomenda';
        document.getElementById('pedidoTipo').value = 'pendente';
        
        // Preencher campos com dados atuais
        // Preencher Cliente
        const clienteInput = document.getElementById('cliente');
        if (clienteInput) {
            clienteInput.value = pedido.cliente || '';
        }
        
        // Preencher Local de Descarga
        const localDescargaInput = document.getElementById('localDescarga');
        if (localDescargaInput) {
            // Tentar obter local de descarga do pedido, se não houver, usar cliente
            localDescargaInput.value = pedido.local_descarga || pedido.cliente || '';
        }
        
        // Preencher Material
        const materialInput = document.getElementById('material');
        if (materialInput) {
            materialInput.value = pedido.material || '';
        }
        
        // Preencher Local de Carga
        const localCargaInput = document.getElementById('localCarga');
        if (localCargaInput) {
            localCargaInput.value = pedido.local_carga || pedido.cliente || '';
        }
        
        document.getElementById('observacoes').value = pedido.observacoes || '';
        document.getElementById('dataEntrega').value = pedido.data_entrega || '';
        document.getElementById('quantidade').value = '1';
        
        // Carregar locais de descarga para o cliente selecionado
        if (pedido.cliente) {
            carregarLocaisNoSelect(pedido.cliente);
        }
        
        document.getElementById('pedidoModal').style.display = 'block';
    } catch (error) {
        console.error('Erro ao carregar dados do pedido:', error);
        alert('Erro ao carregar dados do pedido: ' + (error.message || 'Erro de conexão'));
    }
}

async function apagarEncomenda(pedidoId) {
    if (!confirm('Tem certeza que deseja apagar esta encomenda?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/pedidos-pendentes/${pedidoId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            // Remover seleção
            if (encomendaSelecionada && encomendaSelecionada.row) {
                encomendaSelecionada.row.classList.remove('encomenda-selecionada');
            }
            encomendaSelecionada = null;
            
            // Recarregar dados
            await carregarEncomendasPendentesDia();
            alert('✅ Encomenda apagada com sucesso!');
        } else {
            alert('Erro ao apagar encomenda: ' + (result.error || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro ao apagar encomenda:', error);
        alert('Erro ao apagar encomenda: ' + (error.message || 'Erro de conexão'));
    }
}

// ==================== FUNÇÕES DE DRAG INLINE ====================

function handleDragOverPendentesInline(e) {
    // Verificar se pode fazer movimentos (bloquear datas anteriores)
    if (!podeFazerMovimentos()) {
        e.dataTransfer.dropEffect = 'none';
        return true;
    }
    
    if (draggedEncomendaBack) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        return false;
    }
    return true;
}

function handleDragLeavePendentesInline(e) {
    // Remover classes de drag over se necessário
}

async function handleDropBackInline(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Verificar se pode fazer movimentos (bloquear datas anteriores)
    if (!podeFazerMovimentos()) {
        return;
    }
    
    // Remover classe drag-over de todos os elementos
    document.querySelectorAll('.drop-zone-encomendas').forEach(el => {
        el.classList.remove('drop-zone-encomendas');
    });
    
    if (!draggedEncomendaBack) return;
    
    // Guardar dados da encomenda antes de qualquer operação assíncrona
    const encomendaData = {
        pedido_id: draggedEncomendaBack.pedido_id,
        pedido_tipo: draggedEncomendaBack.pedido_tipo
    };
    
    const data = document.getElementById('dataPlaneamento').value;
    
    try {
        let codigoAutorizacao = null;
        
        // Usar a nova API que aceita pedido_id + pedido_tipo + data
        let response = await fetch('/api/remover-atribuicao-por-pedido', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pedido_id: encomendaData.pedido_id,
                pedido_tipo: encomendaData.pedido_tipo,
                data_associacao: data,
                codigo_autorizacao: codigoAutorizacao
            })
        });
        
        let result = await response.json();
        
        // Se o servidor pedir código, pedir ao utilizador
        if (response.status === 403 && result.error && (result.error.includes('1990') || result.error.includes('código de autorização') || result.error.includes('autorização'))) {
            codigoAutorizacao = await pedirCodigoAutorizacao(result.error);
            if (!codigoAutorizacao || codigoAutorizacao !== '1990') {
                alert('Código incorreto. Operação cancelada.');
                draggedEncomendaBack = null;
                return;
            }
            // Tentar novamente com o código (usar dados guardados)
            response = await fetch('/api/remover-atribuicao-por-pedido', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pedido_id: encomendaData.pedido_id,
                    pedido_tipo: encomendaData.pedido_tipo,
                    data_associacao: data,
                    codigo_autorizacao: codigoAutorizacao
                })
            });
            result = await response.json();
        }
        
        if (response.ok && result.success) {
            // Recarregar dados - a encomenda deve voltar para a lista de pendentes
            await carregarEncomendasPendentesDia();
            await carregarViaturasMotoristas();
        } else {
            alert('Erro ao remover atribuição: ' + (result.error || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro ao remover atribuição:', error);
        alert('Erro ao remover atribuição');
    }
    
    draggedEncomendaBack = null;
}

async function handleDropInline(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Verificar se pode fazer movimentos (bloquear datas anteriores)
    if (!podeFazerMovimentos()) {
        return;
    }
    
    const dropZone = e.currentTarget;
    const card = dropZone.closest('.motorista-card');
    if (!card) return;
    
    // Verificar se o card está bloqueado por férias
    if (card.classList.contains('ferias-bloqueado')) {
        return;
    }
    
    // Verificar se a zona de drop está desabilitada
    if (dropZone.classList.contains('disabled')) {
        return;
    }
    
    const cardId2 = parseInt(card.getAttribute('data-id'));
    const atribuicaoId2 = parseInt(card.getAttribute('data-atribuicao-id')) || null;
    if (isNaN(cardId2)) return;
    
    dropZone.classList.remove('drag-over');
    
    // Remover estilo verde de todos os cards
    document.querySelectorAll('.motorista-card').forEach(card => {
        card.classList.remove('drag-over-encomenda');
    });
    
    if (draggedEncomenda) {
        // Atribuir encomenda pendente à viatura (usar atribuicao_id se o card tiver)
        try {
            const data = document.getElementById('dataPlaneamento').value;
            const body = {
                data_associacao: data,
                pedido_id: draggedEncomenda.id,
                pedido_tipo: draggedEncomenda.tipo
            };
            if (atribuicaoId2) body.atribuicao_id = atribuicaoId2;
            else body.viatura_motorista_id = cardId2;
            const response = await fetch('/api/atribuir-encomenda', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                // Recarregar dados
                await carregarEncomendasPendentesDia();
                await carregarViaturasMotoristas(true);
            } else {
                alert('Erro ao atribuir encomenda: ' + (result.error || 'Erro desconhecido'));
            }
        } catch (error) {
            console.error('Erro ao atribuir encomenda:', error);
            alert('Erro ao atribuir encomenda');
        }
        
        draggedEncomenda = null;
    } else if (draggedEncomendaBack) {
        // Mover encomenda de uma viatura para outra
        try {
            // Verificar se draggedEncomendaBack tem os dados necessários
            if (!draggedEncomendaBack.pedido_id || !draggedEncomendaBack.pedido_tipo) {
                console.error('Dados incompletos:', draggedEncomendaBack);
                draggedEncomendaBack = null;
                return;
            }
            
            // Verificar se não está a mover para a mesma viatura
            if (cardId2 === draggedEncomendaBack.viatura_id) {
                draggedEncomendaBack = null;
                return;
            }
            
            const data = document.getElementById('dataPlaneamento').value;
            const response = await fetch('/api/mover-encomenda-viatura', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    encomenda_viatura_id: draggedEncomendaBack.atribuicao_id,
                    pedido_id: draggedEncomendaBack.pedido_id,
                    pedido_tipo: draggedEncomendaBack.pedido_tipo,
                    viatura_id_origem: draggedEncomendaBack.viatura_id,
                    viatura_id_destino: cardId2,
                    data_associacao: data
                })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                // Recarregar dados
                await carregarEncomendasPendentesDia();
                await carregarViaturasMotoristas();
            } else {
                alert('Erro ao mover encomenda: ' + (result.error || 'Erro desconhecido'));
            }
        } catch (error) {
            console.error('Erro ao mover encomenda:', error);
            alert('Erro ao mover encomenda');
        }
        
        draggedEncomendaBack = null;
    }
}

function handleDragOverInline(e) {
    // Verificar se pode fazer movimentos (bloquear datas anteriores)
    if (!podeFazerMovimentos()) {
        e.dataTransfer.dropEffect = 'none';
        return true;
    }
    
    // Verificar se o card está bloqueado por férias
    const card = e.currentTarget.closest('.motorista-card');
    if (card && card.classList.contains('ferias-bloqueado')) {
        e.dataTransfer.dropEffect = 'none';
        return true;
    }
    
    // Verificar se a zona de drop está desabilitada
    if (e.currentTarget.classList.contains('disabled')) {
        e.dataTransfer.dropEffect = 'none';
        return true;
    }
    
    if (draggedEncomenda || draggedEncomendaBack) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('drag-over');
        
        // Adicionar estilo verde ao card
        if (card) {
            card.classList.add('drag-over-encomenda');
        }
        
        return false;
    }
    return true;
}

function handleDragLeaveInline(e) {
    const dropZone = e.currentTarget;
    if (!dropZone.contains(e.relatedTarget)) {
        dropZone.classList.remove('drag-over');
        
        // Remover estilo verde do card quando sai da zona de drop
        const card = dropZone.closest('.motorista-card');
        if (card) {
            card.classList.remove('drag-over-encomenda');
        }
    }
}

// ==================== REORDENAÇÃO DE ENCOMENDAS DENTRO DO MESMO MOTORISTA ====================

let encomendaSendoArrastada = null;

function handleDragOverEncomenda(e, viaturaId) {
    // Verificar se pode fazer movimentos (bloquear datas anteriores)
    if (!podeFazerMovimentos()) {
        e.dataTransfer.dropEffect = 'none';
        return;
    }
    
    // Verificar se o card está bloqueado (férias, baixa, outros trabalhos)
    const card = e.currentTarget.closest('.motorista-card');
    if (card && (card.classList.contains('ferias-bloqueado') || card.classList.contains('baixa-bloqueado') || card.classList.contains('outros-trabalhos-bloqueado'))) {
        e.dataTransfer.dropEffect = 'none';
        return;
    }
    
    // Só permitir reordenação se for dentro do mesmo motorista
    if (!draggedEncomendaBack || draggedEncomendaBack.viatura_id !== viaturaId) {
        return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    
    const cardAlvo = e.currentTarget;
    const cardArrastado = document.querySelector('.encomenda-card.dragging');
    
    if (!cardAlvo || !cardArrastado || cardAlvo === cardArrastado) {
        return;
    }
    
    // Determinar se inserir ANTES (metade superior) ou DEPOIS (metade inferior) do card alvo
    const rect = cardAlvo.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const insertBefore = e.clientY < midY;
    
    cardAlvo.classList.remove('drop-insert-before', 'drop-insert-after');
    cardAlvo.classList.add(insertBefore ? 'drop-insert-before' : 'drop-insert-after');
    cardAlvo.setAttribute('data-drop-insert', insertBefore ? 'before' : 'after');
}

function handleDragLeaveEncomenda(e) {
    const card = e.currentTarget;
    if (card && card.classList) {
        card.classList.remove('drag-over-encomenda', 'drop-insert-before', 'drop-insert-after');
        card.removeAttribute('data-drop-insert');
    }
}

function handleDropEncomenda(e, viaturaId, encomendaIdAlvo) {
    e.preventDefault();
    e.stopPropagation();
    
    // Verificar se pode fazer movimentos (bloquear datas anteriores)
    if (!podeFazerMovimentos()) {
        return;
    }
    
    // Verificar se o card está bloqueado (férias, baixa, outros trabalhos)
    const card = e.currentTarget.closest('.motorista-card');
    if (card && (card.classList.contains('ferias-bloqueado') || card.classList.contains('baixa-bloqueado') || card.classList.contains('outros-trabalhos-bloqueado'))) {
        return;
    }
    
    if (!draggedEncomendaBack || draggedEncomendaBack.viatura_id !== viaturaId) {
        return;
    }
    
    const cardArrastado = document.querySelector('.encomenda-card.dragging');
    const cardAlvo = e.currentTarget.closest('.encomenda-card');
    
    if (!cardArrastado || !cardAlvo || cardArrastado === cardAlvo) {
        return;
    }
    
    const encomendaIdOrigem = parseInt(cardArrastado.getAttribute('data-atribuicao-id'));
    const encomendaIdDestino = parseInt(cardAlvo.getAttribute('data-atribuicao-id'));
    
    if (isNaN(encomendaIdOrigem) || isNaN(encomendaIdDestino)) {
        return;
    }
    
    // Reordenar no DOM: usar a posição indicada (inserir antes ou depois do alvo)
    const container = cardArrastado.parentElement;
    const insertPos = cardAlvo.getAttribute('data-drop-insert') || 'after';
    if (insertPos === 'before') {
        cardAlvo.before(cardArrastado);
    } else {
        cardAlvo.after(cardArrastado);
    }
    
    // Remover indicadores visuais
    cardAlvo.classList.remove('drag-over-encomenda', 'drop-insert-before', 'drop-insert-after');
    cardAlvo.removeAttribute('data-drop-insert');
    
    // Enviar ordem para o servidor
    const dataAssociacao = document.getElementById('dataPlaneamento').value;
    
    // Reconstruir lista de IDs (encomenda_viatura.id) na ordem atual
    const idsOrdenados = Array.from(container.querySelectorAll('.encomenda-card'))
        .map(card => parseInt(card.getAttribute('data-atribuicao-id')))
        .filter(id => !isNaN(id));
    
    if (idsOrdenados.length === 0) return;
    
    // Enviar para o servidor
    fetch('/api/reordenar-encomendas-motorista', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            data_associacao: dataAssociacao,
            ids: idsOrdenados
        })
    })
    .then(response => response.json())
    .then(result => {
        if (!result.success) {
            console.error('Erro ao reordenar:', result);
            // Reverter mudança no DOM se falhar
            carregarViaturasMotoristas();
        }
    })
    .catch(error => {
        console.error('Erro ao reordenar encomendas:', error);
        // Reverter mudança no DOM se falhar
        carregarViaturasMotoristas();
    });
}

// ==================== FUNÇÕES DE SERVIÇO DO DIA ANTERIOR ====================

async function mostrarServicoDiaAnterior(viaturaId, nomeMotorista, matricula) {
    try {
        const dataInput = document.getElementById('dataPlaneamento');
        if (!dataInput || !dataInput.value) {
            alert('Por favor, selecione uma data primeiro.');
            return;
        }
        
        const dataSelecionada = new Date(dataInput.value);
        const diaAnterior = new Date(dataSelecionada);
        diaAnterior.setDate(diaAnterior.getDate() - 1);
        
        // Ajustar para dia útil anterior se necessário
        while (diaAnterior.getDay() === 0 || diaAnterior.getDay() === 6) {
            diaAnterior.setDate(diaAnterior.getDate() - 1);
        }
        
        const dataAnteriorStr = diaAnterior.toISOString().split('T')[0];
        
        const response = await fetch(`/api/viatura-motorista/${viaturaId}/servico-dia-anterior?data=${dataAnteriorStr}`);
        
        // Verificar se a resposta é JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Resposta não é JSON:', {
                status: response.status,
                statusText: response.statusText,
                contentType: contentType,
                body: text.substring(0, 500)
            });
            alert(`Erro ${response.status}: Não foi possível carregar o serviço do dia anterior. Verifique o console para mais detalhes.`);
            return;
        }
        
        let dados;
        try {
            dados = await response.json();
        } catch (jsonError) {
            console.error('Erro ao fazer parse do JSON:', jsonError);
            alert('Erro ao processar resposta do servidor.');
            return;
        }
        
        // Verificar se é um erro
        if (!response.ok) {
            const errorMsg = dados.error || 'Erro desconhecido';
            console.error('Erro ao carregar serviço:', errorMsg);
            alert('Erro ao carregar serviço do dia anterior: ' + errorMsg);
            return;
        }
        
        // Verificar se os elementos existem
        const titulo = document.getElementById('servicoDiaAnteriorTitulo');
        const info = document.getElementById('servicoDiaAnteriorInfo');
        const tbody = document.getElementById('servicoDiaAnteriorBody');
        const modal = document.getElementById('servicoDiaAnteriorModal');
        
        if (!titulo || !info || !tbody || !modal) {
            console.error('Elementos do modal não encontrados');
            alert('Erro: Modal não encontrado. Por favor, recarregue a página.');
            return;
        }
        
        // Atualizar modal
        titulo.textContent = `📋 Serviço do Dia Anterior - ${nomeMotorista} (${matricula})`;
        info.textContent = `Data: ${dataAnteriorStr}`;
        
        if (!Array.isArray(dados) || dados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="empty">Nenhuma encomenda no dia anterior</td></tr>';
        } else {
            tbody.innerHTML = dados.map(item => `
                <tr>
                    <td>${(item.local_carga || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
                    <td>${(item.cliente || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
                    <td>${(item.material || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
                </tr>
            `).join('');
        }
        
        modal.style.display = 'block';
    } catch (error) {
        console.error('Erro ao carregar serviço do dia anterior:', error);
        alert('Erro ao carregar serviço do dia anterior: ' + (error.message || 'Erro de conexão'));
    }
}

// Preencher, em fundo, o serviço do dia anterior dentro dos cards (sem encomendas hoje)
async function preencherServicoDiaAnteriorFundo() {
    try {
        const dataInput = document.getElementById('dataPlaneamento');
        if (!dataInput || !dataInput.value) return;
        const dataSelecionadaStr = dataInput.value;
        
        const zonas = Array.from(document.querySelectorAll('.motorista-encomendas[data-viatura-id]'));
        if (zonas.length === 0) return;
        
        await Promise.all(zonas.map(async (zona) => {
            // Se já tem encomendas hoje, não mostrar serviço de ontem
            if (zona.querySelector('.encomenda-card')) return;
            
            const fundo = zona.querySelector('.servico-anterior-fundo');
            if (!fundo) return;
            
            const viaturaId = parseInt(zona.getAttribute('data-viatura-id'));
            if (!viaturaId || isNaN(viaturaId)) return;

            try {
                // data-viatura-id nos cards é atribuicao_id (conjunto do dia). Último serviço por atribuição/conjunto.
                const response = await fetch(`/api/atribuicao/${viaturaId}/ultimo-servico?data_ref=${encodeURIComponent(dataSelecionadaStr)}`);
                if (!response.ok) return;
                
                const dados = await response.json();
                if (!dados || !Array.isArray(dados.encomendas) || dados.encomendas.length === 0) {
                    fundo.textContent = '';
                    return;
                }
                
                const linhas = dados.encomendas.map((item, idx) => {
                    const texto = (item.local_descarga || item.local_carga || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    return `${idx + 1}) ${texto || '—'}`;
                });
                
                fundo.innerHTML = linhas.join('<br>');
            } catch (e) {
                console.error('Erro ao preencher serviço do dia anterior no card:', e);
            }
        }));
    } catch (error) {
        console.error('Erro em preencherServicoDiaAnteriorFundo:', error);
    }
}

function fecharModalServicoDiaAnterior() {
    document.getElementById('servicoDiaAnteriorModal').style.display = 'none';
}

// ==================== FUNÇÃO PARA MOSTRAR ÚLTIMO SERVIÇO AO CLICAR ====================

async function mostrarUltimoServico(viaturaId, nomeMotorista, matricula) {
    const modal = document.getElementById('ultimoServicoModal');
    const titulo = document.getElementById('ultimoServicoTitulo');
    const info = document.getElementById('ultimoServicoInfo');
    const tbody = document.getElementById('ultimoServicoBody');
    
    if (!modal || !titulo || !info || !tbody) {
        console.error('Elementos do modal não encontrados');
        return;
    }
    
    // Atualizar título
    titulo.textContent = `📋 Último Serviço - ${nomeMotorista} (${matricula})`;
    info.textContent = 'Carregando...';
    tbody.innerHTML = '<tr><td colspan="3" class="loading">Carregando último serviço...</td></tr>';
    
    // Mostrar modal
    modal.style.display = 'block';
    
    try {
        const response = await fetch(`/api/viatura-motorista/${viaturaId}/ultimo-servico`);
        
        if (!response.ok) {
            throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }
        
        const dados = await response.json();
        
        if (dados.error) {
            throw new Error(dados.error);
        }
        
        if (!dados.data || !dados.encomendas || dados.encomendas.length === 0) {
            info.textContent = 'Nenhum serviço anterior encontrado';
            tbody.innerHTML = '<tr><td colspan="3" class="empty">Nenhum serviço anterior encontrado</td></tr>';
            return;
        }
        
        // Formatar data
        const dataObj = new Date(dados.data + 'T00:00:00');
        const dataFormatada = dataObj.toLocaleDateString('pt-PT', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        info.textContent = `Data: ${dataFormatada}`;
        
        // Preencher tabela
        tbody.innerHTML = dados.encomendas.map(e => `
            <tr>
                <td>${(e.local_carga || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
                <td>${(e.cliente || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
                <td>${(e.material || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error(`Erro ao carregar último serviço para viatura ${viaturaId}:`, error);
        info.textContent = 'Erro ao carregar';
        tbody.innerHTML = '<tr><td colspan="3" class="error">Erro ao carregar último serviço</td></tr>';
    }
}

async function mostrarUltimoServicoAtribuicao(atribuicaoId, nomeMotorista, matricula) {
    const modal = document.getElementById('ultimoServicoModal');
    const titulo = document.getElementById('ultimoServicoTitulo');
    const info = document.getElementById('ultimoServicoInfo');
    const tbody = document.getElementById('ultimoServicoBody');
    
    if (!modal || !titulo || !info || !tbody) {
        console.error('Elementos do modal não encontrados');
        return;
    }
    
    titulo.textContent = `📋 Último dia com trabalho - ${nomeMotorista} (${matricula})`;
    info.textContent = 'Carregando...';
    tbody.innerHTML = '<tr><td colspan="5" class="loading">Carregando último serviço...</td></tr>';
    
    modal.style.display = 'block';
    
    const dataPlaneamento = (document.getElementById('dataPlaneamento') && document.getElementById('dataPlaneamento').value) || new Date().toISOString().split('T')[0];
    const url = `/api/atribuicao/${atribuicaoId}/ultimo-servico?data_ref=${encodeURIComponent(dataPlaneamento)}&ultimo_dia_com_servico=1`;
    
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }
        
        const dados = await response.json();
        
        if (dados.error) {
            throw new Error(dados.error);
        }
        
        if (!dados.data || !dados.encomendas || dados.encomendas.length === 0) {
            info.textContent = 'Nenhum serviço no último dia com trabalho';
            tbody.innerHTML = '<tr><td colspan="5" class="empty">Nenhum serviço no último dia com trabalho</td></tr>';
            return;
        }
        
        const dataObj = new Date(dados.data + 'T00:00:00');
        const dataFormatada = dataObj.toLocaleDateString('pt-PT', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        info.textContent = `Data: ${dataFormatada}`;
        
        tbody.innerHTML = dados.encomendas.map((e, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${(e.local_carga || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
                <td>${(e.cliente || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
                <td>${(e.local_descarga || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
                <td>${(e.material || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Erro ao carregar último serviço:', error);
        info.textContent = 'Erro ao carregar último serviço';
        tbody.innerHTML = `<tr><td colspan="5" class="error">Erro: ${error.message}</td></tr>`;
    }
}

function fecharModalUltimoServico() {
    const modal = document.getElementById('ultimoServicoModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Fechar modal ao clicar fora dele
document.addEventListener('click', function(event) {
    const modal = document.getElementById('ultimoServicoModal');
    if (modal && event.target === modal) {
        fecharModalUltimoServico();
    }
});

// ==================== TOOLTIP ÚLTIMO SERVIÇO ====================

let tooltipServicoTimeout = null;
let tooltipServicoElement = null;

async function carregarUltimoServicoCard(viaturaId) {
    // Aguardar um pouco para garantir que o elemento está no DOM
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const container = document.getElementById(`ultimo-servico-${viaturaId}`);
    if (!container) {
        console.warn(`Container não encontrado para viatura ${viaturaId}`);
        return;
    }
    
    try {
        const response = await fetch(`/api/viatura-motorista/${viaturaId}/ultimo-servico`);
        
        if (!response.ok) {
            throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }
        
        const dados = await response.json();
        
        if (dados.error) {
            throw new Error(dados.error);
        }
        
        if (!dados.data || !dados.encomendas || dados.encomendas.length === 0) {
            container.innerHTML = '<div class="ultimo-servico-empty">Nenhum serviço anterior encontrado</div>';
            return;
        }
        
        // Formatar data
        const dataObj = new Date(dados.data + 'T00:00:00');
        const dataFormatada = dataObj.toLocaleDateString('pt-PT', { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
        
        container.innerHTML = `
            <div class="ultimo-servico-header">
                <span class="ultimo-servico-label">📋 Último Serviço:</span>
                <span class="ultimo-servico-data">${dataFormatada}</span>
            </div>
            <div class="ultimo-servico-encomendas">
                ${dados.encomendas.map(e => `
                    <div class="ultimo-servico-item">
                        <span class="ultimo-servico-local">${(e.local_carga || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
                        <span class="ultimo-servico-cliente">${(e.cliente || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
                        <span class="ultimo-servico-material">${(e.material || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (error) {
        console.error(`Erro ao carregar último serviço para viatura ${viaturaId}:`, error);
        container.innerHTML = '<div class="ultimo-servico-error">Erro ao carregar último serviço</div>';
    }
}

// ==================== MENU HAMBÚRGUER ====================

let codigoAdminVerificado = false;
let menuKeyListenerAtivo = false;

function toggleMenuHamburger() {
    // Abrir menu diretamente (sem pedir código)
    const menuModal = document.getElementById('menuHamburgerModal');
    if (menuModal) {
        menuModal.style.display = 'block';
        
        // SEMPRE remover listener anterior antes de adicionar novo (para evitar duplicados)
        document.removeEventListener('keydown', handleMenuKeyPress, true);
        
        // Adicionar listener para tecla "*" quando o menu estiver aberto
        // Usar capture: true para garantir que captura antes de outros handlers
        document.addEventListener('keydown', handleMenuKeyPress, true);
        menuKeyListenerAtivo = true;
        console.log('✅✅✅ Listener de tecla * ativado para o menu (toggleMenuHamburger)');
    }
}

function fecharMenuHamburger() {
    const menuModal = document.getElementById('menuHamburgerModal');
    if (menuModal) {
        menuModal.style.display = 'none';
    }
    
    // Remover listener quando fechar o menu
    if (menuKeyListenerAtivo) {
        document.removeEventListener('keydown', handleMenuKeyPress, true);
        menuKeyListenerAtivo = false;
        console.log('Listener de tecla * desativado');
    }
}

function handleMenuKeyPress(event) {
    // Verificar se o menu está aberto
    const menuModal = document.getElementById('menuHamburgerModal');
    if (!menuModal) {
        return;
    }
    
    const menuAberto = menuModal.style.display === 'block' || 
                       window.getComputedStyle(menuModal).display === 'block';
    
    if (!menuAberto) {
        return;
    }
    
    // Verificar se a tecla pressionada é "*" (Shift + 8) ou "Multiply" no teclado numérico
    // Também verificar código da tecla (42 é o código ASCII para *)
    const keyPressed = event.key;
    const keyCode = event.keyCode || event.which || event.keyCode;
    const code = event.code;
    
    console.log('Tecla pressionada no menu:', {
        key: keyPressed,
        keyCode: keyCode,
        code: code,
        shiftKey: event.shiftKey,
        menuAberto: menuAberto
    });
    
    // Verificar múltiplas formas de detectar a tecla *
    const isAsterisk = keyPressed === '*' || 
                       keyPressed === 'Multiply' || 
                       keyPressed === 'NumpadMultiply' ||
                       code === 'Digit8' && event.shiftKey ||
                       code === 'NumpadMultiply' ||
                       keyCode === 42 ||
                       (keyPressed === '8' && event.shiftKey);
    
    if (isAsterisk) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        console.log('✅✅✅ Tecla * confirmada! Abrindo modal de código admin...');
        // Abrir modal de código secreto
        abrirModalCodigoAdmin();
        return false;
    }
}

function abrirModalCodigoAdmin() {
    console.log('🔐 Abrindo modal de código admin...');
    
    // Fechar menu hambúrguer primeiro
    fecharMenuHamburger();
    
    // Aguardar um pouco para garantir que o menu fechou
    setTimeout(() => {
        const modal = document.getElementById('modalCodigoAdmin');
        if (modal) {
            modal.style.display = 'block';
            console.log('✅ Modal de código admin aberto');
            
            const input = document.getElementById('codigoAdminInput');
            if (input) {
                input.value = '';
                // Aguardar um pouco antes de focar para garantir que o modal está visível
                setTimeout(() => {
                    input.focus();
                    console.log('✅ Input focado');
                }, 150);
            } else {
                console.error('❌ Input de código não encontrado!');
            }
        } else {
            console.error('❌ Modal de código admin não encontrado!');
            alert('Erro: Modal de código não encontrado. Verifique a consola (F12) para mais detalhes.');
        }
    }, 100);
}

function fecharModalCodigoAdmin() {
    const modal = document.getElementById('modalCodigoAdmin');
    if (modal) {
        modal.style.display = 'none';
        const input = document.getElementById('codigoAdminInput');
        if (input) {
            input.value = '';
        }
    }
}

function verificarCodigoAdmin() {
    const input = document.getElementById('codigoAdminInput');
    if (!input) return;
    
    const codigo = input.value.trim();
    
    if (codigo === '1990') {
        codigoAdminVerificado = true;
        fecharModalCodigoAdmin();
        
        // Definir cookie de administração
        document.cookie = 'admin_code=1990; max-age=3600; path=/';
        
        // Abrir painel de administração no mesmo separador (não em novo separador)
        window.location.href = '/admin/dashboard?code=1990';
        return;
    } else {
        alert('❌ Código incorreto. Tente novamente.');
        input.value = '';
        input.focus();
    }
}

// Função chamada quando o código é inserido corretamente
function onCodigoAutorizado() {
    // Após código autorizado, mostrar menu
    document.getElementById('menuHamburgerModal').style.display = 'block';
}

function fecharMenuHamburger() {
    document.getElementById('menuHamburgerModal').style.display = 'none';
}

// ==================== ANTI-CRIANÇAS ====================

function abrirModalAntiCriancas() {
    // Pedir código apenas para Anti-Crianças
    if (!codigoDesbloqueioAtivo) {
        // Guardar ação pendente
        window.pendingAntiCriancasAction = function() {
            fecharMenuHamburger();
            document.getElementById('antiCriancasModal').style.display = 'block';
            mostrarTabAntiCriancas('historico');
            carregarHistoricoAlteracoes();
        };
        abrirModalCodigoAutorizacao();
    } else {
        fecharMenuHamburger();
        document.getElementById('antiCriancasModal').style.display = 'block';
        mostrarTabAntiCriancas('historico');
        carregarHistoricoAlteracoes();
    }
}

function fecharModalAntiCriancas() {
    document.getElementById('antiCriancasModal').style.display = 'none';
}

function mostrarTabAntiCriancas(tab) {
    // Esconder todos os conteúdos
    document.getElementById('tabContentHistorico').style.display = 'none';
    document.getElementById('tabContentUtilizadores').style.display = 'none';
    
    // Remover classe ativa de todos os botões
    document.getElementById('tabHistorico').classList.remove('btn-tab-active');
    document.getElementById('tabHistorico').classList.add('btn-tab');
    document.getElementById('tabUtilizadores').classList.remove('btn-tab-active');
    document.getElementById('tabUtilizadores').classList.add('btn-tab');
    
    // Mostrar conteúdo selecionado
    if (tab === 'historico') {
        document.getElementById('tabContentHistorico').style.display = 'block';
        document.getElementById('tabHistorico').classList.remove('btn-tab');
        document.getElementById('tabHistorico').classList.add('btn-tab-active');
        carregarHistoricoAlteracoes();
    } else if (tab === 'utilizadores') {
        document.getElementById('tabContentUtilizadores').style.display = 'block';
        document.getElementById('tabUtilizadores').classList.remove('btn-tab');
        document.getElementById('tabUtilizadores').classList.add('btn-tab-active');
        carregarUtilizadoresSistema();
    }
}

// ==================== GESTÃO DE UTILIZADORES ====================

async function carregarUtilizadoresSistema() {
    try {
        const tbody = document.getElementById('utilizadoresBody');
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="8" class="loading">Carregando utilizadores...</td></tr>';
        
        const response = await fetch('/api/utilizadores');
        if (!response.ok) {
            if (response.status === 401) {
                tbody.innerHTML = '<tr><td colspan="8" style="color: red;">Não autenticado. Por favor, faça login novamente.</td></tr>';
                return;
            }
            if (response.status === 403) {
                tbody.innerHTML = '<tr><td colspan="8" style="color: red;">Acesso negado. Apenas administradores podem gerir utilizadores.</td></tr>';
                return;
            }
            throw new Error('Erro ao carregar utilizadores');
        }
        
        const utilizadores = await response.json();
        
        if (utilizadores.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty">Nenhum utilizador encontrado</td></tr>';
            return;
        }
        
        tbody.innerHTML = utilizadores.map(u => `
            <tr>
                <td style="color: #333;">${u.id}</td>
                <td style="color: #333;"><strong>${u.username}</strong></td>
                <td style="color: #333;">${u.nome}</td>
                <td style="color: #333;">${u.email || '-'}</td>
                <td style="color: #333;">${u.is_admin ? '✅ Sim' : '❌ Não'}</td>
                <td style="color: #333;">${u.ativo ? '✅ Ativo' : '❌ Inativo'}</td>
                <td style="color: #333;">${u.last_login ? new Date(u.last_login).toLocaleString('pt-PT') : 'Nunca'}</td>
                <td style="color: #333;">
                    <button onclick="abrirModalUtilizador(${u.id})" class="btn btn-sm btn-primary" style="padding: 5px 10px; font-size: 12px;">✏️ Editar</button>
                    ${u.ativo ? 
                        `<button onclick="removerUtilizador(${u.id})" class="btn btn-sm btn-danger" style="padding: 5px 10px; font-size: 12px;">🚫 Desativar</button>` :
                        `<button onclick="ativarUtilizador(${u.id})" class="btn btn-sm btn-success" style="padding: 5px 10px; font-size: 12px;">✅ Ativar</button>`
                    }
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Erro ao carregar utilizadores:', error);
        const tbody = document.getElementById('utilizadoresBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" style="color: red;">Erro ao carregar utilizadores: ' + error.message + '</td></tr>';
        }
    }
}

function abrirModalUtilizador(id = null) {
    const modal = document.getElementById('modalUtilizador');
    const titulo = document.getElementById('modalUtilizadorTitulo');
    const form = document.getElementById('formUtilizador');
    const passwordHint = document.getElementById('passwordHint');
    const passwordObrigatorio = document.getElementById('passwordObrigatorio');
    
    if (id) {
        // Editar utilizador existente
        titulo.textContent = '✏️ Editar Utilizador';
        passwordHint.style.display = 'block';
        passwordObrigatorio.style.display = 'none';
        document.getElementById('utilizadorPassword').required = false;
        
        // Carregar dados do utilizador
        fetch(`/api/utilizadores/${id}`)
            .then(response => response.json())
            .then(utilizador => {
                document.getElementById('utilizadorId').value = utilizador.id;
                document.getElementById('utilizadorUsername').value = utilizador.username;
                document.getElementById('utilizadorUsername').disabled = true; // Não permitir alterar username
                document.getElementById('utilizadorNome').value = utilizador.nome;
                document.getElementById('utilizadorEmail').value = utilizador.email || '';
                document.getElementById('utilizadorIsAdmin').checked = utilizador.is_admin;
                document.getElementById('utilizadorAtivo').checked = utilizador.ativo;
                document.getElementById('utilizadorPassword').value = '';
                modal.style.display = 'block';
            })
            .catch(error => {
                console.error('Erro ao carregar utilizador:', error);
                alert('Erro ao carregar dados do utilizador');
            });
    } else {
        // Novo utilizador
        titulo.textContent = '➕ Adicionar Utilizador';
        passwordHint.style.display = 'none';
        passwordObrigatorio.style.display = 'inline';
        document.getElementById('utilizadorPassword').required = true;
        form.reset();
        document.getElementById('utilizadorId').value = '';
        document.getElementById('utilizadorUsername').disabled = false;
        document.getElementById('utilizadorAtivo').checked = true;
        modal.style.display = 'block';
    }
}

function fecharModalUtilizador() {
    document.getElementById('modalUtilizador').style.display = 'none';
    document.getElementById('formUtilizador').reset();
    document.getElementById('utilizadorUsername').disabled = false;
}

async function salvarUtilizador(event) {
    event.preventDefault();
    
    const id = document.getElementById('utilizadorId').value;
    const username = document.getElementById('utilizadorUsername').value.trim();
    const nome = document.getElementById('utilizadorNome').value.trim();
    const email = document.getElementById('utilizadorEmail').value.trim();
    const password = document.getElementById('utilizadorPassword').value.trim();
    const is_admin = document.getElementById('utilizadorIsAdmin').checked;
    const ativo = document.getElementById('utilizadorAtivo').checked;
    
    if (!username || !nome) {
        alert('Username e nome são obrigatórios');
        return;
    }
    
    if (!id && !password) {
        alert('Password é obrigatória para novos utilizadores');
        return;
    }
    
    const dados = {
        username,
        nome,
        email,
        is_admin,
        ativo
    };
    
    if (password) {
        dados.password = password;
    }
    
    try {
        const url = id ? `/api/utilizadores/${id}` : '/api/utilizadores';
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dados)
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Utilizador guardado com sucesso!');
            fecharModalUtilizador();
            carregarUtilizadoresSistema();
        } else {
            alert('❌ Erro ao guardar utilizador: ' + (result.error || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro ao guardar utilizador:', error);
        alert('❌ Erro ao guardar utilizador: ' + error.message);
    }
}

async function removerUtilizador(id) {
    if (!confirm('Tem certeza que deseja desativar este utilizador?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/utilizadores/${id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Utilizador desativado com sucesso!');
            carregarUtilizadoresSistema();
        } else {
            alert('❌ Erro ao desativar utilizador: ' + (result.error || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro ao desativar utilizador:', error);
        alert('❌ Erro ao desativar utilizador');
    }
}

async function ativarUtilizador(id) {
    try {
        // Carregar utilizador e atualizar para ativo
        const response = await fetch(`/api/utilizadores/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ativo: true })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Utilizador ativado com sucesso!');
            carregarUtilizadoresSistema();
        } else {
            alert('❌ Erro ao ativar utilizador: ' + (result.error || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro ao ativar utilizador:', error);
        alert('❌ Erro ao ativar utilizador');
    }
}

async function carregarHistoricoAlteracoes() {
    try {
        const tbody = document.getElementById('historicoAlteracoesBody');
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="6" class="loading">Carregando histórico de alterações...</td></tr>';
        
        const response = await fetch('/api/historico-alteracoes');
        const dados = await response.json();
        
        if (!dados || dados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty">Nenhuma alteração registada</td></tr>';
            return;
        }
        
        // Tipos de ações que podem ser revertidas
        const acoesReversiveis = [
            'REMOVER_PEDIDO',
            'APAGAR_CARD_DIA',
            'APAGAR_CARD_PERMANENTE',
            'ALTERAR_MATRICULA',
            'MOVER_ENCOMENDA',
            'ALTERAR_DATA_PEDIDO',
            'ATRIBUIR_ENCOMENDA',
            'REMOVER_ATRIBUICAO',
            'DISPONIBILIDADE_FORCADA',
            'DESATIVAR_CARD_DATA_ATUAL'
        ];
        
        tbody.innerHTML = dados.map(item => {
            const dataAcao = new Date(item.data_acao).toLocaleString('pt-PT');
            const revertido = item.revertido ? 'Revertido' : 'Ativo';
            const corStatus = item.revertido ? '#999' : '#4CAF50';
            // Permitir reverter sempre que a ação for reversível (mesmo que já tenha sido revertida)
            const podeReverter = acoesReversiveis.includes(item.tipo_acao);
            
            // Mensagem de confirmação baseada no tipo de ação
            let mensagemConfirmacao = 'Tem certeza que deseja reverter esta alteração?';
            if (item.tipo_acao === 'REMOVER_PEDIDO') {
                mensagemConfirmacao = 'Tem certeza que deseja reverter esta alteração? O pedido será restaurado.';
            } else if (item.tipo_acao === 'APAGAR_CARD_DIA' || item.tipo_acao === 'APAGAR_CARD_PERMANENTE') {
                mensagemConfirmacao = 'Tem certeza que deseja reverter esta alteração? O card será restaurado.';
            } else if (item.tipo_acao === 'MOVER_ENCOMENDA') {
                mensagemConfirmacao = 'Tem certeza que deseja reverter esta alteração? A encomenda voltará à posição original.';
            } else if (item.tipo_acao === 'ALTERAR_DATA_PEDIDO') {
                mensagemConfirmacao = 'Tem certeza que deseja reverter esta alteração? A data será restaurada.';
            } else if (item.tipo_acao === 'ATRIBUIR_ENCOMENDA' || item.tipo_acao === 'REMOVER_ATRIBUICAO') {
                mensagemConfirmacao = 'Tem certeza que deseja reverter esta alteração? A atribuição será revertida.';
            } else if (item.tipo_acao === 'DISPONIBILIDADE_FORCADA') {
                mensagemConfirmacao = 'Tem certeza que deseja reverter? O status anterior (Férias/Baixa/Outros trabalhos) será reposto.';
            } else if (item.tipo_acao === 'DESATIVAR_CARD_DATA_ATUAL') {
                mensagemConfirmacao = 'Tem certeza que deseja reverter? O card será reativado e as encomendas repostas.';
            }
            
            // Escapar a mensagem para uso seguro em HTML/JavaScript
            const mensagemEscapada = mensagemConfirmacao
                .replace(/'/g, "\\'")
                .replace(/"/g, '&quot;')
                .replace(/\n/g, ' ');
            
            const userNome = item.user_nome || '—';
            return `
                <tr>
                    <td style="color: #333;">
                        ${podeReverter 
                            ? `<button onclick="reverterAlteracao(${item.id}, event)" class="btn btn-sm ${item.revertido ? 'btn-warning' : 'btn-success'}" title="${item.revertido ? 'Reverter novamente (desfazer reversão anterior)' : 'Reverter esta ação'}" data-mensagem="${mensagemEscapada}">${item.revertido ? '↩️ Reverter Novamente' : '↩️ Reverter'}</button>` 
                            : '<span style="color: #999;">Não reversível</span>'}
                    </td>
                    <td style="color: #333;">${dataAcao}</td>
                    <td style="color: #333;">${item.tipo_acao}</td>
                    <td style="color: #333;">${item.descricao}</td>
                    <td style="color: #333;">${userNome}</td>
                    <td style="color: ${corStatus}; font-weight: bold;">${revertido}</td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Erro ao carregar histórico de alterações:', error);
        const tbody = document.getElementById('historicoAlteracoesBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty">Erro ao carregar histórico</td></tr>';
        }
    }
}

async function reverterAlteracao(historicoId, event) {
    // Obter mensagem do botão se disponível
    let mensagemConfirmacao = 'Tem certeza que deseja reverter esta alteração?';
    
    if (event && event.target) {
        const mensagemAttr = event.target.getAttribute('data-mensagem');
        if (mensagemAttr) {
            mensagemConfirmacao = mensagemAttr.replace(/&quot;/g, '"');
        }
    } else {
        // Tentar encontrar o botão pelo ID
        const botao = document.querySelector(`button[onclick*="reverterAlteracao(${historicoId})"]`);
        if (botao) {
            const mensagemAttr = botao.getAttribute('data-mensagem');
            if (mensagemAttr) {
                mensagemConfirmacao = mensagemAttr.replace(/&quot;/g, '"');
            }
        }
    }
    
    if (!confirm(mensagemConfirmacao)) {
        return;
    }
    
    console.log('Revertendo alteração ID:', historicoId);
    
    try {
        const response = await fetch(`/api/reverter-acao/${historicoId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Resposta da API:', response.status, response.statusText);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Erro na resposta:', errorText);
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { error: errorText };
            }
            throw new Error(errorData.error || `Erro HTTP ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Resultado:', result);
        
        if (result.success) {
            alert('✅ Alteração revertida com sucesso!');
            carregarHistoricoAlteracoes();
            // Recarregar dados da página
            const dataInput = document.getElementById('dataPlaneamento');
            if (dataInput && dataInput.value) {
                carregarEncomendasPendentesDia();
                carregarViaturasMotoristas();
            }
        } else {
            alert('❌ Erro ao reverter alteração: ' + (result.error || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro ao reverter alteração:', error);
        alert('❌ Erro ao reverter alteração: ' + (error.message || error));
    }
}

// ==================== ANÁLISES ====================

let graficosAnalises = {};

function abrirModalAnalises() {
    document.getElementById('analisesModal').style.display = 'block';
    // Definir datas padrão (últimos 30 dias)
    const hoje = new Date();
    const dataFim = hoje.toISOString().split('T')[0];
    const dataInicio = new Date(hoje);
    dataInicio.setDate(dataInicio.getDate() - 30);
    const dataInicioStr = dataInicio.toISOString().split('T')[0];
    
    document.getElementById('analiseDataInicio').value = dataInicioStr;
    document.getElementById('analiseDataFim').value = dataFim;
    
    carregarFiltrosAnalises();
    carregarAnalises();
}

function fecharModalAnalises() {
    document.getElementById('analisesModal').style.display = 'none';
    // Destruir gráficos ao fechar
    Object.values(graficosAnalises).forEach(grafico => {
        if (grafico) grafico.destroy();
    });
    graficosAnalises = {};
}

async function carregarFiltrosAnalises() {
    try {
        // Carregar motoristas
        const responseMotoristas = await fetch('/api/viatura-motorista');
        const motoristas = await responseMotoristas.json();
        const selectMotorista = document.getElementById('filtroAnaliseMotorista');
        selectMotorista.innerHTML = '<option value="">Todos</option>';
        motoristas.forEach(m => {
            const option = document.createElement('option');
            option.value = m.id;
            option.textContent = `${m.matricula} - ${m.nome_motorista}`;
            selectMotorista.appendChild(option);
        });
        
        // Carregar clientes e materiais do histórico
        const dataInicio = document.getElementById('analiseDataInicio').value;
        const dataFim = document.getElementById('analiseDataFim').value;
        const responseHistorico = await fetch(`/api/historico-entregas?data_inicio=${dataInicio}&data_fim=${dataFim}`);
        const historico = await responseHistorico.json();
        
        // Extrair clientes únicos
        const clientes = [...new Set(historico.map(h => h.cliente).filter(c => c))];
        const selectCliente = document.getElementById('filtroAnaliseCliente');
        selectCliente.innerHTML = '<option value="">Todos</option>';
        clientes.sort().forEach(c => {
            const option = document.createElement('option');
            option.value = c;
            option.textContent = c;
            selectCliente.appendChild(option);
        });
        
        // Extrair materiais únicos
        const materiais = [...new Set(historico.map(h => h.material).filter(m => m))];
        const selectMaterial = document.getElementById('filtroAnaliseMaterial');
        selectMaterial.innerHTML = '<option value="">Todos</option>';
        materiais.sort().forEach(m => {
            const option = document.createElement('option');
            option.value = m;
            option.textContent = m;
            selectMaterial.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar filtros:', error);
    }
}

async function carregarAnalises() {
    const dataInicio = document.getElementById('analiseDataInicio').value;
    const dataFim = document.getElementById('analiseDataFim').value;
    const motoristaId = document.getElementById('filtroAnaliseMotorista').value;
    const cliente = document.getElementById('filtroAnaliseCliente').value;
    const material = document.getElementById('filtroAnaliseMaterial').value;
    
    if (!dataInicio || !dataFim) {
        alert('Por favor, selecione as datas de início e fim');
        return;
    }
    
    try {
        const params = new URLSearchParams({
            data_inicio: dataInicio,
            data_fim: dataFim
        });
        
        if (motoristaId) params.append('motorista_id', motoristaId);
        if (cliente) params.append('cliente', cliente);
        if (material) params.append('material', material);
        
        console.log('Carregando análises com parâmetros:', params.toString());
        console.log('URL completa:', `/api/analises?${params}`);
        
        let response;
        try {
            response = await fetch(`/api/analises?${params}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        } catch (fetchError) {
            console.error('Erro ao fazer fetch:', fetchError);
            throw new Error('Não foi possível conectar ao servidor. Verifique se o servidor Flask está rodando.');
        }
        
        if (!response.ok) {
            let errorText;
            try {
                errorText = await response.text();
            } catch {
                errorText = `Erro HTTP ${response.status}`;
            }
            console.error('Erro na resposta:', response.status, errorText);
            throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
        }
        
        let dados;
        try {
            dados = await response.json();
        } catch (jsonError) {
            console.error('Erro ao parsear JSON:', jsonError);
            const text = await response.text();
            console.error('Resposta do servidor:', text);
            throw new Error('Resposta inválida do servidor');
        }
        
        console.log('Dados recebidos:', dados);
        
        // Atualizar resumo
        if (dados.resumo) {
            atualizarResumo(dados.resumo);
        }
        
        // Atualizar gráficos
        if (dados.entregas_por_dia) {
            atualizarGraficoEntregas(dados.entregas_por_dia);
        }
        if (dados.entregas_por_motorista) {
            atualizarGraficoMotoristas(dados.entregas_por_motorista);
        }
        if (dados.entregas_por_cliente) {
            atualizarGraficoClientes(dados.entregas_por_cliente);
        }
        if (dados.entregas_por_material) {
            atualizarGraficoMateriais(dados.entregas_por_material);
        }
        // Sempre chamar atualizarDisponibilidadesForcadas, mesmo se não houver dados
        const disponibilidades = dados.disponibilidades_forcadas || [];
        console.log('DEBUG - Chamando atualizarDisponibilidadesForcadas com:', disponibilidades);
        atualizarDisponibilidadesForcadas(disponibilidades);
        const noiteFora = dados.noite_fora_por_motorista || [];
        atualizarNoiteFora(noiteFora);
        
    } catch (error) {
        console.error('Erro ao carregar análises:', error);
        alert('Erro ao carregar análises: ' + error.message);
    }
}

function atualizarResumo(resumo) {
    document.getElementById('totalEntregas').textContent = resumo.total_entregas || 0;
    document.getElementById('totalMotoristas').textContent = resumo.total_motoristas || 0;
    document.getElementById('totalClientes').textContent = resumo.total_clientes || 0;
    document.getElementById('mediaDiaria').textContent = resumo.media_diaria ? resumo.media_diaria.toFixed(1) : 0;
}

function atualizarGraficoEntregas(dados) {
    const ctx = document.getElementById('graficoEntregas');
    if (!ctx) return;
    
    if (graficosAnalises.entregas) {
        graficosAnalises.entregas.destroy();
    }
    
    graficosAnalises.entregas = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dados.map(d => d.data),
            datasets: [{
                label: 'Entregas',
                data: dados.map(d => d.total),
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Entregas por Dia'
                }
            }
        }
    });
}

function atualizarGraficoMotoristas(dados) {
    const ctx = document.getElementById('graficoMotoristas');
    if (!ctx) return;
    
    if (graficosAnalises.motoristas) {
        graficosAnalises.motoristas.destroy();
    }
    
    graficosAnalises.motoristas = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dados.map(d => d.motorista),
            datasets: [{
                label: 'Número de Entregas',
                data: dados.map(d => d.total),
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Entregas por Motorista'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function atualizarGraficoClientes(dados) {
    const ctx = document.getElementById('graficoClientes');
    if (!ctx) return;
    
    if (!dados || dados.length === 0) {
        if (graficosAnalises.clientes) {
            graficosAnalises.clientes.destroy();
            graficosAnalises.clientes = null;
        }
        const tbody = document.getElementById('tabelaClientesBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #666;">Nenhum dado no período selecionado</td></tr>';
        return;
    }
    
    const totalGeral = dados.reduce((s, d) => s + (Number(d.total) || 0), 0);
    const dadosComPerc = dados.map(d => {
        const total = Number(d.total) || 0;
        const perc = totalGeral > 0 ? (100 * total / totalGeral) : 0;
        return { ...d, total, percentagem: perc };
    });
    
    if (graficosAnalises.clientes) {
        graficosAnalises.clientes.destroy();
    }
    
    graficosAnalises.clientes = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: dadosComPerc.map(d => `${d.cliente} (${d.percentagem.toFixed(1)}%)`),
            datasets: [{
                data: dadosComPerc.map(d => d.total),
                backgroundColor: [
                    'rgba(255, 99, 132, 0.6)',
                    'rgba(54, 162, 235, 0.6)',
                    'rgba(255, 206, 86, 0.6)',
                    'rgba(75, 192, 192, 0.6)',
                    'rgba(153, 102, 255, 0.6)',
                    'rgba(255, 159, 64, 0.6)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Distribuição por Cliente'
                },
                legend: {
                    position: 'right'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.parsed;
                            const pct = totalGeral > 0 ? (100 * total / totalGeral).toFixed(1) : '0';
                            return `${context.label.replace(/ \(\d+\.?\d*%\)$/, '')}: ${total} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
    
    const tbody = document.getElementById('tabelaClientesBody');
    if (tbody) {
        const escape = (s) => String(s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        tbody.innerHTML = dadosComPerc.map(d => 
            `<tr><td style="padding: 8px;">${escape(d.cliente)}</td><td style="padding: 8px; text-align: right;">${d.total}</td><td style="padding: 8px; text-align: right;">${d.percentagem.toFixed(1)}%</td></tr>`
        ).join('');
    }
}

function atualizarNoiteFora(dados) {
    const tbody = document.getElementById('noiteForaBody');
    if (!tbody) return;
    if (!dados || dados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px;">Nenhum registo de noite fora no período selecionado</td></tr>';
        return;
    }
    tbody.innerHTML = dados.map(item => {
        const datasStr = (item.dias || []).join(', ');
        return `<tr>
            <td style="padding: 10px; border: 1px solid #ddd;">${(item.nome_motorista || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${item.total_dias || 0}</td>
            <td style="padding: 10px; border: 1px solid #ddd; font-size: 12px;">${datasStr.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        </tr>`;
    }).join('');
}

function atualizarDisponibilidadesForcadas(dados) {
    console.log('DEBUG - atualizarDisponibilidadesForcadas chamada com:', dados);
    const tbody = document.getElementById('disponibilidadesForcadasBody');
    if (!tbody) {
        console.error('DEBUG - disponibilidadesForcadasBody não encontrado!');
        // Tentar encontrar novamente após um pequeno delay
        setTimeout(() => {
            const tbody2 = document.getElementById('disponibilidadesForcadasBody');
            if (tbody2) {
                console.log('DEBUG - Encontrado disponibilidadesForcadasBody após delay');
                atualizarDisponibilidadesForcadas(dados);
            }
        }, 100);
        return;
    }
    
    console.log('DEBUG - tbody encontrado:', tbody);
    
    if (!dados || dados.length === 0) {
        console.log('DEBUG - Nenhum dado de disponibilidade forçada');
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Nenhuma disponibilidade forçada registada no período selecionado</td></tr>';
        return;
    }
    
    console.log('DEBUG - Renderizando', dados.length, 'disponibilidades forçadas');
    
    // Limpar tbody primeiro
    tbody.innerHTML = '';
    
    dados.forEach((item, index) => {
        console.log(`DEBUG - Processando item ${index}:`, JSON.stringify(item));
        
        // Formatar data/hora
        let dataHora = 'N/A';
        try {
            if (item.data) {
                let dateStr = String(item.data);
                // Converter formato "2026-01-08 16:16:41" para ISO
                if (dateStr.includes(' ') && !dateStr.includes('T')) {
                    dateStr = dateStr.replace(' ', 'T');
                }
                const dateObj = new Date(dateStr);
                if (!isNaN(dateObj.getTime())) {
                    dataHora = dateObj.toLocaleString('pt-PT', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                } else {
                    dataHora = String(item.data);
                }
            }
        } catch (e) {
            console.error('DEBUG - Erro ao formatar data:', e, item.data);
            dataHora = item.data ? String(item.data) : 'N/A';
        }
        
        // Extrair valores - garantir que são strings válidas
        const nomeMotorista = (item.nome_motorista && String(item.nome_motorista).trim()) ? String(item.nome_motorista).trim() : 'N/A';
        const matricula = (item.matricula && String(item.matricula).trim()) ? String(item.matricula).trim() : 'N/A';
        const statusAnterior = item.status_anterior === 'Ferias' ? '🏖️ Férias' : (item.status_anterior === 'Baixa' ? '🏥 Baixa' : (item.status_anterior ? String(item.status_anterior) : 'N/A'));
        const dataStatus = (item.data_status && String(item.data_status).trim()) ? String(item.data_status).trim() : 'N/A';
        const descricao = (item.descricao && String(item.descricao).trim()) ? String(item.descricao).trim() : '';
        
        console.log(`DEBUG - Item ${index} valores:`, { 
            dataHora, 
            nomeMotorista, 
            matricula, 
            statusAnterior, 
            dataStatus, 
            descricao 
        });
        
        // Criar linha usando innerHTML diretamente (mais simples e confiável)
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 10px; border: 1px solid #ddd; color: #333;">${dataHora}</td>
            <td style="padding: 10px; border: 1px solid #ddd; color: #333;">${nomeMotorista}</td>
            <td style="padding: 10px; border: 1px solid #ddd; color: #333;">${matricula}</td>
            <td style="padding: 10px; border: 1px solid #ddd; color: #333;">${statusAnterior}</td>
            <td style="padding: 10px; border: 1px solid #ddd; color: #333;">${dataStatus}</td>
            <td style="padding: 10px; border: 1px solid #ddd; color: #333;">${descricao}</td>
        `;
        
        tbody.appendChild(tr);
        
        // Verificar imediatamente após adicionar
        const celulas = tr.querySelectorAll('td');
        celulas.forEach((td, idx) => {
            if (!td.textContent && !td.innerText) {
                console.warn(`DEBUG - Célula ${idx} está vazia após criação!`);
            }
        });
    });
    
    console.log('DEBUG - Tabela atualizada, número de linhas:', tbody.children.length);
    console.log('DEBUG - HTML gerado:', tbody.innerHTML.substring(0, 500));
    
    // Verificar se o elemento está visível
    const analiseDiv = document.getElementById('analiseDisponibilidadesForcadas');
    if (analiseDiv) {
        console.log('DEBUG - analiseDisponibilidadesForcadas display:', window.getComputedStyle(analiseDiv).display);
        console.log('DEBUG - analiseDisponibilidadesForcadas visibility:', window.getComputedStyle(analiseDiv).visibility);
    }
    
    // Verificar se as células têm conteúdo visível
    const primeiraLinha = tbody.querySelector('tr');
    if (primeiraLinha) {
        const celulas = primeiraLinha.querySelectorAll('td');
        console.log('DEBUG - Primeira linha tem', celulas.length, 'células');
        celulas.forEach((td, idx) => {
            const computedStyle = window.getComputedStyle(td);
            console.log(`DEBUG - Célula ${idx}: textContent="${td.textContent}", display="${computedStyle.display}", visibility="${computedStyle.visibility}", color="${computedStyle.color}"`);
        });
    } else {
        console.error('DEBUG - Nenhuma linha encontrada no tbody!');
    }
}

function atualizarGraficoMateriais(dados) {
    const ctx = document.getElementById('graficoMateriais');
    if (!ctx) return;
    
    if (graficosAnalises.materiais) {
        graficosAnalises.materiais.destroy();
    }
    
    graficosAnalises.materiais = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dados.map(d => d.material),
            datasets: [{
                label: 'Quantidade',
                data: dados.map(d => d.total),
                backgroundColor: 'rgba(255, 159, 64, 0.6)',
                borderColor: 'rgba(255, 159, 64, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Entregas por Material'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function mostrarAnalise(tipo) {
    // Esconder todos os conteúdos
    document.querySelectorAll('.analise-content').forEach(el => {
        el.style.display = 'none';
    });
    
    // Remover classe ativa de todos os botões
    document.querySelectorAll('[id^="tab"]').forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
    });
    
    // Mostrar conteúdo selecionado
    let elementoId;
    if (tipo === 'baixas-ferias') {
        elementoId = 'analiseBaixasFerias';
    } else if (tipo === 'disponibilidades-forcadas') {
        elementoId = 'analiseDisponibilidadesForcadas';
    } else if (tipo === 'noite-fora') {
        elementoId = 'analiseNoiteFora';
    } else {
        elementoId = `analise${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`;
    }
    document.getElementById(elementoId).style.display = 'block';
    
    // Ativar botão
    let btnId;
    if (tipo === 'baixas-ferias') {
        btnId = 'tabBaixasFerias';
    } else if (tipo === 'disponibilidades-forcadas') {
        btnId = 'tabDisponibilidadesForcadas';
    } else if (tipo === 'noite-fora') {
        btnId = 'tabNoiteFora';
    } else {
        btnId = `tab${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`;
    }
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-primary');
    }
    
    // Se for o tab de baixas e férias, carregar automaticamente
    if (tipo === 'baixas-ferias') {
        carregarRelatorioBaixasFerias();
    }
}

function limparFiltrosAnalises() {
    document.getElementById('analiseDataInicio').value = '';
    document.getElementById('analiseDataFim').value = '';
    document.getElementById('filtroAnaliseMotorista').value = '';
    document.getElementById('filtroAnaliseCliente').value = '';
    document.getElementById('filtroAnaliseMaterial').value = '';
    carregarAnalises();
}

// ==================== REMOVER PEDIDO ====================

async function removerPedido(tipo, pedidoId) {
    if (!confirm(`Tem certeza que deseja remover este pedido ${tipo}?`)) {
        return;
    }
    
    try {
        // Verificar se precisa de código de autorização
        const dataInput = document.getElementById('dataPlaneamento');
        const dataAtual = dataInput ? dataInput.value : null;
        
        let codigoAutorizacao = null;
        const isAnterior = isDataAnterior(dataAtual);
        
        if (isAnterior && codigoDesbloqueioAtivo) {
            codigoAutorizacao = CODIGO_SECRETO;
        } else if (isAnterior && !codigoDesbloqueioAtivo) {
            // Solicitar código
            abrirModalCodigoAutorizacao();
            // Aguardar código ser inserido (será chamado novamente após código)
            return;
        }
        
        const response = await fetch('/api/remover-pedido', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: pedidoId,
                tipo: tipo,
                codigo_autorizacao: codigoAutorizacao
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Pedido removido com sucesso!');
            // Recarregar dados
            carregarEncomendasPendentesDia();
            carregarViaturasMotoristas();
        } else {
            if (response.status === 403 && result.error && (result.error.includes('1990') || result.error.includes('código de autorização'))) {
                abrirModalCodigoAutorizacao();
            } else {
                alert('❌ Erro ao remover pedido: ' + (result.error || 'Erro desconhecido'));
            }
        }
    } catch (error) {
        console.error('Erro ao remover pedido:', error);
        alert('❌ Erro ao remover pedido');
    }
}

// ==================== VERIFICAÇÃO DE AUTENTICAÇÃO ====================
// Verificar se o utilizador está autenticado ao carregar a página
document.addEventListener('DOMContentLoaded', async function() {
    // Verificar autenticação apenas se não estiver na página de login
    if (window.location.pathname === '/login') {
        // Se estiver na página de login, verificar se já está autenticado
        try {
            const response = await fetch('/api/auth/check');
            if (response.ok) {
                const data = await response.json();
                if (data.authenticated) {
                    // Já autenticado - redirecionar para página principal
                    window.location.href = '/';
                    return;
                }
            }
        } catch (error) {
            // Erro ao verificar - manter na página de login
            console.error('Erro ao verificar autenticação:', error);
        }
        return;
    }
    
    // Verificar autenticação para outras páginas
    try {
        const response = await fetch('/api/auth/check');
        if (!response.ok || response.status === 401) {
            // Não autenticado - redirecionar para login
            window.location.href = '/login';
            return;
        }
        const data = await response.json();
        if (!data.authenticated) {
            window.location.href = '/login';
            return;
        }
        // Utilizador autenticado - atualizar dropdown do utilizador e continuar
        atualizarUserDropdown(data.user);
        inicializarSplashScreen();
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        window.location.href = '/login';
        return;
    }
});

// ==================== DROPDOWN DO UTILIZADOR ====================

let userDropdownOpen = false;

function atualizarUserDropdown(user) {
    if (!user) return;
    
    const userNameDisplay = document.getElementById('userNameDisplay');
    const userDropdownName = document.getElementById('userDropdownName');
    const userDropdownUsername = document.getElementById('userDropdownUsername');
    
    if (userNameDisplay) {
        userNameDisplay.textContent = `👤 ${user.nome || user.username}`;
    }
    if (userDropdownName) {
        userDropdownName.textContent = user.nome || 'Utilizador';
    }
    if (userDropdownUsername) {
        userDropdownUsername.textContent = `@${user.username}`;
        if (user.is_admin) {
            userDropdownUsername.textContent += ' (Admin)';
            userDropdownUsername.classList.add('admin');
        } else {
            userDropdownUsername.classList.remove('admin');
        }
    }
}

function toggleUserDropdown() {
    const dropdown = document.getElementById('userDropdownMenu');
    if (!dropdown) return;
    
    userDropdownOpen = !userDropdownOpen;
    dropdown.style.display = userDropdownOpen ? 'block' : 'none';
    
    // Fechar ao clicar fora
    if (userDropdownOpen) {
        setTimeout(() => {
            document.addEventListener('click', fecharUserDropdownOnClick);
        }, 100);
    }
}

function fecharUserDropdownOnClick(event) {
    const dropdown = document.getElementById('userDropdownMenu');
    const btn = document.getElementById('userDropdownBtn');
    
    if (dropdown && btn && !dropdown.contains(event.target) && !btn.contains(event.target)) {
        dropdown.style.display = 'none';
        userDropdownOpen = false;
        document.removeEventListener('click', fecharUserDropdownOnClick);
    }
}

async function fazerLogout() {
    try {
        const response = await fetch('/api/logout', {
            method: 'POST'
        });
        
        if (response.ok) {
            window.location.href = '/login';
        } else {
            alert('Erro ao fazer logout');
        }
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
        // Mesmo com erro, redirecionar para login
        window.location.href = '/login';
    }
}

// Carregar informações do utilizador ao iniciar
document.addEventListener('DOMContentLoaded', async function() {
    // Verificar se não está na página de login
    if (window.location.pathname !== '/login') {
        try {
            const response = await fetch('/api/auth/check');
            if (response.ok) {
                const data = await response.json();
                if (data.authenticated && data.user) {
                    atualizarUserDropdown(data.user);
                }
            }
        } catch (error) {
            console.error('Erro ao carregar informações do utilizador:', error);
        }
    }
});

function inicializarSplashScreen() {
    const splashScreen = document.getElementById('splashScreen');
    const mainContainer = document.getElementById('mainContainer');
    
    if (splashScreen && mainContainer) {
        // Função para esconder splash e mostrar conteúdo principal
        window.hideSplash = function() {
            splashScreen.classList.add('hidden');
            setTimeout(() => {
                splashScreen.style.display = 'none';
                mainContainer.style.display = 'block';
                document.body.style.overflow = 'auto'; // Restaurar scroll
                
                // Após esconder splash, mostrar menu hambúrguer diretamente (sem pedir código)
                setTimeout(() => {
                    // Usar a função toggleMenuHamburger para garantir que o listener é ativado
                    toggleMenuHamburger();
                }, 300);
                
                // Carregar dados após mostrar o painel (mas não mostrar janelas ainda)
                if (typeof carregarEncomendasPendentesDia === 'function') {
                    carregarEncomendasPendentesDia();
                }
                if (typeof carregarViaturasMotoristas === 'function') {
                    carregarViaturasMotoristas();
                }
            }, 500); // Aguardar animação de fade out
        }
        
        // Clique no splash screen para continuar
        splashScreen.addEventListener('click', window.hideSplash);
        
        // Também permitir tecla Enter ou Espaço
        document.addEventListener('keydown', function(e) {
            if (splashScreen.style.display !== 'none' && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                window.hideSplash();
            }
        });
        
        // Auto-hide após 5 segundos (opcional - pode remover se preferir apenas clique)
        // setTimeout(() => {
        //     if (splashScreen.style.display !== 'none') {
        //         window.hideSplash();
        //     }
        // }, 5000);
    }
}

// ==================== BASE DE DADOS DE CLIENTES ====================
async function carregarClientesLocais() {
    try {
        const response = await fetch('/api/clientes-locais');
        if (!response.ok) throw new Error('Erro ao carregar clientes');
        
        const clientes = await response.json();
        renderizarClientesLocais(clientes);
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
        document.getElementById('clientesTableBody').innerHTML = 
            '<tr><td colspan="5" style="text-align: center; color: red;">Erro ao carregar dados</td></tr>';
    }
}

function renderizarClientesLocais(clientes) {
    const tbody = document.getElementById('clientesTableBody');
    if (!tbody) return;
    
    if (clientes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #666;">Nenhum cliente cadastrado</td></tr>';
        return;
    }
    
    tbody.innerHTML = clientes.map(cliente => {
        const clienteEscaped = escapeHtml(cliente.cliente).replace(/'/g, "\\'");
        const localEscaped = escapeHtml(cliente.local_descarga).replace(/'/g, "\\'");
        return `
        <tr>
            <td>${escapeHtml(cliente.cliente)}</td>
            <td>${escapeHtml(cliente.local_descarga)}</td>
            <td>
                <button type="button" class="btn-materiais-cliente btn btn-secondary" data-id="${cliente.id}" style="padding: 4px 8px;">📦 Materiais</button>
            </td>
            <td>
                <button type="button" class="btn-locais-carga-cliente btn btn-secondary" data-id="${cliente.id}" style="padding: 4px 8px;">🚚 Locais Carga</button>
            </td>
            <td>
                <button onclick="editarCliente(${cliente.id}, '${clienteEscaped}', '${localEscaped}')" 
                        class="btn-edit">✏️ Editar</button>
                <button onclick="removerCliente(${cliente.id})" 
                        class="btn-delete">🗑️ Remover</button>
            </td>
        </tr>
    `;
    }).join('');
    tbody.querySelectorAll('.btn-materiais-cliente').forEach(btn => {
        btn.addEventListener('click', function() {
            var row = this.closest('tr');
            var cliente = row && row.cells[0] ? row.cells[0].textContent.trim() : '';
            var localDescarga = row && row.cells[1] ? row.cells[1].textContent.trim() : '';
            abrirModalMateriaisClienteLocal(parseInt(this.getAttribute('data-id'), 10), cliente, localDescarga);
        });
    });
    tbody.querySelectorAll('.btn-locais-carga-cliente').forEach(btn => {
        btn.addEventListener('click', function() {
            var row = this.closest('tr');
            var cliente = row && row.cells[0] ? row.cells[0].textContent.trim() : '';
            var localDescarga = row && row.cells[1] ? row.cells[1].textContent.trim() : '';
            abrirModalLocaisCargaClienteLocal(parseInt(this.getAttribute('data-id'), 10), cliente, localDescarga);
        });
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.abrirModalAdicionarCliente = function() {
    document.getElementById('clienteId').value = '';
    document.getElementById('clienteNome').value = '';
    document.getElementById('clienteLocalDescarga').value = '';
    document.getElementById('clienteModalTitle').textContent = 'Adicionar Cliente e Local de Descarga';
    document.getElementById('clienteModal').style.display = 'block';
};

window.editarCliente = function(id, cliente, localDescarga) {
    document.getElementById('clienteId').value = id;
    document.getElementById('clienteNome').value = cliente;
    document.getElementById('clienteLocalDescarga').value = localDescarga;
    document.getElementById('clienteModalTitle').textContent = 'Editar Cliente e Local de Descarga';
    document.getElementById('clienteModal').style.display = 'block';
};

window.fecharModalCliente = function() {
    document.getElementById('clienteModal').style.display = 'none';
};

window.removerCliente = async function(id) {
    if (!confirm('Tem certeza que deseja remover este cliente/local de descarga?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/clientes-locais/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('✅ Cliente/local removido com sucesso!');
            carregarClientesLocais();
        } else {
            const result = await response.json();
            alert('❌ Erro ao remover: ' + (result.error || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro ao remover cliente:', error);
        alert('❌ Erro ao remover cliente');
    }
};

function garantirModalMateriaisClienteLocal() {
    var modal = document.getElementById('materiaisClienteLocalModal');
    if (modal) return { modal: modal, inputId: document.getElementById('materiaisClienteLocalId'), titleEl: document.getElementById('materiaisClienteLocalTitle'), subEl: document.getElementById('materiaisClienteLocalSub'), lista: document.getElementById('materiaisClienteLocalLista') };
    modal = document.createElement('div');
    modal.id = 'materiaisClienteLocalModal';
    modal.className = 'modal';
    modal.innerHTML = '<div class="modal-content" style="max-width: 480px;"><span class="close" onclick="fecharModalMateriaisClienteLocal()">&times;</span><h2 id="materiaisClienteLocalTitle">Materiais que este local recebe</h2><p id="materiaisClienteLocalSub" style="margin: 0 0 12px 0; color: #666; font-size: 14px;"></p><input type="hidden" id="materiaisClienteLocalId"><div id="materiaisClienteLocalLista" style="max-height: 320px; overflow-y: auto; border: 1px solid #ddd; border-radius: 6px; padding: 10px; margin-bottom: 12px;"></div><div class="form-actions"><button type="button" onclick="salvarMateriaisClienteLocal()" class="btn btn-primary">Guardar</button><button type="button" onclick="fecharModalMateriaisClienteLocal()" class="btn btn-secondary">Cancelar</button></div></div>';
    document.body.appendChild(modal);
    return { modal: modal, inputId: document.getElementById('materiaisClienteLocalId'), titleEl: document.getElementById('materiaisClienteLocalTitle'), subEl: document.getElementById('materiaisClienteLocalSub'), lista: document.getElementById('materiaisClienteLocalLista') };
}

window.abrirModalMateriaisClienteLocal = async function(clienteLocalId, cliente, localDescarga) {
    var ref = garantirModalMateriaisClienteLocal();
    var modal = ref.modal, inputId = ref.inputId, titleEl = ref.titleEl, subEl = ref.subEl, lista = ref.lista;
    inputId.value = clienteLocalId;
    if (titleEl) titleEl.textContent = 'Materiais que este local recebe';
    if (subEl) subEl.textContent = (typeof escapeHtml === 'function' ? escapeHtml(cliente) : cliente) + ' — ' + (typeof escapeHtml === 'function' ? escapeHtml(localDescarga) : localDescarga);
    lista.innerHTML = '<p class="loading">A carregar...</p>';
    modal.style.display = 'block';
    try {
        const resMateriais = await fetch('/api/materiais');
        const resIds = await fetch(`/api/materiais-cliente-local?cliente_local_id=${clienteLocalId}`);
        if (!resMateriais.ok) {
            var msg = (await resMateriais.text()) || resMateriais.statusText;
            try { var j = JSON.parse(msg); msg = j.error || msg; } catch (_) {}
            throw new Error('Lista de materiais: ' + (msg || resMateriais.status));
        }
        if (!resIds.ok) {
            var msg = (await resIds.text()) || resIds.statusText;
            try { var j = JSON.parse(msg); msg = j.error || msg; } catch (_) {}
            throw new Error('Materiais do local: ' + (msg || resIds.status));
        }
        const materiais = await resMateriais.json();
        const idsMarcados = new Set(await resIds.json());
        lista.innerHTML = materiais.map(m => {
            const checked = idsMarcados.has(m.id) ? ' checked' : '';
            return `<label style="display: block; margin: 6px 0;"><input type="checkbox" value="${m.id}"${checked}> ${escapeHtml(m.nome)}</label>`;
        }).join('');
    } catch (e) {
        console.error(e);
        lista.innerHTML = '<p style="color: red;">Erro ao carregar materiais. ' + (e.message || e) + '</p>';
    }
};

window.fecharModalMateriaisClienteLocal = function() {
    var m = document.getElementById('materiaisClienteLocalModal');
    if (m) m.style.display = 'none';
};

window.salvarMateriaisClienteLocal = async function() {
    const id = document.getElementById('materiaisClienteLocalId').value;
    const lista = document.getElementById('materiaisClienteLocalLista');
    const materialIds = Array.from(lista.querySelectorAll('input[type="checkbox"]:checked')).map(cb => parseInt(cb.value, 10));
    try {
        const res = await fetch('/api/materiais-cliente-local', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cliente_local_id: parseInt(id, 10), material_ids: materialIds })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Erro');
        alert('✅ Materiais guardados.');
        fecharModalMateriaisClienteLocal();
    } catch (e) {
        alert('❌ Erro ao guardar: ' + (e.message || e));
    }
};

function garantirModalLocaisCargaClienteLocal() {
    var modal = document.getElementById('locaisCargaClienteLocalModal');
    if (modal) return { modal: modal, inputId: document.getElementById('locaisCargaClienteLocalId'), titleEl: document.getElementById('locaisCargaClienteLocalTitle'), subEl: document.getElementById('locaisCargaClienteLocalSub'), lista: document.getElementById('locaisCargaClienteLocalLista') };
    modal = document.createElement('div');
    modal.id = 'locaisCargaClienteLocalModal';
    modal.className = 'modal';
    modal.innerHTML = '<div class="modal-content" style="max-width: 480px;"><span class="close" onclick="fecharModalLocaisCargaClienteLocal()">&times;</span><h2 id="locaisCargaClienteLocalTitle">Locais de carga deste cliente/local</h2><p id="locaisCargaClienteLocalSub" style="margin: 0 0 12px 0; color: #666; font-size: 14px;"></p><input type="hidden" id="locaisCargaClienteLocalId"><div id="locaisCargaClienteLocalLista" style="max-height: 320px; overflow-y: auto; border: 1px solid #ddd; border-radius: 6px; padding: 10px; margin-bottom: 12px;"></div><div class="form-actions"><button type="button" onclick="salvarLocaisCargaClienteLocal()" class="btn btn-primary">Guardar</button><button type="button" onclick="fecharModalLocaisCargaClienteLocal()" class="btn btn-secondary">Cancelar</button></div></div>';
    document.body.appendChild(modal);
    return { modal: modal, inputId: document.getElementById('locaisCargaClienteLocalId'), titleEl: document.getElementById('locaisCargaClienteLocalTitle'), subEl: document.getElementById('locaisCargaClienteLocalSub'), lista: document.getElementById('locaisCargaClienteLocalLista') };
}

window.abrirModalLocaisCargaClienteLocal = async function(clienteLocalId, cliente, localDescarga) {
    var ref = garantirModalLocaisCargaClienteLocal();
    var modal = ref.modal, inputId = ref.inputId, titleEl = ref.titleEl, subEl = ref.subEl, lista = ref.lista;
    inputId.value = clienteLocalId;
    if (titleEl) titleEl.textContent = 'Locais de carga para este cliente/local';
    if (subEl) subEl.textContent = (typeof escapeHtml === 'function' ? escapeHtml(cliente) : cliente) + ' — ' + (typeof escapeHtml === 'function' ? escapeHtml(localDescarga) : localDescarga);
    lista.innerHTML = '<p class="loading">A carregar...</p>';
    modal.style.display = 'block';
    try {
        var resTodos = await fetch('/api/locais-carga');
        var resAssoc = await fetch('/api/locais-carga-cliente-local/' + clienteLocalId);
        if (!resTodos.ok || !resAssoc.ok) throw new Error('Erro ao carregar');
        var todos = await resTodos.json();
        var assoc = await resAssoc.json();
        var idsMarcados = new Set((Array.isArray(assoc) ? assoc : []).map(function (x) { return x.id; }));
        lista.innerHTML = todos.map(function (lc) {
            var checked = idsMarcados.has(lc.id) ? ' checked' : '';
            return '<label style="display: block; margin: 6px 0;"><input type="checkbox" value="' + lc.id + '"' + checked + '> ' + (escapeHtml(lc.nome) || '') + '</label>';
        }).join('');
    } catch (e) {
        console.error(e);
        lista.innerHTML = '<p style="color: red;">Erro ao carregar locais de carga.</p>';
    }
};

window.fecharModalLocaisCargaClienteLocal = function() {
    var m = document.getElementById('locaisCargaClienteLocalModal');
    if (m) m.style.display = 'none';
};

window.salvarLocaisCargaClienteLocal = async function() {
    var id = document.getElementById('locaisCargaClienteLocalId').value;
    var lista = document.getElementById('locaisCargaClienteLocalLista');
    var ids = Array.from(lista.querySelectorAll('input[type="checkbox"]:checked')).map(function (cb) { return parseInt(cb.value, 10); });
    try {
        var res = await fetch('/api/locais-carga-cliente-local', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cliente_local_id: parseInt(id, 10), local_carga_ids: ids })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Erro');
        alert('✅ Locais de carga guardados.');
        fecharModalLocaisCargaClienteLocal();
    } catch (e) {
        alert('❌ Erro ao guardar: ' + (e.message || e));
    }
};

// Event listener para o formulário de cliente
document.addEventListener('DOMContentLoaded', function() {
    const clienteForm = document.getElementById('clienteForm');
    if (clienteForm) {
        clienteForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const id = document.getElementById('clienteId').value;
            const cliente = document.getElementById('clienteNome').value.trim();
            const localDescarga = document.getElementById('clienteLocalDescarga').value.trim();
            
            if (!cliente || !localDescarga) {
                alert('Por favor, preencha todos os campos');
                console.log('DEBUG - Validação falhou:', { cliente, localDescarga });
                return;
            }
            
            try {
                let response;
                if (id) {
                    // Atualizar
                    response = await fetch(`/api/clientes-locais/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ cliente, local_descarga: localDescarga })
                    });
                } else {
                    // Adicionar
                    response = await fetch('/api/clientes-locais', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ cliente, local_descarga: localDescarga })
                    });
                }
                
                const result = await response.json();
                
                if (response.ok) {
                    alert('✅ Cliente/local salvo com sucesso!');
                    fecharModalCliente();
                    carregarClientesLocais();
                    // Recarregar locais no formulário de pedido para incluir o novo local
                    carregarLocaisNoSelect('');
                    // Recarregar clientes também
                    carregarClientesNoSelect();
                } else {
                    alert('❌ Erro ao salvar: ' + (result.error || 'Erro desconhecido'));
                }
            } catch (error) {
                console.error('Erro ao salvar cliente:', error);
                alert('❌ Erro ao salvar cliente');
            }
        });
    }
    
    // Fechar modal ao clicar fora
    window.onclick = function(event) {
        const clienteModal = document.getElementById('clienteModal');
        const materialModal = document.getElementById('materialModal');
        if (event.target === clienteModal) {
            fecharModalCliente();
        }
        if (event.target === materialModal) {
            fecharModalMaterial();
        }
    };
});

// ==================== BASE DE DADOS DE MATERIAIS ====================
async function carregarMateriais() {
    try {
        const response = await fetch('/api/materiais');
        if (!response.ok) throw new Error('Erro ao carregar materiais');
        
        const materiais = await response.json();
        renderizarMateriais(materiais);
    } catch (error) {
        console.error('Erro ao carregar materiais:', error);
        document.getElementById('materiaisTableBody').innerHTML = 
            '<tr><td colspan="3" style="text-align: center; color: red;">Erro ao carregar dados</td></tr>';
    }
}

function renderizarMateriais(materiais) {
    const tbody = document.getElementById('materiaisTableBody');
    if (!tbody) return;
    
    if (materiais.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #666;">Nenhum material cadastrado</td></tr>';
        return;
    }
    
    tbody.innerHTML = materiais.map(material => `
        <tr>
            <td>${escapeHtml(material.nome)}</td>
            <td>${escapeHtml(material.descricao || '')}</td>
            <td>
                <button onclick="editarMaterial(${material.id}, '${escapeHtml(material.nome).replace(/'/g, "\\'")}', '${escapeHtml(material.descricao || '').replace(/'/g, "\\'")}')" 
                        class="btn-edit">✏️ Editar</button>
                <button onclick="removerMaterial(${material.id})" 
                        class="btn-delete">🗑️ Remover</button>
            </td>
        </tr>
    `).join('');
}

window.abrirModalAdicionarMaterial = function() {
    document.getElementById('materialId').value = '';
    document.getElementById('materialNome').value = '';
    document.getElementById('materialDescricao').value = '';
    document.getElementById('materialModalTitle').textContent = 'Adicionar Material';
    document.getElementById('materialModal').style.display = 'block';
};

window.editarMaterial = function(id, nome, descricao) {
    document.getElementById('materialId').value = id;
    document.getElementById('materialNome').value = nome;
    document.getElementById('materialDescricao').value = descricao || '';
    document.getElementById('materialModalTitle').textContent = 'Editar Material';
    document.getElementById('materialModal').style.display = 'block';
};

window.fecharModalMaterial = function() {
    document.getElementById('materialModal').style.display = 'none';
};

window.removerMaterial = async function(id) {
    if (!confirm('Tem certeza que deseja remover este material?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/materiais/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('✅ Material removido com sucesso!');
            carregarMateriais();
        } else {
            const result = await response.json();
            alert('❌ Erro ao remover: ' + (result.error || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro ao remover material:', error);
        alert('❌ Erro ao remover material');
    }
};

// Event listener para o formulário de material
document.addEventListener('DOMContentLoaded', function() {
    const materialForm = document.getElementById('materialForm');
    if (materialForm) {
        materialForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const id = document.getElementById('materialId').value;
            const nome = document.getElementById('materialNome').value.trim();
            const descricao = document.getElementById('materialDescricao').value.trim();
            
            if (!nome) {
                alert('Por favor, preencha o nome do material');
                return;
            }
            
            try {
                let response;
                if (id) {
                    // Atualizar
                    response = await fetch(`/api/materiais/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ nome, descricao })
                    });
                } else {
                    // Adicionar
                    response = await fetch('/api/materiais', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ nome, descricao })
                    });
                }
                
                const result = await response.json();
                
                if (response.ok) {
                    alert('✅ Material salvo com sucesso!');
                    fecharModalMaterial();
                    carregarMateriais();
                } else {
                    alert('❌ Erro ao salvar: ' + (result.error || 'Erro desconhecido'));
                }
            } catch (error) {
                console.error('Erro ao salvar material:', error);
                alert('❌ Erro ao salvar material');
            }
        });
    }
});

// ==================== BASE DE DADOS DE LOCAIS DE CARGA ====================
async function carregarLocaisCarga() {
    try {
        const response = await fetch('/api/locais-carga');
        if (!response.ok) throw new Error('Erro ao carregar locais de carga');
        
        const locais = await response.json();
        renderizarLocaisCarga(locais);
    } catch (error) {
        console.error('Erro ao carregar locais de carga:', error);
        const tbody = document.getElementById('locaisCargaTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">Erro ao carregar dados</td></tr>';
        }
    }
}

/** Se só houver um local de carga em _locaisCargaAtual, preenche o campo automaticamente. */
function autoPreencherSeUnicoLocalCarga() {
    var list = window._locaisCargaAtual;
    var input = document.getElementById('localCarga');
    if (!input || !list || list.length !== 1) return;
    var nome = (list[0].nome != null) ? String(list[0].nome).trim() : '';
    if (nome) input.value = nome;
}

/** Se só houver um material em _materiaisPermitidos, preenche o campo e atualiza locais de carga; depois pode auto-preencher local de carga. */
function autoPreencherSeUnicoMaterial() {
    var list = window._materiaisPermitidos;
    var input = document.getElementById('material');
    if (!input || !list || list.length !== 1) return;
    var nome = (list[0].nome != null) ? String(list[0].nome) : (list[0] && String(list[0]));
    if (!nome) return;
    input.value = nome;
    atualizarDropdownLocaisCargaPorMaterial().then(autoPreencherSeUnicoLocalCarga);
}

/** Se só houver um local de descarga em _locaisClienteAtual, preenche o campo e atualiza materiais; depois pode auto-preencher material e local de carga. */
function autoPreencherSeUnicoLocalDescarga() {
    var list = window._locaisClienteAtual;
    var input = document.getElementById('localDescarga');
    if (!input || !list || list.length !== 1) return;
    var nome = (list[0].local_descarga != null) ? String(list[0].local_descarga).trim() : '';
    if (!nome) return;
    input.value = nome;
    atualizarMateriaisPermitidos().then(function () {
        atualizarDropdownMateriaisNoModal();
        autoPreencherSeUnicoMaterial();
        atualizarDropdownLocaisCargaNoModal();
    });
}

/** Obtém cliente_local_id a partir dos campos Cliente e Local de Descarga. */
function obterClienteLocalIdNoModal() {
    var inputCliente = document.getElementById('cliente');
    var inputLocalDescarga = document.getElementById('localDescarga');
    var cliente = (inputCliente && inputCliente.value) ? inputCliente.value.trim() : '';
    var localDescarga = (inputLocalDescarga && inputLocalDescarga.value) ? inputLocalDescarga.value.trim() : '';
    var list = window._locaisClienteAtual || [];
    if (!localDescarga || !list.length) return null;
    var row = list.find(function (x) {
        var ld = (x.local_descarga || '').trim();
        if (ld !== localDescarga) return false;
        if (cliente && x.cliente != null && (x.cliente || '').trim() !== cliente) return false;
        return true;
    });
    return row ? row.id : null;
}

/** Atualiza o dropdown de Locais de Carga: por cliente/local (locais associados) e/ou por material (intersecção quando ambos). */
async function atualizarDropdownLocaisCargaNoModal() {
    var datalist = document.getElementById('locaisCargaList');
    var dropdownCarga = document.getElementById('localCargaDropdown');
    if (!datalist && !dropdownCarga) return;
    var clienteLocalId = obterClienteLocalIdNoModal();
    var materialNome = (document.getElementById('material') && document.getElementById('material').value) ? document.getElementById('material').value.trim() : '';
    var locaisPorCliente = null;
    var locaisPorMaterial = null;
    try {
        if (clienteLocalId) {
            var resCl = await fetch('/api/locais-carga-cliente-local/' + clienteLocalId);
            if (resCl.ok) locaisPorCliente = await resCl.json();
        }
        if (materialNome) {
            var resMat = await fetch('/api/locais-carga-por-material?material_nome=' + encodeURIComponent(materialNome));
            if (resMat.ok) locaisPorMaterial = await resMat.json();
        }
    } catch (e) {
        carregarLocaisCargaNoSelect();
        return;
    }
    var locais = [];
    if (Array.isArray(locaisPorCliente) && locaisPorCliente.length && Array.isArray(locaisPorMaterial) && locaisPorMaterial.length) {
        var idsMat = new Set((locaisPorMaterial || []).map(function (x) { return x.id; }));
        locais = (locaisPorCliente || []).filter(function (x) { return idsMat.has(x.id); });
    } else if (Array.isArray(locaisPorCliente) && locaisPorCliente.length) {
        locais = locaisPorCliente;
    } else if (Array.isArray(locaisPorMaterial) && locaisPorMaterial.length) {
        locais = locaisPorMaterial;
    }
    if (locais.length === 0) {
        carregarLocaisCargaNoSelect();
        return;
    }
    window._locaisCargaAtual = locais;
    if (datalist) {
        datalist.innerHTML = '';
        locais.forEach(function (local) {
            var opt = document.createElement('option');
            opt.value = local.nome;
            datalist.appendChild(opt);
        });
    }
    if (dropdownCarga) {
        dropdownCarga.innerHTML = '';
        locais.forEach(function (local) {
            var o = document.createElement('div');
            o.className = 'dropdown-option';
            o.textContent = local.nome;
            dropdownCarga.appendChild(o);
        });
    }
}

/** Mantido por compatibilidade: redireciona para a lógica que considera cliente/local e material. */
async function atualizarDropdownLocaisCargaPorMaterial() {
    await atualizarDropdownLocaisCargaNoModal();
}

/** Preenche o datalist e dropdown custom "Locais de Carga" no formulário de pedido */
async function carregarLocaisCargaNoSelect() {
    try {
        const response = await fetch('/api/locais-carga');
        if (!response.ok) throw new Error('Erro ao carregar locais de carga');
        
        const locais = await response.json();
        window._locaisCargaAtual = Array.isArray(locais) ? locais : [];
        const datalist = document.getElementById('locaisCargaList');
        if (!datalist) return;
        
        datalist.innerHTML = '';
        locais.forEach(local => {
            const option = document.createElement('option');
            option.value = local.nome;
            datalist.appendChild(option);
        });
        
        // Preencher dropdown customizado
        const dropdownCarga = document.getElementById('localCargaDropdown');
        if (dropdownCarga) {
            dropdownCarga.innerHTML = '';
            locais.forEach(local => {
                const o = document.createElement('div');
                o.className = 'dropdown-option';
                o.textContent = local.nome;
                dropdownCarga.appendChild(o);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar locais de carga no select:', error);
        window._locaisCargaAtual = [];
    }
}

/** Obtém cliente_local_id e local_carga_id a partir dos inputs do modal e chama API materiais-permitidos; atualiza window._materiaisPermitidos. */
async function atualizarMateriaisPermitidos() {
    const inputCliente = document.getElementById('cliente');
    const inputLocalDescarga = document.getElementById('localDescarga');
    const inputLocalCarga = document.getElementById('localCarga');
    const cliente = (inputCliente && inputCliente.value) ? inputCliente.value.trim() : '';
    const localDescarga = (inputLocalDescarga && inputLocalDescarga.value) ? inputLocalDescarga.value.trim() : '';
    const localCargaNome = (inputLocalCarga && inputLocalCarga.value) ? inputLocalCarga.value.trim() : '';
    var clienteLocalId = null;
    var localCargaId = null;
    var list = window._locaisClienteAtual || [];
    if (localDescarga && list.length) {
        var row = list.find(function (x) {
            var ld = (x.local_descarga || '').trim();
            if (ld !== localDescarga) return false;
            // Quando a lista vem de locais?cliente=X, não tem x.cliente; quando vem de /api/clientes-locais, tem
            if (cliente && x.cliente != null && (x.cliente || '').trim() !== cliente) return false;
            return true;
        });
        if (row) clienteLocalId = row.id;
    }
    list = window._locaisCargaAtual || [];
    if (localCargaNome && list.length) {
        var lc = list.find(function (x) { return (x.nome || '').trim() === localCargaNome; });
        if (lc) localCargaId = lc.id;
    }
    if (!clienteLocalId && !localCargaId) {
        window._materiaisPermitidos = null;
        return;
    }
    var params = new URLSearchParams();
    if (clienteLocalId) params.set('cliente_local_id', clienteLocalId);
    if (localCargaId) params.set('local_carga_id', localCargaId);
    try {
        var res = await fetch('/api/materiais-permitidos?' + params.toString());
        if (!res.ok) { window._materiaisPermitidos = null; return; }
        var data = await res.json();
        window._materiaisPermitidos = Array.isArray(data) ? data : null;
    } catch (e) {
        window._materiaisPermitidos = null;
    }
}

/** Limpa o campo Local de Descarga se o valor atual não estiver na lista permitida (_locaisClienteAtual). */
function limparLocalDescargaSeInvalido() {
    var input = document.getElementById('localDescarga');
    var list = window._locaisClienteAtual || [];
    if (!input || !input.value.trim()) return;
    var val = input.value.trim();
    var permitido = list.some(function (x) { return (x.local_descarga || '').trim() === val; });
    if (!permitido) input.value = '';
}

/** Limpa o campo Material se o valor atual não estiver em _materiaisPermitidos. */
function limparMaterialSeInvalido() {
    var input = document.getElementById('material');
    var list = window._materiaisPermitidos;
    if (!input || !input.value.trim()) return;
    if (!list || !list.length) return;
    var val = input.value.trim();
    var nomes = list.map(function (m) { return (m.nome || m).toString().trim(); });
    if (nomes.indexOf(val) === -1) input.value = '';
}

/** Limpa o campo Local de Carga se o valor atual não estiver em _locaisCargaAtual. */
function limparLocalCargaSeInvalido() {
    var input = document.getElementById('localCarga');
    var list = window._locaisCargaAtual || [];
    if (!input || !input.value.trim()) return;
    var val = input.value.trim();
    var permitido = list.some(function (x) { return (x.nome || '').trim() === val; });
    if (!permitido) input.value = '';
}

/** Mostrar/ocultar dropdown ao focar/sair e ao clicar numa opção (Cliente, Local de Descarga, Local de Carga, Material) */
function setupDropdownsPedidoModal() {
    var blurTimer;
    function setupOne(inputId, dropdownId, onSelect) {
        var input = document.getElementById(inputId);
        var dropdown = document.getElementById(dropdownId);
        if (!input || !dropdown) return;
        input.addEventListener('focus', function() {
            clearTimeout(blurTimer);
            if (dropdown.children.length) dropdown.classList.add('show');
        });
        input.addEventListener('blur', function() {
            blurTimer = setTimeout(function() { dropdown.classList.remove('show'); }, 200);
        });
        dropdown.addEventListener('click', function(e) {
            var opt = e.target.closest('.dropdown-option');
            if (opt) {
                input.value = opt.textContent.trim();
                dropdown.classList.remove('show');
                if (typeof onSelect === 'function') onSelect();
            }
        });
    }
    // Ao alterar Cliente: rever todos os campos para a frente (locais descarga → material → local carga)
    setupOne('cliente', 'clienteDropdown', function() {
        var cliente = document.getElementById('cliente').value;
        carregarLocaisNoSelect(cliente).then(function () {
            limparLocalDescargaSeInvalido();
            autoPreencherSeUnicoLocalDescarga();
            return atualizarMateriaisPermitidos();
        }).then(function () {
            atualizarDropdownMateriaisNoModal();
            return atualizarDropdownLocaisCargaNoModal();
        }).then(function () {
            limparMaterialSeInvalido();
            limparLocalCargaSeInvalido();
            autoPreencherSeUnicoMaterial();
        });
    });
    // Ao alterar Local de Descarga: rever campos para a frente (material → local carga)
    setupOne('localDescarga', 'localDescargaDropdown', function() {
        atualizarMateriaisPermitidos().then(function () {
            atualizarDropdownMateriaisNoModal();
            return atualizarDropdownLocaisCargaNoModal();
        }).then(function () {
            limparMaterialSeInvalido();
            limparLocalCargaSeInvalido();
            autoPreencherSeUnicoMaterial();
        });
    });
    // Ao alterar Local de Carga: rever material (opções + limpar inválido + auto-preencher se único)
    setupOne('localCarga', 'localCargaDropdown', function() {
        atualizarMateriaisPermitidos().then(function () {
            atualizarDropdownMateriaisNoModal();
            limparMaterialSeInvalido();
            autoPreencherSeUnicoMaterial();
        });
    });
    // Ao alterar Material: rever local de carga (opções + limpar inválido + auto-preencher se único)
    setupOne('material', 'materialDropdown', function() {
        atualizarDropdownLocaisCargaNoModal().then(function () {
            limparLocalCargaSeInvalido();
            autoPreencherSeUnicoLocalCarga();
        });
    });
    // Ao focar no campo material, atualizar lista de materiais permitidos (cliente/local e local carga já podem estar preenchidos)
    var materialInput = document.getElementById('material');
    if (materialInput) {
        materialInput.addEventListener('focus', function() {
            atualizarMateriaisPermitidos().then(atualizarDropdownMateriaisNoModal);
        });
        materialInput.addEventListener('input', function() {
            clearTimeout(window._timeoutLocaisCargaPorMaterial);
            window._timeoutLocaisCargaPorMaterial = setTimeout(atualizarDropdownLocaisCargaPorMaterial, 400);
        });
    }
    // Ao focar no campo local de carga, mostrar locais filtrados por cliente/local e material
    var localCargaInput = document.getElementById('localCarga');
    if (localCargaInput) {
        localCargaInput.addEventListener('focus', function() {
            atualizarDropdownLocaisCargaNoModal();
        });
    }
    // Ao focar em Cliente ou Local de Descarga, garantir que as opções estão atualizadas (para quando o utilizador volta a alterar)
    var clienteInput = document.getElementById('cliente');
    if (clienteInput) {
        clienteInput.addEventListener('focus', function() {
            var c = clienteInput.value.trim();
            if (c) carregarLocaisNoSelect(c);
        });
    }
    var localDescargaInput = document.getElementById('localDescarga');
    if (localDescargaInput) {
        localDescargaInput.addEventListener('focus', function() {
            var c = (document.getElementById('cliente') && document.getElementById('cliente').value) ? document.getElementById('cliente').value.trim() : '';
            if (c) carregarLocaisNoSelect(c).then(function () {
                atualizarMateriaisPermitidos().then(function () {
                    atualizarDropdownMateriaisNoModal();
                    atualizarDropdownLocaisCargaNoModal();
                });
            });
        });
    }
}

/** Atualiza o dropdown e datalist de materiais no modal de pedido com _materiaisPermitidos (ou todos se null). */
function atualizarDropdownMateriaisNoModal() {
    var list = window._materiaisPermitidos && window._materiaisPermitidos.length
        ? window._materiaisPermitidos.map(function (m) { return (m.nome || m).toString(); })
        : null;
    var datalist = document.getElementById('materiaisList');
    var dropdown = document.getElementById('materialDropdown');
    if (!datalist && !dropdown) return;
    if (list && list.length) {
        if (datalist) {
            datalist.innerHTML = '';
            list.forEach(function (nome) {
                var opt = document.createElement('option');
                opt.value = nome;
                datalist.appendChild(opt);
            });
        }
        if (dropdown) {
            dropdown.innerHTML = '';
            list.forEach(function (nome) {
                var o = document.createElement('div');
                o.className = 'dropdown-option';
                o.textContent = nome;
                dropdown.appendChild(o);
            });
        }
    } else {
        carregarMateriaisNoSelect();
    }
}

document.addEventListener('DOMContentLoaded', function() {
    setupDropdownsPedidoModal();
});

function renderizarLocaisCarga(locais) {
    const tbody = document.getElementById('locaisCargaTableBody');
    if (!tbody) return;
    
    if (locais.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #666;">Nenhum local de carga cadastrado</td></tr>';
        return;
    }
    
    tbody.innerHTML = locais.map(local => {
        const nomeEscaped = escapeHtml(local.nome).replace(/'/g, "\\'");
        const descEscaped = escapeHtml(local.descricao || '').replace(/'/g, "\\'");
        return `
        <tr>
            <td>${escapeHtml(local.nome)}</td>
            <td>${escapeHtml(local.descricao || '')}</td>
            <td>
                <button type="button" class="btn-materiais-localcarga btn btn-secondary" data-id="${local.id}" style="padding: 4px 8px;">📦 Materiais</button>
            </td>
            <td>
                <button onclick="editarLocalCarga(${local.id}, '${nomeEscaped}', '${descEscaped}')" 
                        class="btn-edit">✏️ Editar</button>
                <button onclick="removerLocalCarga(${local.id})" 
                        class="btn-delete">🗑️ Remover</button>
            </td>
        </tr>
    `;
    }).join('');
    // Delegar clique no botão Materiais
    tbody.querySelectorAll('.btn-materiais-localcarga').forEach(btn => {
        btn.addEventListener('click', function() {
            var row = this.closest('tr');
            var nome = row && row.cells[0] ? row.cells[0].textContent.trim() : '';
            abrirModalMateriaisLocalCarga(parseInt(this.getAttribute('data-id'), 10), nome);
        });
    });
}

function garantirModalMateriaisLocalCarga() {
    var modal = document.getElementById('materiaisLocalCargaModal');
    if (modal) return { modal: modal, inputId: document.getElementById('materiaisLocalCargaId'), titleEl: document.getElementById('materiaisLocalCargaTitle'), subEl: document.getElementById('materiaisLocalCargaSub'), lista: document.getElementById('materiaisLocalCargaLista') };
    modal = document.createElement('div');
    modal.id = 'materiaisLocalCargaModal';
    modal.className = 'modal';
    modal.innerHTML = '<div class="modal-content" style="max-width: 480px;"><span class="close" onclick="fecharModalMateriaisLocalCarga()">&times;</span><h2 id="materiaisLocalCargaTitle">Materiais que aqui se carregam</h2><p id="materiaisLocalCargaSub" style="margin: 0 0 12px 0; color: #666; font-size: 14px;"></p><input type="hidden" id="materiaisLocalCargaId"><div id="materiaisLocalCargaLista" style="max-height: 320px; overflow-y: auto; border: 1px solid #ddd; border-radius: 6px; padding: 10px; margin-bottom: 12px;"></div><div class="form-actions"><button type="button" onclick="salvarMateriaisLocalCarga()" class="btn btn-primary">Guardar</button><button type="button" onclick="fecharModalMateriaisLocalCarga()" class="btn btn-secondary">Cancelar</button></div></div>';
    document.body.appendChild(modal);
    return { modal: modal, inputId: document.getElementById('materiaisLocalCargaId'), titleEl: document.getElementById('materiaisLocalCargaTitle'), subEl: document.getElementById('materiaisLocalCargaSub'), lista: document.getElementById('materiaisLocalCargaLista') };
}

window.abrirModalMateriaisLocalCarga = async function(localCargaId, nome) {
    var ref = garantirModalMateriaisLocalCarga();
    var modal = ref.modal, inputId = ref.inputId, titleEl = ref.titleEl, subEl = ref.subEl, lista = ref.lista;
    inputId.value = localCargaId;
    if (titleEl) titleEl.textContent = 'Materiais que aqui se carregam';
    if (subEl) subEl.textContent = (typeof escapeHtml === 'function' ? escapeHtml(nome) : nome) || '';
    lista.innerHTML = '<p class="loading">A carregar...</p>';
    modal.style.display = 'block';
    try {
        const [resMateriais, resIds] = await Promise.all([
            fetch('/api/materiais'),
            fetch(`/api/materiais-local-carga?local_id=${localCargaId}`)
        ]);
        if (!resMateriais.ok || !resIds.ok) throw new Error('Erro ao carregar');
        const materiais = await resMateriais.json();
        const idsMarcados = new Set(await resIds.json());
        lista.innerHTML = materiais.map(m => {
            const checked = idsMarcados.has(m.id) ? ' checked' : '';
            return `<label style="display: block; margin: 6px 0;"><input type="checkbox" value="${m.id}"${checked}> ${escapeHtml(m.nome)}</label>`;
        }).join('');
    } catch (e) {
        console.error(e);
        lista.innerHTML = '<p style="color: red;">Erro ao carregar materiais.</p>';
    }
};

window.fecharModalMateriaisLocalCarga = function() {
    var modal = document.getElementById('materiaisLocalCargaModal');
    if (modal) modal.style.display = 'none';
};

window.salvarMateriaisLocalCarga = async function() {
    const inputId = document.getElementById('materiaisLocalCargaId');
    const lista = document.getElementById('materiaisLocalCargaLista');
    if (!inputId || !lista) return;
    const id = inputId.value;
    const materialIds = Array.from(lista.querySelectorAll('input[type="checkbox"]:checked')).map(cb => parseInt(cb.value, 10));
    try {
        const res = await fetch('/api/materiais-local-carga', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ local_id: parseInt(id, 10), material_ids: materialIds })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Erro');
        alert('✅ Materiais guardados.');
        fecharModalMateriaisLocalCarga();
    } catch (e) {
        alert('❌ Erro ao guardar: ' + (e.message || e));
    }
};

window.abrirModalAdicionarLocalCarga = function() {
    document.getElementById('localCargaId').value = '';
    document.getElementById('localCargaNome').value = '';
    document.getElementById('localCargaDescricao').value = '';
    document.getElementById('localCargaModalTitle').textContent = 'Adicionar Local de Carga';
    document.getElementById('localCargaModal').style.display = 'block';
};

window.editarLocalCarga = function(id, nome, descricao) {
    document.getElementById('localCargaId').value = id;
    document.getElementById('localCargaNome').value = nome;
    document.getElementById('localCargaDescricao').value = descricao || '';
    document.getElementById('localCargaModalTitle').textContent = 'Editar Local de Carga';
    document.getElementById('localCargaModal').style.display = 'block';
};

window.fecharModalLocalCarga = function() {
    document.getElementById('localCargaModal').style.display = 'none';
};

window.removerLocalCarga = async function(id) {
    if (!confirm('Tem certeza que deseja remover este local de carga?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/locais-carga/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('✅ Local de carga removido com sucesso!');
            carregarLocaisCarga();
            carregarLocaisCargaNoSelect(); // Atualizar datalist
        } else {
            const result = await response.json();
            alert('❌ Erro ao remover: ' + (result.error || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro ao remover local de carga:', error);
        alert('❌ Erro ao remover local de carga');
    }
};

// Event listener para o formulário de local de carga
document.addEventListener('DOMContentLoaded', function() {
    const localCargaForm = document.getElementById('localCargaForm');
    if (localCargaForm) {
        localCargaForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const id = document.getElementById('localCargaId').value;
            const nome = document.getElementById('localCargaNome').value.trim();
            const descricao = document.getElementById('localCargaDescricao').value.trim();
            
            if (!nome) {
                alert('Por favor, preencha o nome do local de carga');
                return;
            }
            
            try {
                let response;
                if (id) {
                    // Atualizar
                    response = await fetch(`/api/locais-carga/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ nome, descricao })
                    });
                } else {
                    // Adicionar
                    response = await fetch('/api/locais-carga', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ nome, descricao })
                    });
                }
                
                const result = await response.json();
                
                if (response.ok) {
                    alert('✅ Local de carga salvo com sucesso!');
                    fecharModalLocalCarga();
                    carregarLocaisCarga();
                    carregarLocaisCargaNoSelect(); // Atualizar datalist
                } else {
                    alert('❌ Erro ao salvar: ' + (result.error || 'Erro desconhecido'));
                }
            } catch (error) {
                console.error('Erro ao salvar local de carga:', error);
                alert('❌ Erro ao salvar local de carga');
            }
        });
    }
});

// ==================== FUNÇÕES PARA DROPDOWNS NO FORMULÁRIO DE PEDIDO ====================
async function carregarClientesNoSelect() {
    try {
        const response = await fetch('/api/clientes-locais/clientes');
        if (!response.ok) throw new Error('Erro ao carregar clientes');
        
        const clientes = await response.json();
        const datalist = document.getElementById('clientesList');
        if (!datalist) return;
        
        datalist.innerHTML = '';
        clientes.forEach(cliente => {
            const option = document.createElement('option');
            option.value = cliente;
            datalist.appendChild(option);
        });
        
        // Dropdown customizado (mesma largura do campo, alinhado à esquerda)
        const dropdown = document.getElementById('clienteDropdown');
        if (dropdown) {
            dropdown.innerHTML = '';
            clientes.forEach(cliente => {
                const o = document.createElement('div');
                o.className = 'dropdown-option';
                o.textContent = cliente;
                dropdown.appendChild(o);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
    }
}

async function carregarLocaisNoSelect(cliente) {
    const datalist = document.getElementById('locaisList');
    if (!datalist) return;
    
    // Limpar opções completamente - usar while para garantir que está vazio
    while (datalist.firstChild) {
        datalist.removeChild(datalist.firstChild);
    }
    datalist.innerHTML = '';
    
    // Usar um Set para evitar duplicados (case-insensitive)
    const locaisUnicos = new Set();
    
    if (!cliente || cliente.trim() === '') {
        // Se não há cliente selecionado, carregar todos os locais disponíveis
        try {
            const response = await fetch('/api/clientes-locais');
            if (response.ok) {
                const dados = await response.json();
                console.log('DEBUG - Dados recebidos da API:', dados);
                window._locaisClienteAtual = Array.isArray(dados) ? dados : [];
                dados.forEach(item => {
                    if (item.local_descarga && item.local_descarga.trim()) {
                        const localNormalizado = item.local_descarga.trim();
                        locaisUnicos.add(localNormalizado);
                    }
                });
                console.log('DEBUG - Locais únicos após processamento:', Array.from(locaisUnicos));
            } else {
                window._locaisClienteAtual = [];
            }
        } catch (error) {
            console.error('Erro ao carregar todos os locais:', error);
            window._locaisClienteAtual = [];
        }
    } else {
        // Carregar locais específicos do cliente (API devolve [{ id, local_descarga }])
        try {
            const response = await fetch(`/api/clientes-locais/locais?cliente=${encodeURIComponent(cliente)}`);
            if (response.ok) {
                const locais = await response.json();
                console.log('DEBUG - Locais recebidos para cliente', cliente, ':', locais);
                window._locaisClienteAtual = Array.isArray(locais) ? locais : [];
                locais.forEach(local => {
                    const nome = (local && local.local_descarga != null) ? String(local.local_descarga).trim() : (local && typeof local === 'string' ? local.trim() : '');
                    if (nome) {
                        locaisUnicos.add(nome);
                    }
                });
                console.log('DEBUG - Locais únicos após processamento:', Array.from(locaisUnicos));
            } else {
                window._locaisClienteAtual = [];
            }
        } catch (error) {
            console.error('Erro ao carregar locais:', error);
            window._locaisClienteAtual = [];
        }
    }
    if (!cliente || !cliente.trim()) {
        window._locaisClienteAtual = [];
    }
    
    // Converter Set para Array e ordenar
    const locaisArray = Array.from(locaisUnicos).sort();
    
    // Verificar se há duplicados antes de adicionar (não deveria haver, mas verificar mesmo assim)
    const duplicados = locaisArray.filter((item, index) => locaisArray.indexOf(item) !== index);
    if (duplicados.length > 0) {
        console.warn('DEBUG - ATENÇÃO: Encontrados duplicados no Set:', duplicados);
        // Remover duplicados
        const locaisUnicosArray = [...new Set(locaisArray)];
        locaisArray.length = 0;
        locaisArray.push(...locaisUnicosArray);
    }
    
    // Verificar novamente se o datalist está vazio antes de adicionar
    if (datalist.options.length > 0) {
        console.warn('DEBUG - ATENÇÃO: Datalist não estava vazio antes de adicionar! Limpando novamente...');
        while (datalist.firstChild) {
            datalist.removeChild(datalist.firstChild);
        }
    }
    
    // Adicionar locais únicos ao datalist
    locaisArray.forEach(local => {
        const option = document.createElement('option');
        option.value = local;
        datalist.appendChild(option);
    });
    
    console.log('DEBUG - Total de opções no datalist após adicionar:', datalist.options.length);
    console.log('DEBUG - Valores no datalist:', Array.from(datalist.options).map(opt => opt.value));
    
    // Verificação final de duplicados
    const valoresFinais = Array.from(datalist.options).map(opt => opt.value);
    const duplicadosFinais = valoresFinais.filter((item, index) => valoresFinais.indexOf(item) !== index);
    if (duplicadosFinais.length > 0) {
        console.error('DEBUG - ERRO: Ainda há duplicados após adicionar!', duplicadosFinais);
        // Remover duplicados manualmente
        const valoresUnicos = [...new Set(valoresFinais)];
        while (datalist.firstChild) {
            datalist.removeChild(datalist.firstChild);
        }
        valoresUnicos.forEach(local => {
            const option = document.createElement('option');
            option.value = local;
            datalist.appendChild(option);
        });
    }
    
    // Preencher dropdown customizado (tamanho do campo, alinhado à esquerda)
    const finalLocais = Array.from(datalist.options).map(o => o.value);
    const dropdownDesc = document.getElementById('localDescargaDropdown');
    if (dropdownDesc) {
        dropdownDesc.innerHTML = '';
        finalLocais.forEach(local => {
            const o = document.createElement('div');
            o.className = 'dropdown-option';
            o.textContent = local;
            dropdownDesc.appendChild(o);
        });
    }
}

// Função para atualizar locais quando o cliente é digitado
function atualizarLocaisPorCliente() {
    const clienteInput = document.getElementById('cliente');
    if (clienteInput) {
        const cliente = clienteInput.value.trim();
        if (cliente) {
            carregarLocaisNoSelect(cliente);
        } else {
            carregarLocaisNoSelect(''); // Carregar todos os locais
        }
    }
}

async function carregarMateriaisNoSelect() {
    try {
        const response = await fetch('/api/materiais');
        if (!response.ok) throw new Error('Erro ao carregar materiais');
        
        const materiais = await response.json();
        const datalist = document.getElementById('materiaisList');
        if (!datalist) return;
        
        datalist.innerHTML = '';
        materiais.forEach(material => {
            const option = document.createElement('option');
            option.value = material.nome;
            datalist.appendChild(option);
        });
        
        // Dropdown customizado
        const dropdown = document.getElementById('materialDropdown');
        if (dropdown) {
            dropdown.innerHTML = '';
            materiais.forEach(material => {
                const o = document.createElement('div');
                o.className = 'dropdown-option';
                o.textContent = material.nome;
                dropdown.appendChild(o);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar materiais:', error);
    }
}

// ==================== RELATÓRIO DE BAIXAS E FÉRIAS ====================
async function carregarRelatorioBaixasFerias() {
    // Usar as datas das análises
    const dataInicio = document.getElementById('analiseDataInicio').value;
    const dataFim = document.getElementById('analiseDataFim').value;
    
    if (!dataInicio || !dataFim) {
        alert('Por favor, selecione as datas de início e fim');
        return;
    }
    
    if (dataInicio > dataFim) {
        alert('A data de início deve ser anterior à data de fim');
        return;
    }
    
    const content = document.getElementById('relatorioBaixasFeriasContent');
    content.innerHTML = '<p style="text-align: center; color: #666;">Carregando...</p>';
    
    try {
        const response = await fetch(`/api/relatorio-baixas-ferias?data_inicio=${dataInicio}&data_fim=${dataFim}`);
        if (!response.ok) throw new Error('Erro ao carregar relatório');
        
        const dados = await response.json();
        renderizarRelatorioBaixasFerias(dados);
    } catch (error) {
        console.error('Erro ao carregar relatório:', error);
        content.innerHTML = '<p style="text-align: center; color: red;">Erro ao carregar relatório</p>';
    }
}

function renderizarRelatorioBaixasFerias(dados) {
    const content = document.getElementById('relatorioBaixasFeriasContent');
    
    if (dados.length === 0) {
        content.innerHTML = '<p style="text-align: center; color: #666;">Nenhum registo encontrado no período selecionado</p>';
        return;
    }
    
    let html = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
                <tr style="background-color: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                    <th style="padding: 12px; text-align: left; font-weight: 600;">Motorista</th>
                    <th style="padding: 12px; text-align: left; font-weight: 600;">Matrícula</th>
                    <th style="padding: 12px; text-align: center; font-weight: 600;">Dias de Férias</th>
                    <th style="padding: 12px; text-align: center; font-weight: 600;">Dias de Baixa</th>
                    <th style="padding: 12px; text-align: center; font-weight: 600;">Total</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    let totalFerias = 0;
    let totalBaixa = 0;
    
    dados.forEach(item => {
        const total = item.dias_ferias + item.dias_baixa;
        totalFerias += item.dias_ferias;
        totalBaixa += item.dias_baixa;
        
        html += `
            <tr style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 10px;">${escapeHtml(item.nome_motorista)}</td>
                <td style="padding: 10px;">${escapeHtml(item.matricula)} ${escapeHtml(item.codigo || '')}</td>
                <td style="padding: 10px; text-align: center; color: #17a2b8;">${item.dias_ferias}</td>
                <td style="padding: 10px; text-align: center; color: #dc3545;">${item.dias_baixa}</td>
                <td style="padding: 10px; text-align: center; font-weight: 600;">${total}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
            <tfoot style="background-color: #f8f9fa; font-weight: 600;">
                <tr>
                    <td colspan="2" style="padding: 12px; text-align: right;">TOTAL:</td>
                    <td style="padding: 12px; text-align: center; color: #17a2b8;">${totalFerias}</td>
                    <td style="padding: 12px; text-align: center; color: #dc3545;">${totalBaixa}</td>
                    <td style="padding: 12px; text-align: center;">${totalFerias + totalBaixa}</td>
                </tr>
            </tfoot>
        </table>
    `;
    
    content.innerHTML = html;
}

async function exportarRelatorioBaixasFerias() {
    // Usar as datas das análises
    const dataInicio = document.getElementById('analiseDataInicio').value;
    const dataFim = document.getElementById('analiseDataFim').value;
    
    if (!dataInicio || !dataFim) {
        alert('Por favor, carregue o relatório primeiro');
        return;
    }
    
    try {
        const response = await fetch(`/api/relatorio-baixas-ferias?data_inicio=${dataInicio}&data_fim=${dataFim}`);
        if (!response.ok) throw new Error('Erro ao exportar relatório');
        
        const dados = await response.json();
        
        // Criar workbook Excel
        const wb = XLSX.utils.book_new();
        
        // Preparar dados para Excel
        const dadosExcel = dados.map(item => ({
            'Motorista': item.nome_motorista,
            'Matrícula': item.matricula,
            'Código': item.codigo || '',
            'Dias de Férias': item.dias_ferias,
            'Dias de Baixa': item.dias_baixa,
            'Total': item.dias_ferias + item.dias_baixa
        }));
        
        // Adicionar linha de totais
        const totalFerias = dados.reduce((sum, item) => sum + item.dias_ferias, 0);
        const totalBaixa = dados.reduce((sum, item) => sum + item.dias_baixa, 0);
        dadosExcel.push({
            'Motorista': 'TOTAL',
            'Matrícula': '',
            'Código': '',
            'Dias de Férias': totalFerias,
            'Dias de Baixa': totalBaixa,
            'Total': totalFerias + totalBaixa
        });
        
        const ws = XLSX.utils.json_to_sheet(dadosExcel);
        XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
        
        // Exportar
        const nomeArquivo = `Relatorio_Baixas_Ferias_${dataInicio}_${dataFim}.xlsx`;
        XLSX.writeFile(wb, nomeArquivo);
        
        alert('✅ Relatório exportado com sucesso!');
    } catch (error) {
        console.error('Erro ao exportar:', error);
        alert('❌ Erro ao exportar relatório');
    }
}

// ==================== CONJUNTOS COMPATÍVEIS ====================
async function carregarConjuntosCompatives() {
    try {
        const response = await fetch('/api/conjuntos-compatives');
        if (!response.ok) throw new Error('Erro ao carregar conjuntos compatíveis');
        
        const conjuntos = await response.json();
        renderizarConjuntosCompatives(conjuntos);
    } catch (error) {
        console.error('Erro ao carregar conjuntos compatíveis:', error);
        const tbody = document.getElementById('conjuntosCompativesTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">Erro ao carregar dados</td></tr>';
        }
    }
}

async function carregarTratoresParaSelect() {
    try {
        const response = await fetch('/api/tratores');
        if (!response.ok) throw new Error('Erro ao carregar tratores');
        const tratores = await response.json();
        const select = document.getElementById('conjuntoCompativeTrator');
        if (!select) return;
        select.innerHTML = '<option value="">-- Selecione um trator --</option>';
        tratores.forEach(t => {
            const option = document.createElement('option');
            option.value = t.id;
            option.textContent = `${t.matricula}${t.codigo ? ' - ' + t.codigo : ''}`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar tratores:', error);
    }
}

async function carregarCisternasParaSelect() {
    try {
        const response = await fetch('/api/cisternas');
        if (!response.ok) throw new Error('Erro ao carregar cisternas');
        const cisternas = await response.json();
        const select = document.getElementById('conjuntoCompativeCisterna');
        if (!select) return;
        select.innerHTML = '<option value="">-- Selecione uma cisterna --</option>';
        cisternas.forEach(c => {
            const option = document.createElement('option');
            option.value = c.id;
            option.textContent = `${c.matricula}${c.codigo ? ' - ' + c.codigo : ''}`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar cisternas:', error);
    }
}

function renderizarConjuntosCompatives(conjuntos) {
    const tbody = document.getElementById('conjuntosCompativesTableBody');
    if (!tbody) return;
    
    if (conjuntos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #666;">Nenhum conjunto compatível cadastrado</td></tr>';
        return;
    }
    
    tbody.innerHTML = conjuntos.map(conjunto => `
        <tr>
            <td>${escapeHtml(conjunto.trator_matricula || '')} ${escapeHtml(conjunto.trator_codigo || '')}</td>
            <td>${escapeHtml(conjunto.cisterna_matricula || '')} ${escapeHtml(conjunto.cisterna_codigo || '')}</td>
            <td style="text-align: center;">
                <span style="color: ${conjunto.autorizado ? '#28a745' : '#dc3545'}; font-weight: 600;">
                    ${conjunto.autorizado ? '✅ Autorizado' : '❌ Não Autorizado'}
                </span>
            </td>
            <td>${escapeHtml(conjunto.observacoes || '')}</td>
            <td>
                <button onclick="editarConjuntoCompative(${conjunto.id}, ${conjunto.trator_id}, ${conjunto.cisterna_id}, ${conjunto.autorizado ? 'true' : 'false'}, '${escapeHtml(conjunto.observacoes || '').replace(/'/g, "\\'")}')" 
                        class="btn-edit">✏️ Editar</button>
                <button onclick="removerConjuntoCompative(${conjunto.id})" 
                        class="btn-delete">🗑️ Remover</button>
            </td>
        </tr>
    `).join('');
}

window.abrirModalAdicionarConjuntoCompative = function() {
    document.getElementById('conjuntoCompativeId').value = '';
    document.getElementById('conjuntoCompativeTrator').value = '';
    document.getElementById('conjuntoCompativeCisterna').value = '';
    document.getElementById('conjuntoCompativeAutorizado').checked = true;
    document.getElementById('conjuntoCompativeObservacoes').value = '';
    document.getElementById('conjuntoCompativeModalTitle').textContent = 'Adicionar Conjunto Compatível';
    carregarTratoresParaSelect();
    carregarCisternasParaSelect();
    document.getElementById('conjuntoCompativeModal').style.display = 'block';
};

window.editarConjuntoCompative = function(id, tratorId, cisternaId, autorizado, observacoes) {
    document.getElementById('conjuntoCompativeId').value = id;
    document.getElementById('conjuntoCompativeAutorizado').checked = autorizado;
    document.getElementById('conjuntoCompativeObservacoes').value = observacoes || '';
    document.getElementById('conjuntoCompativeModalTitle').textContent = 'Editar Conjunto Compatível';
    carregarTratoresParaSelect();
    carregarCisternasParaSelect();
    setTimeout(() => {
        document.getElementById('conjuntoCompativeTrator').value = tratorId;
        document.getElementById('conjuntoCompativeCisterna').value = cisternaId;
    }, 100);
    document.getElementById('conjuntoCompativeModal').style.display = 'block';
};

window.fecharModalConjuntoCompative = function() {
    document.getElementById('conjuntoCompativeModal').style.display = 'none';
};

window.removerConjuntoCompative = async function(id) {
    if (!confirm('Tem certeza que deseja remover este conjunto compatível?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/conjuntos-compatives/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('✅ Conjunto compatível removido com sucesso!');
            carregarConjuntosCompatives();
        } else {
            const result = await response.json();
            alert('❌ Erro ao remover: ' + (result.error || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro ao remover conjunto compatível:', error);
        alert('❌ Erro ao remover conjunto compatível');
    }
};

// Event listener para o formulário de conjunto compatível
document.addEventListener('DOMContentLoaded', function() {
    const conjuntoCompativeForm = document.getElementById('conjuntoCompativeForm');
    if (conjuntoCompativeForm) {
        conjuntoCompativeForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const id = document.getElementById('conjuntoCompativeId').value;
            const tratorId = document.getElementById('conjuntoCompativeTrator').value;
            const cisternaId = document.getElementById('conjuntoCompativeCisterna').value;
            const autorizado = document.getElementById('conjuntoCompativeAutorizado').checked;
            const observacoes = document.getElementById('conjuntoCompativeObservacoes').value.trim();
            
            if (!tratorId || !cisternaId) {
                alert('Por favor, selecione trator e cisterna');
                return;
            }
            
            try {
                let response;
                if (id) {
                    response = await fetch(`/api/conjuntos-compatives/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ autorizado, observacoes })
                    });
                } else {
                    response = await fetch('/api/conjuntos-compatives', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ trator_id: tratorId, cisterna_id: cisternaId, autorizado, observacoes })
                    });
                }
                
                const result = await response.json();
                
                if (response.ok) {
                    alert('✅ Conjunto compatível salvo com sucesso!');
                    fecharModalConjuntoCompative();
                    carregarConjuntosCompatives();
                } else {
                    alert('❌ Erro ao salvar: ' + (result.error || 'Erro desconhecido'));
                }
            } catch (error) {
                console.error('Erro ao salvar conjunto compatível:', error);
                alert('❌ Erro ao salvar conjunto compatível');
            }
        });
    }
});

// ==================== TRANSPORTADORAS ====================
async function carregarTransportadoras() {
    try {
        const response = await fetch('/api/transportadoras');
        if (!response.ok) throw new Error('Erro ao carregar transportadoras');
        
        const transportadoras = await response.json();
        renderizarTransportadoras(transportadoras);
    } catch (error) {
        console.error('Erro ao carregar transportadoras:', error);
        const tbody = document.getElementById('transportadorasTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">Erro ao carregar dados</td></tr>';
        }
    }
}

function renderizarTransportadoras(transportadoras) {
    const tbody = document.getElementById('transportadorasTableBody');
    if (!tbody) return;
    
    if (transportadoras.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #666;">Nenhuma transportadora cadastrada</td></tr>';
        return;
    }
    
    tbody.innerHTML = transportadoras.map(trans => `
        <tr>
            <td>${escapeHtml(trans.nome)}</td>
            <td style="text-align: center;">
                <span style="color: ${trans.ativo ? '#28a745' : '#dc3545'}; font-weight: 600;">
                    ${trans.ativo ? '✅ Ativa' : '❌ Inativa'}
                </span>
            </td>
            <td>${escapeHtml(trans.observacoes || '')}</td>
            <td>
                <button onclick="editarTransportadora(${trans.id}, '${escapeHtml(trans.nome).replace(/'/g, "\\'")}', ${trans.ativo ? 'true' : 'false'}, '${escapeHtml(trans.observacoes || '').replace(/'/g, "\\'")}')" 
                        class="btn-edit">✏️ Editar</button>
                <button onclick="ativarTransportadoraData(${trans.id})" 
                        class="btn-edit" style="background-color: #17a2b8;">📅 Ativar para Data</button>
                <button onclick="desativarTransportadoraData(${trans.id})" 
                        class="btn-edit" style="background-color: #dc3545;">❌ Desativar para Data</button>
                <button onclick="removerTransportadora(${trans.id})" 
                        class="btn-delete">🗑️ Remover</button>
            </td>
        </tr>
    `).join('');
}

window.abrirModalAdicionarTransportadora = function() {
    document.getElementById('transportadoraId').value = '';
    document.getElementById('transportadoraNome').value = '';
    document.getElementById('transportadoraAtivo').checked = true;
    document.getElementById('transportadoraObservacoes').value = '';
    document.getElementById('transportadoraModalTitle').textContent = 'Adicionar Transportadora';
    document.getElementById('transportadoraModal').style.display = 'block';
};

window.editarTransportadora = function(id, nome, ativo, observacoes) {
    document.getElementById('transportadoraId').value = id;
    document.getElementById('transportadoraNome').value = nome;
    document.getElementById('transportadoraAtivo').checked = ativo;
    document.getElementById('transportadoraObservacoes').value = observacoes || '';
    document.getElementById('transportadoraModalTitle').textContent = 'Editar Transportadora';
    document.getElementById('transportadoraModal').style.display = 'block';
};

window.fecharModalTransportadora = function() {
    document.getElementById('transportadoraModal').style.display = 'none';
};

window.ativarTransportadoraData = function(id) {
    document.getElementById('ativarTransportadoraId').value = id;
    const dataInput = document.getElementById('dataPlaneamento');
    const hoje = dataInput ? dataInput.value : new Date().toISOString().split('T')[0];
    document.getElementById('ativarTransportadoraData').value = hoje;
    document.getElementById('ativarTransportadoraModal').style.display = 'block';
};

window.fecharModalAtivarTransportadora = function() {
    document.getElementById('ativarTransportadoraModal').style.display = 'none';
};

window.desativarTransportadoraData = function(id) {
    document.getElementById('desativarTransportadoraId').value = id;
    const dataInput = document.getElementById('dataPlaneamento');
    const hoje = dataInput ? dataInput.value : new Date().toISOString().split('T')[0];
    document.getElementById('desativarTransportadoraData').value = hoje;
    document.getElementById('desativarTransportadoraModal').style.display = 'block';
};

window.fecharModalDesativarTransportadora = function() {
    document.getElementById('desativarTransportadoraModal').style.display = 'none';
};

window.removerTransportadora = async function(id) {
    if (!confirm('Tem certeza que deseja remover esta transportadora?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/transportadoras/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('✅ Transportadora removida com sucesso!');
            carregarTransportadoras();
        } else {
            const result = await response.json();
            alert('❌ Erro ao remover: ' + (result.error || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro ao remover transportadora:', error);
        alert('❌ Erro ao remover transportadora');
    }
};

// Event listeners para transportadoras
document.addEventListener('DOMContentLoaded', function() {
    const transportadoraForm = document.getElementById('transportadoraForm');
    if (transportadoraForm) {
        transportadoraForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const id = document.getElementById('transportadoraId').value;
            const nome = document.getElementById('transportadoraNome').value.trim();
            const ativo = document.getElementById('transportadoraAtivo').checked;
            const observacoes = document.getElementById('transportadoraObservacoes').value.trim();
            
            if (!nome) {
                alert('Por favor, preencha o nome da transportadora');
                return;
            }
            
            try {
                let response;
                if (id) {
                    response = await fetch(`/api/transportadoras/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ nome, ativo, observacoes })
                    });
                } else {
                    response = await fetch('/api/transportadoras', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ nome, observacoes })
                    });
                }
                
                const result = await response.json();
                
                if (response.ok) {
                    alert('✅ Transportadora salva com sucesso!');
                    fecharModalTransportadora();
                    carregarTransportadoras();
                } else {
                    alert('❌ Erro ao salvar: ' + (result.error || 'Erro desconhecido'));
                }
            } catch (error) {
                console.error('Erro ao salvar transportadora:', error);
                alert('❌ Erro ao salvar transportadora');
            }
        });
    }
    
    const ativarTransportadoraForm = document.getElementById('ativarTransportadoraForm');
    if (ativarTransportadoraForm) {
        ativarTransportadoraForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const id = document.getElementById('ativarTransportadoraId').value;
            const data = document.getElementById('ativarTransportadoraData').value;
            
            if (!data) {
                alert('Por favor, selecione uma data');
                return;
            }
            
            try {
                const response = await fetch(`/api/transportadoras/${id}/ativar`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data_ativacao: data })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    alert('✅ Transportadora ativada para a data selecionada!');
                    fecharModalAtivarTransportadora();
                    carregarTransportadoras();
                    // Recarregar cards se estiver na página de planeamento
                    if (typeof carregarViaturasMotoristas === 'function') {
                        carregarViaturasMotoristas();
                    }
                } else {
                    alert('❌ Erro ao ativar: ' + (result.error || 'Erro desconhecido'));
                }
            } catch (error) {
                console.error('Erro ao ativar transportadora:', error);
                alert('❌ Erro ao ativar transportadora');
            }
        });
    }
    
    const desativarTransportadoraForm = document.getElementById('desativarTransportadoraForm');
    if (desativarTransportadoraForm) {
        desativarTransportadoraForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const id = document.getElementById('desativarTransportadoraId').value;
            const data = document.getElementById('desativarTransportadoraData').value;
            
            if (!data) {
                alert('Por favor, selecione uma data');
                return;
            }
            
            if (!confirm('Tem certeza que deseja desativar esta transportadora para esta data? Esta ação só será permitida se não houver encomendas atribuídas.')) {
                return;
            }
            
            try {
                const response = await fetch(`/api/transportadoras/${id}/desativar`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data_ativacao: data })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    alert('✅ Transportadora desativada para a data selecionada!');
                    fecharModalDesativarTransportadora();
                    carregarTransportadoras();
                    // Recarregar cards se estiver na página de planeamento
                    if (typeof carregarViaturasMotoristas === 'function') {
                        carregarViaturasMotoristas();
                    }
                } else {
                    alert('❌ Erro ao desativar: ' + (result.error || (result.success === false ? result.error : 'Erro desconhecido')));
                }
            } catch (error) {
                console.error('Erro ao desativar transportadora:', error);
                alert('❌ Erro ao desativar transportadora');
            }
        });
    }
});



