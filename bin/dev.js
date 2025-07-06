const dotenv = require('dotenv');
const express = require('express');
const { handler } = require('../dist/index');

dotenv.config();

console.log('GOOGLE_SERVICE_ACCOUNT_KEY loaded:', !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

const app = express();
app.use(express.json()); // Parse JSON bodies

const { GOOGLE_SERVICE_ACCOUNT_KEY, PORT } = process.env;

// Remove process.exit(1) to keep the server running for debugging
if (GOOGLE_SERVICE_ACCOUNT_KEY === undefined) {
    console.warn('`GOOGLE_SERVICE_ACCOUNT_KEY` not set. Please set it in your .env file. All requests will fail.');
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy', 
        service: 'Google Sheets Writer',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// POST endpoint for Google Sheets writing
app.post('/write', async (req, res) => {
    if (!GOOGLE_SERVICE_ACCOUNT_KEY) {
        return res.status(500).json({ error: 'GOOGLE_SERVICE_ACCOUNT_KEY not set in environment.' });
    }
    const { sheet_id, range, summary } = req.body;

    const event = {
        body: JSON.stringify({
            args: {
                sheet_id,
                range,
                summary
            },
            secrets: {
                GOOGLE_SERVICE_ACCOUNT_KEY
            }
        })
    };

    const result = await handler(event);
    res.status(result.statusCode).send(result.body);
});

const port = PORT || 3000;
app.listen(port, () => {
    console.log(`Local development server running on port ${port}`);
    console.log('POST to /write with JSON: { "sheet_id": "...", "range": "...", "summary": "..." }');
});
