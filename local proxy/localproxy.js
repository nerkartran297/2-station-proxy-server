const http = require('http');
const sodium = require('sodium-native');

// Proxy Configuration
const LOCAL_PROXY_PORT = 8888;
const PROXY_SERVER_IP = '123.123.123.123';
const PROXY_SERVER_PORT = 1080;

const password = "i'm here if you need me";
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES);
const hash = Buffer.alloc(sodium.crypto_generichash_BYTES);
sodium.crypto_generichash(hash, Buffer.from(password, 'utf8'));
hash.copy(key, 0, 0, sodium.crypto_secretbox_KEYBYTES);

function encrypt(text) {
    const message = Buffer.from(text, 'utf8');
    const cipher = Buffer.alloc(message.length + sodium.crypto_secretbox_MACBYTES);
    const nonce = Buffer.alloc(sodium.crypto_secretbox_NONCEBYTES);
    sodium.randombytes_buf(nonce);

    sodium.crypto_secretbox_easy(cipher, message, nonce, key);
    return { nonce: nonce.toString('hex'), cipher: cipher.toString('hex') };
}

function decrypt(nonceHex, cipherHex) {
    const nonce = Buffer.from(nonceHex, 'hex');
    const cipher = Buffer.from(cipherHex, 'hex');
    const message = Buffer.alloc(cipher.length - sodium.crypto_secretbox_MACBYTES);

    if (sodium.crypto_secretbox_open_easy(message, cipher, nonce, key)) {
        return message.toString('utf8');
    } else {
        throw new Error('Decryption failed');
    }
}

const requestHandler = (req, res) => {
    console.log(`Request received: ${req.method} ${req.url}`);
    console.log('Request headers:', req.headers);

    try {
        const options = {
            hostname: PROXY_SERVER_IP,
            port: PROXY_SERVER_PORT,
            path: '/proxy',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const proxyRequest = http.request(options, (proxyResponse) => {
            let data = '';
            proxyResponse.on('data', (chunk) => data += chunk);
            proxyResponse.on('end', () => {
                const responseObj = JSON.parse(data);
                const decryptedData = decrypt(responseObj.nonce, responseObj.cipher);
                res.end(decryptedData);
            });
        });

        let body = '';
        req.on('data', (chunk) => body += chunk);
        req.on('end', () => {
            const encryptedBody = encrypt(body);
            proxyRequest.write(JSON.stringify(encryptedBody));
            proxyRequest.end();
        });
    } catch (error) {
        console.error('Error handling request:', error);
        res.writeHead(500);
        res.end('Internal Server Error');
    }
};

const server = http.createServer(requestHandler);

server.listen(LOCAL_PROXY_PORT, () => {
    console.log(`Local proxy running on http://localhost:${LOCAL_PROXY_PORT}/`);
});
