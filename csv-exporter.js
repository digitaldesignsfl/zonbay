const fs = require('fs');
const path = require('path');
const { appendHistory } = require('./logger');
const {
    generateEbayCsvString,
    convertProductToCsvRow,
    escapeCsvField: escapeCsvValue
} = require('./exporters/ebay-csv');

const READY_PRODUCT_PATH = path.join(__dirname, 'ebay_ready_product.json');
const FINAL_PACKAGE_PATH = path.join(__dirname, 'ebay_final_api_ready.json');

/**
 * Generates an official eBay Seller Hub upload-ready CSV string
 * Delegates row construction to exporters/ebay-csv.js (single source of truth)
 * @param {Object|Array} products - Single product or array of products
 * @param {Object} [optionalRawData]
 * @returns {string} Complete CSV string with eBay headers
 */
function generateEbaySellerHubCsv(products, optionalRawData = null) {
    const productList = Array.isArray(products) ? products : [products];
    const raw = optionalRawData || (fs.existsSync(READY_PRODUCT_PATH) ? JSON.parse(fs.readFileSync(READY_PRODUCT_PATH, 'utf8')) : {});

    const mergedList = productList.map(prod => ({
        ...raw,
        ...prod,
        // Ensure productSpecs and itemSpecifics format compatibility
        productSpecs: prod.productSpecs || (Array.isArray(prod.itemSpecifics) 
            ? prod.itemSpecifics.reduce((acc, s) => { acc[s.name] = s.value; return acc; }, {}) 
            : (raw.productSpecs || {}))
    }));

    const csvOutput = generateEbayCsvString(mergedList);

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
