/**
 * Zonbay - In-Browser Stealth Temu Extractor
 * Executes within the user's active Temu tab context.
 * Bypasses bot detection & Cloudflare by scraping directly within the user's authentic session.
 */

function extractTemuProduct() {
    // 1. Title Extraction
    let rawTitle = '';
    const titleCandidates = [
        document.querySelector('[data-testid="goods-title"]'),
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

    // 2. Goods / Item ID
    let goodsId = '';
    const urlMatch = window.location.href.match(/-g-(\d+)\.html/) || window.location.href.match(/[?&]goods_id=(\d+)/);
    if (urlMatch) {
        goodsId = urlMatch[1];
    } else {
        goodsId = `TEMU-${Date.now()}`;
    }

    // 3. Price Detection
    let price = '0.00';
    const metaPrice = document.querySelector('meta[property="product:price:amount"]')?.getAttribute('content');
    if (metaPrice && !isNaN(parseFloat(metaPrice))) {
        price = parseFloat(metaPrice).toFixed(2);
    } else {
        const priceEls = document.querySelectorAll('[data-testid="goods-price"], .goods-price, span[class*="price"]');
        for (const el of priceEls) {
            const match = el.innerText.match(/\$?\s*([0-9]+\.[0-9]{2})/);
            if (match) {
                price = match[1];
                break;
            }
        }
    }

    // 4. Brand / Seller
    let brand = 'Unbranded';
    const mallEl = document.querySelector('[data-testid="mall-name"], .mall-name, a[href*="mall"]');
    if (mallEl && mallEl.innerText) {
        brand = mallEl.innerText.trim();
    }

    // 5. Image Extraction (Temu CDN: img.kwcdn.com)
    function cleanTemuImg(src) {
        if (!src || typeof src !== 'string') return '';
        // Upgrade webp/downscaled thumbnails to higher resolution if formatted with imageView2
        if (src.includes('imageView2')) {
            return src.replace(/imageView2\/\d\/[wh]\/\d+/gi, 'imageView2/2/w/1000/q/90/format/jpg');
        }
        return src;
    }

    function isJunkOrUnrelated(imgEl, src) {
        if (!src) return true;
        const s = src.toLowerCase();
        if (s.includes('icon') || s.includes('avatar') || s.includes('logo') || s.includes('badge') || s.includes('coupon') || s.includes('sprite') || s.includes('rating') || s.includes('cert')) {
            return true;
        }
        if (imgEl && imgEl.closest) {
            const badAncestor = imgEl.closest('[class*="recommend"], [class*="similar"], [class*="review"], [class*="comment"], [class*="footer"], [class*="header"], [class*="cart"], [class*="bought_together"], [class*="like_list"], [class*="nav"]');
            if (badAncestor) return true;
        }
        if (imgEl && imgEl.naturalWidth && imgEl.naturalWidth < 80) return true;
        return false;
    }

    const images = [];
    const ogImg = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
    if (ogImg && !isJunkOrUnrelated(null, ogImg)) {
        images.push(cleanTemuImg(ogImg));
    }

    // Prioritize main product gallery containers first
    const galleryEls = document.querySelectorAll('[data-testid*="gallery"] img, [class*="gallery"] img, [class*="goods-image"] img, [class*="thumb"] img, [class*="swiper"] img, [class*="slider"] img');
    galleryEls.forEach(img => {
        const src = img.getAttribute('data-src') || img.getAttribute('src');
        if (src && src.includes('kwcdn.com') && !isJunkOrUnrelated(img, src)) {
            const highRes = cleanTemuImg(src);
            if (!images.includes(highRes)) {
                images.push(highRes);
            }
        }
    });

    // If gallery search returned few images, broaden carefully while filtering junk
    if (images.length < 2) {
        const imgEls = document.querySelectorAll('img[src*="kwcdn.com"], img[data-src*="kwcdn.com"]');
        imgEls.forEach(img => {
            const src = img.getAttribute('data-src') || img.getAttribute('src');
            if (src && !isJunkOrUnrelated(img, src)) {
                const highRes = cleanTemuImg(src);
                if (!images.includes(highRes)) {
                    images.push(highRes);
                }
            }
        });
    }

    // 6. Product Specs & Features
    const productSpecs = {
        'Brand': brand,
        'Item ID': goodsId
    };

    const specItems = document.querySelectorAll('[data-testid="spec-item"], .spec-row, .goods-detail-spec-item');
    specItems.forEach(item => {
        const text = item.innerText.replace(/\s+/g, ' ').trim();
        if (text.includes(':')) {
            const parts = text.split(':');
            const k = parts[0].trim();
            const v = parts.slice(1).join(':').trim();
            if (k && v) productSpecs[k] = v;
        }
    });

    // 7. Description / Bullets
    const bulletPoints = [];
    const descBlock = document.querySelector('[data-testid="goods-desc"], .goods-detail-desc, #goods_desc');
    let longDescription = descBlock ? descBlock.innerText.replace(/\s+/g, ' ').trim() : '';

    if (!longDescription) {
        longDescription = `Authentic item sourced from Temu. Features: ${rawTitle}.`;
    }

    return {
        source: 'temu',
        sourceId: goodsId,
        title: rawTitle,
        brand: brand,
        price: price,
        currency: 'USD',
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
    module.exports = { extractTemuProduct };
}
