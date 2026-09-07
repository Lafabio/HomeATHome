// Configuracao do Supabase
const SUPABASE_URL = 'https://jjmjjlvpaxafxpebvrwb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqbWpqbHZwYXhhZnhwZWJ2cndiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1ODEzODUsImV4cCI6MjEwMjE1NzM4NX0.-uCFZjREoE1RRxufDFyymYSgodhp3CZXWQjSIEeEW7A';

let supabaseClient = null;
try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
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
    try {
        map = L.map('map').setView([-15.7975, -47.8919], 12);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        map.on('click', function(e) {
            var latlng = e.latlng;
            
            if (marker) {
                map.removeLayer(marker);
            }
            
            marker = L.marker([latlng.lat, latlng.lng]).addTo(map)
                .bindPopup('Localizacao selecionada')
                .openPopup();
            
            document.getElementById('lat').value = latlng.lat.toFixed(6);
            document.getElementById('lng').value = latlng.lng.toFixed(6);
            
            buscarEndereco(latlng.lat, latlng.lng);
        });
        
        setTimeout(function() {
            map.invalidateSize();
        }, 100);
    } catch (e) {
        console.error('Erro ao inicializar mapa:', e);
    }
}

// Buscar endereco via reverse geocoding
async function buscarEndereco(lat, lng) {
    try {
        var response = await fetch(
            'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&accept-language=pt-BR'
        );
        var data = await response.json();
        
        if (data.display_name) {
            document.getElementById('endereco').value = data.display_name;
            document.getElementById('locationCoords').innerHTML = 
                '📍 ' + data.display_name.substring(0, 80) + '...';
        }
    } catch (err) {
        document.getElementById('locationCoords').innerHTML = 
            '📍 Lat: ' + lat.toFixed(4) + ', Lng: ' + lng.toFixed(4);
    }
}

// Formatacao de telefone
function formatarTelefone(telefone) {
    if (!telefone) return '';
    var nums = telefone.replace(/\D/g, '');
    if (nums.length === 11) {
        return '(' + nums.slice(0,2) + ') ' + nums.slice(2,7) + '-' + nums.slice(7);
    }
    return telefone;
}

// Carregar interessados do Supabase
async function carregarInteressados() {
    if (!supabaseClient) {
        console.warn('Supabase nao inicializado');
        return;
    }
    try {
        var result = await supabaseClient
            .from('interessados')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (result.error) throw result.error;
        
        interessados = result.data || [];
        renderizarLista();
    } catch (err) {
        console.error('Erro ao carregar:', err);
    }
}

// Salvar interessado no Supabase
async function salvarInteressado(dados) {
    if (!supabaseClient) {
        alert('Supabase nao conectado.');
        return;
    }
    try {
        if (interessadoEditando) {
            var result = await supabaseClient
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
            
            if (result.error) throw result.error;
            interessadoEditando = null;
        } else {
            var result = await supabaseClient
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
            
            if (result.error) throw result.error;
        }
        
        await carregarInteressados();
    } catch (err) {
        console.error('Erro ao salvar:', err);
        alert('Erro ao salvar. Tente novamente.');
    }
}

// Excluir interessado do Supabase
async function excluirInteressado() {
    if (!deleteId) return;
    if (!supabaseClient) {
        alert('Supabase nao conectado.');
        return;
    }
    
    try {
        var result = await supabaseClient
            .from('interessados')
            .delete()
            .eq('id', deleteId);
        
        if (result.error) throw result.error;
        
        await carregarInteressados();
        fecharModal();
    } catch (err) {
        console.error('Erro ao excluir:', err);
        alert('Erro ao excluir. Tente novamente.');
    }
}

// Renderizar lista de interessados
function renderizarLista(filtro) {
    var container = document.getElementById('listaInteressados');
    var lista = filtro || interessados;
    
    if (lista.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhum interessado cadastrado ainda.</p>';
    } else {
        var html = '';
        for (var i = 0; i < lista.length; i++) {
            var int = lista[i];
            html += '<div class="interessado-card" data-id="' + int.id + '">';
            html += '<div class="card-header">';
            html += '<span class="card-name">' + int.nome + '</span>';
            html += '<span class="card-sex ' + int.sexo.toLowerCase() + '">' + int.sexo + '</span>';
            html += '</div>';
            html += '<div class="card-details">';
            html += '<p>📅 Idade: ' + int.idade + ' anos</p>';
            if (int.telefone) html += '<p>📱 ' + formatarTelefone(int.telefone) + '</p>';
            if (int.endereco_completo) html += '<p>🏠 ' + int.endereco_completo + '</p>';
            html += '</div>';
            if (int.info_adicionais) {
                html += '<div class="card-info"><strong>Obs:</strong> ' + int.info_adicionais + '</div>';
            }
            html += '<div class="card-actions">';
            html += '<button class="btn-whatsapp" onclick="enviarWhatsApp(' + int.id + ')">📱 WhatsApp</button>';
            html += '<button class="btn-location" onclick="verNoMapa(' + int.latitude + ', ' + int.longitude + ')">📍 Mapa</button>';
            html += '<button class="btn-edit" onclick="editarInteressado(' + int.id + ')">✏️ Editar</button>';
            html += '<button class="btn-delete" onclick="confirmarExclusao(' + int.id + ')">🗑️</button>';
            html += '</div>';
            html += '</div>';
        }
        container.innerHTML = html;
    }
    
    document.getElementById('totalCadastrados').textContent = 
        'Total: ' + lista.length + ' interessado(s)';
}

// Enviar dados via WhatsApp
function enviarWhatsApp(id) {
    var interessado = null;
    for (var i = 0; i < interessados.length; i++) {
        if (interessados[i].id === id) {
            interessado = interessados[i];
            break;
        }
    }
    if (!interessado) return;
    
    var msg = '📚 *INTERESSADO EM ESTUDO BIBLICO*\n\n';
    msg += '👤 *Nome:* ' + interessado.nome + '\n';
    msg += '⚧ *Sexo:* ' + interessado.sexo + '\n';
    msg += '📅 *Idade:* ' + interessado.idade + ' anos\n';
    
    if (interessado.telefone) {
        msg += '📱 *Telefone:* ' + formatarTelefone(interesado.telefone) + '\n';
    }
    
    if (interessado.endereco_completo) {
        msg += '🏠 *Endereco:* ' + interessado.endereco_completo + '\n';
    }
    
    if (interessado.info_adicionais) {
        msg += '📝 *Observacoes:* ' + interessado.info_adicionais + '\n';
    }
    
    if (interessado.latitude && interessado.longitude) {
        msg += '\n📍 *Localizacao:* https://www.google.com/maps?q=' + interessado.latitude + ',' + interessado.longitude + '\n';
    }
    
    var urlWhatsApp = 'https://wa.me/?text=' + encodeURIComponent(msg);
    window.open(urlWhatsApp, '_blank');
}

// Exportar todos via WhatsApp
function exportarTodosWhatsApp() {
    if (interessados.length === 0) {
        alert('Nenhum interessado para exportar!');
        return;
    }
    
    var msg = '📚 *LISTA DE INTERESSADOS - HOMEATHOME*\n';
    msg += '📅 ' + new Date().toLocaleDateString('pt-BR') + '\n\n';
    
    for (var i = 0; i < interessados.length; i++) {
        var int = interessados[i];
        msg += '*' + (i + 1) + '. ' + int.nome + '*\n';
        msg += '   ⚧ ' + int.sexo + ' | 📅 ' + int.idade + ' anos\n';
        if (int.telefone) msg += '   📱 ' + formatarTelefone(int.telefone) + '\n';
        if (int.endereco_completo) msg += '   🏠 ' + int.endereco_completo + '\n';
        if (int.latitude && int.longitude) {
            msg += '   📍 https://www.google.com/maps?q=' + int.latitude + ',' + int.longitude + '\n';
        }
        msg += '\n';
    }
    
    var urlWhatsApp = 'https://wa.me/?text=' + encodeURIComponent(msg);
    window.open(urlWhatsApp, '_blank');
}

// Ver localizacao no mapa
function verNoMapa(lat, lng) {
    if (lat && lng) {
        window.open('https://www.google.com/maps?q=' + lat + ',' + lng, '_blank');
    }
}

// Editar interessado
function editarInteressado(id) {
    var interessado = null;
    for (var i = 0; i < interessados.length; i++) {
        if (interessados[i].id === id) {
            interessado = interessados[i];
            break;
        }
    }
    if (!interessado) return;
    
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
            '📍 Editando localizacao de ' + interessado.nome;
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
    var termo = document.getElementById('searchInput').value.toLowerCase();
    
    if (!termo) {
        renderizarLista();
        return;
    }
    
    var filtro = [];
    for (var i = 0; i < interessados.length; i++) {
        if (interessados[i].nome.toLowerCase().indexOf(termo) !== -1) {
            filtro.push(interessados[i]);
        }
    }
    
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

// Inicializacao
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    carregarInteressados();
    
    document.getElementById('cadastroForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        var dados = {
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
    
    document.getElementById('confirmDeleteBtn').addEventListener('click', excluirInteressado);
    
    document.getElementById('navToggle').addEventListener('click', function() {
        document.getElementById('navMenu').classList.toggle('active');
    });
    
    var navLinks = document.querySelectorAll('.nav-menu a');
    for (var i = 0; i < navLinks.length; i++) {
        navLinks[i].addEventListener('click', function() {
            document.getElementById('navMenu').classList.remove('active');
        });
    }
    
    document.getElementById('telefone').addEventListener('input', function(e) {
        var value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) value = value.slice(0, 11);
        
        if (value.length > 6) {
            value = '(' + value.slice(0,2) + ') ' + value.slice(2,7) + '-' + value.slice(7);
        } else if (value.length > 2) {
            value = '(' + value.slice(0,2) + ') ' + value.slice(2);
        }
        
        e.target.value = value;
    });
});
