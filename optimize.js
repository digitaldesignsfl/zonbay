const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { appendHistory } = require('./logger');

const READY_PRODUCT_PATH = path.join(__dirname, 'ebay_ready_product.json');
const OPTIMIZED_PACKAGE_PATH = path.join(__dirname, 'ebay_optimized_package.json');

async function downloadImages(imageUrls = [], folderName = 'item') {
    const downloadFolder = path.join(__dirname, 'downloads', folderName);
    if (!fs.existsSync(downloadFolder)) { fs.mkdirSync(downloadFolder, { recursive: true }); }
    const localPaths = [];
    for (let i = 0; i < imageUrls.length; i++) {
        try {
            const url = imageUrls[i];
            if (!url || typeof url !== 'string' || !url.startsWith('http')) continue;
            const response = await axios({ url, responseType: 'stream', timeout: 10000 });
            const fileName = `image_${i + 1}.jpg`;
            const filePath = path.join(downloadFolder, fileName);
            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);
            await new Promise((resolve, reject) => { writer.on('finish', resolve); writer.on('error', reject); });
            localPaths.push(filePath);
        } catch (error) { console.error(`Image download error (${imageUrls[i]}):`, error.message); }
    }
    return localPaths;
}

function optimizeTitle(rawTitle = '', specs = {}) {
    const stopWords = ['with', 'for', 'the', 'a', 'an', 'and', 'of', 'by', 'brand', 'new', 'in', 'box', 'excellent', 'generic'];
    let cleanTitle = String(rawTitle).replace(/[^a-zA-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    let words = cleanTitle.split(' ').filter(Boolean);
    let uniqueWords = [];
    words.forEach(word => {
        const lowerWord = word.toLowerCase();
        if (stopWords.includes(lowerWord)) return;
        if (!uniqueWords.some(w => w.toLowerCase() === lowerWord)) { uniqueWords.push(word); }
    });

    // Apply relevant booster keywords based on product classification
    const lower = cleanTitle.toLowerCase();
    if (lower.includes('charger') || lower.includes('battery')) {
        const batteryBoosters = ['Smart', 'Maintainer', 'Trickle', 'Auto'];
        batteryBoosters.forEach(kw => {
            if (!uniqueWords.some(w => w.toLowerCase() === kw.toLowerCase())) {
                uniqueWords.push(kw);
            }
        });
    }

    let finalTitle = "";
    for (let word of uniqueWords) {
        if ((finalTitle + " " + word).trim().length <= 80) {
            finalTitle = (finalTitle + " " + word).trim();
        } else {
            break;
        }
    }
    return finalTitle || cleanTitle.substring(0, 80);
}

// Drops human readable names directly into your data package
function detectEbayCategory(titleText = '') {
    const text = String(titleText).toLowerCase();
    if (text.includes('charger') && text.includes('battery')) {
        return { id: '111422', name: 'Automotive Tools: Battery Chargers & Tenders' };
    }
    if (text.includes('pump') && text.includes('water')) {
        return { id: '180010', name: 'Plumbing: Water Pumps' };
    }
    if (text.includes('strip') || text.includes('surge') || text.includes('outlet')) {
        return { id: '20138', name: 'Consumer Electronics: Surge Protectors & Power Strips' };
    }
    return { id: '172008', name: 'Electronics: Consumer Electronics' };
}

function mapItemSpecifics(specs = {}) {
    const ebaySpecifics = [];
    const mappingGuide = { 'Brand': 'Brand', 'Item model number': 'MPN', 'Model Number': 'MPN', 'Color': 'Color' };
    for (const [amazonKey, value] of Object.entries(specs || {})) {
        const ebayKey = mappingGuide[amazonKey] || amazonKey;
        ebaySpecifics.push({ name: ebayKey, value: String(value) });
    }
    return ebaySpecifics;
}

function generateHtmlDescription(title, bullets = [], longDesc = '') {
    let bulletListhtml = (bullets || []).map(b => `<li>${b}</li>`).join('');
    return `<div style="font-family: Arial, sans-serif; padding: 20px;"><h1 style="color:#333;">${title}</h1>${bulletListhtml ? `<h3>Features</h3><ul>${bulletListhtml}</ul>` : ''}<h3>Description</h3><p>${longDesc || 'No extended description provided.'}</p></div>`;
}

async function processProduct() {
    if (!fs.existsSync(READY_PRODUCT_PATH)) {
        console.log("❌ No ebay_ready_product.json found.");
        return null;
    }
    const rawData = JSON.parse(fs.readFileSync(READY_PRODUCT_PATH, 'utf8'));
    const rawTitle = rawData.title || "Product";
    const folderId = rawTitle.substring(0, 10).replace(/[^a-zA-Z0-9]/g, "_") || "item";
    
    // Support alternateImages array or fallback to mainImgUrl
    let candidateImages = [];
    if (Array.isArray(rawData.alternateImages) && rawData.alternateImages.length > 0) {
        candidateImages = rawData.alternateImages;
    } else if (rawData.mainImgUrl) {
        candidateImages = [rawData.mainImgUrl];
    }

    const downloadedImages = await downloadImages(candidateImages, folderId);
    const optimizedTitle = optimizeTitle(rawTitle, rawData.productSpecs);
    const cat = detectEbayCategory(optimizedTitle);

    const optimizedPackage = {
        title: optimizedTitle,
        categoryId: cat.id,
        categoryName: cat.name,
        price: rawData.price ? String(rawData.price).replace(/[^0-9.]/g, '') : "0.00",
        itemSpecifics: mapItemSpecifics(rawData.productSpecs),
        htmlDescription: generateHtmlDescription(optimizedTitle, rawData.bulletPoints, rawData.longDescription),
        localImages: downloadedImages,
        shippingPolicy: { type: "Standard", handlingTimeDays: 3, cost: 0.00 },
        returnPolicy: { returnsAccepted: false },
        paymentPolicy: { requireInstantPayment: true }
    };

    fs.writeFileSync(OPTIMIZED_PACKAGE_PATH, JSON.stringify(optimizedPackage, null, 2));
    console.log("🚀 Optimization complete!");

    // Ledger update
    appendHistory('OPTIMIZED', {
        title: optimizedPackage.title,
        categoryId: optimizedPackage.categoryId,
        categoryName: optimizedPackage.categoryName,
        price: optimizedPackage.price,
        imagesCount: downloadedImages.length
    });

    return optimizedPackage;
}

if (require.main === module) {
    processProduct();
}

module.exports = {
    processProduct,
    optimizeTitle,
    detectEbayCategory,
    mapItemSpecifics,
    downloadImages,
    generateHtmlDescription
};
