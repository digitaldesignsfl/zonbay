const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

async function runTest() {
    console.log("🧪 Starting Amazon-Scraper End-to-End Pipeline Test...\n");

    // 1. Launch server
    const serverProcess = exec('node server.js', { cwd: __dirname });
    serverProcess.stdout.on('data', data => console.log(`[Server] ${data.trim()}`));
    serverProcess.stderr.on('data', data => console.error(`[Server Err] ${data.trim()}`));

    // Wait for server to bind to port 3000
    await new Promise(resolve => setTimeout(resolve, 1500));

    const baseUrl = 'http://localhost:3000';
    let testsPassed = 0;
    let testsFailed = 0;

    function assert(name, condition, extra = '') {
        if (condition) {
            console.log(`  ✅ PASS: ${name} ${extra}`);
            testsPassed++;
        } else {
            console.error(`  ❌ FAIL: ${name} ${extra}`);
            testsFailed++;
        }
    }

    try {
        // Test 1: Check UI dashboard
        const uiRes = await axios.get(baseUrl);
        assert("Dashboard UI serves on GET /", uiRes.status === 200 && uiRes.data.includes("eBay Automated Control Center"));

        // Test 2: POST /api/save-product (Scraper simulation)
        const mockScrapedProduct = {
            title: "Dewalt 20V MAX Cordless Drill Driver Kit Compact 1/2-Inch",
            price: "$99.00",
            alternateImages: [
                "https://m.media-amazon.com/images/I/418xUZTlODL.jpg"
            ],
            bulletPoints: [
                "High performance motor delivers 300 unit watts out (UWO) of power",
                "Compact, lightweight design fits into tight areas",
                "2-speed transmission (0-450 / 0-1500 RPM)"
            ],
            productSpecs: {
                "Brand": "DEWALT",
                "Item model number": "DCD771C2",
                "Color": "Yellow/Black",
                "Voltage": "20 Volts"
            },
            longDescription: "The DCD771C2 20V MAX Cordless Drill/Driver Kit is compact and lightweight to fit into tight spaces."
        };

        const saveRes = await axios.post(`${baseUrl}/api/save-product`, mockScrapedProduct);
        assert("Scraper endpoint POST /api/save-product", saveRes.status === 200);

        // Test 3: GET /api/view-product (Triggers optimize.js & upload-images.js)
        const viewRes = await axios.get(`${baseUrl}/api/view-product`);
        assert("Pipeline execution GET /api/view-product", viewRes.status === 200);
        assert("Payload contains optimized title", Boolean(viewRes.data.title));
        assert("Payload contains category", Boolean(viewRes.data.categoryId));
        assert("Payload contains hosted imageUrls", Array.isArray(viewRes.data.imageUrls));

        // Test 4: Verify static image serving
        if (viewRes.data.imageUrls && viewRes.data.imageUrls.length > 0) {
            const firstImg = viewRes.data.imageUrls[0];
            const imgRes = await axios.get(firstImg);
            assert("Static hosted image GET returns 200", imgRes.status === 200, `(${firstImg})`);
        }

        // Test 5: POST /api/manual-product
        const manualItem = {
            title: "Smart Wi-Fi Power Strip Surge Protector 4 Outlets 4 USB Ports",
            price: "27.50",
            alternateImages: [],
            bulletPoints: ["App Remote Control", "Voice Control compatible with Alexa"],
            longDescription: "Control appliances anywhere with smart Wi-Fi power strip.",
            productSpecs: { "Brand": "Kasa", "Color": "White" }
        };
        const manualRes = await axios.post(`${baseUrl}/api/manual-product`, manualItem);
        assert("Manual product entry POST /api/manual-product", manualRes.status === 200);

        // Test 6: GET /api/get-listings
        const listingsRes = await axios.get(`${baseUrl}/api/get-listings`);
        assert("Store inventory GET /api/get-listings", listingsRes.status === 200 && Array.isArray(listingsRes.data));

        // Test 7: POST /api/update-listing (Listing revision)
        const targetId = listingsRes.data[0]?.itemId || 'v1-29472940294-0';
        const updateRes = await axios.post(`${baseUrl}/api/update-listing`, {
            itemId: targetId,
            title: "Updated 12V 6A Smart Battery Charger - Special Edition",
            price: "39.99"
        });
        assert("Revise listing POST /api/update-listing", updateRes.status === 200);

        // Test 8: GET /api/history (Ledger verification)
        const historyRes = await axios.get(`${baseUrl}/api/history`);
        assert("History ledger GET /api/history", historyRes.status === 200 && Array.isArray(historyRes.data.history));
        assert("History contains SCRAPED event", historyRes.data.history.some(line => line.includes("[SCRAPED]")));
        assert("History contains OPTIMIZED event", historyRes.data.history.some(line => line.includes("[OPTIMIZED]")));
        assert("History contains UPLOADED event", historyRes.data.history.some(line => line.includes("[UPLOADED]")));
        assert("History contains MANUAL_ENTRY event", historyRes.data.history.some(line => line.includes("[MANUAL_ENTRY]")));
        assert("History contains REVISION event", historyRes.data.history.some(line => line.includes("[REVISION]")));

        // Test 9: GET /api/export-csv (eBay Seller Hub CSV Generation)
        const csvRes = await axios.get(`${baseUrl}/api/export-csv`);
        assert("Export CSV GET /api/export-csv returns 200", csvRes.status === 200);
        assert("CSV content type is text/csv", csvRes.headers['content-type']?.includes('text/csv'));
        assert("CSV includes official eBay action header", csvRes.data.includes('*Action(SiteID=US'));
        assert("CSV includes required eBay fields", csvRes.data.includes('*ConditionID') && csvRes.data.includes('*StartPrice'));

        // Test 10: POST /api/export-custom-csv (Direct manual item export)
        const customCsvRes = await axios.post(`${baseUrl}/api/export-custom-csv`, {
            title: "Custom Anker USB C Cable 6ft Braided Nylon",
            price: "14.99",
            categoryId: "172008",
            itemSpecifics: [{ name: "Brand", value: "Anker" }, { name: "Color", value: "Black" }]
        });
        assert("Custom CSV POST /api/export-custom-csv returns 200", customCsvRes.status === 200);
        assert("Custom CSV contains custom title and brand", customCsvRes.data.includes("Custom Anker USB C Cable") && customCsvRes.data.includes("Anker"));

    } catch (err) {
        console.error("❌ Unexpected test exception:", err.message);
        testsFailed++;
    } finally {
        console.log(`\n📊 Test Summary: ${testsPassed} Passed, ${testsFailed} Failed`);
        serverProcess.kill();
        process.exit(testsFailed > 0 ? 1 : 0);
    }
}

runTest();
