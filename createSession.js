const TronWeb = require('tronweb');
const fs = require('fs');

// 使用最新版 tronweb 的静态方法 createAccount 来生成密钥对
// 该方法返回一个包含 privateKey, publicKey, address 的对象
async function generateSession() {
    try {
        // 调用 createAccount 生成新账户
        const account = await TronWeb.createAccount();
        
        // 提取私钥
        const privateKey = account.privateKey;
        
        // 注意：用于权限设置的 address 字段需要 hex 格式
        // 这里的 publicKey 是完整的非压缩公钥，但权限字段需要的是账户地址的 hex 格式
        // 因此我们从 account 对象中获取 address.hex
        const publicKeyHex = account.address.hex;

        const sessionData = {
            privateKey: privateKey,
            publicKey: publicKeyHex
        };

        fs.writeFileSync('.session', JSON.stringify(sessionData, null, 2));
        console.log('✅ 会话密钥已生成并保存至 .session');
        console.log('公钥(hex):', publicKeyHex);
        console.log('私钥已保存，请绝对不要泄露！');
    } catch (error) {
        console.error('生成会话密钥时出错:', error);
    }
}

generateSession();
