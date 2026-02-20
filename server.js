const express = require('express');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(cors()); // 🔥 Додаємо CORS

app.get('/geocode', async (req, res) => {
    const q = req.query.q;

    if (!q) {
        return res.status(400).json({ error: 'Query missing' });
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=ua&q=${encodeURIComponent(q)}`;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'bsmap-ua-tool'
            }
        });

        const data = await response.json();
        res.json(data);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Geocode failed' });
    }
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
