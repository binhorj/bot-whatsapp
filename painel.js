const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

let qrCodeData = '';
let botStatus = 'desconectado';

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Bot WhatsApp</title>
      <meta charset="utf-8">
      <meta http-equiv="refresh" content="10">
      <style>
        body { font-family: Arial; text-align: center; background: #111; color: #fff; padding: 40px; }
        img { margin: 20px auto; display: block; }
        .status { font-size: 20px; margin: 20px; }
        .online { color: #25D366; }
        .offline { color: #ff4444; }
      </style>
    </head>
    <body>
      <h1>Bot WhatsApp</h1>
      <div class="status">
        Status: <span class="${botStatus === 'conectado' ? 'online' : 'offline'}">${botStatus}</span>
      </div>
      ${qrCodeData ? `<img src="${qrCodeData}" width="300" />` : '<p>Aguardando QR Code...</p>'}
    </body>
    </html>
  `);
});

app.get('/qr', (req, res) => {
  res.json({ qr: qrCodeData, status: botStatus });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Painel rodando na porta ${PORT}`);
});

module.exports = { setQR: (qr) => { qrCodeData = qr; }, setStatus: (s) => { botStatus = s; } };