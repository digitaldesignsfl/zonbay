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

// Category IDs below are verified against eBay's live category browse pages (checked Sep 2026).
// Do NOT add new entries here without verifying the ID on ebay.com/b/... first — a wrong
// category ID can get a real listing suppressed or removed.
function detectEbayCategory(titleText = '') {
    const text = String(titleText).toLowerCase();
    if (text.includes('charger') && text.includes('battery')) {
        return { id: '179471', name: 'Automotive Battery Chargers', verified: true };
    }
    if (text.includes('strip') || text.includes('surge') || text.includes('outlet')) {
        return { id: '67779', name: 'Power Strips & Surge Protectors', verified: true };
    }
    if (text.includes('drill') || text.includes('driver') || (text.includes('cordless') && text.includes('kit'))) {
        return { id: '184655', name: 'Cordless Drills', verified: true };
    }
    // No confident match — flag for manual category selection instead of guessing.
    // Uploading with an unverified category ID risks listing suppression/removal.
    return { id: '', name: 'NEEDS_MANUAL_CATEGORY', verified: false };
}

const { cleanProductData } = require('./cleaner');
const { renderStorefrontShowcase } = require('./templates');

function mapItemSpecifics(specs = {}) {
    const cleaned = cleanProductData({ productSpecs: specs }).productSpecs;
    return Object.entries(cleaned).map(([name, value]) => ({ name, value: String(value) }));
}

function generateHtmlDescription(title, bullets = [], longDesc = '', specs = {}) {
    return renderStorefrontShowcase({
        title,
        bulletPoints: bullets,
        longDescription: longDesc,
        productSpecs: specs
    });
}

async function processProduct() {
    if (!fs.existsSync(READY_PRODUCT_PATH)) {
        console.log("❌ No ebay_ready_product.json found.");
        return null;
    }

    try {
        const rawContent = fs.readFileSync(READY_PRODUCT_PATH, 'utf8');
        let rawData;
        try {
            rawData = JSON.parse(rawContent);
        } catch (parseErr) {
            console.error("Failed to parse ready product JSON:", parseErr.message);
            appendHistory('ERROR', { source: 'optimize', message: `JSON parse error: ${parseErr.message}` });
            return null;
        }

        const cleaned = cleanProductData(rawData);
        const rawTitle = cleaned.title || "Product";
        const folderId = rawTitle.substring(0, 10).replace(/[^a-zA-Z0-9]/g, "_") || "item";
        
        // Support alternateImages array or fallback to mainImgUrl
        let candidateImages = [];
        if (Array.isArray(rawData.alternateImages) && rawData.alternateImages.length > 0) {
            candidateImages = rawData.alternateImages;
        } else if (rawData.mainImgUrl) {
            candidateImages = [rawData.mainImgUrl];
        }

        const downloadedImages = await downloadImages(candidateImages, folderId);
        const optimizedTitle = optimizeTitle(rawTitle, cleaned.productSpecs);
        const cat = detectEbayCategory(optimizedTitle);
        const htmlDesc = renderStorefrontShowcase({
            ...cleaned,
            title: optimizedTitle
        }, {
            storeName: rawData.storeName || 'Official Seller Store',
            storeUrl: rawData.storeUrl || 'https://www.ebay.com/usr'
        });

        const optimizedPackage = {
            title: optimizedTitle,
            categoryId: cat.id,
            categoryName: cat.name,
            price: rawData.price ? String(rawData.price).replace(/[^0-9.]/g, '') : "0.00",
            itemSpecifics: Object.entries(cleaned.productSpecs).map(([name, value]) => ({ name, value: String(value) })),
            htmlDescription: htmlDesc,
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
    } catch (err) {
        console.error("Optimization unexpected error:", err.message);
        appendHistory('ERROR', { source: 'optimize', message: err.message });
        return null;
    }
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
