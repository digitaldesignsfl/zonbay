const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');
const { appendHistory, getHistory } = require('./logger');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use('/images', express.static(path.join(__dirname, 'downloads')));
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let mockStoreDatabase = [
    { itemId: 'v1-29472940294-0', title: '12V 6A Smart Battery Charger Trickle Maintainer Car Motorcycle Marine AGM', price: '34.99' },
    { itemId: 'v1-84027502941-0', title: 'Surge Protector Power Strip - Tower 12 Outlets, 6 USB Ports, 6ft Extension Cord', price: '24.95' },
    { itemId: 'v1-10485720475-0', title: 'Tankless Water Heater 27kW 240V Whole Home Instant Electric Hot Water Eco', price: '289.00' }
];

function buildReviseItemXml(itemId, updatedTitle, updatedPrice) {
    return `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>__EBAY_AUTH_TOKEN_PLACEHOLDER__</eBayAuthToken></RequesterCredentials>
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <Item>
    <ItemID>${itemId}</ItemID>
    <Title>${escapeXml(updatedTitle)}</Title>
    <StartPrice>${updatedPrice}</StartPrice>
  </Item>
</ReviseFixedPriceItemRequest>`;
}

function escapeXml(unsafeText) {
    return String(unsafeText).replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;'; 
            case '>': return '&gt;'; 
            case '&': return '&amp;'; 
            case '\'': return '&apos;'; 
            case '"': return '&quot;'; 
            default: return c;
        }
    });
}

async function pushRevisionToEbay(itemId, title, price) {
    let authToken = "MOCK_TOKEN_EXPIRED_OR_PENDING";
    const tokenPath = path.join(__dirname, 'ebay_tokens.json');
    if (fs.existsSync(tokenPath)) {
        try {
            const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
            authToken = tokens.accessToken || authToken;
        } catch (e) {
            console.error("Token read error:", e.message);
        }
    }
    const xmlPayload = buildReviseItemXml(itemId, title, price).replace('__EBAY_AUTH_TOKEN_PLACEHOLDER__', authToken);
    try {
        const response = await axios.post('https://ebay.com', xmlPayload, {
            headers: { 'X-EBAY-API-COMPATIBILITY-LEVEL': '1131', 'X-EBAY-API-CALL-NAME': 'ReviseFixedPriceItem', 'X-EBAY-API-SITEID': '0', 'Content-Type': 'text/xml' },
            timeout: 5000
        });
        return response.data;
    } catch (error) { 
        return null; 
    }
}

app.post('/api/save-product', (req, res) => {
    const productData = req.body;
    const targetPath = path.join(__dirname, 'ebay_ready_product.json');
    fs.writeFileSync(targetPath, JSON.stringify(productData, null, 2));

    appendHistory('SCRAPED', {
        title: productData.title,
        price: productData.price,
        imagesCount: (productData.alternateImages || []).length
    });

    res.status(200).json({ message: "Success! Product scraped, ready for dashboard activation." });
});

// MANUAL ENTRY ENDPOINT
app.post('/api/manual-product', (req, res) => {
    const manualPayload = req.body;
    console.log("✍️ Manual data packet received from form input.");
    const targetPath = path.join(__dirname, 'ebay_ready_product.json');
    fs.writeFileSync(targetPath, JSON.stringify(manualPayload, null, 2));

    appendHistory('MANUAL_ENTRY', {
        title: manualPayload.title,
        price: manualPayload.price
    });
    
    exec('node optimize.js', { cwd: __dirname }, (optErr) => {
        if (optErr) console.error("optimize.js error:", optErr.message);
        exec('node upload-images.js', { cwd: __dirname }, (imgErr) => {
            if (imgErr) console.error("upload-images.js error:", imgErr.message);
            console.log("🚀 Manual product layout processed successfully.");
            res.status(200).json({ message: "Success! Manual listing compiled and optimized." });
        });
    });
});

app.get('/api/view-product', (req, res) => {
    const readyFile = path.join(__dirname, 'ebay_ready_product.json');
    if (!fs.existsSync(readyFile)) return res.status(404).json({ error: "Missing ebay_ready_product.json" });
    
    exec('node optimize.js', { cwd: __dirname }, (optErr) => {
        if (optErr) console.error("optimize.js error:", optErr.message);
        exec('node upload-images.js', { cwd: __dirname }, (imgErr) => {
            if (imgErr) console.error("upload-images.js error:", imgErr.message);
            const finalFile = path.join(__dirname, 'ebay_final_api_ready.json');
            if (fs.existsSync(finalFile)) {
                try {
                    const finalData = JSON.parse(fs.readFileSync(finalFile, 'utf8'));
                    res.json(finalData);
                } catch (e) {
                    res.status(500).json({ error: "Corrupt final payload file" });
                }
            } else {
                res.status(500).json({ error: "Failed generating final payload" });
            }
        });
    });
});

app.get('/api/get-listings', (req, res) => { 
    res.json(mockStoreDatabase); 
});

app.post('/api/update-listing', async (req, res) => {
    const { itemId, title, price } = req.body;
    const targetItem = mockStoreDatabase.find(i => i.itemId === itemId);
    if (targetItem) { 
        targetItem.title = title; 
        targetItem.price = price; 
    }
    
    appendHistory('REVISION', {
        itemId,
        title,
        price
    });

    await pushRevisionToEbay(itemId, title, price);
    res.status(200).json({ message: `Listing update processed.` });
});

// HISTORY LEDGER ENDPOINT
app.get('/api/history', (req, res) => {
    const lines = getHistory(100);
    res.json({ history: lines });
});

// EBAY SELLER HUB CSV EXPORT ENDPOINTS
app.get('/api/export-csv', (req, res) => {
    try {
        const { exportCurrentListingCsv } = require('./csv-exporter');
        const csvContent = exportCurrentListingCsv();
        const filename = `ebay-seller-hub-listing-${Date.now()}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(csvContent);
    } catch (err) {
        console.error("CSV Export error:", err.message);
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/export-custom-csv', (req, res) => {
    try {
        const { generateEbaySellerHubCsv } = require('./csv-exporter');
        const productData = req.body;
        const csvContent = generateEbaySellerHubCsv(productData);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="ebay-custom-listing-${Date.now()}.csv"`);
        res.status(200).send(csvContent);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`API Server and Multi-Panel Control Dashboard active at http://localhost:${PORT}`);
});

