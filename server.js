require('dotenv').config();
// server.js
const http = require('http');
const { handler } = require('./dist/index');

const PORT = 3000; // The port your local server will listen on

const server = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/write') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                const payload = JSON.parse(body);
                console.log('Received payload:', payload);

                const event = {
                    body: JSON.stringify({
                        args: {
                            sheet_id: payload.sheet_id,
                            range: payload.range,
                            summary: payload.summary
                        },
                        secrets: {
                            GOOGLE_SERVICE_ACCOUNT_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_KEY
                        }
                    })
                };

                const result = await handler(event);
                res.writeHead(result.statusCode, { 'Content-Type': 'application/json' });
                res.end(result.body);
            } catch (error) {
                console.error('Error processing request:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
    } else {
        // For any other requests, just send a simple message
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('This is the Google Sheets Writer server. Send POST requests to /write.');
    }
});

server.listen(PORT, () => {
    console.log(`Local server running on http://localhost:${PORT}`);
    console.log('Ready to receive POST requests to /write...');
});