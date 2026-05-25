const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            const key = match[1];
            let value = match[2] || '';
            value = value.replace(/^['"]|['"]$/g, '');
            if (!process.env[key]) process.env[key] = value;
        }
    });
}
const config = {
    sessionKey: process.env.SESSION_PRIVATE_KEY,
    sessionAddress: process.env.SESSION_ADDRESS,
    receiverAddress: process.env.RECEIVER_ADDRESS,
    port: parseInt(process.env.SERVER_PORT) || 3000,
    apiKey: process.env.API_KEY,
    network: process.env.NETWORK || 'mainnet',
    fullNode: process.env.NETWORK === 'shasta' ? 'https://api.shasta.trongrid.io' : 'https://api.trongrid.io'
};
const required = ['sessionKey', 'sessionAddress', 'receiverAddress'];
const missing = required.filter(k => !config[k] || config[k].includes('your_'));
if (missing.length > 0) {
    console.error('[✗] 缺少: ' + missing.join(', '));
    process.exit(1);
}
console.log('[+] Session: ' + config.sessionAddress.slice(0, 10) + '...');
console.log('[+] Receiver: ' + config.receiverAddress.slice(0, 10) + '...');
module.exports = config;
