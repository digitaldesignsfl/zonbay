/**
 * Zonbay - In-Browser Stealth AliExpress Extractor
 * Executes within the user's active AliExpress tab context.
 * Bypasses bot detection & Cloudflare by scraping directly within the user's authentic session.
 */

function extractAliExpressProduct() {
    // 1. Title Extraction
    let rawTitle = '';
    const titleCandidates = [
        document.querySelector('h1[data-pl="product-title"]'),
        document.querySelector('h1.product-title-text'),
        document.querySelector('[class*="title--wrap"] h1'),
        document.querySelector('meta[property="og:title"]'),
        document.querySelector('h1')
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

    // 2. Item ID / SKU Detection
    let itemId = '';
    const urlMatch = window.location.href.match(/item\/(\d+)\.html/) || 
                     window.location.href.match(/[?&]itemId=(\d+)/) ||
                     window.location.href.match(/\/(\d{10,})\.html/);
    if (urlMatch) {
        itemId = urlMatch[1];
    } else {
        itemId = `ALI-${Date.now()}`;
    }

    // 3. Price Detection
    let price = '0.00';
    const metaPrice = document.querySelector('meta[property="product:price:amount"]')?.getAttribute('content');
    if (metaPrice && !isNaN(parseFloat(metaPrice))) {
        price = parseFloat(metaPrice).toFixed(2);
    } else {
        const priceEls = document.querySelectorAll(
            '.product-price-current, [class*="price--current"], [class*="price-value"], .uniform-banner-box-price, [data-pl="product-price"]'
        );
        for (const el of priceEls) {
            const match = el.innerText.match(/[\$£€¥]?\s*([0-9]+\.[0-9]{2})/);
            if (match) {
                price = match[1];
                break;
            }
        }
    }

    // 4. Brand / Store Detection
    let brand = 'Unbranded';
    const storeCandidates = [
        document.querySelector('a[data-pl="store-name"]'),
        document.querySelector('.store-name'),
        document.querySelector('[class*="store-detail--storeName"]'),
        document.querySelector('.shop-name')
    ];
    for (const s of storeCandidates) {
        if (s && s.innerText && s.innerText.trim().length > 1) {
            brand = s.innerText.trim();
            break;
        }
    }

    // 5. Image Extraction (AliExpress CDN: alicdn.com)
    function cleanAliImg(src) {
        if (!src || typeof src !== 'string') return '';
        let cleaned = src;
        // Strip protocol-relative prefix
        if (cleaned.startsWith('//')) cleaned = 'https:' + cleaned;
        // Strip downscaled thumbnail suffixes like _50x50.jpg, _120x120.jpg, _640x640.jpg, _Q90.jpg_.webp
        cleaned = cleaned.replace(/_\d+x\d+[^.]*\.(?:jpg|jpeg|png|webp)/gi, '');
        cleaned = cleaned.replace(/_\.webp$/gi, '');
        cleaned = cleaned.replace(/\.jpg_[^.]+\.jpg$/gi, '.jpg');
        // Clean query parameters
        cleaned = cleaned.split('?')[0];
        return cleaned;
    }

    function isJunkOrUnrelated(imgEl, src) {
        if (!src) return true;
        const s = src.toLowerCase();
        if (s.includes('avatar') || s.includes('icon') || s.includes('logo') || s.includes('badge') || s.includes('coupon') || s.includes('sprite') || s.includes('flag')) {
            return true;
        }
        if (imgEl && imgEl.closest) {
            const badAncestor = imgEl.closest('[class*="recommend"], [class*="similar"], [class*="review"], [class*="comment"], [class*="footer"], [class*="header"], [class*="nav"]');
            if (badAncestor) return true;
        }
        if (imgEl && imgEl.naturalWidth && imgEl.naturalWidth < 80) return true;
        return false;
    }

    const images = [];
    const ogImg = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
    if (ogImg && !isJunkOrUnrelated(null, ogImg)) {
        images.push(cleanAliImg(ogImg));
    }

    // Gallery and main slider images
    const galleryEls = document.querySelectorAll(
        '[class*="image-view--previewBox"] img, [class*="slider--img"] img, [class*="gallery"] img, [class*="magnifier"] img, [data-pl="image-viewer"] img, .p-item-image img'
    );
    galleryEls.forEach(img => {
        const src = img.getAttribute('data-src') || img.getAttribute('src');
        if (src && (src.includes('alicdn.com') || src.includes('aliexpress-media.com')) && !isJunkOrUnrelated(img, src)) {
            const highRes = cleanAliImg(src);
            if (highRes && !images.includes(highRes)) {
                images.push(highRes);
            }
        }
    });

    // Broaden search if few images found
    if (images.length < 2) {
        const imgEls = document.querySelectorAll('img[src*="alicdn.com"], img[data-src*="alicdn.com"]');
        imgEls.forEach(img => {
            const src = img.getAttribute('data-src') || img.getAttribute('src');
            if (src && !isJunkOrUnrelated(img, src)) {
                const highRes = cleanAliImg(src);
                if (highRes && !images.includes(highRes)) {
                    images.push(highRes);
                }
            }
        });
    }

    // 6. Product Specs & Features
    const productSpecs = {
        'Brand': brand,
        'Item ID': itemId,
        'Country/Region of Manufacture': 'China'
    };

    const specItems = document.querySelectorAll(
        '[class*="specification--prop"] [class*="specification--line"], [class*="specification"] li, [class*="property-item"], [data-pl="product-prop"]'
    );
    specItems.forEach(item => {
        const text = item.innerText.replace(/\s+/g, ' ').trim();
        if (text.includes(':')) {
            const parts = text.split(':');
            const k = parts[0].trim();
            const v = parts.slice(1).join(':').trim();
            if (k && v && k.length < 40 && v.length < 100) productSpecs[k] = v;
        }
    });

    // 7. Description / Bullets
    const bulletPoints = [];
    const descBlock = document.querySelector('[class*="description--detail"], #product-description, [data-pl="product-description"]');
    let longDescription = descBlock ? descBlock.innerText.replace(/\s+/g, ' ').trim() : '';

    if (!longDescription) {
        longDescription = `Authentic item sourced from AliExpress. High quality ${rawTitle}. Ships safely packaged.`;
    }

    return {
        source: 'aliexpress',
        sourcePlatform: 'AliExpress',
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
    module.exports = { extractAliExpressProduct };
}
