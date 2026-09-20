/**
 * Zonbay - Universal Listing Curator & Clutter Cleaner
 * Dual-environment module: Works in Node.js (CommonJS) and browser contexts.
 * Purges marketplace noise, ratings, scripts, and comparison tables, and standardizes eBay specifics.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.ZonbayCleaner = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    // Blacklisted Item Specifics keys that do NOT belong on eBay
    const BLACKLIST_KEYS = [
        'customer reviews',
        'customer review',
        'best sellers rank',
        'bestsellers rank',
        'date first available',
        'asin',
        'is discontinued by manufacturer',
        'discontinued by manufacturer',
        'manufacturer discontinued',
        'package dimensions',
        'package weight',
        'parcel dimensions',
        'domestic shipping',
        'international shipping',
        'item model number', // Re-mapped to MPN
        'model number',      // Re-mapped to MPN
        'warranty',
        'warranty description',
        'customer service',
        'feedback',
        'seller notes',
        'amazon choice',
        'goods number',
        'supply chain'
    ];

    // Priority Taxonomy for eBay Item Specifics
    const ESSENTIAL_KEYS = [
        'brand',
        'mpn',
        'type',
        'model'
    ];

    const RECOMMENDED_KEYS = [
        'color',
        'colour',
        'voltage',
        'amperage',
        'wattage',
        'power source',
        'current rating',
        'material',
        'features',
        'compatible brand',
        'compatible model',
        'compatible devices',
        'connectivity',
        'country/region of manufacture',
        'item dimensions',
        'item length',
        'item width',
        'item height',
        'item weight',
        'size',
        'capacity',
        'battery technology',
        'number of outlets',
        'number of ports'
    ];

    // Promotional stop words for titles
    const TITLE_SPAM_WORDS = [
        'prime', 'hot sale', 'sale', 'new 2026', 'new 2025', '2026 upgrade', '2025 upgrade',
        'top rated', 'best quality', 'free shipping', '100% satisfaction', 'money back guarantee', 'wholesale',
        'hot deal', 'must have', 'high quality', 'authentic', 'genuine'
    ];

    function getSpecificPriority(key = '') {
        const clean = String(key).trim().toLowerCase();
        if (ESSENTIAL_KEYS.includes(clean)) return 'essential';
        if (RECOMMENDED_KEYS.includes(clean)) return 'recommended';
        return 'optional';
    }

    function normalizeSpecificKey(key = '') {
        const raw = String(key).trim();
        const lower = raw.toLowerCase();

        if (lower === 'item model number' || lower === 'model number' || lower === 'manufacturer part number' || lower === 'part number') {
            return 'MPN';
        }
        if (lower === 'brand' || lower === 'brand name' || lower === 'manufacturer') {
            return 'Brand';
        }
        if (lower === 'colour') {
            return 'Color';
        }
        if (lower === 'power source type') {
            return 'Power Source';
        }
        if (lower === 'item dimensions l x w x h' || lower === 'product dimensions' || lower === 'dimensions') {
            return 'Item Dimensions';
        }
        if (lower === 'built-in media' || lower === 'included components' || lower === 'package includes') {
            return 'Included Components';
        }
        if (lower === 'connector type used on cable' || lower === 'connector type') {
            return 'Connector Type';
        }
        if (lower === 'item weight' || lower === 'weight') {
            return 'Item Weight';
        }

        return raw.charAt(0).toUpperCase() + raw.slice(1);
    }

    function isCorruptedValue(val = '') {
        if (!val || typeof val !== 'string') return true;
        const str = val.toLowerCase();
        if (str.includes('var dpacr') || str.includes('p.when(') || str.includes('acrlink-click') || str.includes('script') || str.includes('function(')) {
            return true;
        }
        if (str.includes('out of 5 stars') && str.length > 50) {
            return true;
        }
        return false;
    }

    function cleanItemSpecifics(specs = {}, existingProduct = {}) {
        let rawEntries = [];
        if (Array.isArray(specs)) {
            rawEntries = specs.map(item => [item.name || item.key, item.value]);
        } else if (typeof specs === 'object' && specs !== null) {
            rawEntries = Object.entries(specs);
        }

        const cleanedMap = {};

        for (const [rawKey, rawVal] of rawEntries) {
            if (!rawKey || !rawVal) continue;
            const keyTrim = String(rawKey).trim();
            const keyLower = keyTrim.toLowerCase();

            if (BLACKLIST_KEYS.includes(keyLower)) {
                if ((keyLower.includes('model') || keyLower.includes('part number')) && !cleanedMap['MPN']) {
                    const normVal = String(rawVal).trim();
                    if (!isCorruptedValue(normVal)) {
                        cleanedMap['MPN'] = normVal;
                    }
                }
                continue;
            }

            const valTrim = String(rawVal).trim();
            if (isCorruptedValue(valTrim)) continue;

            const normKey = normalizeSpecificKey(keyTrim);
            if (!cleanedMap[normKey]) {
                cleanedMap[normKey] = valTrim;
            }
        }

        if (!cleanedMap['Brand']) {
            cleanedMap['Brand'] = existingProduct.brand || 'Unbranded';
        }

        if (!cleanedMap['MPN']) {
            const title = existingProduct.title || '';
            const modelMatch = title.match(/\b([A-Z0-9]{4,12}[A-Z0-9-]*)\b/);
            if (modelMatch && !['BATTERY', 'CHARGER', 'POWER', 'CORDLESS', 'USPS', 'SMART'].includes(modelMatch[1].toUpperCase())) {
                cleanedMap['MPN'] = modelMatch[1];
            } else {
                cleanedMap['MPN'] = 'Does Not Apply';
            }
        }

        if (!cleanedMap['Type']) {
            const t = (existingProduct.title || '').toLowerCase();
            if (t.includes('battery') && t.includes('charger')) cleanedMap['Type'] = 'Battery Charger & Maintainer';
            else if (t.includes('power strip') || t.includes('surge protector')) cleanedMap['Type'] = 'Power Strip & Surge Protector';
            else if (t.includes('drill') || t.includes('driver')) cleanedMap['Type'] = 'Cordless Drill';
            else if (t.includes('cable') || t.includes('cord')) cleanedMap['Type'] = 'Charging Cable';
            else if (t.includes('inverter')) cleanedMap['Type'] = 'Power Inverter';
        }

        if (!cleanedMap['Voltage']) {
            const vMatch = (existingProduct.title || '').match(/\b(\d{1,3}V(?:\s*DC|\s*AC)?)\b/i);
            if (vMatch) cleanedMap['Voltage'] = vMatch[1].toUpperCase();
        }

        return cleanedMap;
    }

    function cleanDescriptionText(rawDesc = '') {
        if (!rawDesc || typeof rawDesc !== 'string') return '';

        let desc = rawDesc;
        desc = desc.replace(/(?:Add to Cart|Buying Options|Customer Reviews \d(?:\.\d)? out of 5 stars)[^<]*/gi, '');
        desc = desc.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        desc = desc.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
        desc = desc.replace(/var dpAcrHasRegisteredArcLinkClickAction[\s\S]*?4\.5 out of 5 stars/gi, '');
        desc = desc.replace(/P\.when\('A', 'ready'\)[\s\S]*?\);/gi, '');
        desc = desc.replace(/Please contact us before leaving negative feedback[^.]*\./gi, '');
        desc = desc.replace(/100% money back guarantee[^.]*\./gi, '');
        desc = desc.replace(/\n\s*\n\s*\n/g, '\n\n').trim();

        return desc;
    }

    function cleanTitle(rawTitle = '') {
        if (!rawTitle || typeof rawTitle !== 'string') return 'Quality Item';

        let t = rawTitle;
        TITLE_SPAM_WORDS.forEach(w => {
            const re = new RegExp('\\b' + w + '\\b', 'gi');
            t = t.replace(re, '');
        });

        t = t.replace(/[\s,:;\-]+$/g, '');
        t = t.replace(/\s+(and|with|for|or)\s*$/i, '');
        t = t.replace(/\s+/g, ' ').trim();

        if (t.length > 80) {
            const cut = t.substring(0, 80);
            const lastSpace = cut.lastIndexOf(' ');
            t = (lastSpace > 40 ? cut.substring(0, lastSpace) : cut).trim();
        }

        return t;
    }

    function cleanBulletPoints(bullets = []) {
        if (!Array.isArray(bullets)) return [];
        return bullets
            .map(b => String(b).trim())
            .filter(b => {
                const lower = b.toLowerCase();
                if (lower.includes('money back guarantee')) return false;
                if (lower.includes('contact our 24/7')) return false;
                if (lower.includes('negative feedback')) return false;
                if (lower.includes('prime members')) return false;
                if (lower.includes('satisfaction guarantee')) return false;
                if (lower.length < 5) return false;
                return true;
            });
    }

    function cleanProductData(product = {}) {
        const cleanedSpecs = cleanItemSpecifics(product.productSpecs || {}, product);
        const cleanedBullets = cleanBulletPoints(product.bulletPoints || []);
        const cleanedDesc = cleanDescriptionText(product.longDescription || '');
        const cleanedTitleText = cleanTitle(product.title || '');

        return {
            ...product,
            title: cleanedTitleText,
            brand: cleanedSpecs['Brand'] || product.brand || 'Unbranded',
            bulletPoints: cleanedBullets,
            productSpecs: cleanedSpecs,
            longDescription: cleanedDesc
        };
    }

    /**
     * Detects supplier shipping origin and generates recommended eBay logistics settings.
     * International suppliers (e.g. Temu, AliExpress, DHgate) require extended handling time
     * and outside-US shipping services to comply with eBay policy and prevent late delivery defects.
     */
    function detectShippingLogistics(product = {}) {
        const source = String(product.source || product.sourcePlatform || '').toLowerCase();
        const url = String(product.url || product.sourceUrl || product.itemUrl || '').toLowerCase();
        const origin = String(product.originCountry || product.countryOfOrigin || '').toLowerCase();
        
        let specCountry = '';
        if (product.productSpecs && typeof product.productSpecs === 'object') {
            specCountry = String(
                product.productSpecs['Country/Region of Manufacture'] ||
                product.productSpecs['Country of Origin'] ||
                product.productSpecs['Origin'] || ''
            ).toLowerCase();
        }

        const isChinaSupplier = (
            source === 'temu' ||
            source === 'aliexpress' ||
            source === 'dhgate' ||
            source === 'cjdropshipping' ||
            source.includes('cj drop') ||
            source === 'shein' ||
            source === 'taobao' ||
            source === '1688' ||
            source === 'alibaba' ||
            url.includes('temu.com') ||
            url.includes('aliexpress.com') ||
            url.includes('aliexpress.us') ||
            url.includes('dhgate.com') ||
            url.includes('cjdropshipping.com') ||
            url.includes('shein.com') ||
            url.includes('taobao.com') ||
            url.includes('1688.com') ||
            url.includes('alibaba.com') ||
            origin === 'china' ||
            origin === 'cn' ||
            specCountry.includes('china')
        );

        if (isChinaSupplier) {
            const supplierLabel = product.sourcePlatform || product.source || 'China / Overseas';
            return {
                isInternational: true,
                originCountry: 'China',
                originCountryName: `China (${supplierLabel})`,
                handlingTimeDays: 5,
                shippingService: 'StandardShippingFromOutsideUS',
                shippingServiceName: 'Standard Shipping from Outside US (7-19 business days)',
                itemLocation: 'China',
                shippingCost: '0.00',
                shippingType: 'Flat',
                estimatedTransitDaysMin: 7,
                estimatedTransitDaysMax: 19,
                warningMessage: `International Origin Detected: Shipping from overseas supplier (${supplierLabel}). Extended handling time (5 business days) and outside-US shipping service have been auto-applied to prevent eBay late-delivery defects and comply with Item Location policy.`
            };
        }

        return {
            isInternational: false,
            originCountry: 'US',
            originCountryName: 'United States (Domestic)',
            handlingTimeDays: 3,
            shippingService: 'USPSGroundAdvantage',
            shippingServiceName: 'USPS Ground Advantage (2-5 business days)',
            itemLocation: 'United States',
            shippingCost: '0.00',
            shippingType: 'Flat',
            estimatedTransitDaysMin: 2,
            estimatedTransitDaysMax: 5,
            warningMessage: ''
        };
    }

    return {
        cleanItemSpecifics,
        cleanDescriptionText,
        cleanTitle,
        cleanBulletPoints,
        cleanProductData,
        detectShippingLogistics,
        getSpecificPriority,
        normalizeSpecificKey,
        isCorruptedValue,
        ESSENTIAL_KEYS,
        RECOMMENDED_KEYS,
        BLACKLIST_KEYS
    };
}));
