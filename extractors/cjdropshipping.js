/**
 * Zonbay - In-Browser Stealth CJ Dropshipping Extractor
 * Executes within the user's active CJ Dropshipping tab context.
 * Bypasses bot protection by scraping directly from the user's authentic session.
 */

function extractCJDropshippingProduct() {
    // 1. Title Extraction
    let rawTitle = '';
    const titleCandidates = [
        document.querySelector('.product-title'),
        document.querySelector('h1[class*="title"]'),
        document.querySelector('[class*="product-name"]'),
        document.querySelector('h1'),
        document.querySelector('meta[property="og:title"]')
    ];

    for (const el of titleCandidates) {
        if (!el) continue;
        const text = el.tagName === 'META' ? el.getAttribute('content') : el.innerText;
        if (text && text.trim().length > 5) {
            rawTitle = text.replace(/\s+/g, ' ').trim();
            break;
        }
    }
    if (!rawTitle) {
        rawTitle = document.title.split('|')[0].split('-')[0].trim();
    }

    // 2. SKU / PID / Item ID
    let itemId = '';
    const urlMatch = window.location.href.match(/[?&]pid=([a-zA-Z0-9-]+)/i) || 
                     window.location.href.match(/product-detail\/([a-zA-Z0-9-]+)/i) ||
                     window.location.href.match(/[?&]id=([a-zA-Z0-9-]+)/i);
    if (urlMatch) {
        itemId = urlMatch[1];
    } else {
        const skuEl = document.querySelector('[class*="sku"], .product-sku');
        if (skuEl && skuEl.innerText) {
            const m = skuEl.innerText.match(/SKU:\s*([A-Za-z0-9_-]+)/i);
            if (m) itemId = m[1];
        }
    }
    if (!itemId) {
        itemId = `CJD-${Date.now()}`;
    }

    // 3. Price Detection
    let price = '0.00';
    const metaPrice = document.querySelector('meta[property="product:price:amount"]')?.getAttribute('content');
    if (metaPrice && !isNaN(parseFloat(metaPrice))) {
        price = parseFloat(metaPrice).toFixed(2);
    } else {
        const priceEls = document.querySelectorAll(
            '.price-box .price, .product-price, [class*="price-num"], [class*="unit-price"], span[class*="price"]'
        );
        for (const el of priceEls) {
            const text = el.innerText || el.textContent;
            const match = text.match(/[\$£€¥]?\s*([0-9]+\.[0-9]{2})/);
            if (match) {
                price = match[1];
                break;
            }
        }
    }

    // 4. Brand / Store Detection
    let brand = 'Unbranded';
    const brandCandidates = [
        document.querySelector('[class*="supplier-name"]'),
        document.querySelector('.store-name'),
        document.querySelector('[class*="brand"]')
    ];
    for (const b of brandCandidates) {
        if (b && b.innerText && b.innerText.trim().length > 1) {
            brand = b.innerText.trim();
            break;
        }
    }

    // 5. High-Resolution Imagery (CJ CDN: cj.wshoto.com, aliyuncs.com, cjdropshipping.com)
    function cleanCJImg(src) {
        if (!src || typeof src !== 'string') return '';
        let cleaned = src;
        if (cleaned.startsWith('//')) cleaned = 'https:' + cleaned;
        // Strip downscaling / resizing parameters (e.g. ?x-oss-process=image/resize,w_80,h_80) to get master asset
        cleaned = cleaned.replace(/\?x-oss-process=image\/resize[^\s&]*/gi, '');
        cleaned = cleaned.split('?')[0];
        return cleaned;
    }

    function isJunkOrUnrelated(imgEl, src) {
        if (!src) return true;
        const s = src.toLowerCase();
        if (s.includes('icon') || s.includes('avatar') || s.includes('logo') || s.includes('badge') || s.includes('flag') || s.includes('cart') || s.includes('sprite')) {
            return true;
        }
        if (imgEl && imgEl.closest) {
            const bad = imgEl.closest('footer, header, nav, [class*="recommend"], [class*="similar"]');
            if (bad) return true;
        }
        if (imgEl && imgEl.naturalWidth && imgEl.naturalWidth < 80) return true;
        return false;
    }

    const images = [];
    const ogImg = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
    if (ogImg && !isJunkOrUnrelated(null, ogImg)) {
        images.push(cleanCJImg(ogImg));
    }

    const galleryEls = document.querySelectorAll(
        '.preview-img img, [class*="thumb"] img, [class*="gallery"] img, .product-img img, [class*="carousel"] img'
    );
    galleryEls.forEach(img => {
        const src = img.getAttribute('data-src') || img.getAttribute('src');
        if (src && (src.includes('wshoto.com') || src.includes('cjdropshipping.com') || src.includes('aliyuncs.com')) && !isJunkOrUnrelated(img, src)) {
            const hiRes = cleanCJImg(src);
            if (hiRes && !images.includes(hiRes)) {
                images.push(hiRes);
            }
        }
    });

    if (images.length < 2) {
        const fallbackImgs = document.querySelectorAll('img[src*="wshoto.com"], img[src*="cjdropshipping.com"], img[src*="aliyuncs.com"]');
        fallbackImgs.forEach(img => {
            const src = img.getAttribute('data-src') || img.getAttribute('src');
            if (src && !isJunkOrUnrelated(img, src)) {
                const hiRes = cleanCJImg(src);
                if (hiRes && !images.includes(hiRes)) {
                    images.push(hiRes);
                }
            }
        });
    }

    // 6. Product Specs & Properties
    const productSpecs = {
        'Brand': brand,
        'CJ Item SKU / PID': itemId,
        'Country/Region of Manufacture': 'China'
    };

    const specItems = document.querySelectorAll(
        '.product-info-item, .property-item, [class*="detail-item"], [class*="spec-row"]'
    );
    specItems.forEach(item => {
        const text = item.innerText.replace(/\s+/g, ' ').trim();
        if (text.includes(':')) {
            const parts = text.split(':');
            const k = parts[0].trim();
            const v = parts.slice(1).join(':').trim();
            if (k && v && k.length < 40 && v.length < 120) {
                productSpecs[k] = v;
            }
        }
    });

    // 7. Bullet Points & Description
    const bulletPoints = [];
    const descBlock = document.querySelector('.product-description, [class*="description-wrap"], #description, [class*="desc-content"]');
    let longDescription = descBlock ? descBlock.innerText.replace(/\s+/g, ' ').trim() : '';

    if (!longDescription) {
        longDescription = `Authentic item sourced from CJ Dropshipping. ${rawTitle}. Quality verified supplier with automated order fulfillment.`;
    }

    return {
        source: 'cjdropshipping',
        sourcePlatform: 'CJ Dropshipping',
        sourceId: itemId,
        title: rawTitle,
        brand: brand,
        price: price,
        currency: 'USD',
        originCountry: 'China',
        isInternational: true,
        mainImgUrl: images[0] || '',
        alternateImages: images.slice(0, 12),
        bulletPoints: bulletPoints,
        productSpecs: productSpecs,
        longDescription: longDescription,
        url: window.location.href,
        extractedAt: new Date().toISOString()
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { extractCJDropshippingProduct };
}
