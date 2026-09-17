const fs = require('fs');
const axios = require('axios');
const querystring = require('querystring');

// PLACEHOLDERS: Drop in your official credentials here once your eBay Developer account is approved
const EBAY_CLIENT_ID = 'YOUR_PRODUCTION_APP_ID_HERE';
const EBAY_CLIENT_SECRET = 'YOUR_PRODUCTION_CERT_ID_HERE';
const REDIRECT_URI = 'YOUR_RU_NAME_HERE'; // eBay refers to this as your RuName

// Generates the official URL you will click to authorize your eBay account
function getAuthorizationUrl() {
    const scopes = [
        'https://ebay.com',
        'https://ebay.com/sell.inventory'
    ].join(' ');

    const authUrl = `https://ebay.com?` + querystring.stringify({
        client_id: EBAY_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: scopes
    });

    console.log("\n🔗 STEP 1: Copy and paste this URL into your browser to authorize your store account:");
    console.log("---------------------------------------------------------------------------------");
    console.log(authUrl);
    console.log("---------------------------------------------------------------------------------\n");
    return authUrl;
}

// Trades the temporary browser code for permanent background Access & Refresh tokens
async function exchangeCodeForTokens(authCode) {
    const tokenUrl = 'https://ebay.com';
    const credentialsBase64 = Buffer.from(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`).toString('base64');

    try {
        const response = await axios.post(tokenUrl, querystring.stringify({
            grant_type: 'authorization_code',
            code: authCode,
            redirect_uri: REDIRECT_URI
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${credentialsBase64}`
            }
        });

        const tokenData = {
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token,
            expiresAt: Date.now() + (response.data.expires_in * 1000)
        };

        // Save safely into your workspace folder so the listing engine can read it dynamically
        fs.writeFileSync('ebay_tokens.json', JSON.stringify(tokenData, null, 2));
        console.log("🎉 SUCCESS: Permanent 'ebay_tokens.json' generated successfully!");
    } catch (error) {
        console.error("❌ Token exchange failed:", error.response ? error.response.data : error.message);
    }
}

// Switch between functions here depending on the step you are on
getAuthorizationUrl();
// exchangeCodeForTokens('PASTE_CODE_FROM_REDIRECT_URL_HERE');
