/**
 * Zonbay Reseller Cockpit - Extension Controller
 */

let currentProduct = null;
let activeTab = null;

function showStatus(text, type = 'info') {
    const el = document.getElementById('statusMessage');
    if (!el) return;
    el.innerText = text;
    el.className = `status-${type}`;
    el.style.display = 'block';
    if (type === 'success' || type === 'info') {
        setTimeout(() => { el.style.display = 'none'; }, 4000);
    }
}

function updateCharCounter() {
    const input = document.getElementById('listingTitle');
    const counter = document.getElementById('titleCounter');
    if (!input || !counter) return;
    const len = input.value.length;
    counter.innerText = `${len} / 80`;
    if (len >= 80) {
        counter.classList.add('limit');
    } else {
        counter.classList.remove('limit');
    }
}

function calculatePricing() {
    if (!currentProduct) return;
    const cost = parseFloat(currentProduct.price) || 0;
    const marginSelect = document.getElementById('marginPercent');
    const margin = parseFloat(marginSelect ? marginSelect.value : 40) / 100;
    
    // Auto-calculate suggested listing price if not manually edited
    const listingPriceInput = document.getElementById('listingPrice');
    let listingPrice = parseFloat(listingPriceInput.value);
    
    if (isNaN(listingPrice) || listingPrice <= 0 || document.activeElement !== listingPriceInput) {
        listingPrice = parseFloat((cost * (1 + margin)).toFixed(2));
        if (cost > 0 && listingPrice < cost + 5) {
            listingPrice = parseFloat((cost + 5).toFixed(2)); // minimum $5 buffer
        }
        listingPriceInput.value = listingPrice.toFixed(2);
    }

    // eBay standard fees ~13.25% + $0.30 insertion/order fee
    const fee = (listingPrice * 0.1325) + 0.30;
    const netProfit = listingPrice - cost - fee;

    const feeEl = document.getElementById('estEbayFee');
    const profitEl = document.getElementById('estNetProfit');

    if (feeEl) feeEl.innerText = `-$${fee.toFixed(2)}`;
    if (profitEl) {
        profitEl.innerText = `${netProfit >= 0 ? '+' : ''}$${netProfit.toFixed(2)}`;
        profitEl.style.color = netProfit >= 0 ? '#28a745' : '#dc3545';
    }
}

function autoDetectCategory(titleText) {
    const text = String(titleText).toLowerCase();
    const select = document.getElementById('listingCategory');
    if (!select) return;

    if (text.includes('charger') && text.includes('battery')) {
        select.value = '179471';
    } else if (text.includes('strip') || text.includes('surge') || text.includes('outlet')) {
        select.value = '67779';
    } else if (text.includes('drill') || text.includes('driver') || text.includes('wrench')) {
        select.value = '184655';
    } else if (text.includes('cable') || text.includes('usb') || text.includes('adapter') || text.includes('phone')) {
        select.value = '172008';
    } else {
        select.value = '11700'; // Home & Garden fallback
    }
}

function renderProductDataInPopup(data) {
    if (!data) return;
    if (typeof ZonbayCleaner !== 'undefined') {
        currentProduct = ZonbayCleaner.cleanProductData(data);
    } else {
        currentProduct = { ...data };
    }

    // Auto-apply preferred template if not set
    if (typeof ZonbayTemplates !== 'undefined' && (!currentProduct.htmlDescription || !currentProduct.htmlDescription.includes('<!-- ZONBAY'))) {
        currentProduct.htmlDescription = ZonbayTemplates.renderEbayTemplate('storefront_showcase', currentProduct, {
            storeName: "Our Official Store",
            storeUrl: "https://www.ebay.com/usr"
        });
    }

    // Logistics & Origin Detection (China / Temu / AliExpress vs US Domestic)
    let logistics = { isInternational: false };
    if (typeof ZonbayCleaner !== 'undefined' && typeof ZonbayCleaner.detectShippingLogistics === 'function') {
        logistics = ZonbayCleaner.detectShippingLogistics(currentProduct);
    }
    currentProduct.isInternational = (data.isInternational !== undefined) ? data.isInternational : logistics.isInternational;
    currentProduct.originCountry = data.originCountry || logistics.originCountry || 'US';
    currentProduct.shippingService = currentProduct.shippingService || (currentProduct.isInternational ? 'StandardShippingFromOutsideUS' : 'USPSGroundAdvantage');
    currentProduct.dispatchTimeMax = (currentProduct.dispatchTimeMax !== undefined) ? currentProduct.dispatchTimeMax : (currentProduct.isInternational ? 5 : 3);
    currentProduct.location = currentProduct.location || (currentProduct.isInternational ? 'China' : 'United States');

    const logisticsBox = document.getElementById('popupLogisticsBox');
    if (logisticsBox) {
        if (currentProduct.isInternational) {
            logisticsBox.style.display = 'block';
            const originTitle = document.getElementById('popupOriginTitle');
            const originDesc = document.getElementById('popupOriginDesc');
            const handlingBadge = document.getElementById('popupHandlingBadge');
            if (originTitle) originTitle.innerText = `🇨🇳 ${logistics.originCountryName || 'Overseas Origin: China'}`;
            if (handlingBadge) handlingBadge.innerText = `${logistics.handlingTimeDays || 5}d Handling`;
            if (originDesc && logistics.warningMessage) originDesc.innerText = logistics.warningMessage;
        } else {
            logisticsBox.style.display = 'none';
        }
    }

    const preview = document.getElementById('productPreview');
    if (preview) preview.style.display = 'block';

    const previewImg = document.getElementById('previewImg');
    if (previewImg) previewImg.src = currentProduct.mainImgUrl || (currentProduct.alternateImages && currentProduct.alternateImages[0]) || '';

    const previewBrand = document.getElementById('previewBrand');
    if (previewBrand) previewBrand.innerText = currentProduct.brand || 'UNBRANDED';

    const countEl = document.getElementById('previewImgCount');
    const totalImgs = (currentProduct.alternateImages || []).length || (currentProduct.imageList || []).length || 1;
    if (countEl) countEl.innerText = `🖼️ ${totalImgs} High-Res Photos`;

    const sourcePriceInput = document.getElementById('sourcePriceInput');
    if (sourcePriceInput) sourcePriceInput.value = currentProduct.price || '0.00';

    const titleInput = document.getElementById('listingTitle');
    const cleanTitle = (currentProduct.title || '').replace(/\s+/g, ' ').trim();
    if (titleInput) {
        titleInput.value = cleanTitle.substring(0, 80);
        updateCharCounter();
    }

    if (currentProduct.categoryId) {
        const catSelect = document.getElementById('listingCategory');
        if (catSelect) {
            if (catSelect.querySelector(`option[value="${currentProduct.categoryId}"]`)) {
                catSelect.value = currentProduct.categoryId;
            } else {
                catSelect.value = 'custom';
                const customInput = document.getElementById('customCategoryId');
                if (customInput) {
                    customInput.style.display = 'block';
                    customInput.value = currentProduct.categoryId;
                }
            }
        }
    } else {
        autoDetectCategory(cleanTitle);
    }

    calculatePricing();
}

document.addEventListener('DOMContentLoaded', async () => {
    // 0. Pre-load previously extracted product if available
    try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            const stored = await chrome.storage.local.get('lastScrapedProduct');
            if (stored && stored.lastScrapedProduct) {
                renderProductDataInPopup(stored.lastScrapedProduct);
            }
        }
    } catch (e) {
        console.warn("Storage pre-load error:", e);
    }

    // 1. Inspect current tab
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs[0]) {
            activeTab = tabs[0];
            const url = activeTab.url || '';
            const platEl = document.getElementById('activePlatform');
            const idEl = document.getElementById('detectedId');

            if (url.includes('amazon.com') || url.includes('amzn.to')) {
                platEl.innerText = '🛒 Amazon detected';
                const asinMatch = url.match(/(?:dp|gp\/product|product)\/([A-Z0-9]{10})/i);
                if (asinMatch) idEl.innerText = `ASIN: ${asinMatch[1].toUpperCase()}`;
            } else if (url.includes('walmart.com')) {
                platEl.innerText = '🟦 Walmart detected';
                const wmtMatch = url.match(/\/ip\/(?:[^\/]+\/)?(\d+)/i) || url.match(/[?&]id=(\d+)/i);
                if (wmtMatch) idEl.innerText = `Item: ${wmtMatch[1]}`;
            } else if (url.includes('homedepot.com')) {
                platEl.innerText = '🟧 Home Depot detected';
                const hdMatch = url.match(/\/p\/(?:[^\/]+\/)?(\d+)/i) || url.match(/[?&]id=(\d+)/i);
                if (hdMatch) idEl.innerText = `Item: ${hdMatch[1]}`;
            } else if (url.includes('temu.com')) {
                platEl.innerText = '🛍️ Temu detected';
                const goodsMatch = url.match(/-g-(\d+)\.html/);
                if (goodsMatch) idEl.innerText = `Goods: ${goodsMatch[1]}`;
            } else if (url.includes('aliexpress.com') || url.includes('aliexpress.us')) {
                platEl.innerText = '🔴 AliExpress detected';
                const aliMatch = url.match(/item\/(\d+)\.html/i) || url.match(/[?&]itemId=(\d+)/i) || url.match(/\/(\d{10,})\.html/i);
                if (aliMatch) idEl.innerText = `Item: ${aliMatch[1]}`;
            } else if (url.includes('dhgate.com')) {
                platEl.innerText = '🏮 DHgate detected';
                const dhMatch = url.match(/product\/[^\/]+\/(\d+)\.html/i) || url.match(/\/(\d{8,})\.html/i) || url.match(/[?&]itemcode=(\d+)/i);
                if (dhMatch) idEl.innerText = `Code: ${dhMatch[1]}`;
            } else if (url.includes('cjdropshipping.com')) {
                platEl.innerText = '📦 CJ Dropshipping detected';
                const cjMatch = url.match(/[?&]pid=([a-zA-Z0-9-]+)/i) || url.match(/product-detail\/([a-zA-Z0-9-]+)/i);
                if (cjMatch) idEl.innerText = `PID: ${cjMatch[1]}`;
            } else {
                platEl.innerText = '🌐 Open Amazon, Walmart, Home Depot, Temu, AliExpress, DHgate, or CJ';
                idEl.innerText = '';
            }
        }
    } catch (e) {
        console.error("Tab query error:", e);
    }

    // 2. Extract Button
    document.getElementById('extractBtn').addEventListener('click', async () => {
        const btn = document.getElementById('extractBtn');
        btn.innerText = '⏳ Extracting Product...';
        btn.disabled = true;

        try {
            if (!activeTab || !activeTab.id) {
                throw new Error("No active browser tab found.");
            }

            const url = activeTab.url || '';
            let extractorFunc = null;

            if (url.includes('temu.com')) {
                extractorFunc = extractTemuProduct;
            } else if (url.includes('aliexpress.com') || url.includes('aliexpress.us')) {
                extractorFunc = extractAliExpressProduct;
            } else if (url.includes('walmart.com')) {
                extractorFunc = extractWalmartProduct;
            } else if (url.includes('homedepot.com')) {
                extractorFunc = extractHomeDepotProduct;
            } else if (url.includes('dhgate.com')) {
                extractorFunc = extractDHgateProduct;
            } else if (url.includes('cjdropshipping.com')) {
                extractorFunc = extractCJDropshippingProduct;
            } else {
                extractorFunc = extractAmazonProduct; // default Amazon
            }

            const results = await chrome.scripting.executeScript({
                target: { tabId: activeTab.id },
                function: extractorFunc
            });

            if (!results || !results[0] || !results[0].result) {
                throw new Error("Could not extract product data. Make sure you are on a product page.");
            }

            const extracted = results[0].result;
            renderProductDataInPopup(extracted);
            
            // Persist locally in chrome.storage.local
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                await chrome.storage.local.set({ lastScrapedProduct: currentProduct });
            }

            // Sync to local server so http://localhost:3000/editor has the fresh extracted item immediately
            try {
                fetch('http://localhost:3000/api/save-product', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(currentProduct)
                }).catch(() => {});
            } catch (e) {}

            showStatus("✅ Extracted & auto-cleaned for eBay!", "success");

        } catch (err) {
            console.error("Extraction error:", err);
            showStatus(err.message, "error");
        } finally {
            btn.innerText = '⚡ Extract Product Data';
            btn.disabled = false;
        }
    });

    // 3. UI Inputs & Dynamic Recalculation
    const sourcePriceInput = document.getElementById('sourcePriceInput');
    if (sourcePriceInput) {
        sourcePriceInput.addEventListener('input', () => {
            if (!currentProduct) return;
            const newCost = parseFloat(sourcePriceInput.value) || 0;
            currentProduct.price = newCost;
            
            // Reset custom listing price so calculatePricing auto-fills with margin
            const listingPriceInput = document.getElementById('listingPrice');
            if (listingPriceInput && document.activeElement !== listingPriceInput) {
                listingPriceInput.value = '';
            }
            
            calculatePricing();
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ lastScrapedProduct: currentProduct }).catch(() => {});
            }
        });
    }

    const titleInput = document.getElementById('listingTitle');
    if (titleInput) titleInput.addEventListener('input', updateCharCounter);

    const marginSelect = document.getElementById('marginPercent');
    if (marginSelect) marginSelect.addEventListener('change', calculatePricing);

    const priceInput = document.getElementById('listingPrice');
    if (priceInput) priceInput.addEventListener('input', calculatePricing);

    const catSelect = document.getElementById('listingCategory');
    const customCatInput = document.getElementById('customCategoryId');
    if (catSelect) {
        catSelect.addEventListener('change', () => {
            if (catSelect.value === 'custom') {
                customCatInput.style.display = 'block';
            } else {
                customCatInput.style.display = 'none';
            }
        });
    }

    // Helper to get active category ID
    function getSelectedCategoryId() {
        if (catSelect.value === 'custom') {
            return customCatInput.value.trim() || '67779';
        }
        return catSelect.value;
    }

    // 4. Open Full-Screen Reseller Studio
    document.getElementById('openStudioBtn').addEventListener('click', async () => {
        if (!currentProduct) {
            showStatus("Please extract a product first.", "error");
            return;
        }

        const titleVal = document.getElementById('listingTitle').value.trim();
        const priceVal = document.getElementById('listingPrice').value.trim();
        const categoryId = getSelectedCategoryId();

        const payload = {
            ...currentProduct,
            title: titleVal,
            price: priceVal,
            sellingPrice: priceVal,
            costPrice: currentProduct.price || currentProduct.costPrice || '0.00',
            categoryId: categoryId,
            sourcePlatform: currentProduct.source || 'Scraped Import',
            sellingPlatform: 'eBay'
        };

        // 1. Persist in chrome.storage.local
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            await chrome.storage.local.set({ lastScrapedProduct: payload });
        }

        // 2. Persist in local inventory database
        let savedId = payload.id || payload.sourceId;
        try {
            const res = await fetch('http://localhost:3000/api/inventory/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                const data = await res.json();
                if (data.item && data.item.id) savedId = data.item.id;
            }
        } catch (e) {
            console.warn("Could not sync to local server on studio open:", e);
        }

        // 3. Open studio
        if (typeof chrome !== 'undefined' && chrome.tabs) {
            const targetUrl = savedId ? `http://localhost:3000/editor?id=${encodeURIComponent(savedId)}` : 'editor.html';
            chrome.tabs.create({ url: targetUrl });
        } else {
            const targetUrl = savedId ? `/editor?id=${encodeURIComponent(savedId)}` : '/editor';
            window.open(targetUrl, '_blank');
        }
    });

    // 5. Download CSV Action
    document.getElementById('downloadCsvBtn').addEventListener('click', () => {
        if (!currentProduct) {
            showStatus("Please extract a product first.", "error");
            return;
        }

        const titleVal = document.getElementById('listingTitle').value.trim();
        const priceVal = document.getElementById('listingPrice').value.trim();
        const categoryId = getSelectedCategoryId();

        const exportItem = {
            ...currentProduct,
            title: titleVal,
            price: priceVal,
            categoryId: categoryId
        };

        try {
            const csvString = generateEbayCsvString(exportItem);
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `ebay-seller-hub-${exportItem.sourceId || Date.now()}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);

            showStatus("📥 CSV downloaded! Upload in Seller Hub Reports.", "success");
        } catch (err) {
            showStatus("CSV generation error: " + err.message, "error");
        }
    });

    // 5. 1-Click Auto-Upload Action
    document.getElementById('autoUploadBtn').addEventListener('click', async () => {
        if (!currentProduct) {
            showStatus("Please extract a product first.", "error");
            return;
        }

        const titleVal = document.getElementById('listingTitle').value.trim();
        const priceVal = document.getElementById('listingPrice').value.trim();
        const categoryId = getSelectedCategoryId();

        const exportItem = {
            ...currentProduct,
            title: titleVal,
            price: priceVal,
            categoryId: categoryId
        };

        try {
            const csvString = generateEbayCsvString(exportItem);
            const filename = `ebay-seller-hub-${exportItem.sourceId || Date.now()}.csv`;

            // Save payload to chrome.storage.local for content script pickup
            await chrome.storage.local.set({
                zonbayPendingUpload: csvString,
                zonbayPendingFilename: filename
            });

            showStatus("🚀 Opening eBay Seller Hub Reports uploader...", "info");

            // Open or switch to eBay Seller Hub Reports Uploads
            await chrome.tabs.create({ url: 'https://www.ebay.com/sh/reports/uploads' });
        } catch (err) {
            showStatus("Auto-upload error: " + err.message, "error");
        }
    });

    // 6. Save directly to Inventory Base
    document.getElementById('syncLocalBtn').addEventListener('click', async () => {
        if (!currentProduct) {
            showStatus("Please extract a product first.", "error");
            return;
        }

        const titleVal = document.getElementById('listingTitle').value.trim();
        const priceVal = document.getElementById('listingPrice').value.trim();
        const categoryId = getSelectedCategoryId();

        const payload = {
            ...currentProduct,
            title: titleVal,
            price: priceVal,
            categoryId: categoryId,
            sourcePlatform: currentProduct.source || 'Scraped Import',
            sellingPlatform: 'eBay'
        };

        try {
            const res = await fetch('http://localhost:3000/api/inventory/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            showStatus(data.message || "Saved to Inventory Base & approved!", "success");
        } catch (e) {
            showStatus("Local server offline. Run 'node server.js' to use database.", "info");
        }
    });

    // 7. Open Inventory Base Dashboard
    document.getElementById('openBaseBtn').addEventListener('click', () => {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
            chrome.tabs.create({ url: 'http://localhost:3000/' });
        } else {
            window.open('http://localhost:3000/', '_blank');
        }
    });

    // 8. Sync Live eBay Store Inventory
    document.getElementById('syncEbayStoreBtn').addEventListener('click', async () => {
        if (!activeTab || !activeTab.url) {
            showStatus("Checking active tab...", "info");
            return;
        }

        if (activeTab.url.includes('ebay.com')) {
            showStatus("🔄 Requesting active listings sync on eBay tab...", "info");
            try {
                const res = await chrome.tabs.sendMessage(activeTab.id, { action: 'SYNC_EBAY_ACTIVE' });
                showStatus("✅ Synced active eBay listings to Base!", "success");
            } catch (err) {
                // Navigate to active listings
                chrome.tabs.create({ url: 'https://www.ebay.com/sh/lst/active' });
            }
        } else {
            showStatus("🚀 Opening eBay Seller Hub Active Listings...", "info");
            chrome.tabs.create({ url: 'https://www.ebay.com/sh/lst/active' });
        }
    });
});
