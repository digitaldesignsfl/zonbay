/**
 * Zonbay - In-Browser Stealth Amazon Extractor
 * Executes within the user's active Amazon tab context.
 * Bypasses bot detection by reading directly from the user's rendered DOM.
 */

function extractAmazonProduct() {
    // 1. Basic Title & Brand
    const titleEl = document.getElementById('productTitle') || 
                    document.querySelector('#title span') ||
                    document.querySelector('h1.a-size-large');
    const rawTitle = titleEl ? titleEl.innerText.replace(/\s+/g, ' ').trim() : '';

    // Brand detection
    let brand = '';
    const brandEl = document.getElementById('bylineInfo') || 
                    document.querySelector('#bylineInfo_feature_div a') ||
                    document.querySelector('.po-brand .a-span9 span');
    if (brandEl) {
        brand = brandEl.innerText.replace(/Brand:\s*|Visit the\s*|Store/gi, '').trim();
    }

    // 2. Price Detection (multi-selector fallback)
    let price = '0.00';
    const priceSelectors = [
        '.a-price.priceToPay .a-offscreen',
        '#corePrice_desktop .a-price .a-offscreen',
        '#apex_desktop .a-price .a-offscreen',
        '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
        '.a-price .a-offscreen',
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        '#price'
    ];
    for (const sel of priceSelectors) {
        const el = document.querySelector(sel);
        if (el && el.innerText) {
            const matched = el.innerText.match(/([0-9]+\.[0-9]{2})/);
            if (matched) {
                price = matched[1];
                break;
            }
        }
    }

    // 3. ASIN
    let asin = '';
    const asinMatch = window.location.href.match(/(?:dp|gp\/product|product)\/([A-Z0-9]{10})/i);
    if (asinMatch) {
        asin = asinMatch[1].toUpperCase();
    } else {
        const asinInput = document.getElementById('ASIN');
        if (asinInput && asinInput.value) asin = asinInput.value.trim().toUpperCase();
    }

    // 4. High-Resolution Imagery
    // Converts Amazon thumbnail tokens (e.g. ._AC_US40_. or ._SX38_SY50_CR,0,0,38,50_.) into full 1500px zoom links
    function toHighRes(src) {
        if (!src || typeof src !== 'string') return '';
        return src.replace(/\._[A-Z0-9_,-]+_\./i, '._AC_SL1500_.');
    }

    const images = [];
    const landingImg = document.getElementById('landingImage') || 
                       document.getElementById('imgBlkFront') ||
                       document.querySelector('#main-image-container img');

    if (landingImg) {
        const dynamicData = landingImg.getAttribute('data-a-dynamic-image');
        if (dynamicData) {
            try {
                const parsed = JSON.parse(dynamicData);
                const urls = Object.keys(parsed);
                urls.sort((a, b) => {
                    const dimA = parsed[a][0] * parsed[a][1];
                    const dimB = parsed[b][0] * parsed[b][1];
                    return dimB - dimA;
                });
                if (urls.length > 0 && !images.includes(urls[0])) {
                    images.push(urls[0]);
                }
            } catch (e) {
                // Ignore json parse error
            }
        }

        const hiresAttr = landingImg.getAttribute('data-old-hires');
        if (hiresAttr && !images.includes(hiresAttr)) {
            images.push(hiresAttr);
        }

        const src = landingImg.getAttribute('src');
        if (src) {
            const hiRes = toHighRes(src);
            if (!images.includes(hiRes)) images.push(hiRes);
        }
    }

    // Extract alternate thumbnail gallery images
    const thumbElements = document.querySelectorAll('#altImages img, #imageBlock_feature_div img, #imageBlock img');
    thumbElements.forEach(img => {
        const src = img.getAttribute('src');
        if (src && !src.includes('play-icon') && !src.includes('transparent-pixel') && !src.includes('blank.gif') && !src.toLowerCase().includes('.svg')) {
            const hiRes = toHighRes(src);
            if (hiRes && !images.includes(hiRes) && hiRes.startsWith('http')) {
                images.push(hiRes);
            }
        }
    });

    // 5. Bullet Points ("About this item")
    const bulletPoints = [];
    const bulletElements = document.querySelectorAll('#feature-bullets ul li span.a-list-item, #featurebullets_feature_div li span');
    bulletElements.forEach(el => {
        const text = el.innerText.trim();
        if (text && !text.toLowerCase().includes('make sure this fits by entering')) {
            bulletPoints.push(text);
        }
    });

    // 6. Product Specs Table
    const productSpecs = {};
    if (brand) productSpecs['Brand'] = brand;
    if (asin) productSpecs['ASIN'] = asin;

    // Standard HTML tables
    const specRows = document.querySelectorAll('.prodDetTable tr, #productDetails_techSpec_sections_1 tr, #detailBullets_feature_div li');
    specRows.forEach(row => {
        const key = row.querySelector('th, .a-text-bold')?.innerText.replace(/[\s:]+/g, ' ').trim();
        const val = row.querySelector('td, span:not(.a-text-bold)')?.innerText.replace(/\s+/g, ' ').trim();
        if (key && val && key !== val) {
            productSpecs[key] = val;
        }
    });

    // Modern div-based spec rows (.po-row)
    const modernRows = document.querySelectorAll('#poExpander .po-row, .po-break-word .po-row');
    modernRows.forEach(row => {
        const key = row.querySelector('.a-span3 span, th')?.innerText.replace(/[\s:]+/g, ' ').trim();
        const val = row.querySelector('.a-span9 span, td')?.innerText.replace(/\s+/g, ' ').trim();
        if (key && val) {
            productSpecs[key] = val;
        }
    });

    // 7. Long Description
    let longDescription = '';
    const descEl = document.querySelector('#productDescription p span, #productDescription p, #bookDescription_feature_div, #aplus_feature_div');
    if (descEl) {
        longDescription = descEl.innerText.replace(/\s+/g, ' ').trim();
    }

    return {
        source: 'amazon',
        sourceId: asin || `AMZ-${Date.now()}`,
        title: rawTitle,
        brand: brand || productSpecs['Brand'] || 'Unbranded',
        price: price,
        currency: 'USD',
        mainImgUrl: images[0] || '',
        alternateImages: images.slice(0, 12),
        bulletPoints: bulletPoints.slice(0, 10),
        productSpecs: productSpecs,
        longDescription: longDescription,
        url: window.location.href,
        extractedAt: new Date().toISOString()
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { extractAmazonProduct };
}
