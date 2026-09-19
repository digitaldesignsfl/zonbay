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

        // Test 11: Standalone Portable CSV Exporter (exporters/ebay-csv.js)
        const { generateEbayCsvString } = require('./exporters/ebay-csv');
        const mockAmazonItem = {
            source: 'amazon',
            sourceId: 'B08N5WRWNW',
            title: 'Anker Power Strip Surge Protector with 12 Outlets and 3 USB Ports Power Delivery Extension Cord 6ft Extra Long Cord',
            price: '29.99',
            brand: 'Anker',
            mainImgUrl: 'https://m.media-amazon.com/images/I/71xyz.jpg',
            alternateImages: [
                'https://m.media-amazon.com/images/I/71xyz.jpg',
                'https://m.media-amazon.com/images/I/81abc.jpg'
            ],
            bulletPoints: ['12 Outlets', '3 USB Ports', 'Surge Protection'],
            productSpecs: { Brand: 'Anker', MPN: 'A9192', Color: 'White' },
            categoryId: '67779'
        };
        const amazonCsv = generateEbayCsvString(mockAmazonItem);
        assert("Portable CSV exporter generates eBay format", amazonCsv.includes('*Action(SiteID=US'));
        assert("Portable CSV exporter truncates title to <= 80 chars", amazonCsv.split('\r\n')[1].split(',')[3].length <= 80);
        assert("Portable CSV joins alternate images with pipe delimiter", amazonCsv.includes('https://m.media-amazon.com/images/I/71xyz.jpg|https://m.media-amazon.com/images/I/81abc.jpg'));

        // Test 12: Standalone Portable CSV Exporter with Temu Item
        const mockTemuItem = {
            source: 'temu',
            sourceId: 'TEMU-601099',
            title: 'Cordless Electric Screwdriver Rechargeable Mini Drill Tool Kit',
            price: '12.49',
            brand: 'Unbranded',
            mainImgUrl: 'https://img.kwcdn.com/product/123.jpg',
            alternateImages: ['https://img.kwcdn.com/product/123.jpg'],
            bulletPoints: ['USB Rechargeable', 'LED Light'],
            productSpecs: { 'Type': 'Cordless Screwdriver', 'Voltage': '3.6V' },
            categoryId: '184655'
        };
        const temuCsv = generateEbayCsvString(mockTemuItem);
        assert("Temu CSV contains correct category ID", temuCsv.includes('184655'));
        assert("Temu CSV contains clean SKU", temuCsv.includes('TEMU-601099'));
        assert("Temu CSV includes HTML description with specs", temuCsv.includes('Cordless Screwdriver'));

        // Test 13: Dynamic Policy Configuration in CSV Exporter
        const mockPolicyItem = {
            title: "Heavy Duty Power Inverter 1000W Pure Sine Wave",
            price: "129.00",
            shippingService: "FedExHomeDelivery",
            shippingCost: "9.99",
            shippingType: "Flat",
            dispatchTimeMax: "1",
            location: "Miami, FL 33101",
            immediatePayRequired: "1",
            returnsAcceptedOption: "ReturnsAccepted"
        };
        const policyCsv = generateEbayCsvString(mockPolicyItem);
        assert("CSV reflects custom shipping service", policyCsv.includes("FedExHomeDelivery"));
        assert("CSV reflects custom shipping cost", policyCsv.includes("9.99"));
        assert("CSV reflects custom handling time", policyCsv.includes(",1,ReturnsAccepted"));
        assert("CSV reflects custom item location", policyCsv.includes("Miami, FL 33101"));

        // Test 14: GET /editor (Full-Screen Reseller Studio route)
        const editorRes = await axios.get(`${baseUrl}/editor`);
        assert("GET /editor serves Studio HTML", editorRes.status === 200 && editorRes.data.includes("Zonbay Reseller Studio"));

        // Test 15: POST /api/save-edited-image (Canvas edited image disk persistence)
        const sampleBase64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
        const saveImgRes = await axios.post(`${baseUrl}/api/save-edited-image`, {
            dataUrl: sampleBase64,
            filename: "test_edited_photo"
        });
        assert("Save edited image POST /api/save-edited-image returns 200", saveImgRes.status === 200 && saveImgRes.data.success);
        assert("Save edited image creates file on disk", fs.existsSync(saveImgRes.data.localPath));
        const hostedImgRes = await axios.get(saveImgRes.data.hostedUrl);
        assert("Static route serves saved edited image via HTTP", hostedImgRes.status === 200);

        // Test 16: CSV Exporter preserves public URL when photos are edited via Canvas
        const mockEditedProduct = {
            title: "MOTOPOWER MP00205A 12V 800mA Fully Automatic Battery Charger",
            price: "24.99",
            imageList: [
                {
                    url: sampleBase64, // Edited canvas data URL
                    originalUrl: "https://m.media-amazon.com/images/I/71xyz.jpg",
                    isHero: true,
                    isExcluded: false,
                    isEdited: true
                },
                {
                    url: "https://m.media-amazon.com/images/I/81abc.jpg",
                    originalUrl: "https://m.media-amazon.com/images/I/81abc.jpg",
                    isHero: false,
                    isExcluded: false,
                    isEdited: false
                }
            ]
        };
        const editedCsv = generateEbayCsvString(mockEditedProduct);
        assert("CSV Exporter excludes data URLs and falls back to public CDN", editedCsv.includes("https://m.media-amazon.com/images/I/71xyz.jpg") && !editedCsv.includes("data:image"));

        // Test 17: GET /editor.js serves updated Studio logic
        const editorJsRes = await axios.get(`${baseUrl}/editor.js`);
        assert("GET /editor.js contains photo download and toast helpers", editorJsRes.status === 200 && editorJsRes.data.includes("downloadEditedImage") && editorJsRes.data.includes("showToast"));

        // Test 18: GET /cleaner.js and GET /templates.js
        const cleanerRes = await axios.get(`${baseUrl}/cleaner.js`);
        assert("GET /cleaner.js returns 200", cleanerRes.status === 200 && cleanerRes.data.includes("ZonbayCleaner"));
        const templatesRes = await axios.get(`${baseUrl}/templates.js`);
        assert("GET /templates.js returns 200", templatesRes.status === 200 && templatesRes.data.includes("renderStorefrontShowcase"));

        // Test 19: ZonbayCleaner Unit Tests (Clutter purge & normalization)
        const { cleanProductData, getSpecificPriority } = require('./cleaner');
        const dirtyMockItem = {
            title: "MOTOPOWER MP00205A 12V 800mA Automatic Battery Charger Prime Sale New 2026",
            brand: "MOTOPOWER",
            productSpecs: {
                "ASIN": "B06XWDZ2KQ",
                "Best Sellers Rank": "#176 in Automotive",
                "Customer Reviews": "4.5 out of 5 stars (16,611) var dpAcrHasRegisteredArcLinkClickAction; P.when('A', 'ready').execute...",
                "Date First Available": "January 15, 2021",
                "Item model number": "MP00205A",
                "Amperage": "800 milliamps",
                "Color": "Black"
            },
            bulletPoints: [
                "Desulfates and maintains 12V lead-acid batteries",
                "100% money back guarantee if not satisfied",
                "Spark proof and reverse polarity protected"
            ],
            longDescription: "Product Overview\\n\\nMP00205A MX1000 Add to Cart Buying Options Customer Reviews 4.5 out of 5 stars 16,611 Price $13.47\\n\\nReal features of the charger."
        };
        const cleanedMock = cleanProductData(dirtyMockItem);
        assert("Cleaner purges Customer Reviews and JS", !cleanedMock.productSpecs['Customer Reviews']);
        assert("Cleaner purges Best Sellers Rank", !cleanedMock.productSpecs['Best Sellers Rank']);
        assert("Cleaner removes ASIN from specifics", !cleanedMock.productSpecs['ASIN']);
        assert("Cleaner maps Item model number to MPN", cleanedMock.productSpecs['MPN'] === 'MP00205A');
        assert("Cleaner purges spam words from title", !cleanedMock.title.toLowerCase().includes('prime') && !cleanedMock.title.includes('2026'));
        assert("Cleaner purges money back guarantee from bullets", cleanedMock.bulletPoints.length === 2);
        assert("Cleaner strips comparison matrix and Add to Cart from description", !cleanedMock.longDescription.includes('Add to Cart'));

        // Test 20: Taxonomy priority tiers
        assert("Brand is essential priority", getSpecificPriority('Brand') === 'essential');
        assert("MPN is essential priority", getSpecificPriority('MPN') === 'essential');
        assert("Type is essential priority", getSpecificPriority('Type') === 'essential');
        assert("Voltage is recommended priority", getSpecificPriority('Voltage') === 'recommended');
        assert("Color is recommended priority", getSpecificPriority('Color') === 'recommended');

        // Test 21: ZonbayTemplates Storefront Showcase (User's Preferred Layout)
        const { renderStorefrontShowcase } = require('./templates');
        const customStoreConfig = {
            storeName: "Digital Designs Florida",
            storeUrl: "https://www.ebay.com/str/digitaldesignsfl",
            storeTagline: "Top Rated Plus • Same Day Shipping • Quality Guaranteed"
        };
        const templateHtml = renderStorefrontShowcase(cleanedMock, customStoreConfig);
        assert("Template includes Header Showcase Banner", templateHtml.includes("<!-- ZONBAY STOREFRONT SHOWCASE TEMPLATE -->") && templateHtml.includes("MOTOPOWER"));
        assert("Template includes Product Overview & Practical Usage", templateHtml.includes("Product Overview & Practical Usage"));
        assert("Template includes Item Specifics & Technical Details", templateHtml.includes("Item Specifics & Technical Details"));
        assert("Template includes What's In The Box", templateHtml.includes("What's In The Box"));
        assert("Template includes Store Showcase Footer Ad with custom store name", templateHtml.includes("Digital Designs Florida") && templateHtml.includes("https://www.ebay.com/str/digitaldesignsfl"));

        // Test 21b: Modern Minimalist & Technical Pro Templates
        const { renderModernMinimalist, renderTechnicalPro, renderEbayTemplate } = require('./templates');
        const minimalHtml = renderModernMinimalist(cleanedMock, customStoreConfig);
        assert("Modern Minimalist template renders clean specs", minimalHtml.includes("ZONBAY MODERN MINIMALIST TEMPLATE") && minimalHtml.includes("Key Specifications") && minimalHtml.includes("Digital Designs Florida"));

        const technicalHtml = renderTechnicalPro(cleanedMock, customStoreConfig);
        assert("Technical Pro template renders matrix & inclusions", technicalHtml.includes("ZONBAY TECHNICAL PRO TEMPLATE") && technicalHtml.includes("Technical Specifications Matrix") && technicalHtml.includes("Package Inclusions"));

        const dispatchedMinimal = renderEbayTemplate('modern_minimalist', cleanedMock, customStoreConfig);
        const dispatchedTechnical = renderEbayTemplate('technical_pro', cleanedMock, customStoreConfig);
        assert("Dispatcher correctly outputs chosen template", dispatchedMinimal.includes("ZONBAY MODERN MINIMALIST TEMPLATE") && dispatchedTechnical.includes("ZONBAY TECHNICAL PRO TEMPLATE"));

        // Test 21c: Studio Presentation Area in editor.html
        const editorHtml = fs.readFileSync(path.join(__dirname, 'editor.html'), 'utf8');
        assert("Studio HTML includes Live Visual Preview container", editorHtml.includes('id="inlineTemplatePreviewContainer"'));
        assert("Studio HTML includes inline viewport controls", editorHtml.includes('id="inlineViewportControls"') && editorHtml.includes('id="inlineDesktopBtn"') && editorHtml.includes('id="inlineMobileBtn"'));
        assert("Studio HTML includes presentation tabs", editorHtml.includes('id="tabVisualPreviewBtn"') && editorHtml.includes('id="tabBulletsBtn"') && editorHtml.includes('id="tabHtmlCodeBtn"'));

        // Test 22: CSV Export reflects rendered Template in Description
        const csvWithTemplate = generateEbayCsvString({
            ...cleanedMock,
            htmlDescription: templateHtml
        });
        assert("CSV exporter incorporates Storefront Showcase HTML in *Description", csvWithTemplate.includes("ZONBAY STOREFRONT SHOWCASE TEMPLATE") && csvWithTemplate.includes("Digital Designs Florida"));

        // Test 23: 1:1 Authentic Live eBay Buyer Page Mockup
        const { renderEbayBuyerPageMockup } = require('./templates');
        assert("renderEbayBuyerPageMockup is exported by templates.js", typeof renderEbayBuyerPageMockup === 'function');

        const mockForMockup = {
            ...cleanedMock,
            price: "19.95",
            shippingCost: "0.00",
            shippingService: "USPS Ground Advantage®",
            location: "Orlando, Florida",
            imageList: [
                { url: "https://m.media-amazon.com/images/I/71example1.jpg", isHero: true, isExcluded: false },
                { url: "https://m.media-amazon.com/images/I/71example2.jpg", isHero: false, isExcluded: false },
                { url: "https://m.media-amazon.com/images/I/71example3.jpg", isHero: false, isExcluded: true }
            ]
        };
        const buyerMockup = renderEbayBuyerPageMockup(mockForMockup, templateHtml, customStoreConfig);

        assert("Mockup contains official eBay 4-color logo", buyerMockup.includes('color:#e53238') && buyerMockup.includes('color:#0064d2') && buyerMockup.includes('color:#f5af02') && buyerMockup.includes('color:#86b817'));
        assert("Mockup contains top utility bar and search bar", buyerMockup.includes('Hi <strong') && buyerMockup.includes('Daily Deals') && buyerMockup.includes('Search for anything'));
        assert("Mockup contains photo viewer and hero image", buyerMockup.includes('id="ebayLiveHeroImg"') && buyerMockup.includes('71example1.jpg'));
        assert("Mockup contains interactive thumbnail strip excluding disabled photos", buyerMockup.includes('ebay-preview-thumb-btn') && buyerMockup.includes('71example2.jpg') && !buyerMockup.includes('71example3.jpg'));
        assert("Mockup contains seller trust card with custom store name", buyerMockup.includes("Digital Designs Florida") && buyerMockup.includes("Top Rated Plus"));
        assert("Mockup contains bold price and CTA buttons", buyerMockup.includes("US $19.95") && buyerMockup.includes("Buy It Now") && buyerMockup.includes("Add to cart") && buyerMockup.includes("Add to Watchlist"));
        assert("Mockup contains estimated delivery and free shipping", buyerMockup.includes("FREE Standard Shipping") && buyerMockup.includes("Estimated between"));
        assert("Mockup contains eBay Money Back Guarantee", buyerMockup.includes("eBay Money Back Guarantee"));
        assert("Mockup contains official Item Specifics grid with Brand and MPN", buyerMockup.includes("Item specifics") && buyerMockup.includes("MP00205A") && buyerMockup.includes("MOTOPOWER"));
        assert("Mockup contains embedded seller description template", buyerMockup.includes("Description from seller") && buyerMockup.includes("ZONBAY STOREFRONT SHOWCASE TEMPLATE"));

        // Test 24: Multi-Platform Inventory Base & Two-Step Workflow
        const inventorySavePayload = {
            id: 'RUN-TEST-001',
            sku: 'SKU-TEST-001',
            title: 'DeWalt 20V MAX XR Brushless Impact Driver Bare Tool High Torque',
            brand: 'DeWalt',
            sourcePlatform: 'Amazon',
            sourceId: 'B018864600',
            sourceUrl: 'https://www.amazon.com/dp/B018864600',
            costPrice: '45.00',
            sellingPrice: '89.99',
            price: '89.99',
            quantity: 4,
            alternateImages: ['http://localhost:3000/images/test.jpg']
        };

        const invSaveRes = await axios.post(`${baseUrl}/api/inventory/save`, inventorySavePayload);
        assert("Inventory save returns 200", invSaveRes.status === 200);
        assert("Inventory item marked APPROVED", invSaveRes.data.item.status === 'APPROVED');
        assert("Inventory item calculates profit", parseFloat(invSaveRes.data.item.estimatedProfit) > 20);

        const invGetOne = await axios.get(`${baseUrl}/api/inventory/RUN-TEST-001`);
        assert("Inventory get single item by ID returns 200", invGetOne.status === 200 && invGetOne.data.id === 'RUN-TEST-001');

        const invUploadRes = await axios.post(`${baseUrl}/api/inventory/upload`, { id: 'RUN-TEST-001', method: 'Seller Hub' });
        assert("Inventory mark uploaded sets LIVE_ON_EBAY", invUploadRes.status === 200 && invUploadRes.data.item.status === 'LIVE_ON_EBAY');

        // Test 25: eBay Store Inventory Listing-by-Listing Sync
        const uniqueStoreId = 'RUN-STORE-' + Date.now();
        const storeSyncRes = await axios.post(`${baseUrl}/api/inventory/sync-ebay`, {
            listings: [
                {
                    itemId: uniqueStoreId,
                    title: 'Live eBay Store Product Title From Seller Hub',
                    price: '49.99',
                    quantity: 2,
                    sku: 'STORE-SKU-1',
                    brand: 'StoreBrand'
                }
            ]
        });
        assert("eBay Store Sync endpoint returns 200", storeSyncRes.status === 200 && storeSyncRes.data.success);
        assert("eBay Store Sync adds listing", storeSyncRes.data.addedCount >= 1 || storeSyncRes.data.updatedCount >= 1);

        // Test 26: Active Listings CSV Import
        const uniqueCsvId = 'RUN-CSV-' + Date.now();
        const testCsv = `Item number,Title,Custom label (SKU),Price,Quantity available\n${uniqueCsvId},CSV Imported Drill Kit,SKU-CSV-1,55.00,3`;
        const csvImportRes = await axios.post(`${baseUrl}/api/inventory/import-ebay-csv`, { csvText: testCsv });
        assert("CSV Report import returns 200", csvImportRes.status === 200 && (csvImportRes.data.addedCount >= 1 || csvImportRes.data.updatedCount >= 1));

        // Test 27: Inventory Business Analytics
        const invAllRes = await axios.get(`${baseUrl}/api/inventory`);
        assert("Inventory GET returns items and stats", invAllRes.status === 200 && invAllRes.data.items.length >= 3);
        assert("Inventory stats contains liveCount and valuation", invAllRes.data.stats.liveCount >= 2 && parseFloat(invAllRes.data.stats.totalValue) > 0);

        // Test 28: RFC 4180 CSV Import with complex quotes, empty fields, and PicURL
        const uniqueRfcId = 'RUN-RFC-' + Date.now();
        const uniqueRfcSku = 'SKU-RFC-' + Date.now();
        const complexCsv = `Item number,Title,Custom label (SKU),Price,Quantity available,PicURL,Brand,Category ID
${uniqueRfcId},"Impact Driver, 20V Cordless ""Pro Edition""",${uniqueRfcSku},79.95,5,"https://i.ebayimg.com/images/g/rfc1/s-l1600.jpg|https://i.ebayimg.com/images/g/rfc2/s-l1600.jpg",DeWalt,184655`;
        const rfcImportRes = await axios.post(`${baseUrl}/api/inventory/import-ebay-csv`, { csvText: complexCsv });
        assert("RFC 4180 CSV import returns 200", rfcImportRes.status === 200 && rfcImportRes.data.addedCount >= 1);

        // Test 29: Single item by ID returns complete merged schema with photos & specifics
        const rfcItemRes = await axios.get(`${baseUrl}/api/inventory/${uniqueRfcId}`);
        assert("Inventory item by ID returns 200", rfcItemRes.status === 200);
        assert("Imported item title preserved with commas and quotes", rfcItemRes.data.title.includes("Impact Driver, 20V"));
        assert("Imported item has primary photo", rfcItemRes.data.mainImage.includes("rfc1"));
        assert("Imported item productData has alternateImages array", Array.isArray(rfcItemRes.data.alternateImages) && rfcItemRes.data.alternateImages.length === 2);
        assert("Imported item has Brand and Category ID", rfcItemRes.data.brand === 'DeWalt' && rfcItemRes.data.productData.categoryId === '184655');

        // Test 30: GET /api/inventory/latest returns the most recently imported item
        const latestRes = await axios.get(`${baseUrl}/api/inventory/latest`);
        assert("Inventory latest item returns 200", latestRes.status === 200 && latestRes.data.id === uniqueRfcId);
        assert("Latest item has mainImgUrl and alternateImages", Boolean(latestRes.data.mainImgUrl) && latestRes.data.alternateImages.length >= 1);

        // Test 31: GET /editor.js contains API_BASE, autoDetectCategory, and updateInlineTemplatePreview
        const editorJsContentRes = await axios.get(`${baseUrl}/editor.js`);
        assert("editor.js serves without error", editorJsContentRes.status === 200);
        assert("editor.js defines API_BASE", editorJsContentRes.data.includes("const API_BASE"));
        assert("editor.js defines autoDetectCategory", editorJsContentRes.data.includes("function autoDetectCategory"));
        assert("editor.js defines top-level updateInlineTemplatePreview", editorJsContentRes.data.includes("function updateInlineTemplatePreview()"));

        // Cleanup
        await axios.delete(`${baseUrl}/api/inventory/RUN-TEST-001`).catch(() => {});
        await axios.delete(`${baseUrl}/api/inventory/${uniqueRfcId}`).catch(() => {});
        await axios.delete(`${baseUrl}/api/inventory/${uniqueStoreId}`).catch(() => {});
        await axios.delete(`${baseUrl}/api/inventory/${uniqueCsvId}`).catch(() => {});

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
