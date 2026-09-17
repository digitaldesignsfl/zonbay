/**
 * Zonbay - Automated eBay Seller Hub Uploader
 * Content script running on https://www.ebay.com/sh/reports/uploads
 * Automates the CSV template upload flow directly inside the user's authenticated session.
 */

(function() {
    console.log("[Zonbay] eBay Seller Hub Uploader script initialized.");

    function createBanner() {
        if (document.getElementById('zonbay-uploader-banner')) return document.getElementById('zonbay-uploader-banner');
        const banner = document.createElement('div');
        banner.id = 'zonbay-uploader-banner';
        banner.style.position = 'fixed';
        banner.style.top = '20px';
        banner.style.right = '20px';
        banner.style.zIndex = '9999999';
        banner.style.backgroundColor = '#0046af';
        banner.style.color = '#ffffff';
        banner.style.padding = '16px 20px';
        banner.style.borderRadius = '8px';
        banner.style.boxShadow = '0 6px 16px rgba(0,0,0,0.3)';
        banner.style.fontFamily = 'Arial, sans-serif';
        banner.style.fontSize = '14px';
        banner.style.maxWidth = '360px';
        banner.innerHTML = `
            <div style="font-weight:bold; font-size:16px; margin-bottom:8px;">📦 Zonbay Auto-Lister</div>
            <div id="zonbay-status-text">Preparing CSV upload...</div>
            <div id="zonbay-progress" style="margin-top:8px; font-size:12px; color:#cce0ff;"></div>
        `;
        document.body.appendChild(banner);
        return banner;
    }

    function setStatus(text, subtext = '', isError = false) {
        createBanner();
        const statusEl = document.getElementById('zonbay-status-text');
        const subEl = document.getElementById('zonbay-progress');
        const banner = document.getElementById('zonbay-uploader-banner');
        if (statusEl) statusEl.innerText = text;
        if (subEl) subEl.innerText = subtext;
        if (banner) {
            banner.style.backgroundColor = isError ? '#c82333' : '#0046af';
        }
    }

    async function wait(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    async function attemptUpload(csvContent, fileName = 'zonbay_listing.csv') {
        createBanner();
        setStatus("Locating Seller Hub upload controls...");

        // Check if user is logged into eBay
        if (document.body.innerText.includes("Sign in") && !document.querySelector('#gh-ug, .gh-identity')) {
            setStatus("⚠️ Please Sign In", "Log in to your eBay Seller account to finish upload.", true);
            return;
        }

        // Check if there is an "Upload template" button that opens the upload dialog
        const buttons = Array.from(document.querySelectorAll('button, a'));
        const uploadTemplateBtn = buttons.find(b => b.innerText && b.innerText.toLowerCase().includes('upload template'));
        if (uploadTemplateBtn) {
            setStatus("Opening upload modal...");
            uploadTemplateBtn.click();
            await wait(1200);
        }

        // Look for file input
        let fileInput = document.querySelector('input[type="file"]');
        if (!fileInput) {
            // Try searching inside shadow roots or iframes if present
            for (let attempt = 0; attempt < 5; attempt++) {
                await wait(600);
                fileInput = document.querySelector('input[type="file"]');
                if (fileInput) break;
            }
        }

        if (!fileInput) {
            setStatus("Dropzone ready", "Drag your downloaded CSV here, or click Browse to upload.", false);
            return;
        }

        try {
            setStatus("Attaching CSV listing file...");
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const file = new File([blob], fileName, { type: 'text/csv', lastModified: Date.now() });

            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;

            // Trigger standard browser events
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            fileInput.dispatchEvent(new Event('input', { bubbles: true }));

            await wait(1000);

            // Find submit / upload confirmation button
            const actionButtons = Array.from(document.querySelectorAll('button'));
            const submitBtn = actionButtons.find(b => {
                const txt = b.innerText ? b.innerText.toLowerCase().trim() : '';
                return txt === 'upload' || txt.includes('upload file') || txt === 'submit';
            });

            if (submitBtn && !submitBtn.disabled) {
                setStatus("🚀 Submitting to eBay...", "Processing file...");
                submitBtn.click();
                await wait(2000);
                setStatus("🎉 Upload complete!", "eBay is processing your listing. Refresh below in 30s to check report.", false);
            } else {
                setStatus("✅ File Attached!", "Click the blue 'Upload' button on eBay to confirm.", false);
            }
        } catch (err) {
            console.error("[Zonbay] File attach error:", err);
            setStatus("Upload setup error", err.message, true);
        }
    }

    // Check if CSV was saved in chrome.storage for automated upload
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['zonbayPendingUpload', 'zonbayPendingFilename'], (res) => {
            if (res.zonbayPendingUpload) {
                const csvData = res.zonbayPendingUpload;
                const fname = res.zonbayPendingFilename || 'ebay-listing.csv';
                // Clear pending flag so it doesn't loop
                chrome.storage.local.remove(['zonbayPendingUpload', 'zonbayPendingFilename'], () => {
                    attemptUpload(csvData, fname);
                });
            }
        });
    }

    // Listen for runtime messages from popup
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'UPLOAD_CSV') {
                attemptUpload(request.csvContent, request.filename);
                sendResponse({ status: 'STARTED' });
            }
            return true;
        });
    }
})();
