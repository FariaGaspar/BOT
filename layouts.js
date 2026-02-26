// Sistema de alternância de layouts do painel
// Mostra diferentes opções durante 5 minutos, depois volta ao original

const layouts = {
    1: {
        name: 'Original',
        class: 'layout-original',
        description: 'Layout atual - duas colunas lado a lado'
    },
    2: {
        name: 'Kanban',
        class: 'layout-kanban',
        description: 'Estilo Kanban/Trello - colunas verticais com cards arrastáveis'
    },
    3: {
        name: 'Timeline',
        class: 'layout-timeline',
        description: 'Layout horizontal tipo timeline - visualização temporal'
    },
    4: {
        name: 'Dashboard',
        class: 'layout-dashboard',
        description: 'Dashboard com métricas e visualização compacta'
    },
    5: {
        name: 'Split Focus',
        class: 'layout-split',
        description: 'Split screen - foco em uma coluna de cada vez'
    },
    6: {
        name: 'Excel Denso',
        class: 'layout-excel',
        description: 'Layout ultra-compacto estilo Excel - máximo de informação'
    },
    7: {
        name: 'Cards Grandes',
        class: 'layout-bigcards',
        description: 'Cards grandes com muito espaço - fácil leitura'
    },
    8: {
        name: 'Lista Vertical',
        class: 'layout-list',
        description: 'Lista vertical densa - todas as informações visíveis'
    },
    9: {
        name: 'Grid 3 Colunas',
        class: 'layout-grid3',
        description: 'Grid de 3 colunas - organização diferente'
    },
    10: {
        name: 'Focus Mode',
        class: 'layout-focus',
        description: 'Modo foco - uma seção por vez com zoom'
    },
    11: {
        name: 'Comparativo',
        class: 'layout-compare',
        description: 'Vista comparativa lado a lado - fácil comparação'
    },
    12: {
        name: 'Minimalista',
        class: 'layout-minimal',
        description: 'Layout minimalista - apenas o essencial'
    }
};

let currentLayout = 1;
let layoutInterval = null;
let startTime = null;
const TOTAL_TIME = 5 * 60 * 1000; // 5 minutos em milissegundos
const TIME_PER_LAYOUT = TOTAL_TIME / 11; // 11 layouts alternativos (excluindo o original)

function applyLayout(layoutNumber) {
    const container = document.getElementById('planeamentoColunas');
    if (!container) return;
    
    // Remover todas as classes de layout
    Object.values(layouts).forEach(layout => {
        container.classList.remove(layout.class);
    });
    
    // Aplicar novo layout
    if (layouts[layoutNumber]) {
        container.classList.add(layouts[layoutNumber].class);
        currentLayout = layoutNumber;
        
        // Atualizar indicador
        const indicator = document.getElementById('layoutIndicator');
        const numberSpan = document.getElementById('layoutNumber');
        const nameSpan = document.getElementById('layoutName');
        
        if (indicator && numberSpan && nameSpan) {
            numberSpan.textContent = layoutNumber;
            nameSpan.textContent = layouts[layoutNumber].name;
        }
    }
}

function startLayoutRotation() {
    startTime = Date.now();
    const layoutKeys = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; // Layouts alternativos (excluindo o 1)
    let currentIndex = 0;
    
    // Aplicar primeiro layout alternativo
    if (layoutKeys.length > 0) {
        applyLayout(layoutKeys[0]);
    }
    
    layoutInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        
        if (elapsed >= TOTAL_TIME) {
            // Voltar ao layout original
            stopLayoutRotation();
            applyLayout(1);
            return;
        }
        
        // Calcular qual layout mostrar baseado no tempo decorrido
        const progress = elapsed / TOTAL_TIME;
        const newIndex = Math.floor(progress * layoutKeys.length);
        
        if (newIndex !== currentIndex && newIndex < layoutKeys.length) {
            currentIndex = newIndex;
            applyLayout(layoutKeys[currentIndex]);
        }
    }, 500); // Verificar a cada 500ms para transições mais suaves
}

function stopLayoutRotation() {
    if (layoutInterval) {
        clearInterval(layoutInterval);
        layoutInterval = null;
    }
}

// Iniciar rotação quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    // Aplicar layout original e manter (rotação desativada)
    applyLayout(1);
    // startLayoutRotation(); // Desativado - voltar ao original
});

// Permitir escolha manual de layout (opcional - para testes)
window.selectLayout = function(layoutNumber) {
    stopLayoutRotation();
    applyLayout(layoutNumber);
};

