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
    // Clean eBay search-inhibiting characters (commas, slashes, pipes)
    rawTitle = rawTitle.replace(/[,/\\|;:_]/g, ' ').replace(/\s+/g, ' ').trim();

    // 2. Goods / Item ID
    let goodsId = '';
    const urlMatch = window.location.href.match(/-g-(\d+)\.html/) || window.location.href.match(/[?&]goods_id=(\d+)/);
    if (urlMatch) {
        goodsId = urlMatch[1];
    } else {
        goodsId = `TEMU-${Date.now()}`;
    }

    // Helper: test if an element is styled in orange/red (Temu active sale price color)
    function isOrangeOrRed(el) {
        if (!el || typeof window === 'undefined' || !window.getComputedStyle) return false;
        try {
            const cs = window.getComputedStyle(el);
            const color = cs.color || '';
            const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (m) {
                const r = parseInt(m[1], 10);
                const g = parseInt(m[2], 10);
                const b = parseInt(m[3], 10);
                if (r >= 180 && g <= 140 && b <= 80) return true;
            }
        } catch (e) {}
        return false;
    }

    // Helper: detect if an element is strikethrough (list price / was price / reference price)
    function isStrikethroughOrOriginal(el) {
        if (!el) return false;
        if (['DEL', 'STRIKE', 'S'].includes(el.tagName)) return true;
        if (el.closest && el.closest('del, strike, s, [class*="origin"], [class*="was"], [class*="reference"], [class*="market"], [class*="line-through"], [style*="line-through"]')) {
            return true;
        }
        try {
            if (typeof window !== 'undefined' && window.getComputedStyle) {
                const cs = window.getComputedStyle(el);
                if (cs.textDecorationLine?.includes('line-through') || cs.textDecoration?.includes('line-through')) return true;
                // Gray/muted color check (original strikethrough prices on Temu are gray, sale prices are bold orange)
                const color = cs.color || '';
                const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                if (m) {
                    const r = parseInt(m[1], 10);
                    const g = parseInt(m[2], 10);
                    const b = parseInt(m[3], 10);
                    if (Math.abs(r - g) < 25 && Math.abs(g - b) < 25 && r >= 70 && r <= 170) {
                        return true;
                    }
                }
            }
        } catch (e) {}
        return false;
    }

    // 3. Price Detection (Active Selected DOM Price First)
    let price = '0.00';

    // Tier 1: Look in the Price Container directly adjacent to the Discount Badge (% OFF)
    // On Temu, the price row is: [ $16.14 (original strikethrough) ] [ $10.66 (active sale price) ] [ 33% OFF (discount tag) ]
    const allElements = Array.from(document.querySelectorAll('*'));
    const discountEls = allElements.filter(el => {
        if (el.children && el.children.length > 0) return false;
        return /\b\d+%\s*OFF\b/i.test(el.innerText || el.textContent || '');
    });

    for (const dEl of discountEls) {
        let container = dEl.parentElement;
        for (let depth = 0; depth < 4 && container; depth++) {
            const candidates = [];
            const textNodes = Array.from(container.querySelectorAll('*')).filter(node => {
                if (node.children && node.children.length > 0) return false;
                const t = (node.innerText || node.textContent || '').trim();
                return /^\$?\s*\d+(?:\.\d{1,2})?$/.test(t);
            });

            textNodes.forEach(node => {
                const match = (node.innerText || node.textContent || '').match(/\$?\s*([0-9]+\.[0-9]{2})/);
                if (match) {
                    const val = parseFloat(match[1]);
                    if (val >= 0.50 && val < 5000) {
                        candidates.push({
                            val: val,
                            el: node,
                            isOrange: isOrangeOrRed(node),
                            isStrikethrough: isStrikethroughOrOriginal(node)
                        });
                    }
                }
            });

            if (candidates.length > 0) {
                // Priority 1: Orange/red colored price element (Temu's active sale price style)
                const orangeCand = candidates.find(c => c.isOrange);
                if (orangeCand) {
                    price = orangeCand.val.toFixed(2);
                    break;
                }

                // Priority 2: Non-strikethrough / non-gray candidates
                const nonStrike = candidates.filter(c => !c.isStrikethrough);
                if (nonStrike.length > 0) {
                    // In a discount row [16.14, 10.66], the sale price is the discounted lower value
                    const minVal = Math.min(...nonStrike.map(c => c.val));
                    price = minVal.toFixed(2);
                    break;
                } else {
                    // Priority 3: Between all candidates in a discount row, the sale price is the discounted (lower) one
                    const minVal = Math.min(...candidates.map(c => c.val));
                    price = minVal.toFixed(2);
                    break;
                }
            }
            container = container.parentElement;
        }
        if (price !== '0.00') break;
    }

    // Tier 2: Dedicated Goods Price Element ([data-testid="goods-price"], .goods-price)
    if (price === '0.00') {
        const primaryPriceEls = document.querySelectorAll('[data-testid="goods-price"], .goods-price, [class*="goods-price"], [class*="goodsPrice"]');
        for (const el of primaryPriceEls) {
            const subNodes = Array.from(el.querySelectorAll('*')).filter(n => n.children.length === 0);
            const foundVals = [];
            subNodes.forEach(n => {
                const match = (n.innerText || n.textContent || '').match(/\$?\s*([0-9]+\.[0-9]{2})/);
                if (match) {
                    const v = parseFloat(match[1]);
                    if (v >= 0.50 && v < 5000) {
                        foundVals.push({ val: v, isOrange: isOrangeOrRed(n), isStrike: isStrikethroughOrOriginal(n) });
                    }
                }
            });

            if (foundVals.length > 0) {
                const orangeCand = foundVals.find(f => f.isOrange);
                if (orangeCand) {
                    price = orangeCand.val.toFixed(2);
                    break;
                }
                const nonStrike = foundVals.filter(f => !f.isStrike);
                if (nonStrike.length > 0) {
                    price = Math.min(...nonStrike.map(f => f.val)).toFixed(2);
                    break;
                }
            }

            const fullMatch = (el.innerText || el.textContent || '').match(/\$?\s*([0-9]+\.[0-9]{2})/);
            if (fullMatch) {
                const v = parseFloat(fullMatch[1]);
                if (v >= 0.50 && v < 5000) {
                    price = v.toFixed(2);
                    break;
                }
            }
        }
    }

    // Tier 3: Meta tags (product:price:amount, og:price:amount)
    if (price === '0.00') {
        const metaPrice = document.querySelector('meta[property="product:price:amount"]')?.getAttribute('content') ||
                          document.querySelector('meta[property="og:price:amount"]')?.getAttribute('content') ||
                          document.querySelector('[itemprop="price"]')?.getAttribute('content');
        if (metaPrice && !isNaN(parseFloat(metaPrice)) && parseFloat(metaPrice) > 0.50) {
            price = parseFloat(metaPrice).toFixed(2);
        }
    }

    // Tier 4: Fallback to scanning product header elements for dollar values (strictly excluding strikethroughs)
    if (price === '0.00') {
        const headerArea = document.querySelector('main, [class*="goods-detail"], [class*="detail-header"]') || document.body;
        const priceSpans = headerArea.querySelectorAll('span, div, p');
        for (const el of priceSpans) {
            if (el.children && el.children.length > 0) continue;
            if (isStrikethroughOrOriginal(el)) continue;
            const match = (el.innerText || el.textContent || '').match(/^\$?\s*([0-9]+\.[0-9]{2})$/);
            if (match) {
                const val = parseFloat(match[1]);
                if (val >= 0.50 && val < 5000) {
                    price = val.toFixed(2);
                    break;
                }
            }
        }
    }

    // 4. Variations Extraction
    const variations = [];
    let selectedVariationStr = '';

    try {
        const knownLabels = ['color', 'size', 'style', 'model', 'specification', 'type', 'pattern'];
        const groupElements = [];

        const variantContainers = document.querySelectorAll('[class*="skuProp"], [class*="sku-prop"], [class*="spec-prop"], [data-testid*="sku"]');
        variantContainers.forEach(c => groupElements.push(c));

        if (groupElements.length === 0) {
            const allHeadings = document.querySelectorAll('div, span, p, h3, h4');
            allHeadings.forEach(h => {
                if (h.children && h.children.length > 2) return;
                const txt = (h.innerText || h.textContent || '').trim().toLowerCase();
                if (knownLabels.includes(txt) && !h.closest('footer, nav, [class*="review"], [class*="comment"]')) {
                    const parent = h.parentElement;
                    if (parent && !groupElements.includes(parent)) {
                        groupElements.push(parent);
                    }
                }
            });
        }

        const selectedParts = [];

        groupElements.forEach(group => {
            let groupName = '';
            const labelEl = group.querySelector('[class*="title"], [class*="name"], [class*="label"], h3, h4, span');
            if (labelEl) {
                const t = (labelEl.innerText || labelEl.textContent || '').trim();
                const matched = knownLabels.find(l => t.toLowerCase().includes(l));
                groupName = matched ? matched.charAt(0).toUpperCase() + matched.slice(1) : t.split('\n')[0].replace(/[:：]/g, '').trim();
            }
            if (!groupName || groupName.length > 20) groupName = 'Option';

            const optionEls = group.querySelectorAll('button, [role="radio"], [class*="item"], [class*="btn"], [class*="sku"], [class*="spec"]');
            const options = [];
            let groupSelected = '';

            optionEls.forEach(opt => {
                if (opt.closest('button, [role="radio"]') && opt.closest('button, [role="radio"]') !== opt) return;
                let optText = (opt.getAttribute('title') || opt.getAttribute('aria-label') || opt.innerText || opt.textContent || '').trim();
                optText = optText.replace(/\b(HOT|SALE|\d+%\s*OFF)\b/gi, '').replace(/\s+/g, ' ').trim();
                if (!optText || optText.length > 30) return;

                if (!options.includes(optText)) {
                    options.push(optText);
                }

                const isSelected = opt.getAttribute('aria-checked') === 'true' || 
                                   opt.getAttribute('aria-selected') === 'true' ||
                                   opt.className.includes('selected') ||
                                   opt.className.includes('active') ||
                                   opt.className.includes('checked') ||
                                   opt.querySelector('svg, [class*="check"], [class*="selected"]');
                if (isSelected && !groupSelected) {
                    groupSelected = optText;
                }
            });

            if (options.length > 0) {
                if (!groupSelected) groupSelected = options[0];
                selectedParts.push(groupSelected);
                variations.push({
                    name: groupName,
                    options: options,
                    selected: groupSelected
                });
            }
        });

        if (selectedParts.length > 0) {
            selectedVariationStr = selectedParts.join(' / ');
        }
    } catch (e) {
        console.warn('Error extracting Temu variations:', e);
    }

    // 5. Brand / Seller
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
            return src.replace(/imageView2\/.*$/i, 'imageView2/2/w/1000/q/90/format/jpg');
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
        variations: variations,
        selectedVariation: selectedVariationStr,
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
