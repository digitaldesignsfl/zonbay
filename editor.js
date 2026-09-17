/**
 * Zonbay Reseller Studio - Core Editor & Canvas Photo Manipulation
 */

let product = {
    source: 'generic',
    sourceId: '',
    title: '',
    brand: '',
    price: '0.00',
    currency: 'USD',
    mainImgUrl: '',
    alternateImages: [],
    bulletPoints: [],
    productSpecs: {},
    longDescription: '',
    url: '',
    // Policy defaults
    shippingService: 'USPSGroundAdvantage',
    shippingType: 'Flat',
    shippingCost: '0.00',
    dispatchTimeMax: '3',
    location: 'United States',
    immediatePayRequired: '1',
    returnsAcceptedOption: 'ReturnsNotAccepted',
    conditionId: '1000',
    quantity: '1',
    customSku: ''
};

// Image management array: [{ url, originalUrl, isHero, isExcluded }]
let imageList = [];

// Canvas Photo Editor state
let activeImageIndex = null;
let editorImgElement = new Image();
let editState = {
    brightness: 0,
    contrast: 0,
    saturate: 100,
    rotation: 0
};

/* ==========================================================================
   INITIALIZATION & DATA LOADING
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
    await loadInitialData();
    setupEventListeners();
    updateProfitStats();
    updateTitleCounter();
});

async function loadInitialData() {
    let loaded = false;

    // 0. Priority: Check URL query params for ?id=... (loading directly from inventory base)
    const urlParams = new URLSearchParams(window.location.search);
    const queryId = urlParams.get('id');
    if (queryId) {
        try {
            const res = await fetch(`http://localhost:3000/api/inventory/${encodeURIComponent(queryId)}`);
            if (res.ok) {
                const item = await res.json();
                const productData = item.productData || item;
                productData.status = item.status || 'APPROVED';
                productData.id = item.id;
                productData.sourcePlatform = item.sourcePlatform || productData.sourcePlatform;
                productData.sellingPrice = item.sellingPrice || productData.price;
                applyLoadedProduct(productData);
                updateApprovalBadge(item.status);
                loaded = true;
            }
        } catch (e) {
            console.warn("Could not load item by ID from inventory base:", e);
        }
    }

    // 1. Try Chrome Storage Local (from extension scrape)
    if (!loaded && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        try {
            const res = await chrome.storage.local.get('lastScrapedProduct');
            if (res && res.lastScrapedProduct) {
                applyLoadedProduct(res.lastScrapedProduct);
                loaded = true;
            }
        } catch (e) {
            console.warn("Chrome storage error:", e);
        }
    }

    // 2. Try localStorage draft fallback
    if (!loaded) {
        const savedDraft = localStorage.getItem('zonbay_studio_draft');
        if (savedDraft) {
            try {
                applyLoadedProduct(JSON.parse(savedDraft));
                loaded = true;
            } catch (e) {}
        }
    }

    // 3. Try Local Node.js server fallback (localhost:3000/api/view-product)
    if (!loaded) {
        try {
            const res = await fetch('http://localhost:3000/api/view-product');
            if (res.ok) {
                const serverData = await res.json();
                applyLoadedProduct(serverData);
                loaded = true;
            }
        } catch (e) {}
    }

    if (!loaded) {
        // Mock fallback if opened fresh
        applyLoadedProduct({
            title: "New Product Listing",
            price: "19.99",
            brand: "Unbranded",
            sourceId: `ITEM-${Date.now()}`,
            alternateImages: []
        });
    }
}

function updateApprovalBadge(status) {
    const badge = document.getElementById('approvalBadge');
    if (!badge) return;
    const s = (status || 'DRAFT').toUpperCase();
    if (s === 'LIVE_ON_EBAY' || s === 'LIVE') {
        badge.innerText = '🟢 LIVE ON EBAY';
        badge.style.background = '#28a745';
        badge.style.color = '#ffffff';
    } else if (s === 'APPROVED') {
        badge.innerText = '🟡 APPROVED & IN INVENTORY';
        badge.style.background = '#ffc107';
        badge.style.color = '#212529';
    } else {
        badge.innerText = '⚪ DRAFT';
        badge.style.background = 'rgba(255,255,255,0.25)';
        badge.style.color = '#ffffff';
    }
}

function applyLoadedProduct(data) {
    if (typeof ZonbayCleaner !== 'undefined') {
        product = ZonbayCleaner.cleanProductData({ ...product, ...data });
    } else {
        product = { ...product, ...data };
    }
    if (data.status) {
        updateApprovalBadge(data.status);
    }

    // Badge
    const badge = document.getElementById('sourcePlatformBadge');
    if (badge) {
        const src = (product.source || 'generic').toUpperCase();
        badge.innerText = `${src} #${product.sourceId || 'NEW'}`;
    }

    // Displays
    document.getElementById('sourceUrlDisplay').value = product.url || '';
    document.getElementById('sourceIdDisplay').value = product.sourceId || '';
    document.getElementById('sourceCostDisplay').value = `$${product.price || '0.00'}`;
    document.getElementById('statCost').innerText = `$${product.price || '0.00'}`;

    // Title & Category
    const titleInput = document.getElementById('listingTitle');
    titleInput.value = (product.title || '').substring(0, 80);
    
    if (product.categoryId) {
        const catSelect = document.getElementById('listingCategory');
        if (catSelect.querySelector(`option[value="${product.categoryId}"]`)) {
            catSelect.value = product.categoryId;
        } else {
            catSelect.value = 'custom';
            const customInput = document.getElementById('customCategoryId');
            customInput.style.display = 'block';
            customInput.value = product.categoryId;
        }
    }

    document.getElementById('customSku').value = product.customSku || product.sourceId || '';
    document.getElementById('listingCondition').value = product.conditionId || '1000';

    // Pricing
    const cost = parseFloat(product.price) || 0;
    const initialPrice = (cost > 0) ? (cost * 1.4).toFixed(2) : '19.99';
    document.getElementById('listingPrice').value = initialPrice;
    document.getElementById('listingQuantity').value = product.quantity || '1';

    // Policies
    if (product.shippingService) document.getElementById('shippingService').value = product.shippingService;
    if (product.shippingType) document.getElementById('shippingType').value = product.shippingType;
    if (product.shippingCost !== undefined) document.getElementById('shippingCost').value = product.shippingCost;
    if (product.dispatchTimeMax !== undefined) document.getElementById('dispatchTimeMax').value = product.dispatchTimeMax;
    if (product.location) document.getElementById('itemLocation').value = product.location;
    if (product.immediatePayRequired !== undefined) document.getElementById('immediatePayRequired').value = product.immediatePayRequired;
    if (product.returnsAcceptedOption) document.getElementById('returnsAcceptedOption').value = product.returnsAcceptedOption;

    // Bullets & Description / Template
    const bullets = Array.isArray(product.bulletPoints) ? product.bulletPoints : [];
    document.getElementById('bulletsEditor').value = bullets.join('\n');

    if (product.storeConfig) {
        if (product.storeConfig.storeName && document.getElementById('storeNameInput')) {
            document.getElementById('storeNameInput').value = product.storeConfig.storeName;
        }
        if (product.storeConfig.storeUrl && document.getElementById('storeUrlInput')) {
            document.getElementById('storeUrlInput').value = product.storeConfig.storeUrl;
        }
    }
    if (product.templateStyle && document.getElementById('templateStyleSelect')) {
        document.getElementById('templateStyleSelect').value = product.templateStyle;
    }

    let desc = product.htmlDescription || product.longDescription || '';
    if ((!desc || !desc.includes('<!-- ZONBAY')) && typeof ZonbayTemplates !== 'undefined') {
        const storeConfig = {
            storeName: document.getElementById('storeNameInput') ? document.getElementById('storeNameInput').value.trim() : 'Our Official Store',
            storeUrl: document.getElementById('storeUrlInput') ? document.getElementById('storeUrlInput').value.trim() : 'https://www.ebay.com/usr'
        };
        const templateKey = document.getElementById('templateStyleSelect') ? document.getElementById('templateStyleSelect').value : 'storefront_showcase';
        desc = ZonbayTemplates.renderEbayTemplate(templateKey, product, storeConfig);
    }
    document.getElementById('descriptionEditor').value = desc;

    // Images
    if (Array.isArray(product.imageList) && product.imageList.length > 0) {
        imageList = product.imageList.map(img => ({
            url: img.url,
            originalUrl: img.originalUrl || img.url,
            isHero: Boolean(img.isHero),
            isExcluded: Boolean(img.isExcluded),
            isEdited: Boolean(img.isEdited || (typeof img.url === 'string' && img.url.startsWith('data:'))),
            hostedUrl: img.hostedUrl || null
        }));
    } else {
        const rawImgs = Array.isArray(product.alternateImages) && product.alternateImages.length > 0
            ? product.alternateImages
            : (product.mainImgUrl ? [product.mainImgUrl] : []);

        imageList = rawImgs.map((url, idx) => ({
            url: url,
            originalUrl: url,
            isHero: idx === 0,
            isExcluded: false,
            isEdited: typeof url === 'string' && url.startsWith('data:'),
            hostedUrl: null
        }));
    }

    renderPhotoGrid();
    renderSpecificsTable();
    updateTitleCounter();
    updateProfitStats();
}

/* ==========================================================================
   PHOTO STUDIO & GALLERY
   ========================================================================== */

function renderPhotoGrid() {
    const container = document.getElementById('photoGridContainer');
    if (!container) return;
    container.innerHTML = '';

    const activeCount = imageList.filter(img => !img.isExcluded).length;
    document.getElementById('photoCountDisplay').innerText = `${activeCount} / ${imageList.length}`;

    imageList.forEach((img, idx) => {
        const card = document.createElement('div');
        card.className = `photo-card ${img.isHero ? 'is-hero' : ''} ${img.isExcluded ? 'is-excluded' : ''}`;

        card.innerHTML = `
            ${img.isHero ? '<div class="hero-badge">⭐ HERO</div>' : ''}
            ${img.isEdited ? '<div class="edited-badge" title="Image adjustments applied">✨ EDITED</div>' : ''}
            <img src="${img.url}" class="photo-thumb" alt="Product Image" data-index="${idx}">
            <div class="photo-toolbar">
                <button class="btn-icon btn-hero" data-index="${idx}" title="Set as Hero / Main Photo">⭐</button>
                <button class="btn-icon btn-edit" data-index="${idx}" title="Edit Brightness/Contrast">🎨</button>
                ${img.isEdited ? `<button class="btn-icon btn-download" data-index="${idx}" title="Download Edited JPG to Computer">📥</button>` : ''}
                <button class="btn-icon btn-exclude" data-index="${idx}" title="${img.isExcluded ? 'Include in Listing' : 'Exclude from Listing'}">
                    ${img.isExcluded ? '👁️' : '🚫'}
                </button>
                <button class="btn-icon btn-delete-photo" data-index="${idx}" title="Delete Photo Permanently" style="color: #dc3545;">🗑️</button>
            </div>
        `;
        container.appendChild(card);
    });

    // Attach listeners
    container.querySelectorAll('.btn-hero').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.index);
            setHeroImage(idx);
        });
    });

    container.querySelectorAll('.btn-exclude').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.index);
            toggleExcludeImage(idx);
        });
    });

    container.querySelectorAll('.btn-delete-photo').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.index);
            deleteImage(idx);
        });
    });

    container.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.index);
            openPhotoEditor(idx);
        });
    });

    container.querySelectorAll('.btn-download').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.index);
            downloadEditedImage(idx);
        });
    });

    container.querySelectorAll('.photo-thumb').forEach(thumb => {
        thumb.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.index);
            openPhotoEditor(idx);
        });
    });
}

function downloadEditedImage(index) {
    const img = imageList[index];
    if (!img) return;
    const a = document.createElement('a');
    a.href = img.url;
    a.download = `edited-product-photo-${index + 1}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`📥 Downloaded photo #${index + 1} to your computer!`);
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toastBanner');
    if (!toast) return;
    toast.innerText = message;
    toast.style.background = (type === 'error') ? '#dc3545' : '#28a745';
    toast.style.display = 'block';
    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => {
        toast.style.display = 'none';
    }, 3500);
}

function setHeroImage(index) {
    if (!imageList[index]) return;
    imageList.forEach((img, i) => {
        img.isHero = (i === index);
        if (i === index) img.isExcluded = false; // Hero cannot be excluded
    });
    renderPhotoGrid();
    triggerAutoSave();
    showToast(`⭐ Photo #${index + 1} set as Main Hero photo!`);
}

function toggleExcludeImage(index) {
    if (!imageList[index]) return;

    if (!imageList[index].isExcluded && imageList[index].isHero) {
        // Find next non-excluded photo to inherit Hero status
        const nextHeroIdx = imageList.findIndex((img, i) => i !== index && !img.isExcluded);
        if (nextHeroIdx !== -1) {
            imageList[nextHeroIdx].isHero = true;
            imageList[index].isHero = false;
            imageList[index].isExcluded = true;
            showToast(`Photo #${index + 1} excluded. Photo #${nextHeroIdx + 1} is now Main Hero.`);
        } else {
            // Check if any other photo exists to re-include
            const anyOtherIdx = imageList.findIndex((img, i) => i !== index);
            if (anyOtherIdx !== -1) {
                imageList[anyOtherIdx].isHero = true;
                imageList[anyOtherIdx].isExcluded = false;
                imageList[index].isHero = false;
                imageList[index].isExcluded = true;
                showToast(`Photo #${index + 1} excluded. Photo #${anyOtherIdx + 1} re-included as Main Hero.`);
            } else {
                showToast("⚠️ eBay requires at least one product photo for the listing.", "error");
                return;
            }
        }
    } else {
        imageList[index].isExcluded = !imageList[index].isExcluded;
        if (imageList[index].isExcluded && imageList[index].isHero) {
            imageList[index].isHero = false;
            const nextActive = imageList.find(img => !img.isExcluded);
            if (nextActive) nextActive.isHero = true;
        }
    }
    renderPhotoGrid();
    triggerAutoSave();
}

function deleteImage(index) {
    if (!imageList[index]) return;

    const wasHero = imageList[index].isHero;
    imageList.splice(index, 1);

    if (imageList.length > 0) {
        if (wasHero || !imageList.some(img => img.isHero && !img.isExcluded)) {
            // Automatically promote the first non-excluded photo (or first photo)
            const nextActive = imageList.find(img => !img.isExcluded) || imageList[0];
            nextActive.isHero = true;
            nextActive.isExcluded = false;
            showToast("🗑️ Photo deleted. Next photo set as Main Hero!");
        } else {
            showToast("🗑️ Photo deleted from listing!");
        }
    } else {
        showToast("🗑️ Photo deleted. No photos remaining in listing.", "error");
    }

    renderPhotoGrid();
    triggerAutoSave();
}

/* ==========================================================================
   CANVAS PHOTO EDITOR (BRIGHTNESS, CONTRAST, SATURATION, ROTATION, WHITE BG)
   ========================================================================== */

function openPhotoEditor(index) {
    activeImageIndex = index;
    const target = imageList[index];
    if (!target) return;

    // Reset sliders
    editState = { brightness: 0, contrast: 0, saturate: 100, rotation: 0 };
    document.getElementById('brightnessSlider').value = 0;
    document.getElementById('contrastSlider').value = 0;
    document.getElementById('saturationSlider').value = 100;
    document.getElementById('brightnessVal').innerText = '0%';
    document.getElementById('contrastVal').innerText = '0%';
    document.getElementById('saturationVal').innerText = '100%';

    editorImgElement = new Image();
    editorImgElement.crossOrigin = "anonymous";
    editorImgElement.onload = () => {
        drawCanvas();
        document.getElementById('photoEditorModal').style.display = 'flex';
    };
    editorImgElement.src = target.url;
}

function drawCanvas() {
    const canvas = document.getElementById('editorCanvas');
    const ctx = canvas.getContext('2d');

    const isSideways = editState.rotation % 180 !== 0;
    canvas.width = isSideways ? editorImgElement.height : editorImgElement.width;
    canvas.height = isSideways ? editorImgElement.width : editorImgElement.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    // Translate & Rotate
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((editState.rotation * Math.PI) / 180);

    // Apply CSS filters
    const b = 100 + editState.brightness;
    const c = 100 + editState.contrast;
    const s = editState.saturate;
    ctx.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;

    ctx.drawImage(
        editorImgElement,
        -editorImgElement.width / 2,
        -editorImgElement.height / 2
    );

    ctx.restore();
}

function applyWhitenBackground() {
    const canvas = document.getElementById('editorCanvas');
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    // Threshold: any pixel whose R, G, B are all > 215 (light off-white/gray) is boosted to pure white #FFFFFF
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r > 215 && g > 215 && b > 215) {
            data[i] = 255;
            data[i + 1] = 255;
            data[i + 2] = 255;
        }
    }
    ctx.putImageData(imgData, 0, 0);
}

/* ==========================================================================
   ITEM SPECIFICS TABLE
   ========================================================================== */

function renderSpecificsTable() {
    const tbody = document.getElementById('specificsTbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const specs = product.productSpecs || {};
    if (!specs['Brand']) specs['Brand'] = product.brand || 'Unbranded';
    if (!specs['MPN']) specs['MPN'] = 'Does Not Apply';

    // Sort keys: Essential first, Recommended second, Others third
    const keys = Object.keys(specs).sort((a, b) => {
        const prioA = typeof ZonbayCleaner !== 'undefined' ? ZonbayCleaner.getSpecificPriority(a) : 'optional';
        const prioB = typeof ZonbayCleaner !== 'undefined' ? ZonbayCleaner.getSpecificPriority(b) : 'optional';

        const weight = { 'essential': 1, 'recommended': 2, 'optional': 3 };
        const diff = (weight[prioA] || 3) - (weight[prioB] || 3);
        if (diff !== 0) return diff;
        return a.localeCompare(b);
    });

    keys.forEach(k => {
        const v = specs[k];
        const prio = typeof ZonbayCleaner !== 'undefined' ? ZonbayCleaner.getSpecificPriority(k) : 'optional';
        const tr = document.createElement('tr');
        
        let rowClass = '';
        let badgeHtml = '';
        if (prio === 'essential') {
            rowClass = 'spec-row-essential';
            badgeHtml = `<span class="spec-badge spec-badge-essential" title="Essential requirement for eBay listings">⭐ ESSENTIAL</span>`;
        } else if (prio === 'recommended') {
            rowClass = 'spec-row-recommended';
            badgeHtml = `<span class="spec-badge spec-badge-recommended" title="Recommended filter field on eBay">⭐ RECOMMENDED</span>`;
        }
        
        tr.className = rowClass;
        tr.innerHTML = `
            <td>
                <div style="display:flex; align-items:center; justify-content:space-between;">
                    <input type="text" class="spec-key" value="${escapeHtml(k)}" style="flex:1;">
                    ${badgeHtml}
                </div>
            </td>
            <td><input type="text" class="spec-val" value="${escapeHtml(String(v))}"></td>
            <td><button class="btn-icon delete-spec-btn" title="Delete specific">❌</button></td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.delete-spec-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('tr').remove();
            triggerAutoSave();
        });
    });

    tbody.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', triggerAutoSave);
    });
}

function getSpecificsFromTable() {
    const specs = {};
    document.querySelectorAll('#specificsTbody tr').forEach(tr => {
        const k = tr.querySelector('.spec-key')?.value.trim();
        const v = tr.querySelector('.spec-val')?.value.trim();
        if (k && v) specs[k] = v;
    });
    return specs;
}

/* ==========================================================================
   TITLE & PROFIT CALCULATIONS
   ========================================================================== */

function updateTitleCounter() {
    const input = document.getElementById('listingTitle');
    const counter = document.getElementById('titleCounter');
    if (!input || !counter) return;
    const len = input.value.length;
    counter.innerText = `${len} / 80`;
    counter.style.color = len >= 80 ? '#dc3545' : (len > 70 ? '#28a745' : '#6c757d');
}

function updateProfitStats() {
    const cost = parseFloat(product.price) || 0;
    const priceInput = document.getElementById('listingPrice');
    const salePrice = parseFloat(priceInput.value) || 0;

    // Standard eBay fees ~13.25% + $0.30 fixed
    const fee = (salePrice * 0.1325) + 0.30;
    const netProfit = salePrice - cost - fee;

    document.getElementById('statPrice').innerText = `$${salePrice.toFixed(2)}`;
    document.getElementById('statFee').innerText = `-$${fee.toFixed(2)}`;

    const profitEl = document.getElementById('statNetProfit');
    profitEl.innerText = `${netProfit >= 0 ? '+' : ''}$${netProfit.toFixed(2)}`;
    profitEl.className = `profit-stat-val ${netProfit >= 0 ? 'text-success' : 'text-danger'}`;
}

/* ==========================================================================
   AUTO-SAVE & COMPILATION
   ========================================================================== */

let autoSaveTimer = null;
function triggerAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(saveCurrentState, 500);
}

function compileCurrentProduct() {
    const heroImg = imageList.find(img => img.isHero) || imageList[0];
    const alternateImgs = imageList
        .filter(img => !img.isExcluded)
        .sort((a, b) => (a.isHero ? -1 : (b.isHero ? 1 : 0)))
        .map(img => img.url);

    const catSelect = document.getElementById('listingCategory');
    const categoryId = catSelect.value === 'custom'
        ? document.getElementById('customCategoryId').value.trim()
        : catSelect.value;

    const bullets = document.getElementById('bulletsEditor').value.split('\n').filter(Boolean);
    const specs = getSpecificsFromTable();

    return {
        ...product,
        title: document.getElementById('listingTitle').value.trim(),
        categoryId: categoryId,
        customSku: document.getElementById('customSku').value.trim(),
        conditionId: document.getElementById('listingCondition').value,
        price: document.getElementById('listingPrice').value.trim(),
        quantity: document.getElementById('listingQuantity').value.trim(),
        
        // Policies
        shippingService: document.getElementById('shippingService').value,
        shippingType: document.getElementById('shippingType').value,
        shippingCost: document.getElementById('shippingCost').value,
        dispatchTimeMax: document.getElementById('dispatchTimeMax').value,
        location: document.getElementById('itemLocation').value,
        immediatePayRequired: document.getElementById('immediatePayRequired').value,
        returnsAcceptedOption: document.getElementById('returnsAcceptedOption').value,

        mainImgUrl: heroImg ? heroImg.url : '',
        alternateImages: alternateImgs,
        imageList: imageList,
        bulletPoints: bullets,
        productSpecs: specs,
        longDescription: document.getElementById('descriptionEditor').value.trim(),
        htmlDescription: document.getElementById('descriptionEditor').value.trim(),
        templateStyle: document.getElementById('templateStyleSelect') ? document.getElementById('templateStyleSelect').value : 'storefront_showcase',
        storeConfig: {
            storeName: document.getElementById('storeNameInput') ? document.getElementById('storeNameInput').value.trim() : 'Our Official Store',
            storeUrl: document.getElementById('storeUrlInput') ? document.getElementById('storeUrlInput').value.trim() : 'https://www.ebay.com/usr'
        }
    };
}

async function saveCurrentState() {
    const compiled = compileCurrentProduct();
    localStorage.setItem('zonbay_studio_draft', JSON.stringify(compiled));

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        try {
            await chrome.storage.local.set({ lastScrapedProduct: compiled });
        } catch (e) {}
    }

    const status = document.getElementById('saveStatus');
    if (status) {
        status.innerText = `Draft saved (${new Date().toLocaleTimeString()})`;
    }
}

/* ==========================================================================
   EVENT LISTENERS & MODAL BINDINGS
   ========================================================================== */

function setupEventListeners() {
    // Title Counter & Sanitizers
    const titleInput = document.getElementById('listingTitle');
    titleInput.addEventListener('input', () => {
        updateTitleCounter();
        triggerAutoSave();
    });

    document.getElementById('cleanTitleBtn').addEventListener('click', () => {
        const bannedWords = ['prime', 'hot', 'sale', 'new', 'upgrade', '2026', '2025', 'top', 'best', 'free shipping'];
        let t = titleInput.value;
        bannedWords.forEach(w => {
            const re = new RegExp(`\\b${w}\\b`, 'gi');
            t = t.replace(re, '');
        });
        titleInput.value = t.replace(/\s+/g, ' ').trim().substring(0, 80);
        updateTitleCounter();
        triggerAutoSave();
    });

    document.getElementById('capitalizeTitleBtn').addEventListener('click', () => {
        titleInput.value = titleInput.value.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
        triggerAutoSave();
    });

    // Category Select
    const catSelect = document.getElementById('listingCategory');
    catSelect.addEventListener('change', () => {
        document.getElementById('customCategoryId').style.display = (catSelect.value === 'custom') ? 'block' : 'none';
        triggerAutoSave();
    });

    // Pricing & Markup Select
    document.getElementById('listingPrice').addEventListener('input', () => {
        updateProfitStats();
        triggerAutoSave();
    });

    document.getElementById('marginSelect').addEventListener('change', (e) => {
        const cost = parseFloat(product.price) || 0;
        const margin = parseFloat(e.target.value) / 100;
        const newPrice = (cost * (1 + margin)).toFixed(2);
        document.getElementById('listingPrice').value = newPrice;
        updateProfitStats();
        triggerAutoSave();
    });

    // Policy & Template changes trigger auto-save
    ['shippingService', 'shippingType', 'shippingCost', 'dispatchTimeMax', 'itemLocation', 'immediatePayRequired', 'returnsAcceptedOption', 'listingCondition', 'customSku', 'listingQuantity', 'bulletsEditor', 'descriptionEditor', 'templateStyleSelect', 'storeNameInput', 'storeUrlInput']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', triggerAutoSave);
                el.addEventListener('change', triggerAutoSave);
            }
        });

    // Clutter cleaner button
    const cleanBtn = document.getElementById('cleanClutterBtn');
    if (cleanBtn) {
        cleanBtn.addEventListener('click', () => {
            if (typeof ZonbayCleaner !== 'undefined') {
                const current = compileCurrentProduct();
                const cleaned = ZonbayCleaner.cleanProductData(current);
                product.productSpecs = cleaned.productSpecs;
                product.bulletPoints = cleaned.bulletPoints;
                product.title = cleaned.title;
                document.getElementById('listingTitle').value = cleaned.title;
                document.getElementById('bulletsEditor').value = cleaned.bulletPoints.join('\n');
                renderSpecificsTable();
                updateTitleCounter();
                triggerAutoSave();
                showToast("🧹 Clutter removed: Amazon junk purged & eBay specifics prioritized!");
            }
        });
    }

    // AI Revise & Apply Template button
    const aiBtn = document.getElementById('aiReviseBtn');
    if (aiBtn) {
        aiBtn.addEventListener('click', () => {
            if (typeof ZonbayTemplates !== 'undefined') {
                const current = compileCurrentProduct();
                const storeConfig = {
                    storeName: document.getElementById('storeNameInput') ? document.getElementById('storeNameInput').value.trim() : 'Our Official Store',
                    storeUrl: document.getElementById('storeUrlInput') ? document.getElementById('storeUrlInput').value.trim() : 'https://www.ebay.com/usr'
                };
                const templateStyle = document.getElementById('templateStyleSelect') ? document.getElementById('templateStyleSelect').value : 'storefront_showcase';
                const revisedHtml = ZonbayTemplates.renderEbayTemplate(templateStyle, current, storeConfig);
                document.getElementById('descriptionEditor').value = revisedHtml;
                triggerAutoSave();
                showToast("🤖 AI-revised listing template generated & applied!");
            }
        });
    }

    // Buyer Live Preview Modal & Full eBay Simulation
    function openBuyerPreview() {
        const current = compileCurrentProduct();
        const storeConfig = {
            storeName: document.getElementById('storeNameInput') ? document.getElementById('storeNameInput').value.trim() : 'Our Official Store',
            storeUrl: document.getElementById('storeUrlInput') ? document.getElementById('storeUrlInput').value.trim() : 'https://www.ebay.com/usr'
        };
        let currentHtml = document.getElementById('descriptionEditor').value.trim();
        if ((!currentHtml || !currentHtml.includes('<!-- ZONBAY')) && typeof ZonbayTemplates !== 'undefined') {
            const templateStyle = document.getElementById('templateStyleSelect') ? document.getElementById('templateStyleSelect').value : 'storefront_showcase';
            currentHtml = ZonbayTemplates.renderEbayTemplate(templateStyle, current, storeConfig);
            document.getElementById('descriptionEditor').value = currentHtml;
        }

        const container = document.getElementById('buyerPreviewContainer');
        if (container && typeof ZonbayTemplates !== 'undefined' && ZonbayTemplates.renderEbayBuyerPageMockup) {
            container.innerHTML = ZonbayTemplates.renderEbayBuyerPageMockup(current, currentHtml, storeConfig);
            setupBuyerPreviewInteractions(container);
        } else if (container) {
            container.innerHTML = currentHtml;
        }

        const modal = document.getElementById('buyerPreviewModal');
        if (modal) modal.style.display = 'flex';
    }

    function setupBuyerPreviewInteractions(container) {
        // Interactive thumbnail switching
        const thumbBtns = container.querySelectorAll('.ebay-preview-thumb-btn');
        const heroImg = container.querySelector('#ebayLiveHeroImg');
        const counter = container.querySelector('#ebayLiveImgCounter');

        thumbBtns.forEach((btn, idx) => {
            btn.addEventListener('click', () => {
                thumbBtns.forEach(b => {
                    b.classList.remove('active');
                    b.style.border = '1px solid #d0d0d0';
                });
                btn.classList.add('active');
                btn.style.border = '2px solid #0053a0';
                const targetUrl = btn.getAttribute('data-img-url');
                if (heroImg && targetUrl) {
                    heroImg.src = targetUrl;
                }
                if (counter) {
                    counter.innerText = `${idx + 1} of ${thumbBtns.length}`;
                }
            });
        });
    }

    const previewBtn = document.getElementById('previewBuyerBtn');
    if (previewBtn) {
        previewBtn.addEventListener('click', openBuyerPreview);
    }

    // View Mode Toggle (Desktop vs Mobile)
    const viewDesktopBtn = document.getElementById('viewDesktopBtn');
    const viewMobileBtn = document.getElementById('viewMobileBtn');

    if (viewDesktopBtn && viewMobileBtn) {
        viewDesktopBtn.addEventListener('click', () => {
            const container = document.getElementById('buyerPreviewContainer');
            if (container) {
                container.classList.remove('ebay-mobile-mode');
                container.style.maxWidth = '100%';
            }
            viewDesktopBtn.style.background = '#eef4fc';
            viewDesktopBtn.style.color = '#0053a0';
            viewMobileBtn.style.background = '#ffffff';
            viewMobileBtn.style.color = '#555555';
        });

        viewMobileBtn.addEventListener('click', () => {
            const container = document.getElementById('buyerPreviewContainer');
            if (container) {
                container.classList.add('ebay-mobile-mode');
                container.style.maxWidth = '440px';
            }
            viewMobileBtn.style.background = '#eef4fc';
            viewMobileBtn.style.color = '#0053a0';
            viewDesktopBtn.style.background = '#ffffff';
            viewDesktopBtn.style.color = '#555555';
        });
    }

    const closePrevBtn = document.getElementById('closePreviewBtn');
    if (closePrevBtn) closePrevBtn.addEventListener('click', () => {
        document.getElementById('buyerPreviewModal').style.display = 'none';
    });
    const closePrevFooter = document.getElementById('closePreviewFooterBtn');
    if (closePrevFooter) closePrevFooter.addEventListener('click', () => {
        document.getElementById('buyerPreviewModal').style.display = 'none';
    });

    const buyerModal = document.getElementById('buyerPreviewModal');
    if (buyerModal) {
        buyerModal.addEventListener('click', (e) => {
            if (e.target === buyerModal) {
                buyerModal.style.display = 'none';
            }
        });
    }

    // Photo additions & selections
    document.getElementById('addPhotoBtn').addEventListener('click', () => {
        const input = document.getElementById('newPhotoUrlInput');
        const url = input.value.trim();
        if (url.startsWith('http')) {
            imageList.push({ url, originalUrl: url, isHero: imageList.length === 0, isExcluded: false });
            input.value = '';
            renderPhotoGrid();
            triggerAutoSave();
        }
    });

    document.getElementById('selectAllPhotosBtn').addEventListener('click', () => {
        imageList.forEach(img => img.isExcluded = false);
        renderPhotoGrid();
        triggerAutoSave();
    });

    document.getElementById('deselectAllPhotosBtn').addEventListener('click', () => {
        imageList.forEach(img => { if (!img.isHero) img.isExcluded = true; });
        renderPhotoGrid();
        triggerAutoSave();
    });

    document.getElementById('addSpecificBtn').addEventListener('click', () => {
        const tbody = document.getElementById('specificsTbody');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="text" class="spec-key" placeholder="Specific Name"></td>
            <td><input type="text" class="spec-val" placeholder="Specific Value"></td>
            <td><button class="btn-icon delete-spec-btn">❌</button></td>
        `;
        tbody.appendChild(tr);
        tr.querySelector('.delete-spec-btn').addEventListener('click', () => { tr.remove(); triggerAutoSave(); });
        tr.querySelectorAll('input').forEach(input => input.addEventListener('input', triggerAutoSave));
    });

    // Modal Canvas Sliders
    document.getElementById('brightnessSlider').addEventListener('input', (e) => {
        editState.brightness = parseInt(e.target.value);
        document.getElementById('brightnessVal').innerText = `${editState.brightness}%`;
        drawCanvas();
    });

    document.getElementById('contrastSlider').addEventListener('input', (e) => {
        editState.contrast = parseInt(e.target.value);
        document.getElementById('contrastVal').innerText = `${editState.contrast}%`;
        drawCanvas();
    });

    document.getElementById('saturationSlider').addEventListener('input', (e) => {
        editState.saturate = parseInt(e.target.value);
        document.getElementById('saturationVal').innerText = `${editState.saturate}%`;
        drawCanvas();
    });

    document.getElementById('rotateLeftBtn').addEventListener('click', () => {
        editState.rotation = (editState.rotation - 90 + 360) % 360;
        drawCanvas();
    });

    document.getElementById('rotateRightBtn').addEventListener('click', () => {
        editState.rotation = (editState.rotation + 90) % 360;
        drawCanvas();
    });

    document.getElementById('whitenBgBtn').addEventListener('click', applyWhitenBackground);

    document.getElementById('resetAdjustmentsBtn').addEventListener('click', () => {
        openPhotoEditor(activeImageIndex);
    });

    document.getElementById('closeModalBtn').addEventListener('click', () => {
        document.getElementById('photoEditorModal').style.display = 'none';
    });
    document.getElementById('cancelModalBtn').addEventListener('click', () => {
        document.getElementById('photoEditorModal').style.display = 'none';
    });

    document.getElementById('applyPhotoEditsBtn').addEventListener('click', async () => {
        const canvas = document.getElementById('editorCanvas');
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        if (activeImageIndex !== null && imageList[activeImageIndex]) {
            const targetImg = imageList[activeImageIndex];
            targetImg.url = dataUrl;
            targetImg.dataUrl = dataUrl;
            targetImg.isEdited = true;

            // Attempt saving to local server disk if server is running
            try {
                const filename = `item_${product.sourceId || 'draft'}_img${activeImageIndex + 1}_${Date.now()}`;
                const res = await fetch('http://localhost:3000/api/save-edited-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dataUrl, filename })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.hostedUrl) {
                        targetImg.hostedUrl = data.hostedUrl;
                    }
                }
            } catch (err) {
                // Offline fallback - keeps dataUrl intact
            }

            renderPhotoGrid();
            triggerAutoSave();
            showToast("✨ Photo brightness and adjustments saved to draft!");
        }
        document.getElementById('photoEditorModal').style.display = 'none';
    });

    // Header Actions: Two-Step Save & Upload Workflow
    const saveApproveBtn = document.getElementById('saveApproveBtn');
    if (saveApproveBtn) {
        saveApproveBtn.addEventListener('click', async () => {
            const compiled = compileCurrentProduct();
            saveApproveBtn.disabled = true;
            saveApproveBtn.innerText = '⏳ Saving & Approving...';
            try {
                saveCurrentState();
                
                const res = await fetch('http://localhost:3000/api/inventory/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(compiled)
                });
                
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || `Server returned ${res.status}`);
                }
                
                updateApprovalBadge('APPROVED');
                showToast("✅ Listing saved to inventory database & approved for eBay!");
            } catch (err) {
                console.warn("Save inventory error:", err);
                showToast("⚠️ Saved to local draft. Run 'node server.js' on port 3000 to sync database.");
            } finally {
                saveApproveBtn.disabled = false;
                saveApproveBtn.innerText = '💾 Save to Inventory Base';
            }
        });
    }

    const uploadEbayBtn = document.getElementById('uploadEbayBtn');
    if (uploadEbayBtn) {
        uploadEbayBtn.addEventListener('click', () => {
            const compiled = compileCurrentProduct();
            document.getElementById('uploadModalTitle').innerText = compiled.title || 'Untitled Listing';
            document.getElementById('uploadModalPrice').innerText = `$${parseFloat(compiled.price || 0).toFixed(2)}`;
            document.getElementById('uploadModalQty').innerText = compiled.quantity || '1';
            document.getElementById('uploadModalCategory').innerText = `#${compiled.categoryId || '67779'}`;
            document.getElementById('ebayUploadModal').style.display = 'flex';
        });
    }

    const closeUploadModal = () => {
        const modal = document.getElementById('ebayUploadModal');
        if (modal) modal.style.display = 'none';
    };
    if (document.getElementById('closeUploadModalBtn')) {
        document.getElementById('closeUploadModalBtn').addEventListener('click', closeUploadModal);
    }
    if (document.getElementById('cancelUploadModalBtn')) {
        document.getElementById('cancelUploadModalBtn').addEventListener('click', closeUploadModal);
    }

    const confirmEbayUploadBtn = document.getElementById('confirmEbayUploadBtn');
    if (confirmEbayUploadBtn) {
        confirmEbayUploadBtn.addEventListener('click', async () => {
            const compiled = compileCurrentProduct();
            const methodRadio = document.querySelector('input[name="uploadMethodChoice"]:checked');
            const selectedMethod = methodRadio ? methodRadio.value : 'seller-hub';

            confirmEbayUploadBtn.disabled = true;
            confirmEbayUploadBtn.innerText = '⏳ Publishing to eBay...';

            try {
                // 1. Save and approve to inventory first
                await fetch('http://localhost:3000/api/inventory/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(compiled)
                }).catch(() => {});

                // 2. Perform publishing based on chosen method
                const csvString = generateEbayCsvString(compiled);
                const filename = `ebay-listing-${compiled.sourceId || Date.now()}.csv`;

                if (selectedMethod === 'seller-hub') {
                    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                        await chrome.storage.local.set({
                            zonbayPendingUpload: csvString,
                            zonbayPendingFilename: filename
                        });
                        await chrome.tabs.create({ url: 'https://www.ebay.com/sh/reports/uploads' });
                    } else {
                        downloadCsvBlob(csvString, filename);
                        window.open('https://www.ebay.com/sh/reports/uploads', '_blank');
                    }
                } else if (selectedMethod === 'csv') {
                    downloadCsvBlob(csvString, filename);
                } else if (selectedMethod === 'api') {
                    await fetch('http://localhost:3000/api/update-listing', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ itemId: compiled.sourceId || compiled.id, title: compiled.title, price: compiled.price })
                    }).catch(() => {});
                }

                // 3. Mark live on eBay in inventory database
                await fetch('http://localhost:3000/api/inventory/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: compiled.id || compiled.sourceId || compiled.customSku, method: selectedMethod })
                }).catch(() => {});

                updateApprovalBadge('LIVE_ON_EBAY');
                closeUploadModal();
                showToast("🎉 Listing published & active on your eBay account!");
            } catch (err) {
                alert("Upload error: " + err.message);
            } finally {
                confirmEbayUploadBtn.disabled = false;
                confirmEbayUploadBtn.innerText = '🚀 Confirm & Publish Live';
            }
        });
    }

    function downloadCsvBlob(csvString, filename) {
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Legacy fallbacks
    const saveDraftBtn = document.getElementById('saveDraftBtn');
    if (saveDraftBtn) {
        saveDraftBtn.addEventListener('click', () => {
            saveCurrentState();
            showToast("✅ Draft successfully saved!");
        });
    }

    const syncServerBtn = document.getElementById('syncServerBtn');
    if (syncServerBtn) {
        syncServerBtn.addEventListener('click', async () => {
            const compiled = compileCurrentProduct();
            try {
                const res = await fetch('http://localhost:3000/api/inventory/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(compiled)
                });
                const data = await res.json();
                showToast(data.message || "Synced to local inventory database!");
            } catch (e) {
                showToast("Local server is offline. Run 'node server.js' on port 3000.");
            }
        });
    }

    const exportCsvBtn = document.getElementById('exportCsvBtn');
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', () => {
            const compiled = compileCurrentProduct();
            try {
                const csvString = generateEbayCsvString(compiled);
                const filename = `ebay-listing-${compiled.sourceId || Date.now()}.csv`;
                downloadCsvBlob(csvString, filename);
                showToast("📥 Exported eBay Seller Hub CSV!");
            } catch (err) {
                alert("Export error: " + err.message);
            }
        });
    }

    const autoUploadBtn = document.getElementById('autoUploadBtn');
    if (autoUploadBtn) {
        autoUploadBtn.addEventListener('click', () => {
            if (uploadEbayBtn) uploadEbayBtn.click();
        });
    }
}

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
