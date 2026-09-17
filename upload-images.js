const fs = require('fs');
const path = require('path');
const { appendHistory } = require('./logger');

const OPTIMIZED_PACKAGE_PATH = path.join(__dirname, 'ebay_optimized_package.json');
const FINAL_PACKAGE_PATH = path.join(__dirname, 'ebay_final_api_ready.json');

async function convertLocalPackageToLiveUrls() {
    if (!fs.existsSync(OPTIMIZED_PACKAGE_PATH)) {
        console.log("❌ Error: Run 'node optimize.js' first to download local images!");
        return null;
    }

    const pkg = JSON.parse(fs.readFileSync(OPTIMIZED_PACKAGE_PATH, 'utf8'));
    const localImages = pkg.localImages || [];
    console.log(`Processing ${localImages.length} images for local web hosting...`);
    
    const hostedUrls = [];

    for (const localPath of localImages) {
        if (!localPath) continue;
        // Extracts the folder name and image file name regardless of Windows or POSIX separator
        const pathParts = localPath.split(/[/\\]/).filter(Boolean);
        const fileName = pathParts[pathParts.length - 1];
        const folderName = pathParts[pathParts.length - 2] || 'item';

        // Creates a direct, working web link to your running local server
        const publicUrl = `http://localhost:3000/images/${folderName}/${fileName}`;
        hostedUrls.push(publicUrl);
    }

    // Swap out local paths for fully accessible web URLs
    pkg.imageUrls = hostedUrls;
    delete pkg.localImages; 

    fs.writeFileSync(FINAL_PACKAGE_PATH, JSON.stringify(pkg, null, 2));
    console.log("🎉 Success! 'ebay_final_api_ready.json' generated with internal web links.");

    // Ledger update
    appendHistory('UPLOADED', {
        title: pkg.title,
        hostedUrlsCount: hostedUrls.length
    });

    return pkg;
}

if (require.main === module) {
    convertLocalPackageToLiveUrls();
}

module.exports = { convertLocalPackageToLiveUrls };

