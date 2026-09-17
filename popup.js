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

document.addEventListener('DOMContentLoaded', async () => {
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
            } else if (url.includes('temu.com')) {
                platEl.innerText = '🛍️ Temu detected';
                const goodsMatch = url.match(/-g-(\d+)\.html/);
                if (goodsMatch) idEl.innerText = `Goods: ${goodsMatch[1]}`;
            } else {
                platEl.innerText = '🌐 Open Amazon or Temu product';
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

            currentProduct = results[0].result;
            
            // Persist locally in chrome.storage.local
            await chrome.storage.local.set({ lastScrapedProduct: currentProduct });

            // Render Preview
            const preview = document.getElementById('productPreview');
            preview.style.display = 'block';

            const previewImg = document.getElementById('previewImg');
            if (previewImg) previewImg.src = currentProduct.mainImgUrl || (currentProduct.alternateImages && currentProduct.alternateImages[0]) || '';

            const previewBrand = document.getElementById('previewBrand');
            if (previewBrand) previewBrand.innerText = currentProduct.brand || 'UNBRANDED';

            const countEl = document.getElementById('previewImgCount');
            const totalImgs = (currentProduct.alternateImages || []).length;
            if (countEl) countEl.innerText = `🖼️ ${totalImgs} High-Res Photos`;

            const sourcePrice = document.getElementById('sourcePriceDisplay');
            if (sourcePrice) sourcePrice.innerText = `$${currentProduct.price || '0.00'}`;

            const titleInput = document.getElementById('listingTitle');
            const cleanTitle = (currentProduct.title || '').replace(/\s+/g, ' ').trim();
            if (titleInput) {
                titleInput.value = cleanTitle.substring(0, 80);
                updateCharCounter();
            }

            autoDetectCategory(cleanTitle);
            calculatePricing();
            showStatus("✅ Extracted successfully!", "success");

        } catch (err) {
            console.error("Extraction error:", err);
            showStatus(err.message, "error");
        } finally {
            btn.innerText = '⚡ Extract Product Data';
            btn.disabled = false;
        }
    });

    // 3. UI Inputs & Dynamic Recalculation
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

    // 4. Download CSV Action
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

    // 6. Sync to Local Server (optional companion mode)
    document.getElementById('syncLocalBtn').addEventListener('click', async () => {
        if (!currentProduct) {
            showStatus("Please extract a product first.", "error");
            return;
        }

        const titleVal = document.getElementById('listingTitle').value.trim();
        const priceVal = document.getElementById('listingPrice').value.trim();

        const payload = {
            ...currentProduct,
            title: titleVal,
            price: priceVal
        };

        try {
            const res = await fetch('http://localhost:3000/api/save-product', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            showStatus(data.message || "Synced to local server!", "success");
        } catch (e) {
            showStatus("Local server offline. Run 'node server.js' to use dashboard.", "info");
        }
    });
});
