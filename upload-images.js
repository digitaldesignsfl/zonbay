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

    try {
        const rawContent = fs.readFileSync(OPTIMIZED_PACKAGE_PATH, 'utf8');
        let pkg;
        try {
            pkg = JSON.parse(rawContent);
        } catch (parseErr) {
            console.error("Failed to parse optimized package JSON:", parseErr.message);
            appendHistory('ERROR', { source: 'upload-images', message: `JSON parse error: ${parseErr.message}` });
            return null;
        }

        if (!pkg || typeof pkg !== 'object') {
            console.error("Optimized package is not a valid object.");
            return null;
        }

        const localImages = Array.isArray(pkg.localImages) ? pkg.localImages : [];
        console.log(`Processing ${localImages.length} images for local web hosting...`);
        
        const hostedUrls = [];

        for (const localPath of localImages) {
            if (!localPath || typeof localPath !== 'string') continue;
            // Extracts the folder name and image file name regardless of Windows or POSIX separator
            const pathParts = localPath.split(/[/\\]/).filter(Boolean);
            if (pathParts.length === 0) continue;
            
            const fileName = pathParts[pathParts.length - 1];
            if (!fileName) continue;
            const folderName = pathParts.length > 1 ? pathParts[pathParts.length - 2] : 'item';

            // NOTE: This is a localhost URL — only reachable from this machine.
            // Fine for local dashboard preview, but eBay's servers cannot fetch it.
            // The CSV export path (csv-exporter.js) avoids this by using live Amazon CDN
            // image URLs instead. If/when the real eBay API integration goes live, these
            // localhost URLs MUST be replaced with a real public image host before use.
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
            title: pkg.title || 'Untitled',
            hostedUrlsCount: hostedUrls.length
        });

        return pkg;
    } catch (err) {
        console.error("convertLocalPackageToLiveUrls encountered an unexpected error:", err.message);
        appendHistory('ERROR', { source: 'upload-images', message: err.message });
        return null;
    }
}

if (require.main === module) {
    convertLocalPackageToLiveUrls();
}

module.exports = { convertLocalPackageToLiveUrls };

