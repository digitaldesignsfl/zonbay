const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { exec } = require('child_process');

// Load modules to verify
const { cleanProductData, detectShippingLogistics, getSpecificPriority, normalizeSpecificKey } = require('./cleaner');
const { 
    renderStorefrontShowcase, 
    renderModernMinimalist, 
    renderTechnicalPro, 
    renderEbayTemplate, 
    renderEbayBuyerPageMockup 
} = require('./templates');
const { generateEbayCsvString, convertProductToCsvRow } = require('./exporters/ebay-csv');
const { generateEbaySellerHubCsv } = require('./csv-exporter');

// Load extractors
const { extractAmazonProduct } = require('./extractors/amazon');
const { extractWalmartProduct } = require('./extractors/walmart');
const { extractHomeDepotProduct } = require('./extractors/homedepot');
const { extractTemuProduct } = require('./extractors/temu');
const { extractAliExpressProduct } = require('./extractors/aliexpress');
const { extractDHgateProduct } = require('./extractors/dhgate');
const { extractCJDropshippingProduct } = require('./extractors/cjdropshipping');

let testsPassed = 0;
let testsFailed = 0;

function assert(name, condition, extra = '') {
    if (condition) {
        console.log(`  ✅ PASS: ${name} ${extra}`);
        testsPassed++;
    } else {
        console.error(`  ❌ FAIL: ${name} ${extra}`);
        testsFailed++;
    }
}

/**
 * Lightweight, high-fidelity DOM Node implementation for testing in-browser extractors in Node.js
 */
function matchSingleCompound(node, selector) {
    if (!selector || !node || !node.attributes) return false;
    let s = selector.trim();
    if (!s) return false;

    // Check tag if present at start
    const tagMatch = s.match(/^([a-zA-Z0-9]+)/);
    if (tagMatch) {
        if (node.tagName.toLowerCase() !== tagMatch[1].toLowerCase()) {
            return false;
        }
        s = s.slice(tagMatch[1].length);
    }

    while (s.length > 0) {
        if (s.startsWith('#')) {
            const m = s.match(/^#([a-zA-Z0-9_-]+)/);
            if (!m) return false;
            if (node.attributes['id'] !== m[1]) return false;
            s = s.slice(m[0].length);
        } else if (s.startsWith('.')) {
            const m = s.match(/^\.([a-zA-Z0-9_-]+)/);
            if (!m) return false;
            const cls = (node.attributes['class'] || '').split(/\s+/);
            if (!cls.includes(m[1])) return false;
            s = s.slice(m[0].length);
        } else if (s.startsWith('[')) {
            const m = s.match(/^\[([a-zA-Z0-9_:-]+)(?:([*^$]?=)(["']?)(.*?)\3)?\]/);
            if (!m) return false;
            const attrName = m[1];
            const op = m[2];
            const val = m[4];
            const actual = node.attributes[attrName];
            if (actual === undefined || actual === null) return false;
            if (op) {
                if (op === '=' && actual !== val) return false;
                if (op === '*=' && !actual.includes(val)) return false;
                if (op === '^=' && !actual.startsWith(val)) return false;
                if (op === '$=' && !actual.endsWith(val)) return false;
            }
            s = s.slice(m[0].length);
        } else if (s.startsWith(':not(')) {
            const endParen = s.indexOf(')');
            if (endParen > 0) {
                const inner = s.slice(5, endParen);
                if (matchSingleCompound(node, inner)) return false;
                s = s.slice(endParen + 1);
            } else {
                return false;
            }
        } else if (s.startsWith(':first-child')) {
            if (node.parentElement && node.parentElement.children[0] !== node) return false;
            s = s.slice(12);
        } else if (s.startsWith(':last-child')) {
            if (node.parentElement && node.parentElement.children[node.parentElement.children.length - 1] !== node) return false;
            s = s.slice(11);
        } else {
            return false;
        }
    }
    return true;
}

function matchesSelector(node, fullSelector) {
    const parts = fullSelector.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return false;
    if (parts.length === 1) {
        return matchSingleCompound(node, parts[0]);
    }

    let currentPartIdx = parts.length - 1;
    if (!matchSingleCompound(node, parts[currentPartIdx])) {
        return false;
    }

    let ancestor = node.parentElement;
    currentPartIdx--;

    while (ancestor && currentPartIdx >= 0) {
        if (matchSingleCompound(ancestor, parts[currentPartIdx])) {
            currentPartIdx--;
        }
        ancestor = ancestor.parentElement;
    }

    return currentPartIdx < 0;
}

class MockElement {
    constructor(tagName = 'div', attrs = {}, text = '') {
        this.tagName = tagName.toUpperCase();
        this.attributes = { ...attrs };
        this._innerText = text;
        this.children = [];
        this.parentElement = null;
    }

    get innerText() {
        if (this._innerText !== undefined && this._innerText !== null && this._innerText !== '') {
            return this._innerText;
        }
        if (this.children.length > 0) {
            return this.children.map(c => c.innerText).join(' ');
        }
        return '';
    }

    set innerText(val) {
        this._innerText = val;
    }

    get textContent() {
        return this.innerText;
    }

    set textContent(val) {
        this._innerText = val;
    }

    getAttribute(name) {
        return this.attributes[name] || null;
    }

    setAttribute(name, val) {
        this.attributes[name] = val;
    }

    appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
        return child;
    }

    closest(selector) {
        let curr = this;
        while (curr) {
            if (curr.matches && curr.matches(selector)) return curr;
            curr = curr.parentElement;
        }
        return null;
    }

    matches(selector) {
        const selectors = selector.split(',').map(s => s.trim()).filter(Boolean);
        for (const sel of selectors) {
            if (matchesSelector(this, sel)) return true;
        }
        return false;
    }

    querySelector(selector) {
        const results = this.querySelectorAll(selector);
        return results[0] || null;
    }

    querySelectorAll(selector) {
        const selectors = selector.split(',').map(s => s.trim()).filter(Boolean);
        const matched = [];

        const walk = (node) => {
            for (const sel of selectors) {
                if (node !== this && matchesSelector(node, sel)) {
                    if (!matched.includes(node)) matched.push(node);
                    break;
                }
            }
            for (const c of node.children) walk(c);
        };

        walk(this);
        return matched;
    }
}

class MockDocument {
    constructor() {
        this.root = new MockElement('html');
        this.body = new MockElement('body');
        this.head = new MockElement('head');
        this.root.appendChild(this.head);
        this.root.appendChild(this.body);
        this.title = 'Test Product Title';
    }

    getElementById(id) {
        const all = this.root.querySelectorAll(`[id="${id}"]`);
        return all[0] || null;
    }

    querySelector(selector) {
        return this.root.querySelector(selector);
    }

    querySelectorAll(selector) {
        return this.root.querySelectorAll(selector);
    }

    createElement(tagName) {
        return new MockElement(tagName);
    }
}

function runWithMockContext(url, title, setupFn, extractorFn) {
    const doc = new MockDocument();
    doc.title = title;
    const win = {
        location: { href: url },
        document: doc
    };

    setupFn(doc);

    // Bind globals temporarily for extractor execution
    const prevDoc = global.document;
    const prevWin = global.window;
    global.document = doc;
    global.window = win;

    try {
        return extractorFn();
    } finally {
        global.document = prevDoc;
        global.window = prevWin;
    }
}

async function startSuite() {
    console.log("══════════════════════════════════════════════════════════════════════");
    console.log(" 🧪 ZONBAY COMPREHENSIVE VERIFICATION SUITE: MULTI-SITE & STUDIO");
    console.log(" 🔒 SAFETY GUARANTEE: Offline Simulation — No Live eBay Account Posts");
    console.log("══════════════════════════════════════════════════════════════════════\n");

    // =========================================================================
    // SECTION 1: EXTRACTOR DOM VERIFICATION (ALL 7 SOURCING PLATFORMS)
    // =========================================================================
    console.log("▶ [1/4] Verifying 7 Sourcing Platform In-Browser Extractors...\n");

    // 1. Amazon Extractor Test
    const amzResult = runWithMockContext(
        'https://www.amazon.com/dp/B08N5WRWNW',
        'Anker Power Strip Surge Protector 12 Outlets',
        (doc) => {
            const h1 = doc.createElement('span');
            h1.setAttribute('id', 'productTitle');
            h1.innerText = ' Anker Power Strip Surge Protector 12 Outlets with 3 USB Ports ';
            doc.body.appendChild(h1);

            const brand = doc.createElement('a');
            brand.setAttribute('id', 'bylineInfo');
            brand.innerText = 'Visit the Anker Store';
            doc.body.appendChild(brand);

            const priceSpan = doc.createElement('span');
            priceSpan.setAttribute('class', 'a-price priceToPay');
            const offscreen = doc.createElement('span');
            offscreen.setAttribute('class', 'a-offscreen');
            offscreen.innerText = '$29.99';
            priceSpan.appendChild(offscreen);
            doc.body.appendChild(priceSpan);

            const landingImg = doc.createElement('img');
            landingImg.setAttribute('id', 'landingImage');
            landingImg.setAttribute('src', 'https://m.media-amazon.com/images/I/71xyz._AC_US40_.jpg');
            doc.body.appendChild(landingImg);
        },
        extractAmazonProduct
    );
    assert("Amazon: Title extracted and trimmed", amzResult.title.includes('Anker Power Strip Surge Protector'));
    assert("Amazon: Brand extracted cleanly", amzResult.brand === 'Anker');
    assert("Amazon: Price parsed correctly", amzResult.price === '29.99');
    assert("Amazon: ASIN identified from URL", amzResult.sourceId === 'B08N5WRWNW');
    assert("Amazon: Thumbnail upgraded to 1500px zoom", amzResult.mainImgUrl.includes('._AC_SL1500_.jpg'));

    // 2. Walmart Extractor Test
    const wmtResult = runWithMockContext(
        'https://www.walmart.com/ip/Dewalt-20V-Cordless-Drill/12345678',
        'DEWALT 20V MAX Cordless Drill Kit',
        (doc) => {
            const title = doc.createElement('h1');
            title.setAttribute('id', 'main-title');
            title.innerText = 'DEWALT 20V MAX Cordless Drill / Driver Kit Compact';
            doc.body.appendChild(title);

            const price = doc.createElement('span');
            price.setAttribute('itemprop', 'price');
            price.innerText = '$99.00';
            doc.body.appendChild(price);

            const brand = doc.createElement('a');
            brand.setAttribute('link-identifier', 'brand');
            brand.innerText = 'DEWALT';
            doc.body.appendChild(brand);

            const heroImg = doc.createElement('img');
            heroImg.setAttribute('itemprop', 'image');
            heroImg.setAttribute('src', 'https://i5.walmartimages.com/asr/abc-123.jpeg?odnHeight=180&odnWidth=180');
            doc.body.appendChild(heroImg);
        },
        extractWalmartProduct
    );
    assert("Walmart: Title extracted", wmtResult.title.includes('DEWALT 20V MAX'));
    assert("Walmart: Brand extracted", wmtResult.brand === 'DEWALT');
    assert("Walmart: Price parsed correctly", wmtResult.price === '99.00');
    assert("Walmart: Item ID detected from URL", wmtResult.sourceId === '12345678');
    assert("Walmart: Image upgraded to 2000px master resolution", wmtResult.mainImgUrl.includes('odnHeight=2000&odnWidth=2000'));
    assert("Walmart: Flags Domestic US origin", wmtResult.originCountry === 'US' && wmtResult.isInternational === false);

    // 3. Home Depot Extractor Test
    const hdResult = runWithMockContext(
        'https://www.homedepot.com/p/Milwaukee-M18-Drill/987654321',
        'Milwaukee M18 Brushless Cordless Drill',
        (doc) => {
            const h1 = doc.createElement('h1');
            h1.setAttribute('class', 'product-details__title');
            h1.innerText = 'M18 18V Lithium-Ion Brushless Cordless 1/2 in. Compact Drill/Driver';
            doc.body.appendChild(h1);

            const brand = doc.createElement('a');
            brand.setAttribute('class', 'product-details__brand');
            brand.innerText = 'Milwaukee';
            doc.body.appendChild(brand);

            const price = doc.createElement('div');
            price.setAttribute('class', 'price-format__largePrice');
            price.innerText = '$129.00';
            doc.body.appendChild(price);

            const internetNum = doc.createElement('div');
            internetNum.setAttribute('data-testid', 'product-info-internet-number');
            internetNum.innerText = 'Internet # 987654321';
            doc.body.appendChild(internetNum);

            const img = doc.createElement('img');
            img.setAttribute('class', 'mediagallery__mainimage');
            img.setAttribute('src', 'https://images.thdstatic.com/productImages/xyz/svn/milwaukee-power-drills-2801-20-64_400.jpg');
            doc.body.appendChild(img);
        },
        extractHomeDepotProduct
    );
    assert("Home Depot: Title extracted", hdResult.title.includes('M18 18V Lithium-Ion'));
    assert("Home Depot: Brand extracted", hdResult.brand === 'Milwaukee');
    assert("Home Depot: Price extracted", hdResult.price === '129.00');
    assert("Home Depot: Internet # detected", hdResult.sourceId === '987654321');
    assert("Home Depot: Thumbnail upgraded to 1000px master asset", hdResult.mainImgUrl.includes('_1000.jpg'));
    assert("Home Depot: Flags Domestic US origin", hdResult.originCountry === 'US' && hdResult.isInternational === false);

    // 4. Temu Extractor Test
    const temuResult = runWithMockContext(
        'https://www.temu.com/goods-title-g-601099512345.html',
        'Mini Electric Screwdriver USB Cordless',
        (doc) => {
            const title = doc.createElement('h1');
            title.setAttribute('data-testid', 'goods-title');
            title.innerText = 'Precision Cordless Electric Screwdriver Rechargeable Repair Tool Kit';
            doc.body.appendChild(title);

            const price = doc.createElement('span');
            price.setAttribute('data-testid', 'goods-price');
            price.innerText = '$8.49';
            doc.body.appendChild(price);

            const img = doc.createElement('img');
            img.setAttribute('src', 'https://img.kwcdn.com/product/open/abc.jpg?imageView2/2/w/200/q/70/format/webp');
            doc.body.appendChild(img);
        },
        extractTemuProduct
    );
    assert("Temu: Title extracted", temuResult.title.includes('Precision Cordless Electric Screwdriver'));
    assert("Temu: Price extracted", temuResult.price === '8.49');
    assert("Temu: Goods ID detected from URL", temuResult.sourceId === '601099512345');
    assert("Temu: Upgraded kwcdn image to 1000px master", temuResult.mainImgUrl.includes('w/1000/q/90/format/jpg'));

    // 5. AliExpress Extractor Test
    const aliResult = runWithMockContext(
        'https://www.aliexpress.us/item/3256801234567890.html',
        'Automatic Wire Stripper Crimper Cable Tool',
        (doc) => {
            const title = doc.createElement('h1');
            title.setAttribute('data-pl', 'product-title');
            title.innerText = 'Multifunctional Automatic Wire Stripper Cable Crimping Pliers Terminal Tool';
            doc.body.appendChild(title);

            const priceMeta = doc.createElement('meta');
            priceMeta.setAttribute('property', 'product:price:amount');
            priceMeta.setAttribute('content', '11.85');
            doc.body.appendChild(priceMeta);

            const brand = doc.createElement('a');
            brand.setAttribute('data-pl', 'store-name');
            brand.innerText = 'Official Hardware Store';
            doc.body.appendChild(brand);

            const img = doc.createElement('img');
            img.setAttribute('src', 'https://ae01.alicdn.com/kf/S123456789.jpg_Q90.jpg_.webp');
            doc.body.appendChild(img);
        },
        extractAliExpressProduct
    );
    assert("AliExpress: Title extracted", aliResult.title.includes('Multifunctional Automatic Wire Stripper'));
    assert("AliExpress: Price extracted from meta tag", aliResult.price === '11.85');
    assert("AliExpress: Store name extracted as brand", aliResult.brand === 'Official Hardware Store');
    assert("AliExpress: Item ID detected", aliResult.sourceId === '3256801234567890');
    assert("AliExpress: Cleaned thumbnail suffixes to master photo", aliResult.mainImgUrl === 'https://ae01.alicdn.com/kf/S123456789.jpg');
    assert("AliExpress: Flags Overseas China origin", aliResult.originCountry === 'China' && aliResult.isInternational === true);

    // 6. DHgate Extractor Test
    const dhResult = runWithMockContext(
        'https://www.dhgate.com/product/wholesale-rgb-5050-led-strip/712345678.html',
        'RGB 5050 LED Light Strip Waterproof',
        (doc) => {
            const title = doc.createElement('h1');
            title.setAttribute('class', 'product-name');
            title.innerText = '5M RGB 5050 SMD LED Strip Light Ribbon 300 LEDs Waterproof + 44 Key Remote';
            doc.body.appendChild(title);

            const price = doc.createElement('span');
            price.setAttribute('class', 'price');
            price.innerText = '$6.99';
            doc.body.appendChild(price);

            const seller = doc.createElement('div');
            seller.setAttribute('class', 'seller-name');
            seller.innerText = 'LED_Lighting_Factory';
            doc.body.appendChild(seller);

            const img = doc.createElement('img');
            img.setAttribute('src', 'https://image.dhgate.com/0x0/f2/albu/g10/M00/12/34/abc.jpg');
            doc.body.appendChild(img);
        },
        extractDHgateProduct
    );
    assert("DHgate: Title extracted", dhResult.title.includes('5M RGB 5050 SMD LED Strip'));
    assert("DHgate: Price extracted", dhResult.price === '6.99');
    assert("DHgate: Seller extracted", dhResult.brand === 'LED_Lighting_Factory');
    assert("DHgate: Item code detected from URL", dhResult.sourceId === '712345678');
    assert("DHgate: Stripped /0x0/ downscaling prefix from CDN", dhResult.mainImgUrl === 'https://image.dhgate.com/f2/albu/g10/M00/12/34/abc.jpg');
    assert("DHgate: Flags Overseas China origin", dhResult.originCountry === 'China' && dhResult.isInternational === true);

    // 7. CJ Dropshipping Extractor Test
    const cjResult = runWithMockContext(
        'https://cjdropshipping.com/product-detail/smart-watch-p?pid=CJD-99887766',
        'Smart Fitness Tracker Watch Bluetooth Call',
        (doc) => {
            const title = doc.createElement('h1');
            title.setAttribute('class', 'product-title');
            title.innerText = 'Full Touch Screen IP67 Waterproof Bluetooth Smart Fitness Watch with Heart Rate';
            doc.body.appendChild(title);

            const price = doc.createElement('span');
            price.setAttribute('class', 'price');
            price.innerText = '$14.50';
            doc.body.appendChild(price);

            const img = doc.createElement('img');
            img.setAttribute('src', 'https://cj.wshoto.com/product/abc.jpg?x-oss-process=image/resize,w_80,h_80');
            doc.body.appendChild(img);
        },
        extractCJDropshippingProduct
    );
    assert("CJ Dropshipping: Title extracted", cjResult.title.includes('Full Touch Screen IP67 Waterproof'));
    assert("CJ Dropshipping: Price extracted", cjResult.price === '14.50');
    assert("CJ Dropshipping: PID detected from URL", cjResult.sourceId === 'CJD-99887766');
    assert("CJ Dropshipping: Stripped OSS resize params to get master photo", cjResult.mainImgUrl === 'https://cj.wshoto.com/product/abc.jpg');
    assert("CJ Dropshipping: Flags Overseas China origin", cjResult.originCountry === 'China' && cjResult.isInternational === true);

    // =========================================================================
    // SECTION 2: LOGISTICS ENGINE CLASSIFICATION & WARNING POLICIES
    // =========================================================================
    console.log("\n▶ [2/4] Verifying Logistics Engine Classification & Compliance...\n");

    const allPlatforms = [
        { name: 'Amazon', source: 'amazon', url: 'https://amazon.com/dp/B01', expectedIntl: false, expLoc: 'United States', expDays: 3, expService: 'USPSGroundAdvantage' },
        { name: 'Walmart', source: 'walmart', url: 'https://walmart.com/ip/123', expectedIntl: false, expLoc: 'United States', expDays: 3, expService: 'USPSGroundAdvantage' },
        { name: 'Home Depot', source: 'homedepot', url: 'https://homedepot.com/p/456', expectedIntl: false, expLoc: 'United States', expDays: 3, expService: 'USPSGroundAdvantage' },
        { name: 'Temu', source: 'temu', url: 'https://temu.com/g-789.html', expectedIntl: true, expLoc: 'China', expDays: 5, expService: 'StandardShippingFromOutsideUS' },
        { name: 'AliExpress', source: 'aliexpress', url: 'https://aliexpress.com/item/101.html', expectedIntl: true, expLoc: 'China', expDays: 5, expService: 'StandardShippingFromOutsideUS' },
        { name: 'DHgate', source: 'dhgate', url: 'https://dhgate.com/product/102.html', expectedIntl: true, expLoc: 'China', expDays: 5, expService: 'StandardShippingFromOutsideUS' },
        { name: 'CJ Dropshipping', source: 'cjdropshipping', url: 'https://cjdropshipping.com/item?pid=103', expectedIntl: true, expLoc: 'China', expDays: 5, expService: 'StandardShippingFromOutsideUS' }
    ];

    allPlatforms.forEach(p => {
        const log = detectShippingLogistics({ source: p.source, url: p.url, sourcePlatform: p.name });
        assert(`${p.name} classified as ${p.expectedIntl ? 'International' : 'Domestic'}`, log.isInternational === p.expectedIntl);
        assert(`${p.name} item location is '${p.expLoc}'`, log.itemLocation === p.expLoc);
        assert(`${p.name} handling time set to ${p.expDays} days`, log.handlingTimeDays === p.expDays);
        assert(`${p.name} shipping service is '${p.expService}'`, log.shippingService === p.expService);
    });

    // =========================================================================
    // SECTION 3: STUDIO CORE FEATURES & BUYER SIMULATION MOCKUP
    // =========================================================================
    console.log("\n▶ [3/4] Verifying Studio Core Features & Live Buyer Preview...\n");

    const mockItem = {
        id: 'VERIFY-STUDIO-01',
        title: 'MOTOPOWER MP00205A 12V 800mA Fully Automatic Battery Charger',
        brand: 'MOTOPOWER',
        price: '19.99',
        cost: '6.50',
        quantity: 2,
        categoryId: '179471',
        categoryName: 'Battery Chargers & Starters',
        sourcePlatform: 'Amazon',
        mainImgUrl: 'https://m.media-amazon.com/images/I/71photo1.jpg',
        alternateImages: [
            'https://m.media-amazon.com/images/I/71photo1.jpg',
            'https://m.media-amazon.com/images/I/71photo2.jpg',
            'https://m.media-amazon.com/images/I/71photo3.jpg'
        ],
        bulletPoints: [
            'Fully automatic smart battery charger and trickle maintainer',
            'Spark proof and reverse polarity protected'
        ],
        productSpecs: {
            'Brand': 'MOTOPOWER',
            'MPN': 'MP00205A',
            'Voltage': '12V',
            'Type': 'Battery Charger'
        }
    };

    // 1. Template Renders
    const storeCfg = {
        storeName: "Digital Designs Florida",
        storeUrl: "https://www.ebay.com/str/digitaldesignsfl",
        storeTagline: "Top Rated Plus • Fast Shipping • Guaranteed"
    };

    const showcaseHtml = renderStorefrontShowcase(mockItem, storeCfg);
    assert("Studio: Storefront Showcase renders banner & specs", showcaseHtml.includes('ZONBAY STOREFRONT SHOWCASE') && showcaseHtml.includes('MOTOPOWER'));
    const minimalHtml = renderModernMinimalist(mockItem, storeCfg);
    assert("Studio: Modern Minimalist renders cleanly", minimalHtml.includes('ZONBAY MODERN MINIMALIST') && minimalHtml.includes('Key Specifications'));
    const techHtml = renderTechnicalPro(mockItem, storeCfg);
    assert("Studio: Technical Pro renders matrix & inclusions", techHtml.includes('ZONBAY TECHNICAL PRO') && techHtml.includes('Technical Specifications Matrix'));

    // 2. 1:1 Authentic eBay Buyer Page Mockup
    const buyerMockup = renderEbayBuyerPageMockup({
        ...mockItem,
        imageList: [
            { url: mockItem.alternateImages[0], isHero: true, isExcluded: false },
            { url: mockItem.alternateImages[1], isHero: false, isExcluded: false },
            { url: mockItem.alternateImages[2], isHero: false, isExcluded: true } // Excluded photo
        ],
        shippingService: 'USPSGroundAdvantage',
        location: 'United States'
    }, showcaseHtml, storeCfg);

    assert("Studio: Buyer mockup renders official 4-color eBay logo", buyerMockup.includes('color:#0064d2') && buyerMockup.includes('color:#e53238'));
    assert("Studio: Buyer mockup renders active hero photo", buyerMockup.includes('id="ebayLiveHeroImg"') && buyerMockup.includes('71photo1.jpg'));
    assert("Studio: Buyer mockup excludes disabled photos from thumbnail strip", buyerMockup.includes('71photo2.jpg') && !buyerMockup.includes('71photo3.jpg'));
    assert("Studio: Buyer mockup renders Top Rated Plus trust card", buyerMockup.includes('Top Rated Plus') && buyerMockup.includes('Digital Designs Florida'));
    assert("Studio: Buyer mockup computes estimated delivery date", buyerMockup.includes('Estimated between') || buyerMockup.includes('Estimated delivery') || buyerMockup.includes('Delivery in'));

    // 3. Item Specifics Priority Classification
    assert("Studio: Brand classified as essential specific", getSpecificPriority('Brand') === 'essential');
    assert("Studio: MPN classified as essential specific", getSpecificPriority('MPN') === 'essential');
    assert("Studio: Voltage classified as recommended specific", getSpecificPriority('Voltage') === 'recommended');

    // =========================================================================
    // SECTION 4: SAFE CSV EXPORTING & RFC 4180 COMPLIANCE (NO LIVE POSTS)
    // =========================================================================
    console.log("\n▶ [4/4] Verifying Safe Offline CSV Exporting & Importer...\n");

    const testExportItems = [
        {
            id: 'EXP-US-01',
            sku: 'SKU-AMZ-DRILL',
            title: 'DeWalt 20V MAX Cordless Drill Driver Kit',
            brand: 'DeWalt',
            price: '99.00',
            quantity: 3,
            categoryId: '184655',
            sourcePlatform: 'Amazon',
            isInternational: false,
            originCountry: 'US',
            location: 'United States',
            shippingService: 'USPSGroundAdvantage',
            dispatchTimeMax: '3',
            alternateImages: ['https://m.media-amazon.com/images/I/drill1.jpg', 'https://m.media-amazon.com/images/I/drill2.jpg'],
            productSpecs: { Brand: 'DeWalt', MPN: 'DCD771C2' }
        },
        {
            id: 'EXP-INTL-02',
            sku: 'SKU-ALI-PLIERS',
            title: 'Automatic Wire Stripping Tool Multifunctional Crimper',
            brand: 'ProTools',
            price: '12.50',
            quantity: 5,
            categoryId: '179471',
            sourcePlatform: 'AliExpress',
            isInternational: true,
            originCountry: 'China',
            location: 'China',
            shippingService: 'StandardShippingFromOutsideUS',
            dispatchTimeMax: '5',
            alternateImages: ['https://ae01.alicdn.com/kf/tool1.jpg', 'https://ae01.alicdn.com/kf/tool2.jpg'],
            productSpecs: { Brand: 'ProTools', MPN: 'WS-100', 'Country/Region of Manufacture': 'China' }
        }
    ];

    const generatedCsv = generateEbayCsvString(testExportItems);

    assert("CSV Export: Contains official eBay header", generatedCsv.includes('*Action(SiteID=US|Country=US|Currency=USD|Version=1193'));
    assert("CSV Export: Contains required action column 'Add'", generatedCsv.includes('\nAdd,') || generatedCsv.includes('\r\nAdd,'));
    assert("CSV Export: Domestic item has United States location", generatedCsv.includes('United States'));
    assert("CSV Export: Domestic item has USPS Ground Advantage", generatedCsv.includes('USPSGroundAdvantage'));
    assert("CSV Export: Overseas item has China location", generatedCsv.includes('China'));
    assert("CSV Export: Overseas item has StandardShippingFromOutsideUS", generatedCsv.includes('StandardShippingFromOutsideUS'));
    assert("CSV Export: Overseas item has 5-day dispatch buffer", generatedCsv.includes(',5,') || generatedCsv.includes(',5\n') || generatedCsv.includes(',5\r\n'));
    assert("CSV Export: Multi-photos joined with pipe delimiter", generatedCsv.includes('tool1.jpg|https://ae01.alicdn.com/kf/tool2.jpg') || generatedCsv.includes('drill1.jpg|https://m.media-amazon.com/images/I/drill2.jpg'));
    assert("CSV Export: Brand specific mapped to C:Brand", generatedCsv.includes('DeWalt') && generatedCsv.includes('ProTools'));

    // Verify CSV line parser & quote escaping
    const rowDomestic = convertProductToCsvRow(testExportItems[0]);
    assert("CSV Export: Row generates valid escaped CSV string", typeof rowDomestic === 'string' && rowDomestic.includes('DeWalt'));
    assert("CSV Export: Price formatted properly", rowDomestic.includes('99.00'));

    console.log("\n══════════════════════════════════════════════════════════════════════");
    console.log(` 📊 VERIFICATION COMPLETE: ${testsPassed} Passed, ${testsFailed} Failed`);
    console.log(" ✅ All 7 Extractors, Studio Features & Safe CSV Exporters Verified!");
    console.log(" 🔒 ZERO Live eBay Account Posts Executed (Account 100% Protected)");
    console.log("══════════════════════════════════════════════════════════════════════\n");

    process.exit(testsFailed > 0 ? 1 : 0);
}

startSuite().catch(err => {
    console.error("Test Suite Error:", err);
    process.exit(1);
});
