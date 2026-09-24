const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log("🧪 Testing Interactive Variation Selection & Financial Shipping Math...\n");

const html = fs.readFileSync(path.join(__dirname, 'popup.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, 'popup.js'), 'utf8');

let passed = 0;
let failed = 0;

function assert(desc, condition) {
    if (condition) {
        console.log(`  ✅ PASS: ${desc}`);
        passed++;
    } else {
        console.error(`  ❌ FAIL: ${desc}`);
        failed++;
    }
}

// 1. Verify HTML Structure
assert("popup.html defines .var-pill and .var-pill.selected styles", html.includes('.var-pill') && html.includes('.var-pill.selected'));
assert("popup.html has shippingCostInput with default 4.85", html.includes('id="shippingCostInput"') && html.includes('value="4.85"'));
assert("popup.html has USPS Shipping label in price-calculator", html.includes('USPS Shipping (Ground Adv)'));

// 2. Build lightweight DOM Environment
class MockElement {
    constructor(id = '', tag = 'div') {
        this.id = id;
        this.tagName = tag.toUpperCase();
        this.attributes = {};
        this.listeners = {};
        this.children = [];
        this.value = '';
        this.innerText = '';
        this._innerHTML = '';
        this.style = {};
        this.classList = {
            _classes: new Set(),
            add: (c) => this.classList._classes.add(c),
            remove: (c) => this.classList._classes.delete(c),
            contains: (c) => this.classList._classes.has(c)
        };
    }

    getAttribute(name) {
        return this.attributes[name] || null;
    }

    setAttribute(name, val) {
        this.attributes[name] = val;
    }

    addEventListener(event, fn) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(fn);
    }

    dispatchEvent(event) {
        const type = typeof event === 'string' ? event : event.type;
        if (this.listeners[type]) {
            this.listeners[type].forEach(fn => fn(event));
        }
    }

    click() {
        this.dispatchEvent({ type: 'click', preventDefault: () => {} });
    }

    focus() {
        mockDoc.activeElement = this;
    }

    set innerHTML(htmlStr) {
        this._innerHTML = htmlStr;
        this.children = [];
        const btnRegex = /<button\s+([^>]+)>([\s\S]*?)<\/button>/gi;
        let match;
        while ((match = btnRegex.exec(htmlStr)) !== null) {
            const attrStr = match[1];
            const content = match[2];
            const btn = new MockElement('', 'button');
            btn.innerText = content.replace(/<[^>]+>/g, '').trim();

            const classMatch = attrStr.match(/class=["']([^"']+)["']/i);
            if (classMatch) {
                classMatch[1].split(/\s+/).forEach(c => btn.classList.add(c));
            }
            const grpMatch = attrStr.match(/data-group=["']([^"']+)["']/i);
            if (grpMatch) btn.setAttribute('data-group', grpMatch[1]);
            const valMatch = attrStr.match(/data-value=["']([^"']+)["']/i);
            if (valMatch) btn.setAttribute('data-value', valMatch[1]);

            this.children.push(btn);
        }
    }

    get innerHTML() {
        return this._innerHTML;
    }

    querySelectorAll(selector) {
        if (selector === '.var-pill') {
            return this.children.filter(c => c.classList.contains('var-pill'));
        }
        return [];
    }
}

const elements = {};
function getOrCreate(id, tag = 'div') {
    if (!elements[id]) {
        elements[id] = new MockElement(id, tag);
    }
    return elements[id];
}

// Pre-create needed elements from popup.html
const ids = [
    'statusMessage', 'titleCounter', 'listingTitle', 'marginPercent', 'listingPrice',
    'estEbayFee', 'estNetProfit', 'listingCategory', 'customCategoryId', 'popupLogisticsBox',
    'popupOriginTitle', 'popupOriginDesc', 'popupHandlingBadge', 'productPreview',
    'previewImg', 'previewBrand', 'previewImgCount', 'sourcePriceInput', 'variationsBox',
    'varCountText', 'varSelectedBadge', 'varListDisplay', 'shippingCostInput'
];
ids.forEach(id => getOrCreate(id));

getOrCreate('marginPercent', 'select').value = '40';
getOrCreate('shippingCostInput', 'input').value = '4.85';
getOrCreate('listingPrice', 'input').value = '';
getOrCreate('listingCategory', 'select').value = '67779';

const mockDoc = {
    getElementById: (id) => getOrCreate(id),
    activeElement: null,
    addEventListener: () => {}
};

const sandbox = {
    document: mockDoc,
    window: {
        document: mockDoc,
        addEventListener: () => {}
    },
    chrome: {
        tabs: {
            query: async () => [{ id: 1, url: 'https://www.temu.com/goods-1234567.html' }],
            create: () => {}
        },
        storage: {
            local: {
                get: async () => ({}),
                set: async () => ({})
            }
        },
        scripting: {
            executeScript: async () => [{ result: null }]
        }
    },
    console: console,
    parseFloat: parseFloat,
    parseInt: parseInt,
    isNaN: isNaN,
    Date: Date,
    String: String,
    Array: Array,
    Object: Object,
    setTimeout: (fn) => setTimeout(fn, 10),
    clearTimeout: clearTimeout,
    fetch: async () => ({ ok: true, json: async () => ({}) })
};

vm.createContext(sandbox);
vm.runInContext(js, sandbox);

// 3. Test Variation Selection in GUI
const mockProduct = {
    source: 'temu',
    sourceId: '1234567',
    title: '8-Inch Shower Head Stainless Steel',
    price: '10.66',
    variations: [
        { name: 'Color', options: ['Chrome', 'Black'], selected: 'Chrome' },
        { name: 'Size', options: ['8Inch-A', '10inch', '12inch'], selected: '8Inch-A' }
    ],
    selectedVariation: 'Chrome / 8Inch-A',
    productSpecs: { 'Color': 'Chrome', 'Size': '8Inch-A' }
};

sandbox.renderProductDataInPopup(mockProduct);

const varBadge = getOrCreate('varSelectedBadge');
assert("Initial variation badge shows Chrome / 8Inch-A", varBadge.innerText.includes('Chrome / 8Inch-A'));

const varList = getOrCreate('varListDisplay');
const pills = varList.querySelectorAll('.var-pill');
assert("Renders all 5 variation option pills as interactive buttons", pills.length === 5);

const chromeBtn = pills.find(p => p.getAttribute('data-value') === 'Chrome');
const blackBtn = pills.find(p => p.getAttribute('data-value') === 'Black');
assert("Chrome pill is selected initially", chromeBtn.classList.contains('selected'));
assert("Black pill is not selected initially", !blackBtn.classList.contains('selected'));

// User clicks "Black" pill directly in the extension GUI
blackBtn.click();

const prod = sandbox.window.getCurrentProduct();
assert("Black pill becomes selected after click", blackBtn.classList.contains('selected'));
assert("Chrome pill is deselected after click", !chromeBtn.classList.contains('selected'));
assert("Badge updates to Selected: Black / 8Inch-A", varBadge.innerText.includes('Black / 8Inch-A'));
assert("currentProduct.selectedVariation updated to Black / 8Inch-A", prod.selectedVariation === 'Black / 8Inch-A');
assert("currentProduct.productSpecs.Color updated to Black", prod.productSpecs.Color === 'Black');

// User clicks "10inch" size pill in GUI
const tenInchBtn = pills.find(p => p.getAttribute('data-value') === '10inch');
tenInchBtn.click();

const prodAfterSize = sandbox.window.getCurrentProduct();
assert("Badge updates to Selected: Black / 10inch", varBadge.innerText.includes('Black / 10inch'));
assert("currentProduct.selectedVariation updated to Black / 10inch", prodAfterSize.selectedVariation === 'Black / 10inch');
assert("currentProduct.productSpecs.Size updated to 10inch", prodAfterSize.productSpecs.Size === '10inch');

// 4. Test Financial Math with USPS Ground Advantage
// Source Cost: $10.66
// Margin: 40% (+40%)
// USPS Shipping: $4.85
// Marked up cost: 10.66 * 1.40 = 14.924 -> 14.92
// Suggested listing price: 14.92 + 4.85 = 19.77
const listingPriceInput = getOrCreate('listingPrice');
const estFeeEl = getOrCreate('estEbayFee');
const estProfitEl = getOrCreate('estNetProfit');

assert("Suggested listing price includes USPS shipping ($19.77)", listingPriceInput.value === '19.77');
assert("eBay fee calculated accurately (-$2.92)", estFeeEl.innerText === '-$2.92');
assert("Net profit calculated accurately factoring out USPS shipping (+$1.34)", estProfitEl.innerText === '+$1.34');
assert("Net profit is positive green", estProfitEl.style.color === '#28a745');

// 5. Test Margin Change
// Change to 50% margin
const marginSelect = getOrCreate('marginPercent');
marginSelect.value = '50';
listingPriceInput.value = ''; // simulated reset
sandbox.calculatePricing();

// 10.66 * 1.50 = 15.99 + 4.85 = 20.84
assert("Suggested price updates with 50% margin ($20.84)", listingPriceInput.value === '20.84');
// Fee: 20.84 * 0.1325 + 0.30 = 3.06
assert("eBay fee updates (-$3.06)", estFeeEl.innerText === '-$3.06');
// Profit: 20.84 - 10.66 - 4.85 - 3.06 = +$2.27
assert("Net profit updates with 50% margin (+$2.27)", estProfitEl.innerText === '+$2.27');

// 6. Test Manual Shipping Cost Override
// User edits USPS shipping to $5.50
const shippingInput = getOrCreate('shippingCostInput');
shippingInput.value = '5.50';
listingPriceInput.value = ''; // simulated reset
sandbox.calculatePricing();

// 10.66 * 1.50 = 15.99 + 5.50 = 21.49
assert("Suggested price updates with custom shipping cost ($21.49)", listingPriceInput.value === '21.49');

// 7. Test Manual Listing Price Override
// User types $25.00 manually
mockDoc.activeElement = listingPriceInput;
listingPriceInput.value = '25.00';
sandbox.calculatePricing();

// Fee: 25.00 * 0.1325 + 0.30 = 3.61
// Total Cost: 10.66 + 5.50 + 3.61 = 19.77
// Profit: 25.00 - 19.77 = +$5.23
assert("Manual listing price is preserved at $25.00", listingPriceInput.value === '25.00');
assert("eBay fee recalculates for manual price (-$3.61)", estFeeEl.innerText === '-$3.61');
assert("Net profit recalculates for manual price (+$5.23)", estProfitEl.innerText === '+$5.23');

console.log(`\n📊 Variation & Financial Math Test Summary: ${passed} Passed, ${failed} Failed`);
if (failed > 0) process.exit(1);
