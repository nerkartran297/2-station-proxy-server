const net = require('net');
const url = require('url');

// Local Proxy Configuration
const LOCAL_PROXY_PORT = 8888;
const REMOTE_PROXY_IP = '103.77.243.214'; // IP of the remote proxy server
const REMOTE_PROXY_PORT = 1080; // Port of the remote proxy server

const localProxyServer = net.createServer((clientSocket) => {
    clientSocket.on('data', (chunk) => {
        // Parse the request data to extract the target URL
        const request = chunk.toString();
        const firstLine = request.split('\n')[0];
        const [method, fullUrl] = firstLine.split(' ');
        if (method === 'CONNECT') {
            const { port, hostname } = url.parse(`//${fullUrl}`, true, true);
            console.log(`Local Proxy: Connecting to ${hostname}:${port}`);

            // Establish a connection to the remote proxy
            const remoteProxySocket = net.connect(REMOTE_PROXY_PORT, REMOTE_PROXY_IP, () => {
                console.log('Local Proxy: Connected to remote proxy');
                clientSocket.write('HTTP/1.1 200 Connection Established\r\n' +
                                    'Proxy-agent: Local-Proxy\r\n' +
                                    '\r\n');
                remoteProxySocket.write(chunk);
            });

            clientSocket.pipe(remoteProxySocket);
            remoteProxySocket.pipe(clientSocket);

            // Error handling
            handleSocketErrors(clientSocket, remoteProxySocket);
        }
    });
});

function handleSocketErrors(clientSocket, remoteProxySocket) {
    clientSocket.on('error', (err) => {
        console.error('Local Proxy - Client Socket Error:', err);
        remoteProxySocket.end();
    });
    remoteProxySocket.on('error', (err) => {
        console.error('Local Proxy - Remote Proxy Socket Error:', err);
        clientSocket.end();
    });
}

localProxyServer.listen(LOCAL_PROXY_PORT, () => {
    console.log(`Local proxy server listening on port ${LOCAL_PROXY_PORT}`);
});

