/**
 * Zonbay - In-Browser Stealth DHgate Extractor
 * Executes within the user's active DHgate tab context.
 * Bypasses bot detection & Cloudflare by scraping directly from the user's authentic session.
 */

function extractDHgateProduct() {
    // 1. Title Extraction
    let rawTitle = '';
    const titleCandidates = [
        document.querySelector('h1.product-name'),
        document.querySelector('h1[data-qa="product-title"]'),
        document.querySelector('h1.prod-title'),
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

    // 2. Item Code / Item ID
    let itemId = '';
    const urlMatch = window.location.href.match(/product\/[^\/]+\/(\d+)\.html/i) || 
                     window.location.href.match(/\/(\d{8,})\.html/i) ||
                     window.location.href.match(/[?&]itemcode=(\d+)/i);
    if (urlMatch) {
        itemId = urlMatch[1];
    } else {
        const itemCodeEl = document.querySelector('[data-qa="item-code"], .item-code, #itemCode');
        if (itemCodeEl && itemCodeEl.innerText) {
            const m = itemCodeEl.innerText.match(/\d+/);
            if (m) itemId = m[0];
        }
    }
    if (!itemId) {
        itemId = `DHG-${Date.now()}`;
    }

    // 3. Price Detection
    let price = '0.00';
    const metaPrice = document.querySelector('meta[property="product:price:amount"]')?.getAttribute('content');
    if (metaPrice && !isNaN(parseFloat(metaPrice))) {
        price = parseFloat(metaPrice).toFixed(2);
    } else {
        const priceEls = document.querySelectorAll(
            '.price, .current-price, .product-price, [data-qa="product-price"], span[class*="price-val"], span[class*="price"]'
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

    // 4. Brand / Seller / Store Detection
    let brand = 'Unbranded';
    const storeCandidates = [
        document.querySelector('.seller-name a'),
        document.querySelector('.seller-name'),
        document.querySelector('.store-name'),
        document.querySelector('a[href*="store"]')
    ];
    for (const s of storeCandidates) {
        if (s && s.innerText && s.innerText.trim().length > 1) {
            brand = s.innerText.trim();
            break;
        }
    }

    // 5. High-Resolution Imagery (DHgate CDN: image.dhgate.com)
    function cleanDHgateImg(src) {
        if (!src || typeof src !== 'string') return '';
        let cleaned = src;
        if (cleaned.startsWith('//')) cleaned = 'https:' + cleaned;
        // Strip downscaled thumbnail resolution directory paths like /0x0/, /100x100/, /200x200/, /max_100x100/
        cleaned = cleaned.replace(/\/(?:0x0|\d+x\d+|max_\d+x\d+)\//gi, '/');
        cleaned = cleaned.replace(/_\d+x\d+\.(?:jpg|jpeg|png|webp)/gi, '.jpg');
        cleaned = cleaned.split('?')[0];
        return cleaned;
    }

    function isJunkOrUnrelated(imgEl, src) {
        if (!src) return true;
        const s = src.toLowerCase();
        if (s.includes('icon') || s.includes('avatar') || s.includes('logo') || s.includes('badge') || s.includes('coupon') || s.includes('cert') || s.includes('sprite')) {
            return true;
        }
        if (imgEl && imgEl.closest) {
            const bad = imgEl.closest('footer, header, nav, [class*="recommend"], [class*="similar"], [class*="review"]');
            if (bad) return true;
        }
        if (imgEl && imgEl.naturalWidth && imgEl.naturalWidth < 80) return true;
        return false;
    }

    const images = [];
    const ogImg = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
    if (ogImg && !isJunkOrUnrelated(null, ogImg)) {
        images.push(cleanDHgateImg(ogImg));
    }

    const galleryEls = document.querySelectorAll(
        '.image-box img, .img-view img, [class*="thumb-list"] img, .product-slide img, [data-qa="gallery-img"] img, .slider-box img'
    );
    galleryEls.forEach(img => {
        const src = img.getAttribute('data-src') || img.getAttribute('src');
        if (src && (src.includes('dhgate.com') || src.includes('dhresource.com')) && !isJunkOrUnrelated(img, src)) {
            const hiRes = cleanDHgateImg(src);
            if (hiRes && !images.includes(hiRes)) {
                images.push(hiRes);
            }
        }
    });

    if (images.length < 2) {
        const fallbackImgs = document.querySelectorAll('img[src*="dhgate.com"], img[src*="dhresource.com"]');
        fallbackImgs.forEach(img => {
            const src = img.getAttribute('data-src') || img.getAttribute('src');
            if (src && !isJunkOrUnrelated(img, src)) {
                const hiRes = cleanDHgateImg(src);
                if (hiRes && !images.includes(hiRes)) {
                    images.push(hiRes);
                }
            }
        });
    }

    // 6. Product Specs & Properties
    const productSpecs = {
        'Brand': brand,
        'DHgate Item Code': itemId,
        'Country/Region of Manufacture': 'China'
    };

    const specItems = document.querySelectorAll(
        '.product-item-list li, .prop-list li, .specifics-list li, [class*="item-specifics"] li, [data-qa="product-props"] li'
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
    const descBlock = document.querySelector('.description-detail, #description, [data-qa="product-desc"], .detail-content');
    let longDescription = descBlock ? descBlock.innerText.replace(/\s+/g, ' ').trim() : '';

    if (!longDescription) {
        longDescription = `Authentic item sourced from DHgate wholesale supplier. ${rawTitle}. Tested quality, ships safely packaged.`;
    }

    return {
        source: 'dhgate',
        sourcePlatform: 'DHgate',
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
    module.exports = { extractDHgateProduct };
}
