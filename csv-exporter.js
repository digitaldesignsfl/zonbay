const fs = require('fs');
const path = require('path');
const { appendHistory } = require('./logger');

const READY_PRODUCT_PATH = path.join(__dirname, 'ebay_ready_product.json');
const FINAL_PACKAGE_PATH = path.join(__dirname, 'ebay_final_api_ready.json');

/**
 * Escapes values according to RFC 4180 CSV specifications
 * Doubles any internal quotes and wraps in quotes if commas, quotes, or newlines exist.
 */
function escapeCsvValue(val) {
    if (val === null || val === undefined) return '';
    const str = String(val).trim();
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

/**
 * Extracts a specific aspect from itemSpecifics array or specs object
 */
function getSpecificValue(specifics, keyNames, defaultValue = '') {
    if (Array.isArray(specifics)) {
        for (const key of keyNames) {
            const found = specifics.find(s => s.name && s.name.toLowerCase() === key.toLowerCase());
            if (found && found.value) return found.value;
        }
    } else if (specifics && typeof specifics === 'object') {
        for (const key of keyNames) {
            const foundKey = Object.keys(specifics).find(k => k.toLowerCase() === key.toLowerCase());
            if (foundKey && specifics[foundKey]) return specifics[foundKey];
        }
    }
    return defaultValue;
}

/**
 * Determines the best public image URLs for eBay's picture ingestion
 * Prefers public internet URLs (e.g. Amazon CDN) over localhost URLs which eBay cannot reach.
 */
function resolvePublicImages(packageData, rawData = {}) {
    let images = [];

    // Check raw scraped data for live web CDN images
    if (Array.isArray(rawData.alternateImages) && rawData.alternateImages.length > 0) {
        images = rawData.alternateImages.filter(url => typeof url === 'string' && url.startsWith('http') && !url.includes('localhost'));
    }

    if (images.length === 0 && rawData.mainImgUrl && !rawData.mainImgUrl.includes('localhost')) {
        images = [rawData.mainImgUrl];
    }

    // Fallback to packageData imageUrls if no raw CDN links found
    if (images.length === 0 && Array.isArray(packageData.imageUrls)) {
        images = packageData.imageUrls;
    }

    return images.slice(0, 12).join('|');
}

/**
 * Converts a product object into a single row for eBay Seller Hub CSV
 */
function convertProductToCsvRow(packageData, rawData = {}) {
    const specifics = packageData.itemSpecifics || rawData.productSpecs || [];
    
    // Core details
    const action = 'Add';
    const sku = getSpecificValue(specifics, ['ASIN', 'SKU', 'MPN', 'Item model number'], `SKU-${Date.now()}`);
    const category = packageData.categoryId || '172008';
    const title = (packageData.title || rawData.title || 'Product').substring(0, 80);
    const conditionId = '1000'; // Brand New
    const brand = getSpecificValue(specifics, ['Brand', 'Manufacturer'], 'Unbranded');
    const mpn = getSpecificValue(specifics, ['MPN', 'Item model number', 'Model Number'], 'Does Not Apply');
    const type = getSpecificValue(specifics, ['Type', 'Product Type'], '');
    const model = getSpecificValue(specifics, ['Model', 'Item model number'], '');
    const color = getSpecificValue(specifics, ['Color'], '');
    const picUrl = resolvePublicImages(packageData, rawData);
    const description = packageData.htmlDescription || rawData.longDescription || `<p>${title}</p>`;
    const format = 'FixedPrice';
    const duration = 'GTC';
    const price = packageData.price ? String(packageData.price).replace(/[^0-9.]/g, '') : '0.00';
    const quantity = '1';
    const immediatePay = '1';
    const location = 'United States';
    const shippingType = 'Flat';
    const shippingService = 'USPSGroundAdvantage';
    const shippingCost = '0.00';
    const dispatchTime = packageData.shippingPolicy?.handlingTimeDays || 3;
    const returnsAccepted = packageData.returnPolicy?.returnsAccepted ? 'ReturnsAccepted' : 'ReturnsNotAccepted';

    const rowValues = [
        action,
        sku,
        category,
        title,
        conditionId,
        brand,
        mpn,
        type,
        model,
        color,
        picUrl,
        description,
        format,
        duration,
        price,
        quantity,
        immediatePay,
        location,
        shippingType,
        shippingService,
        shippingCost,
        dispatchTime,
        returnsAccepted
    ];

    return rowValues.map(escapeCsvValue).join(',');
}

/**
 * Generates an official eBay Seller Hub upload-ready CSV string
 * @param {Object|Array} products - Single product or array of products
 * @param {Object} [optionalRawData]
 * @returns {string} Complete CSV string with eBay headers
 */
function generateEbaySellerHubCsv(products, optionalRawData = null) {
    const headerColumns = [
        '*Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8)',
        'CustomLabel',
        '*Category',
        '*Title',
        '*ConditionID',
        '*C:Brand',
        '*C:MPN',
        'C:Type',
        'C:Model',
        'C:Color',
        'PicURL',
        '*Description',
        '*Format',
        '*Duration',
        '*StartPrice',
        '*Quantity',
        'ImmediatePayRequired',
        '*Location',
        'ShippingType',
        'ShippingService-1:Option',
        'ShippingService-1:Cost',
        '*DispatchTimeMax',
        '*ReturnsAcceptedOption'
    ];

    const productList = Array.isArray(products) ? products : [products];
    const rows = [headerColumns.join(',')];

    for (const prod of productList) {
        const raw = optionalRawData || (fs.existsSync(READY_PRODUCT_PATH) ? JSON.parse(fs.readFileSync(READY_PRODUCT_PATH, 'utf8')) : {});
        rows.push(convertProductToCsvRow(prod, raw));
    }

    const csvOutput = rows.join('\r\n');

    // Ledger update
    appendHistory('CSV_EXPORT', {
        exportedCount: productList.length,
        firstItemTitle: productList[0]?.title || 'Unknown'
    });

    return csvOutput;
}

/**
 * Generates CSV from the current local product files
 */
function exportCurrentListingCsv() {
    let packageData = {};
    let rawData = {};

    if (fs.existsSync(FINAL_PACKAGE_PATH)) {
        packageData = JSON.parse(fs.readFileSync(FINAL_PACKAGE_PATH, 'utf8'));
    }
    if (fs.existsSync(READY_PRODUCT_PATH)) {
        rawData = JSON.parse(fs.readFileSync(READY_PRODUCT_PATH, 'utf8'));
    }

    if (!packageData.title && !rawData.title) {
        throw new Error("No product data available to export. Scrape or enter a product first.");
    }

    return generateEbaySellerHubCsv(packageData.title ? packageData : rawData, rawData);
}

module.exports = {
    generateEbaySellerHubCsv,
    convertProductToCsvRow,
    exportCurrentListingCsv,
    escapeCsvValue
};
