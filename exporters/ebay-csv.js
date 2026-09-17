/**
 * Zonbay - Universal eBay Seller Hub CSV Exporter
 * Generates RFC 4180 compliant CSV strings for bulk upload to eBay Seller Hub Reports.
 * Runs in both browser extensions and Node.js environments.
 */

function escapeCsvField(val) {
    if (val === null || val === undefined) return '';
    const str = String(val).trim();
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function buildEbayDescriptionHtml(item) {
    if (item.htmlDescription && typeof item.htmlDescription === 'string' && item.htmlDescription.trim().length > 50) {
        return item.htmlDescription;
    }
    if (typeof ZonbayTemplates !== 'undefined' && ZonbayTemplates.renderStorefrontShowcase) {
        return ZonbayTemplates.renderStorefrontShowcase(item, item.storeConfig || {});
    }
    if (typeof require !== 'undefined') {
        try {
            const { renderStorefrontShowcase } = require('../templates');
            return renderStorefrontShowcase(item, item.storeConfig || {});
        } catch (e) {}
    }
    const title = item.title || 'Product Details';
    const bullets = Array.isArray(item.bulletPoints) ? item.bulletPoints : [];
    const specs = item.productSpecs || {};
    const desc = item.longDescription || '';

    let html = `<div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 20px; color: #333;">`;
    html += `<h1 style="color: #0046af; border-bottom: 2px solid #0046af; padding-bottom: 8px; font-size: 24px;">${title}</h1>`;

    if (bullets.length > 0) {
        html += `<h3 style="color: #222; margin-top: 20px;">Key Features</h3><ul>`;
        for (const b of bullets) {
            html += `<li style="margin-bottom: 6px;">${b}</li>`;
        }
        html += `</ul>`;
    }

    if (desc) {
        html += `<h3 style="color: #222; margin-top: 20px;">Product Overview</h3>`;
        html += `<p style="white-space: pre-line;">${desc}</p>`;
    }

    const specKeys = Object.keys(specs);
    if (specKeys.length > 0) {
        html += `<h3 style="color: #222; margin-top: 20px;">Specifications</h3>`;
        html += `<table style="width: 100%; border-collapse: collapse; margin-top: 10px;">`;
        specKeys.slice(0, 10).forEach((k, idx) => {
            const bg = idx % 2 === 0 ? '#f9f9f9' : '#ffffff';
            html += `<tr style="background: ${bg};"><td style="padding: 8px; font-weight: bold; width: 35%; border: 1px solid #ddd;">${k}</td><td style="padding: 8px; border: 1px solid #ddd;">${specs[k]}</td></tr>`;
        });
        html += `</table>`;
    }

    html += `<div style="margin-top: 30px; padding: 15px; background: #eef4ff; border-radius: 6px; font-size: 13px; color: #444;">`;
    html += `<strong>Fast Shipping:</strong> Ships promptly via USPS Ground Advantage with full tracking provided upon dispatch.`;
    html += `</div></div>`;

    return html;
}

function generateEbayCsvString(products) {
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
        if (prod) {
            rows.push(convertProductToCsvRow(prod));
        }
    }

    return rows.join('\r\n');
}

/**
 * Converts a single product object into an RFC 4180 CSV row string
 * @param {Object} product
 * @returns {string} Escaped CSV row
 */
function convertProductToCsvRow(product) {
    // Collect public images (pipe-separated)
    let images = [];
    if (Array.isArray(product.imageList) && product.imageList.length > 0) {
        images = product.imageList
            .filter(img => !img.isExcluded)
            .sort((a, b) => (a.isHero ? -1 : (b.isHero ? 1 : 0)))
            .map(img => {
                if (img.hostedUrl && img.hostedUrl.startsWith('http') && !img.hostedUrl.includes('localhost')) {
                    return img.hostedUrl;
                }
                if (typeof img.url === 'string' && img.url.startsWith('http') && !img.url.includes('localhost')) {
                    return img.url;
                }
                if (typeof img.originalUrl === 'string' && img.originalUrl.startsWith('http') && !img.originalUrl.includes('localhost')) {
                    return img.originalUrl;
                }
                return null;
            })
            .filter(url => url && !url.toLowerCase().includes('.svg'));
    }

    if (images.length === 0 && Array.isArray(product.alternateImages) && product.alternateImages.length > 0) {
        images = product.alternateImages.filter(url => typeof url === 'string' && url.startsWith('http') && !url.includes('localhost') && !url.toLowerCase().includes('.svg'));
    }
    if (images.length === 0 && product.mainImgUrl && typeof product.mainImgUrl === 'string' && product.mainImgUrl.startsWith('http') && !product.mainImgUrl.includes('localhost') && !product.mainImgUrl.toLowerCase().includes('.svg')) {
        images = [product.mainImgUrl];
    }
    const picUrl = images.slice(0, 12).join('|');

    // Title max 80 chars
    const rawTitle = (product.title || 'Quality Item').trim();
    const cleanTitle = rawTitle.length > 80 ? rawTitle.substring(0, 80).trim() : rawTitle;

    const brand = product.brand || (product.productSpecs && (product.productSpecs.Brand || product.productSpecs.Manufacturer)) || 'Unbranded';
    const mpn = (product.productSpecs && (product.productSpecs.MPN || product.productSpecs['Item model number'] || product.productSpecs['Model Number'])) || 'Does Not Apply';
    const type = (product.productSpecs && product.productSpecs.Type) || '';
    const model = (product.productSpecs && product.productSpecs.Model) || '';
    const color = (product.productSpecs && product.productSpecs.Color) || '';

    const price = product.price ? String(product.price).replace(/[^0-9.]/g, '') : '19.99';
    const sku = product.sourceId || product.sku || product.customSku || `SKU-${Date.now()}`;
    const category = product.categoryId || '';
    if (!category && typeof console !== 'undefined') {
        console.warn(`\u26a0\ufe0f  No verified eBay category for "${cleanTitle}" \u2014 row flagged, fill in *Category manually before uploading to Seller Hub.`);
    }
    const flaggedTitle = category ? cleanTitle : `[REVIEW CATEGORY] ${cleanTitle}`.substring(0, 80);
    const descriptionHtml = product.htmlDescription || buildEbayDescriptionHtml(product);

    const conditionId = product.conditionId || '1000';
    const quantity = product.quantity ? String(product.quantity) : '1';
    const immediatePay = product.immediatePayRequired !== undefined ? String(product.immediatePayRequired) : (product.immediatePay !== undefined ? String(product.immediatePay) : '1');
    const location = product.location || 'United States';
    const shippingType = product.shippingType || 'Flat';
    const shippingService = product.shippingService || 'USPSGroundAdvantage';
    const shippingCost = product.shippingCost !== undefined ? String(product.shippingCost).replace(/[^0-9.]/g, '') : '0.00';
    const dispatchTime = product.dispatchTimeMax !== undefined ? String(product.dispatchTimeMax) : (product.shippingPolicy?.handlingTimeDays !== undefined ? String(product.shippingPolicy.handlingTimeDays) : '3');
    const returnsAccepted = product.returnsAcceptedOption || (product.returnPolicy?.returnsAccepted ? 'ReturnsAccepted' : 'ReturnsNotAccepted');

    const row = [
        'Add',
        sku,
        category,
        flaggedTitle,
        conditionId,
        brand,
        mpn,
        type,
        model,
        color,
        picUrl,
        descriptionHtml,
        'FixedPrice',
        'GTC',
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

    return row.map(escapeCsvField).join(',');
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { generateEbayCsvString, convertProductToCsvRow, buildEbayDescriptionHtml, escapeCsvField };
}
