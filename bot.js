const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const cron = require('node-cron');
const fs = require('fs');
const axios = require('axios');
const scraper = require('./scraper');
const extrairDadosProduto = scraper.extrairDadosProduto;
const painel = require('./painel');

function lerConfig() {
  if (!fs.existsSync('./config.json')) return { modo: 'minutos', intervalo: 30, horarios: '9,14,19' };
  return JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
}

function lerLinks() {
  if (!fs.existsSync('./links.txt')) return [];
  return fs.readFileSync('./links.txt', 'utf-8')
    .split('\n').map(l => l.trim()).filter(l => l.startsWith('http'));
}

function lerEnviados() {
  if (!fs.existsSync('./enviados.json')) return [];
  return JSON.parse(fs.readFileSync('./enviados.json', 'utf-8'));
}

function salvarEnviado(link) {
  const enviados = lerEnviados();
  enviados.push(link);
  fs.writeFileSync('./enviados.json', JSON.stringify(enviados, null, 2));
}

function sortearLink() {
  const todos = lerLinks();
  const enviados = lerEnviados();
  const disponiveis = todos.filter(l => !enviados.includes(l));
  if (disponiveis.length === 0) {
    fs.writeFileSync('./enviados.json', '[]');
    console.log('Todos os produtos enviados! Reiniciando ciclo...');
    return todos[Math.floor(Math.random() * todos.length)];
  }
  return disponiveis[Math.floor(Math.random() * disponiveis.length)];
}

function criarMensagem(produto) {
  return '🔥 *' + produto.nome + '*\n\n' +
         '✅ ' + produto.preco + '\n\n' +
         '➡️ ' + produto.link;
}

function montarCron() {
  const config = lerConfig();
  if (config.modo === 'minutos') {
    return '*/' + config.intervalo + ' * * * *';
  } else {
    const horas = config.horarios.split(',').map(h => h.trim()).join(',');
    return '0 ' + horas + ' * * *';
  }
}

async function baixarImagem(url) {
  try {
    const resposta = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000
    });
    const base64 = Buffer.from(resposta.data).toString('base64');
    const tipo = resposta.headers['content-type'] || 'image/jpeg';
    return { base64, tipo };
  } catch {
    return null;
  }
}

const DESTINO = '5521982509824@c.us';

async function enviarProduto() {
  console.log('\n' + new Date().toLocaleString('pt-BR') + ' — Iniciando envio...');
  const link = sortearLink();
  if (!link) { console.log('Nenhum link no links.txt'); return; }
  console.log('Extraindo dados de: ' + link);
  const produto = await extrairDadosProduto(link);
  if (!produto) { console.log('Nao foi possivel extrair. Pulando...'); return; }
  console.log('Produto: ' + produto.nome);
  const mensagem = criarMensagem(produto);
  try {
    if (produto.imagem) {
      const img = await baixarImagem(produto.imagem);
      if (img) {
        const midia = new MessageMedia(img.tipo, img.base64);
        await client.sendMessage(DESTINO, midia, { caption: mensagem });
      } else {
        await client.sendMessage(DESTINO, mensagem);
      }
    } else {
      await client.sendMessage(DESTINO, mensagem);
    }
    salvarEnviado(link);
    console.log('Enviado com sucesso!');
  } catch (erro) {
    console.error('Erro ao enviar: ' + erro.message);
  }
}

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-accelerated-2d-canvas','--no-first-run','--no-zygote','--single-process','--disable-gpu']
  }
});

client.on('qr', qr => {
  console.log('QR_CODE:' + qr);
  const QRCode = require('qrcode');
  QRCode.toDataURL(qr, (err, url) => {
    if (!err) painel.setQR(url);
  });
});

client.on('ready', () => {
  const cronExp = montarCron();
  const config = lerConfig();
  console.log('WhatsApp conectado!');
  painel.setStatus('conectado');
  if (config.modo === 'minutos') {
    console.log('Enviando a cada ' + config.intervalo + ' minutos.');
  } else {
    console.log('Enviando nos horarios: ' + config.horarios);
  }
  cron.schedule(cronExp, enviarProduto, { timezone: 'America/Sao_Paulo' });
  enviarProduto();
});

client.on('auth_failure', () => {
  console.log('Sessao expirada. Delete a pasta .wwebjs_auth e rode novamente.');
  painel.setStatus('desconectado');
});

client.initialize();