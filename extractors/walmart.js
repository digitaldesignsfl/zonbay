/**
 * Zonbay - In-Browser Stealth Walmart Extractor
 * Executes within the user's active Walmart tab context.
 * Bypasses bot protection by scraping directly from the user's authentic session.
 */

function extractWalmartProduct() {
    // 1. Title Extraction
    let rawTitle = '';
    const titleCandidates = [
        document.getElementById('main-title'),
        document.querySelector('h1[itemprop="name"]'),
        document.querySelector('[data-testid="product-title"]'),
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

    // 2. Item ID / SKU
    let itemId = '';
    const urlMatch = window.location.href.match(/\/ip\/(?:[^\/]+\/)?(\d+)/i) || 
                     window.location.href.match(/[?&]id=(\d+)/i) ||
                     window.location.href.match(/[?&]itemId=(\d+)/i);
    if (urlMatch) {
        itemId = urlMatch[1];
    } else {
        itemId = `WMT-${Date.now()}`;
    }

    // 3. Price Detection
    let price = '0.00';
    const metaPrice = document.querySelector('meta[property="product:price:amount"]')?.getAttribute('content') ||
                      document.querySelector('[itemprop="price"]')?.getAttribute('content');
    if (metaPrice && !isNaN(parseFloat(metaPrice))) {
        price = parseFloat(metaPrice).toFixed(2);
    } else {
        const priceEls = document.querySelectorAll(
            '[data-testid="price-wrap"] [itemprop="price"], [itemprop="price"], span[class*="price-characteristic"], [data-seo-id="hero-price"]'
        );
        for (const el of priceEls) {
            const text = el.innerText || el.textContent;
            const match = text.match(/([0-9]+\.[0-9]{2})/);
            if (match) {
                price = match[1];
                break;
            }
        }
    }

    // 4. Brand Detection
    let brand = 'Unbranded';
    const brandCandidates = [
        document.querySelector('a[link-identifier="brand"]'),
        document.querySelector('[data-testid="brand-name"]'),
        document.querySelector('[itemprop="brand"] span'),
        document.querySelector('[itemprop="brand"]')
    ];
    for (const b of brandCandidates) {
        if (b && b.innerText && b.innerText.trim().length > 1) {
            brand = b.innerText.replace(/Brand:\s*|Visit\s*/gi, '').trim();
            break;
        }
    }

    // 5. High-Resolution Imagery (Walmart CDN: i5.walmartimages.com)
    function cleanWalmartImg(src) {
        if (!src || typeof src !== 'string') return '';
        let cleaned = src;
        if (cleaned.startsWith('//')) cleaned = 'https:' + cleaned;
        // Upgrade thumbnail dimensions to high-resolution master 2000x2000
        cleaned = cleaned.replace(/\?odnHeight=\d+&odnWidth=\d+[^&]*/gi, '?odnHeight=2000&odnWidth=2000');
        cleaned = cleaned.replace(/\?odnHeight=\d+/gi, '?odnHeight=2000&odnWidth=2000');
        return cleaned;
    }

    function isJunkOrUnrelated(imgEl, src) {
        if (!src) return true;
        const s = src.toLowerCase();
        if (s.includes('icon') || s.includes('avatar') || s.includes('badge') || s.includes('logo') || s.includes('spark') || s.includes('ratings') || s.includes('banner')) {
            return true;
        }
        if (imgEl && imgEl.closest) {
            const bad = imgEl.closest('[data-testid="recommendations-container"], footer, header, nav, [data-testid="reviews-section"]');
            if (bad) return true;
        }
        if (imgEl && imgEl.naturalWidth && imgEl.naturalWidth < 80) return true;
        return false;
    }

    const images = [];
    const ogImg = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
    if (ogImg && !isJunkOrUnrelated(null, ogImg)) {
        images.push(cleanWalmartImg(ogImg));
    }

    const heroImgs = document.querySelectorAll(
        '[data-testid="hero-carousel-container"] img, [data-seo-id="hero-carousel"] img, [data-testid="media-thumbnail"] img, [data-testid="item-thumbnail"] img, img[itemprop="image"]'
    );
    heroImgs.forEach(img => {
        const src = img.getAttribute('src') || img.getAttribute('data-src');
        if (src && src.includes('walmartimages.com') && !isJunkOrUnrelated(img, src)) {
            const hiRes = cleanWalmartImg(src);
            if (hiRes && !images.includes(hiRes)) {
                images.push(hiRes);
            }
        }
    });

    // 6. Product Specs Table
    const productSpecs = {
        'Brand': brand,
        'Walmart Item ID': itemId,
        'Country/Region of Manufacture': 'United States'
    };

    const specRows = document.querySelectorAll(
        '#specifications tr, [data-testid="item-specifications"] tr, [data-testid="product-specifications"] div[class*="row"]'
    );
    specRows.forEach(row => {
        const key = row.querySelector('th, div[class*="label"], div:first-child')?.innerText?.replace(/[\s:]+/g, ' ').trim();
        const val = row.querySelector('td, div[class*="value"], div:last-child')?.innerText?.replace(/\s+/g, ' ').trim();
        if (key && val && key !== val && key.length < 40 && val.length < 120) {
            productSpecs[key] = val;
        }
    });

    // 7. Bullet Points & Description
    const bulletPoints = [];
    const bulletEls = document.querySelectorAll(
        '[data-testid="product-description-content"] li, #product-description-content li, .about-desc li'
    );
    bulletEls.forEach(el => {
        const text = el.innerText.trim();
        if (text && text.length > 5 && text.length < 250) {
            bulletPoints.push(text);
        }
    });

    const descEl = document.querySelector(
        '[data-testid="product-description-content"], #product-description-content, div[itemprop="description"]'
    );
    let longDescription = descEl ? descEl.innerText.replace(/\s+/g, ' ').trim() : '';
    if (!longDescription) {
        longDescription = `Authentic item sourced from Walmart. Brand: ${brand}. ${rawTitle}. Ships fast from the US.`;
    }

    return {
        source: 'walmart',
        sourcePlatform: 'Walmart',
        sourceId: itemId,
        title: rawTitle,
        brand: brand,
        price: price,
        currency: 'USD',
        originCountry: 'US',
        isInternational: false,
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
    module.exports = { extractWalmartProduct };
}
