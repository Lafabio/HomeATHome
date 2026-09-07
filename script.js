// Configuracao do Supabase
const SUPABASE_URL = 'https://jjmjjlvpaxafxpebvrwb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqbWpqbHZwYXhhZnhwZWJ2cndiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1ODEzODUsImV4cCI6MjEwMjE1NzM4NX0.-uCFZjREoE1RRxufDFyymYSgodhp3CZXWQjSIEeEW7A';

let supabase;
try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (e) {
    console.error('Erro ao inicializar Supabase:', e);
}

// Variaveis globais
let map;
let marker;
let interessados = [];
let interessadoEditando = null;
let deleteId = null;

// Inicializar mapa
function initMap() {
    map = L.map('map').setView([-15.7975, -47.8919], 12);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    map.on('click', function(e) {
        const { lat, lng } = e.latlng;
        
        if (marker) {
            map.removeLayer(marker);
        }
        
        marker = L.marker([lat, lng]).addTo(map)
            .bindPopup('Localizacao selecionada')
            .openPopup();
        
        document.getElementById('lat').value = lat.toFixed(6);
        document.getElementById('lng').value = lng.toFixed(6);
        
        buscarEndereco(lat, lng);
    });
}

// Buscar endereco via reverse geocoding
async function buscarEndereco(lat, lng) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=pt-BR`
        );
        const data = await response.json();
        
        if (data.display_name) {
            document.getElementById('endereco').value = data.display_name;
            document.getElementById('locationCoords').innerHTML = 
                `📍 ${data.display_name.substring(0, 80)}...`;
        }
    } catch (error) {
        document.getElementById('locationCoords').innerHTML = 
            `📍 Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
    }
}

// Formatacao de telefone
function formatarTelefone(telefone) {
    if (!telefone) return '';
    const nums = telefone.replace(/\D/g, '');
    if (nums.length === 11) {
        return `(${nums.slice(0,2)}) ${nums.slice(2,7)}-${nums.slice(7)}`;
    }
    return telefone;
}

// Carregar interessados do Supabase
async function carregarInteressados() {
    if (!supabase) {
        console.warn('Supabase nao inicializado');
        return;
    }
    try {
        const { data, error } = await supabase
            .from('interessados')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        interessados = data || [];
        renderizarLista();
    } catch (error) {
        console.error('Erro ao carregar:', error);
    }
}

// Salvar interessado no Supabase
async function salvarInteressado(dados) {
    if (!supabase) {
        alert('Supabase nao conectado.');
        return;
    }
    try {
        if (interessadoEditando) {
            // Editar existente
            const { error } = await supabase
                .from('interessados')
                .update({
                    nome: dados.nome,
                    sexo: dados.sexo,
                    idade: dados.idade,
                    telefone: dados.telefone,
                    endereco_completo: dados.enderecoCompleto,
                    info_adicionais: dados.infoAdicionais,
                    latitude: dados.lat ? parseFloat(dados.lat) : null,
                    longitude: dados.lng ? parseFloat(dados.lng) : null,
                    endereco_geocode: dados.endereco
                })
                .eq('id', interessadoEditando);
            
            if (error) throw error;
            interessadoEditando = null;
        } else {
            // Criar novo
            const { error } = await supabase
                .from('interessados')
                .insert({
                    nome: dados.nome,
                    sexo: dados.sexo,
                    idade: parseInt(dados.idade),
                    telefone: dados.telefone,
                    endereco_completo: dados.enderecoCompleto,
                    info_adicionais: dados.infoAdicionais,
                    latitude: dados.lat ? parseFloat(dados.lat) : null,
                    longitude: dados.lng ? parseFloat(dados.lng) : null,
                    endereco_geocode: dados.endereco
                });
            
            if (error) throw error;
        }
        
        await carregarInteressados();
    } catch (error) {
        console.error('Erro ao salvar:', error);
        alert('Erro ao salvar. Tente novamente.');
    }
}

// Excluir interessado do Supabase
async function excluirInteressado() {
    if (!deleteId) return;
    if (!supabase) {
        alert('Supabase nao conectado.');
        return;
    }
    
    try {
        const { error } = await supabase
            .from('interessados')
            .delete()
            .eq('id', deleteId);
        
        if (error) throw error;
        
        await carregarInteressados();
        fecharModal();
    } catch (error) {
        console.error('Erro ao excluir:', error);
        alert('Erro ao excluir. Tente novamente.');
    }
}

// Renderizar lista de interessados
function renderizarLista(filtro = null) {
    const container = document.getElementById('listaInteressados');
    const lista = filtro || interessados;
    
    if (lista.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhum interessado cadastrado ainda.</p>';
    } else {
        container.innerHTML = lista.map(interesado => `
            <div class="interessado-card" data-id="${interessado.id}">
                <div class="card-header">
                    <span class="card-name">${interessado.nome}</span>
                    <span class="card-sex ${interessado.sexo.toLowerCase()}">${interessado.sexo}</span>
                </div>
                
                <div class="card-details">
                    <p>📅 Idade: ${interessado.idade} anos</p>
                    ${interessado.telefone ? `<p>📱 ${formatarTelefone(interesado.telefone)}</p>` : ''}
                    ${interessado.endereco_completo ? `<p>🏠 ${interessado.endereco_completo}</p>` : ''}
                </div>
                
                ${interessado.info_adicionais ? `
                    <div class="card-info">
                        <strong>Obs:</strong> ${interessado.info_adicionais}
                    </div>
                ` : ''}
                
                <div class="card-actions">
                    <button class="btn-whatsapp" onclick="enviarWhatsApp(${interessado.id})">
                        📱 WhatsApp
                    </button>
                    <button class="btn-location" onclick="verNoMapa(${interessado.latitude}, ${interessado.longitude})">
                        📍 Mapa
                    </button>
                    <button class="btn-edit" onclick="editarInteressado(${interessado.id})">
                        ✏️ Editar
                    </button>
                    <button class="btn-delete" onclick="confirmarExclusao(${interessado.id})">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    document.getElementById('totalCadastrados').textContent = 
        `Total: ${lista.length} interessado(s)`;
}

// Enviar dados via WhatsApp
function enviarWhatsApp(id) {
    const interessado = interessados.find(i => i.id === id);
    
    let mensagem = `📚 *INTERESSADO EM ESTUDO BIBLICO*\n\n`;
    mensagem += `👤 *Nome:* ${interessado.nome}\n`;
    mensagem += `⚧ *Sexo:* ${interessado.sexo}\n`;
    mensagem += `📅 *Idade:* ${interessado.idade} anos\n`;
    
    if (interessado.telefone) {
        mensagem += `📱 *Telefone:* ${formatarTelefone(interesado.telefone)}\n`;
    }
    
    if (interessado.endereco_completo) {
        mensagem += `🏠 *Endereco:* ${interessado.endereco_completo}\n`;
    }
    
    if (interessado.info_adicionais) {
        mensagem += `📝 *Observacoes:* ${interessado.info_adicionais}\n`;
    }
    
    if (interessado.latitude && interessado.longitude) {
        mensagem += `\n📍 *Localizacao:* https://www.google.com/maps?q=${interessado.latitude},${interessado.longitude}\n`;
    }
    
    const dataFormatada = new Date(interessado.data_cadastro).toLocaleDateString('pt-BR');
    mensagem += `\n📅 *Cadastrado em:* ${dataFormatada}`;
    
    const urlWhatsApp = `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
    window.open(urlWhatsApp, '_blank');
}

// Exportar todos via WhatsApp
function exportarTodosWhatsApp() {
    if (interessados.length === 0) {
        alert('Nenhum interessado para exportar!');
        return;
    }
    
    let mensagem = `📚 *LISTA DE INTERESSADOS - HOMEATHOME*\n`;
    mensagem += `📅 ${new Date().toLocaleDateString('pt-BR')}\n\n`;
    
    interessados.forEach((int, index) => {
        mensagem += `*${index + 1}. ${int.nome}*\n`;
        mensagem += `   ⚧ ${int.sexo} | 📅 ${int.idade} anos\n`;
        if (int.telefone) mensagem += `   📱 ${formatarTelefone(int.telefone)}\n`;
        if (int.endereco_completo) mensagem += `   🏠 ${int.endereco_completo}\n`;
        if (int.latitude && int.longitude) {
            mensagem += `   📍 https://www.google.com/maps?q=${int.latitude},${int.longitude}\n`;
        }
        mensagem += `\n`;
    });
    
    const urlWhatsApp = `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
    window.open(urlWhatsApp, '_blank');
}

// Ver localizacao no mapa
function verNoMapa(lat, lng) {
    if (lat && lng) {
        window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
    }
}

// Editar interessado
function editarInteressado(id) {
    const interessado = interessados.find(i => i.id === id);
    
    document.getElementById('nome').value = interessado.nome;
    document.getElementById('sexo').value = interessado.sexo;
    document.getElementById('idade').value = interessado.idade;
    document.getElementById('telefone').value = interessado.telefone || '';
    document.getElementById('enderecoCompleto').value = interessado.endereco_completo || '';
    document.getElementById('infoAdicionais').value = interessado.info_adicionais || '';
    document.getElementById('lat').value = interessado.latitude || '';
    document.getElementById('lng').value = interessado.longitude || '';
    
    if (interessado.latitude && interessado.longitude) {
        map.setView([interessado.latitude, interessado.longitude], 15);
        if (marker) map.removeLayer(marker);
        marker = L.marker([interessado.latitude, interessado.longitude]).addTo(map)
            .bindPopup('Editando localizacao').openPopup();
        document.getElementById('locationCoords').innerHTML = 
            `📍 Editando localizacao de ${interessado.nome}`;
    }
    
    interessadoEditando = id;
    document.getElementById('cadastro').scrollIntoView({ behavior: 'smooth' });
}

// Confirmar exclusao
function confirmarExclusao(id) {
    deleteId = id;
    document.getElementById('confirmModal').classList.add('active');
}

// Fechar modal
function fecharModal() {
    document.getElementById('confirmModal').classList.remove('active');
    deleteId = null;
}

// Buscar interessados
function buscarInteressados() {
    const termo = document.getElementById('searchInput').value.toLowerCase();
    
    if (!termo) {
        renderizarLista();
        return;
    }
    
    const filtro = interessados.filter(i => 
        i.nome.toLowerCase().includes(termo)
    );
    
    renderizarLista(filtro);
}

// Limpar formulario
function limparFormulario() {
    document.getElementById('cadastroForm').reset();
    document.getElementById('lat').value = '';
    document.getElementById('lng').value = '';
    document.getElementById('endereco').value = '';
    document.getElementById('locationCoords').innerHTML = 
        '📍 Clique no mapa para marcar a localizacao';
    
    if (marker) {
        map.removeLayer(marker);
        marker = null;
    }
    
    interessadoEditando = null;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    carregarInteressados();
    
    // Form submit
    document.getElementById('cadastroForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const dados = {
            nome: document.getElementById('nome').value,
            sexo: document.getElementById('sexo').value,
            idade: document.getElementById('idade').value,
            telefone: document.getElementById('telefone').value,
            enderecoCompleto: document.getElementById('enderecoCompleto').value,
            infoAdicionais: document.getElementById('infoAdicionais').value,
            lat: document.getElementById('lat').value,
            lng: document.getElementById('lng').value,
            endereco: document.getElementById('endereco').value
        };
        
        await salvarInteressado(dados);
        limparFormulario();
        
        document.getElementById('lista').scrollIntoView({ behavior: 'smooth' });
    });
    
    // Confirm delete
    document.getElementById('confirmDeleteBtn').addEventListener('click', excluirInteressado);
    
    // Mobile nav toggle
    document.getElementById('navToggle').addEventListener('click', function() {
        document.getElementById('navMenu').classList.toggle('active');
    });
    
    // Close mobile menu
    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.addEventListener('click', () => {
            document.getElementById('navMenu').classList.remove('active');
        });
    });
    
    // Format phone on input
    document.getElementById('telefone').addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) value = value.slice(0, 11);
        
        if (value.length > 6) {
            value = `(${value.slice(0,2)}) ${value.slice(2,7)}-${value.slice(7)}`;
        } else if (value.length > 2) {
            value = `(${value.slice(0,2)}) ${value.slice(2)}`;
        }
        
        e.target.value = value;
    });
});
