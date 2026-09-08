// Configuracao do Supabase
var SUPABASE_URL = 'https://jjmjjlvpaxafxpebvrwb.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqbWpqbHZwYXhhZnhwZWJ2cndiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1ODEzODUsImV4cCI6MjEwMjE1NzM4NX0.-uCFZjREoE1RRxufDFyymYSgodhp3CZXWQjSIEeEW7A';

var supabaseClient = null;
try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (e) {
    console.error('Erro ao inicializar Supabase:', e);
}

// Variaveis globais
var map;
var marker;
var interessados = [];
var interessadoEditando = null;
var deleteId = null;
var usuarioAtual = null;

// ============ AUTENTICACAO ============

function mostrarCadastro() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('cadastroAuthForm').style.display = 'block';
    document.getElementById('authError').style.display = 'none';
}

function mostrarLogin() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('cadastroAuthForm').style.display = 'none';
    document.getElementById('authError').style.display = 'none';
}

function mostrarErroAuth(msg) {
    var el = document.getElementById('authError');
    el.textContent = msg;
    el.style.display = 'block';
}

async function fazerCadastro() {
    var nome = document.getElementById('cadastroNome').value.trim();
    var email = document.getElementById('cadastroEmail').value.trim();
    var senha = document.getElementById('cadastroSenha').value;

    if (!nome || !email || !senha) {
        mostrarErroAuth('Preencha todos os campos.');
        return;
    }

    if (senha.length < 6) {
        mostrarErroAuth('A senha deve ter pelo menos 6 caracteres.');
        return;
    }

    try {
        var result = await supabaseClient.auth.signUp({
            email: email,
            password: senha,
            options: {
                data: { nome: nome }
            }
        });

        if (result.error) {
            mostrarErroAuth(result.error.message);
            return;
        }

        if (result.data.user && !result.data.session) {
            mostrarErroAuth('Conta criada! Verifique seu email para confirmar.');
        }
    } catch (err) {
        console.error('Erro ao criar conta:', err);
        mostrarErroAuth('Erro ao criar conta: ' + (err.message || 'Tente novamente.'));
    }
}

async function fazerLogin() {
    var email = document.getElementById('loginEmail').value.trim();
    var senha = document.getElementById('loginSenha').value;

    if (!email || !senha) {
        mostrarErroAuth('Preencha email e senha.');
        return;
    }

    try {
        var result = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: senha
        });

        if (result.error) {
            mostrarErroAuth('Email ou senha incorretos.');
            return;
        }
    } catch (err) {
        mostrarErroAuth('Erro ao fazer login. Tente novamente.');
    }
}

async function fazerLogout() {
    await supabaseClient.auth.signOut();
    usuarioAtual = null;
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('appPrincipal').style.display = 'none';
}

function entrarNoApp(usuario) {
    usuarioAtual = usuario;
    var nome = usuario.user_metadata && usuario.user_metadata.nome 
        ? usuario.user_metadata.nome 
        : usuario.email;
    document.getElementById('userName').textContent = nome;
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appPrincipal').style.display = 'block';
    
    if (!map) {
        initMap();
    }
    carregarInteressados();
    carregarHoras();
}

// Verificar se ja esta logado
async function verificarSessao() {
    var result = await supabaseClient.auth.getSession();
    if (result.data.session && result.data.session.user) {
        entrarNoApp(result.data.session.user);
    }
}

// ============ MAPA ============

function initMap() {
    try {
        map = L.map('map').setView([-15.7975, -47.8919], 4);
        
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
            obterLocalizacaoGPS();
        }, 300);
    } catch (e) {
        console.error('Erro ao inicializar mapa:', e);
    }
}

function obterLocalizacaoGPS() {
    if (!navigator.geolocation) {
        document.getElementById('locationCoords').innerHTML = 
            '📍 GPS nao disponivel neste dispositivo';
        return;
    }

    document.getElementById('locationCoords').innerHTML = '📍 Obtendo localizacao...';

    navigator.geolocation.getCurrentPosition(
        function(posicao) {
            var lat = posicao.coords.latitude;
            var lng = posicao.coords.longitude;
            map.setView([lat, lng], 15);
            document.getElementById('locationCoords').innerHTML = 
                '📍 Sua localizacao atual';
        },
        function(erro) {
            var msg = '📍 Localizacao padrao: Brasil';
            if (erro.code === 1) msg = '📍 Permissao de localizacao negada';
            if (erro.code === 2) msg = '📍 Localizacao indisponivel';
            if (erro.code === 3) msg = '📍 Tempo esgotado';
            document.getElementById('locationCoords').innerHTML = msg;
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
}

// Buscar endereco via reverse geocoding
async function buscarEndereco(lat, lng) {
    document.getElementById('locationCoords').innerHTML = '📍 Buscando endereco...';
    try {
        var response = await fetch(
            'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&accept-language=pt-BR'
        );
        var data = await response.json();
        
        if (data.display_name) {
            var endereco = data.display_name;
            document.getElementById('endereco').value = endereco;
            document.getElementById('enderecoCompleto').value = endereco;
            document.getElementById('locationCoords').innerHTML = 
                '📍 ' + endereco.substring(0, 80) + '...';
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

// ============ DADOS (SUPABASE) ============

// Carregar interessados do Supabase (filtrado por usuario)
async function carregarInteressados() {
    if (!supabaseClient || !usuarioAtual) return;
    
    try {
        var result = await supabaseClient
            .from('interessados')
            .select('*')
            .eq('user_id', usuarioAtual.id)
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
    if (!supabaseClient || !usuarioAtual) {
        alert('Faca login para salvar.');
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
                .eq('id', interessadoEditando)
                .eq('user_id', usuarioAtual.id);
            
            if (result.error) throw result.error;
            interessadoEditando = null;
        } else {
            var result = await supabaseClient
                .from('interessados')
                .insert({
                    user_id: usuarioAtual.id,
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
    if (!deleteId || !usuarioAtual) return;
    
    try {
        var result = await supabaseClient
            .from('interessados')
            .delete()
            .eq('id', deleteId)
            .eq('user_id', usuarioAtual.id);
        
        if (result.error) throw result.error;
        
        await carregarInteressados();
        fecharModal();
    } catch (err) {
        console.error('Erro ao excluir:', err);
        alert('Erro ao excluir. Tente novamente.');
    }
}

// ============ RENDERIZACAO ============

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

// ============ WHATSAPP ============

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

// ============ UTILITARIOS ============

function verNoMapa(lat, lng) {
    if (lat && lng) {
        window.open('https://www.google.com/maps?q=' + lat + ',' + lng, '_blank');
    }
}

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

function confirmarExclusao(id) {
    deleteId = id;
    document.getElementById('confirmModal').classList.add('active');
}

function fecharModal() {
    document.getElementById('confirmModal').classList.remove('active');
    deleteId = null;
}

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

// ============ INICIALIZACAO ============

var cronometroInterval = null;
var cronometroSegundos = 0;
var cronometroRodando = false;

document.addEventListener('DOMContentLoaded', function() {
    verificarSessao();
    
    // Data atual no campo de horas
    document.getElementById('horasData').value = new Date().toISOString().split('T')[0];
    
    // Login Enter
    document.getElementById('loginSenha').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') fazerLogin();
    });
    
    // Cadastro Enter
    document.getElementById('cadastroSenha').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') fazerCadastro();
    });

    // Form submit interessados
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
    
    // Form submit horas
    document.getElementById('horasForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        var horas = parseFloat(document.getElementById('horasQtd').value);
        var data = document.getElementById('horasData').value;
        var objetivo = document.getElementById('objetivoManual').value;
        var obs = document.getElementById('horasObs').value;
        
        await salvarHoras(data, horas, objetivo, obs);
        
        document.getElementById('horasQtd').value = '';
        document.getElementById('horasObs').value = '';
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

// ============ CRONOMETRO ============

function iniciarCronometro() {
    cronometroRodando = true;
    document.getElementById('btnIniciar').style.display = 'none';
    document.getElementById('btnPausar').style.display = 'inline-block';
    document.getElementById('btnParar').style.display = 'inline-block';
    
    cronometroInterval = setInterval(function() {
        cronometroSegundos++;
        atualizarDisplayCronometro();
    }, 1000);
}

function pausarCronometro() {
    cronometroRodando = false;
    clearInterval(cronometroInterval);
    document.getElementById('btnPausar').style.display = 'none';
    document.getElementById('btnIniciar').style.display = 'inline-block';
    document.getElementById('btnIniciar').textContent = '▶️ Continuar';
}

function pararCronometro() {
    clearInterval(cronometroInterval);
    cronometroRodando = false;
    
    var horas = cronometroSegundos / 3600;
    var objetivo = document.getElementById('objetivoCronometro').value;
    
    if (horas < 0.01) {
        alert('Tempo muito curto para registrar.');
        resetarCronometro();
        return;
    }
    
    var data = new Date().toISOString().split('T')[0];
    salvarHoras(data, parseFloat(horas.toFixed(2)), objetivo, '');
    
    resetarCronometro();
}

function selecionarObjetivo(valor) {
    if (objetivoMesAtual) {
        alert('Objetivo ja definido para este mes: ' + objetivoMesAtual + 'h');
        return;
    }
}

function resetarCronometro() {
    cronometroSegundos = 0;
    atualizarDisplayCronometro();
    document.getElementById('btnPausar').style.display = 'none';
    document.getElementById('btnParar').style.display = 'none';
    document.getElementById('btnIniciar').style.display = 'inline-block';
    document.getElementById('btnIniciar').textContent = '▶️ Iniciar';
}

function atualizarDisplayCronometro() {
    var horas = Math.floor(cronometroSegundos / 3600);
    var minutos = Math.floor((cronometroSegundos % 3600) / 60);
    var segundos = cronometroSegundos % 60;
    
    var display = 
        (horas < 10 ? '0' : '') + horas + ':' +
        (minutos < 10 ? '0' : '') + minutos + ':' +
        (segundos < 10 ? '0' : '') + segundos;
    
    document.getElementById('cronometroTempo').textContent = display;
}

// ============ HORAS (SUPABASE) ============

var horasRegistros = [];
var objetivoMesAtual = null;

async function salvarHoras(data, horas, objetivo, obs) {
    if (!supabaseClient || !usuarioAtual) {
        alert('Faca login para salvar.');
        return;
    }
    
    // Se ja tem objetivo definido para o mes, usar ele
    if (objetivoMesAtual) {
        objetivo = objetivoMesAtual;
    } else {
        // Definir objetivo para o mes
        await definirObjetivoMes(objetivo);
    }
    
    try {
        var result = await supabaseClient
            .from('horas_pregacao')
            .insert({
                user_id: usuarioAtual.id,
                data: data,
                horas: horas,
                minutos: Math.round(horas * 60),
                tipo: objetivo,
                observacoes: obs
            });
        
        if (result.error) throw result.error;
        
        await carregarHoras();
    } catch (err) {
        console.error('Erro ao salvar horas:', err);
        alert('Erro ao salvar horas.');
    }
}

async function definirObjetivoMes(objetivo) {
    if (!supabaseClient || !usuarioAtual) return;
    
    var agora = new Date();
    var mes = agora.getFullYear() + '-' + String(agora.getMonth() + 1).padStart(2, '0');
    
    try {
        // Verificar se ja existe objetivo para este mes
        var result = await supabaseClient
            .from('objetivo_mes')
            .select('*')
            .eq('user_id', usuarioAtual.id)
            .eq('mes', mes)
            .single();
        
        if (result.data) {
            // Ja existe objetivo
            objetivoMesAtual = result.data.objetivo;
            atualizarDisplayObjetivo(objetivoMesAtual);
            return;
        }
        
        // Criar novo objetivo
        var insertResult = await supabaseClient
            .from('objetivo_mes')
            .insert({
                user_id: usuarioAtual.id,
                mes: mes,
                objetivo: objetivo
            });
        
        if (insertResult.error) throw insertResult.error;
        
        objetivoMesAtual = objetivo;
        atualizarDisplayObjetivo(objetivo);
    } catch (err) {
        console.error('Erro ao definir objetivo:', err);
        // Se a tabela nao existir, usar o objetivo selecionado
        objetivoMesAtual = objetivo;
        atualizarDisplayObjetivo(objetivo);
    }
}

async function carregarObjetivoMes() {
    if (!supabaseClient || !usuarioAtual) return;
    
    var agora = new Date();
    var mes = agora.getFullYear() + '-' + String(agora.getMonth() + 1).padStart(2, '0');
    
    try {
        var result = await supabaseClient
            .from('objetivo_mes')
            .select('objetivo')
            .eq('user_id', usuarioAtual.id)
            .eq('mes', mes)
            .single();
        
        if (result.data) {
            objetivoMesAtual = result.data.objetivo;
            atualizarDisplayObjetivo(objetivoMesAtual);
            
            // Travar os seletores
            document.getElementById('objetivoCronometro').value = objetivoMesAtual;
            document.getElementById('objetivoManual').value = objetivoMesAtual;
            document.getElementById('objetivoCronometro').disabled = true;
            document.getElementById('objetivoManual').disabled = true;
        }
    } catch (err) {
        console.log('Nenhum objetivo definido para este mes');
    }
}

function atualizarDisplayObjetivo(objetivo) {
    var labels = {
        '15': '🥉 Pioneiro Auxiliar (15h)',
        '30': '🥈 Pioneiro Auxiliar Especial (30h)',
        '50': '🥇 Pioneiro Regular (50h)'
    };
    document.getElementById('objetivoSelecionadoValor').textContent = labels[objetivo] || '🥇 Pioneiro Regular (50h)';
}

async function excluirHora(id) {
    if (!supabaseClient || !usuarioAtual) return;
    
    try {
        var result = await supabaseClient
            .from('horas_pregacao')
            .delete()
            .eq('id', id)
            .eq('user_id', usuarioAtual.id);
        
        if (result.error) throw result.error;
        
        await carregarHoras();
    } catch (err) {
        console.error('Erro ao excluir hora:', err);
    }
}

async function carregarHoras() {
    if (!supabaseClient || !usuarioAtual) return;
    
    await carregarObjetivoMes();
    
    try {
        var result = await supabaseClient
            .from('horas_pregacao')
            .select('*')
            .eq('user_id', usuarioAtual.id)
            .order('data', { ascending: false });
        
        if (result.error) throw result.error;
        
        horasRegistros = result.data || [];
        renderizarHoras();
        atualizarProgresso();
    } catch (err) {
        console.error('Erro ao carregar horas:', err);
    }
}

function renderizarHoras() {
    var container = document.getElementById('listaHoras');
    
    if (horasRegistros.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhum registro de horas ainda.</p>';
        return;
    }
    
    var html = '';
    for (var i = 0; i < horasRegistros.length; i++) {
        var reg = horasRegistros[i];
        var dataFormatada = new Date(reg.data + 'T12:00:00').toLocaleDateString('pt-BR');
        var objetivoLabel = '';
        if (reg.tipo === '15') objetivoLabel = '🥉 15h';
        else if (reg.tipo === '30') objetivoLabel = '🥈 30h';
        else if (reg.tipo === '50') objetivoLabel = '🥇 50h';
        
        html += '<div class="historico-item">';
        html += '<div class="historico-item-info">';
        html += '<span class="historico-item-data">' + dataFormatada + '</span>';
        html += '<span class="historico-item-tipo">' + objetivoLabel + (reg.observacoes ? ' - ' + reg.observacoes : '') + '</span>';
        html += '</div>';
        html += '<span class="historico-item-horas">' + reg.horas.toFixed(1) + 'h</span>';
        html += '<button class="historico-item-delete" onclick="excluirHora(' + reg.id + ')">🗑️</button>';
        html += '</div>';
    }
    
    container.innerHTML = html;
}

function atualizarProgresso() {
    var agora = new Date();
    var mesAtual = agora.getMonth();
    var anoAtual = agora.getFullYear();
    
    var nomesMeses = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
                      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    document.getElementById('mesAtual').textContent = nomesMeses[mesAtual] + ' ' + anoAtual;
    
    var totalMes = 0;
    
    for (var i = 0; i < horasRegistros.length; i++) {
        var dataReg = new Date(horasRegistros[i].data + 'T12:00:00');
        if (dataReg.getMonth() === mesAtual && dataReg.getFullYear() === anoAtual) {
            totalMes += horasRegistros[i].horas;
        }
    }
    
    document.getElementById('totalHorasMes').textContent = totalMes.toFixed(1);
    
    // Meta do objetivo selecionado
    var meta = 50;
    if (objetivoMesAtual === '15') meta = 15;
    else if (objetivoMesAtual === '30') meta = 30;
    else meta = 50;
    
    var percentual = Math.min((totalMes / meta) * 100, 100);
    document.getElementById('progressoFill').style.width = percentual + '%';
    document.getElementById('progressoText').textContent = totalMes.toFixed(1) + ' / ' + meta + ' horas';
}
