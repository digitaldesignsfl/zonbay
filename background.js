/**
 * Zonbay - Background Service Worker (Manifest V3)
 * Handles extension lifecycle and proxies local API communication
 * to avoid webpage-level Local Network Access permission prompts on eBay.
 */

chrome.runtime.onInstalled.addListener(() => {
    console.log('[Zonbay] Service worker initialized.');
});

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === 'SYNC_EBAY_LISTINGS') {
        fetch('http://localhost:3000/api/inventory/sync-ebay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ listings: req.listings })
        })
        .then(async (res) => {
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Server returned status ${res.status}`);
            }
            return res.json();
        })
        .then((data) => {
            sendResponse({ success: true, data });
        })
        .catch((err) => {
            sendResponse({ success: false, error: err.message });
        });

        return true; // Keep message channel open for async response
    }

    if (req.action === 'CHECK_SERVER_HEALTH') {
        fetch('http://localhost:3000/api/inventory')
            .then(res => res.json())
            .then(data => sendResponse({ success: true, running: true }))
            .catch(err => sendResponse({ success: false, running: false, error: err.message }));
        return true;
    }
});
