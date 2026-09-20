/**
 * Zonbay - In-Browser Stealth Home Depot Extractor
 * Executes within the user's active Home Depot tab context.
 * Bypasses bot protection by scraping directly from the user's authentic session.
 */

function extractHomeDepotProduct() {
    // 1. Title Extraction
    let rawTitle = '';
    const titleCandidates = [
        document.querySelector('h1.product-details__title'),
        document.querySelector('[data-testid="product-title"]'),
        document.querySelector('h1[data-testid="product-header"]'),
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
        rawTitle = document.title.split('-')[0].split('|')[0].trim();
    }

    // 2. Internet # / Store SKU / Item ID
    let itemId = '';
    const urlMatch = window.location.href.match(/\/p\/(?:[^\/]+\/)?(\d+)/i) || 
                     window.location.href.match(/[?&]id=(\d+)/i);
    const internetEl = document.querySelector('[data-testid="product-info-internet-number"], .internet-number, [data-testid="internet-number"]');
    if (internetEl && internetEl.innerText) {
        const m = internetEl.innerText.match(/\d{6,}/);
        if (m) itemId = m[0];
    }
    if (!itemId && urlMatch) {
        itemId = urlMatch[1];
    }
    if (!itemId) {
        itemId = `HD-${Date.now()}`;
    }

    // 3. Price Detection
    let price = '0.00';
    const metaPrice = document.querySelector('meta[property="product:price:amount"]')?.getAttribute('content');
    if (metaPrice && !isNaN(parseFloat(metaPrice))) {
        price = parseFloat(metaPrice).toFixed(2);
    } else {
        const priceEls = document.querySelectorAll(
            '.price-format__largePrice, [data-testid="price-format"], .price-detailed__unit-price, [class*="price-format"]'
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
        document.querySelector('a.product-details__brand'),
        document.querySelector('[data-testid="product-brand"]'),
        document.querySelector('[itemprop="brand"]'),
        document.querySelector('.product-details__brand-name')
    ];
    for (const b of brandCandidates) {
        if (b && b.innerText && b.innerText.trim().length > 1) {
            brand = b.innerText.trim();
            break;
        }
    }

    // 5. High-Resolution Imagery (Home Depot CDN: images.thdstatic.com)
    function cleanHomeDepotImg(src) {
        if (!src || typeof src !== 'string') return '';
        let cleaned = src;
        if (cleaned.startsWith('//')) cleaned = 'https:' + cleaned;
        // Upgrade thumbnail suffixes (e.g. _145.jpg, _400.jpg, _600.jpg) to full 1000px master assets
        cleaned = cleaned.replace(/_\d+\.(?:jpg|jpeg|png|webp)/gi, '_1000.jpg');
        cleaned = cleaned.split('?')[0];
        return cleaned;
    }

    function isJunkOrUnrelated(imgEl, src) {
        if (!src) return true;
        const s = src.toLowerCase();
        if (s.includes('icon') || s.includes('avatar') || s.includes('badge') || s.includes('logo') || s.includes('cart') || s.includes('truck') || s.includes('tool-rental')) {
            return true;
        }
        if (imgEl && imgEl.closest) {
            const bad = imgEl.closest('footer, header, nav, [class*="recommendations"], [class*="carousel-similar"]');
            if (bad) return true;
        }
        if (imgEl && imgEl.naturalWidth && imgEl.naturalWidth < 80) return true;
        return false;
    }

    const images = [];
    const ogImg = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
    if (ogImg && !isJunkOrUnrelated(null, ogImg)) {
        images.push(cleanHomeDepotImg(ogImg));
    }

    const galleryImgs = document.querySelectorAll(
        '[data-testid="main-image-container"] img, .mediagallery__mainimage img, [data-testid="media-thumbnail"] img, .thd-gallery img, img[class*="product-image"]'
    );
    galleryImgs.forEach(img => {
        const src = img.getAttribute('src') || img.getAttribute('data-src');
        if (src && (src.includes('thdstatic.com') || src.includes('homedepot.com')) && !isJunkOrUnrelated(img, src)) {
            const hiRes = cleanHomeDepotImg(src);
            if (hiRes && !images.includes(hiRes)) {
                images.push(hiRes);
            }
        }
    });

    // 6. Product Specs & Features Table
    const productSpecs = {
        'Brand': brand,
        'Home Depot SKU / Internet #': itemId,
        'Country/Region of Manufacture': 'United States'
    };

    const specRows = document.querySelectorAll(
        '#specifications-table tr, [data-testid="specifications-table"] tr, [class*="specifications__row"], .specs-table tr'
    );
    specRows.forEach(row => {
        const key = row.querySelector('th, div[class*="label"], .spec-label')?.innerText?.replace(/[\s:]+/g, ' ').trim();
        const val = row.querySelector('td, div[class*="value"], .spec-value')?.innerText?.replace(/\s+/g, ' ').trim();
        if (key && val && key !== val && key.length < 40 && val.length < 120) {
            productSpecs[key] = val;
        }
    });

    // 7. Bullet Points & Overview
    const bulletPoints = [];
    const bulletEls = document.querySelectorAll(
        '#overview li, [data-testid="product-overview"] li, .product-description__bullets li, .highlights__list li'
    );
    bulletEls.forEach(el => {
        const text = el.innerText.trim();
        if (text && text.length > 5 && text.length < 250) {
            bulletPoints.push(text);
        }
    });

    const descEl = document.querySelector(
        '#product-description, [data-testid="product-description"], .product-description__content'
    );
    let longDescription = descEl ? descEl.innerText.replace(/\s+/g, ' ').trim() : '';
    if (!longDescription) {
        longDescription = `Authentic item sourced from Home Depot. ${rawTitle} by ${brand}. Genuine hardware & tools with fast US delivery.`;
    }

    return {
        source: 'homedepot',
        sourcePlatform: 'Home Depot',
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
    module.exports = { extractHomeDepotProduct };
}
