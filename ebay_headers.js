const fs = require('fs');
const APP_ID = 'YOUR_PRODUCTION_APP_ID_HERE';
const DEV_ID = 'YOUR_PRODUCTION_DEV_ID_HERE';
const CERT_ID = 'YOUR_PRODUCTION_CERT_ID_HERE';
function getEbayHeaders(callName) {
    const SITE_ID = '0'; 
    const COMPATIBILITY_LEVEL = '1357'; 
    const headers = {
        'X-EBAY-API-COMPATIBILITY-LEVEL': COMPATIBILITY_LEVEL,
        'X-EBAY-API-CALL-NAME': callName,
        'X-EBAY-API-SITEID': SITE_ID,
        'X-EBAY-API-APP-NAME': APP_ID,
        'X-EBAY-API-DEV-NAME': DEV_ID,
        'X-EBAY-API-CERT-NAME': CERT_ID,
        'Content-Type': 'text/xml',
        'X-EBAY-API-DETAIL-LEVEL': '0'
    };
    console.log(`\n⚙️ Generated HTTP routing headers for eBay Call: [${callName}]`);
    return headers;
}

module.exports = { getEbayHeaders };

if (require.main === module) {
    const sampleHeaders = getEbayHeaders('AddFixedPriceItem');
    console.log(JSON.stringify(sampleHeaders, null, 2));
}
