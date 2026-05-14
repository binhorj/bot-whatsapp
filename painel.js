const express = require('express');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
app.use(express.json());

let botProcesso = null;

function lerLinks() {
  if (!fs.existsSync('./links.txt')) return [];
  return fs.readFileSync('./links.txt', 'utf-8')
    .split('\n').map(l => l.trim()).filter(l => l.startsWith('http'));
}

function salvarLinks(links) {
  fs.writeFileSync('./links.txt', links.join('\n'));
}

function lerEnviados() {
  if (!fs.existsSync('./enviados.json')) return [];
  return JSON.parse(fs.readFileSync('./enviados.json', 'utf-8'));
}

function lerConfig() {
  if (!fs.existsSync('./config.json')) return { modo: 'minutos', intervalo: 30, horarios: '9,14,19' };
  return JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
}

function salvarConfig(config) {
  fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
}

app.get('/api/status', (req, res) => res.json({ rodando: botProcesso !== null }));

app.post('/api/ligar', (req, res) => {
  if (botProcesso) return res.json({ ok: false, msg: 'Bot ja esta rodando!' });
  botProcesso = exec('node bot.js', (err) => { botProcesso = null; });
  res.json({ ok: true, msg: 'Bot ligado!' });
});

app.post('/api/desligar', (req, res) => {
  if (!botProcesso) return res.json({ ok: false, msg: 'Bot nao esta rodando!' });
  botProcesso.kill();
  botProcesso = null;
  res.json({ ok: true, msg: 'Bot desligado!' });
});

app.get('/api/links', (req, res) => res.json(lerLinks()));

app.post('/api/links', (req, res) => {
  const { link } = req.body;
  if (!link || !link.startsWith('http')) return res.json({ ok: false, msg: 'Link invalido!' });
  const links = lerLinks();
  if (links.includes(link)) return res.json({ ok: false, msg: 'Link ja existe!' });
  links.push(link);
  salvarLinks(links);
  res.json({ ok: true, msg: 'Link adicionado!' });
});

app.delete('/api/links/:index', (req, res) => {
  const links = lerLinks();
  links.splice(req.params.index, 1);
  salvarLinks(links);
  res.json({ ok: true });
});

app.get('/api/enviados', (req, res) => res.json(lerEnviados()));

app.post('/api/limpar', (req, res) => {
  fs.writeFileSync('./enviados.json', '[]');
  res.json({ ok: true });
});

app.get('/api/config', (req, res) => res.json(lerConfig()));

app.post('/api/config', (req, res) => {
  const { modo, intervalo, horarios } = req.body;
  if (!modo) return res.json({ ok: false, msg: 'Configuracao invalida!' });
  if (modo === 'minutos' && (!intervalo || intervalo < 2)) return res.json({ ok: false, msg: 'Minimo de 2 minutos!' });
  if (modo === 'horarios' && !horarios) return res.json({ ok: false, msg: 'Informe os horarios!' });
  salvarConfig({ modo, intervalo: parseInt(intervalo) || 30, horarios: horarios || '9,14,19' });
  res.json({ ok: true, msg: 'Salvo! Reinicie o bot para aplicar.' });
});

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Bot WhatsApp</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:Arial,sans-serif; background:#f0f2f5; color:#333; }
.header { background:#25D366; color:white; padding:20px; text-align:center; }
.header h1 { font-size:24px; }
.container { max-width:700px; margin:30px auto; padding:0 20px; }
.card { background:white; border-radius:12px; padding:20px; margin-bottom:20px; box-shadow:0 2px 8px rgba(0,0,0,0.1); }
.card h2 { margin-bottom:15px; font-size:18px; color:#555; }
.status { display:flex; align-items:center; gap:12px; margin-bottom:15px; }
.bolinha { width:14px; height:14px; border-radius:50%; background:#ccc; }
.bolinha.ativo { background:#25D366; }
.bolinha.inativo { background:#e74c3c; }
.btn { padding:10px 24px; border:none; border-radius:8px; font-size:15px; cursor:pointer; font-weight:bold; margin-right:8px; }
.btn-ligar { background:#25D366; color:white; }
.btn-desligar { background:#e74c3c; color:white; }
.btn-add { background:#3498db; color:white; }
.btn-remover { background:#e74c3c; color:white; padding:6px 14px; font-size:13px; }
.btn-salvar { background:#9b59b6; color:white; }
.btn-limpar { background:#e67e22; color:white; }
.input-row { display:flex; gap:10px; margin-bottom:15px; }
input[type=text], input[type=number] { flex:1; padding:10px; border:1px solid #ddd; border-radius:8px; font-size:14px; }
.link-item { display:flex; align-items:center; justify-content:space-between; padding:10px; background:#f8f9fa; border-radius:8px; margin-bottom:8px; font-size:13px; word-break:break-all; gap:10px; }
.enviado-item { padding:8px 12px; background:#f8f9fa; border-radius:8px; margin-bottom:6px; font-size:13px; color:#666; }
.msg { padding:10px; border-radius:8px; margin-top:10px; font-size:14px; display:none; }
.msg.ok { background:#d4edda; color:#155724; }
.msg.erro { background:#f8d7da; color:#721c24; }
.dica { font-size:12px; color:#999; margin-top:8px; }
.tabs { display:flex; gap:8px; margin-bottom:15px; }
.tab { padding:8px 18px; border:2px solid #ddd; border-radius:8px; cursor:pointer; font-size:14px; background:white; }
.tab.ativo { border-color:#9b59b6; color:#9b59b6; font-weight:bold; }
.painel-modo { display:none; }
.painel-modo.ativo { display:block; }
</style>
</head>
<body>
<div class="header"><h1>🤖 Bot WhatsApp Produtos</h1></div>
<div class="container">

  <div class="card">
    <h2>Status do Bot</h2>
    <div class="status">
      <div class="bolinha" id="bolinha"></div>
      <span id="statusTexto">Verificando...</span>
    </div>
    <button class="btn btn-ligar" id="btnLigar" onclick="ligar()">▶️ Ligar Bot</button>
    <button class="btn btn-desligar" id="btnDesligar" onclick="desligar()" style="display:none">⏹️ Desligar Bot</button>
  </div>

  <div class="card">
    <h2>⏰ Horario de Envio</h2>
    <div class="tabs">
      <button class="tab" id="tabMinutos" onclick="trocarModo('minutos')">A cada X minutos</button>
      <button class="tab" id="tabHorarios" onclick="trocarModo('horarios')">Horarios fixos</button>
    </div>
    <div class="painel-modo" id="painelMinutos">
      <div class="input-row">
        <input type="number" id="intervalo" min="2" placeholder="Ex: 30">
        <button class="btn btn-salvar" onclick="salvarConfig()">Salvar</button>
      </div>
      <p class="dica">Minimo de 2 minutos. Ex: 30 = envia a cada 30 minutos.</p>
    </div>
    <div class="painel-modo" id="painelHorarios">
      <div class="input-row">
        <input type="text" id="horarios" placeholder="Ex: 9,12,18">
        <button class="btn btn-salvar" onclick="salvarConfig()">Salvar</button>
      </div>
      <p class="dica">Digite as horas separadas por virgula. Ex: 9,14,19 = envia as 9h, 14h e 19h.</p>
    </div>
    <div id="msgConfig" class="msg"></div>
  </div>

  <div class="card">
    <h2>📦 Produtos (Links)</h2>
    <div class="input-row">
      <input type="text" id="novoLink" placeholder="Cole o link do produto aqui...">
      <button class="btn btn-add" onclick="adicionarLink()">Adicionar</button>
    </div>
    <div id="msgLinks" class="msg"></div>
    <div id="listaLinks"></div>
  </div>

  <div class="card">
    <h2>📋 Historico de Enviados</h2>
    <button class="btn btn-limpar" onclick="limparHistorico()" style="margin-bottom:15px">🗑️ Limpar Historico</button>
    <div id="listaEnviados"></div>
  </div>

</div>
<script>
  let modoAtual = 'minutos';

  function trocarModo(modo) {
    modoAtual = modo;
    document.getElementById('tabMinutos').className = 'tab' + (modo === 'minutos' ? ' ativo' : '');
    document.getElementById('tabHorarios').className = 'tab' + (modo === 'horarios' ? ' ativo' : '');
    document.getElementById('painelMinutos').className = 'painel-modo' + (modo === 'minutos' ? ' ativo' : '');
    document.getElementById('painelHorarios').className = 'painel-modo' + (modo === 'horarios' ? ' ativo' : '');
  }

  async function atualizarStatus() {
    const r = await fetch('/api/status').then(r => r.json());
    document.getElementById('bolinha').className = 'bolinha ' + (r.rodando ? 'ativo' : 'inativo');
    document.getElementById('statusTexto').textContent = r.rodando ? 'Bot rodando!' : 'Bot parado';
    document.getElementById('btnLigar').style.display = r.rodando ? 'none' : 'inline-block';
    document.getElementById('btnDesligar').style.display = r.rodando ? 'inline-block' : 'none';
  }

  async function ligar() {
    const r = await fetch('/api/ligar', { method:'POST' }).then(r => r.json());
    alert(r.msg); atualizarStatus();
  }

  async function desligar() {
    const r = await fetch('/api/desligar', { method:'POST' }).then(r => r.json());
    alert(r.msg); atualizarStatus();
  }

  async function carregarConfig() {
    const c = await fetch('/api/config').then(r => r.json());
    trocarModo(c.modo || 'minutos');
    document.getElementById('intervalo').value = c.intervalo || 30;
    document.getElementById('horarios').value = c.horarios || '9,14,19';
  }

  async function salvarConfig() {
    const body = { modo: modoAtual, intervalo: document.getElementById('intervalo').value, horarios: document.getElementById('horarios').value };
    const r = await fetch('/api/config', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }).then(r => r.json());
    const msg = document.getElementById('msgConfig');
    msg.textContent = r.msg; msg.className = 'msg ' + (r.ok ? 'ok' : 'erro'); msg.style.display = 'block';
    setTimeout(() => msg.style.display = 'none', 4000);
  }

  async function carregarLinks() {
    const links = await fetch('/api/links').then(r => r.json());
    const lista = document.getElementById('listaLinks');
    lista.innerHTML = links.length === 0 ? '<p style="color:#999;font-size:13px">Nenhum link adicionado ainda.</p>' :
      links.map((l, i) => '<div class="link-item"><span>' + l + '</span><button class="btn btn-remover" onclick="removerLink(' + i + ')">Remover</button></div>').join('');
  }

  async function adicionarLink() {
    const link = document.getElementById('novoLink').value.trim();
    const r = await fetch('/api/links', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ link }) }).then(r => r.json());
    const msg = document.getElementById('msgLinks');
    msg.textContent = r.msg; msg.className = 'msg ' + (r.ok ? 'ok' : 'erro'); msg.style.display = 'block';
    setTimeout(() => msg.style.display = 'none', 3000);
    if (r.ok) { document.getElementById('novoLink').value = ''; carregarLinks(); }
  }

  async function removerLink(i) {
    await fetch('/api/links/' + i, { method:'DELETE' });
    carregarLinks();
  }

  async function carregarEnviados() {
    const enviados = await fetch('/api/enviados').then(r => r.json());
    const lista = document.getElementById('listaEnviados');
    lista.innerHTML = enviados.length === 0 ? '<p style="color:#999;font-size:13px">Nenhum produto enviado ainda.</p>' :
      enviados.map(l => '<div class="enviado-item">✅ ' + l + '</div>').join('');
  }

  async function limparHistorico() {
    await fetch('/api/limpar', { method:'POST' });
    carregarEnviados();
  }

  setInterval(atualizarStatus, 3000);
  atualizarStatus(); carregarLinks(); carregarEnviados(); carregarConfig();
</script>
</body>
</html>`);
});

app.listen(3000, () => {
  console.log('Painel aberto em: http://localhost:3000');
});