const http = require('http');
const sodium = require('sodium-native');
const { URL } = require('url');

// Proxy Server Configuration
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
    if (req.method === 'POST' && req.url === '/proxy') {
        let body = '';
        req.on('data', (chunk) => body += chunk);
        req.on('end', () => {
            try {
                const bodyObj = JSON.parse(body);
                const decryptedBody = decrypt(bodyObj.nonce, bodyObj.cipher);

                const requestDetails = JSON.parse(decryptedBody);
                const url = new URL(requestDetails.url);

                const options = {
                    hostname: url.hostname,
                    port: url.port || 80,
                    path: url.pathname + url.search,
                    method: requestDetails.method,
                    headers: requestDetails.headers
                };

                const targetRequest = http.request(options, (targetResponse) => {
                    let responseData = '';
                    targetResponse.on('data', (chunk) => responseData += chunk);
                    targetResponse.on('end', () => {
                        const encryptedResponse = encrypt(responseData);
                        res.end(JSON.stringify(encryptedResponse));
                    });
                });

                targetRequest.end();
            } catch (error) {
                console.error('Error handling proxy request:', error);
                res.writeHead(500);
                res.end('Internal Server Error');
            }
        });
    } else {
        console.log(`Invalid request received: ${req.method} ${req.url}`);
        res.writeHead(404);
        res.end('Not Found');
    }
};

const server = http.createServer(requestHandler);

server.listen(PROXY_SERVER_PORT, () => {
    console.log(`Proxy server running on port ${PROXY_SERVER_PORT}`);
});
