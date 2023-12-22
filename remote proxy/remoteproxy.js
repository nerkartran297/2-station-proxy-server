const http = require('http');
const net = require('net');
const url = require('url');

const remoteProxyServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('This is a simple HTTP CONNECT proxy\n');
});

remoteProxyServer.on('connect', (req, clientSocket, head) => {
    const { port, hostname } = url.parse(`//${req.url}`, true, true);
    console.log(`Remote Proxy: Connecting to ${hostname}:${port}`);

    const targetSocket = net.connect(port || 80, hostname, () => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n' +
                           'Proxy-agent: Remote-Proxy\r\n' +
                           '\r\n');

        if (head && head.length) {
            targetSocket.write(head);
        }

        clientSocket.pipe(targetSocket);
        targetSocket.pipe(clientSocket);
    });

    // Error handling
    handleSocketErrors(clientSocket, targetSocket);
});

function handleSocketErrors(clientSocket, targetSocket) {
    clientSocket.on('error', (err) => {
        console.error('Remote Proxy - Client Socket Error:', err);
        targetSocket.end();
    });
    targetSocket.on('error', (err) => {
        console.error('Remote Proxy - Target Socket Error:', err);
        clientSocket.end();
    });
}

const REMOTE_PROXY_PORT = 1080;

remoteProxyServer.listen(REMOTE_PROXY_PORT, () => {
    console.log(`Remote proxy server listening on port ${REMOTE_PROXY_PORT}`);
});
