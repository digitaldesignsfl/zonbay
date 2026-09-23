/**
 * Zonbay - eBay Store Inventory Syncer
 * Content script running on https://www.ebay.com/sh/lst/active* and https://www.ebay.com/mys/active*
 * Scrapes the seller's active listings listing-by-listing and syncs them into the local inventory database.
 */

(function () {
    console.log("[Zonbay] eBay Store Inventory Syncer content script active.");

    function createSyncBanner(count = 0) {
        if (document.getElementById('zonbay-sync-banner')) {
            const existingCount = document.getElementById('zonbay-detected-count');
            if (existingCount) existingCount.innerText = count;
            return;
        }

        const banner = document.createElement('div');
        banner.id = 'zonbay-sync-banner';
        banner.style.position = 'fixed';
        banner.style.bottom = '20px';
        banner.style.right = '20px';
        banner.style.zIndex = '9999999';
        banner.style.backgroundColor = '#0046af';
        banner.style.color = '#ffffff';
        banner.style.padding = '14px 18px';
        banner.style.borderRadius = '10px';
        banner.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)';
        banner.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
        banner.style.fontSize = '13px';
        banner.style.maxWidth = '380px';
        banner.style.display = 'flex';
        banner.style.flexDirection = 'column';
        banner.style.gap = '10px';

        banner.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="font-weight: bold; font-size: 14px; display: flex; align-items: center; gap: 6px;">
                    <span>⚡ Zonbay Reseller Base</span>
                </div>
                <button id="zonbay-close-sync-btn" style="background:none; border:none; color:white; font-size:16px; cursor:pointer; opacity:0.7;">✕</button>
            </div>
            <div style="font-size: 12px; color: #d0e2ff;">
                Detected <strong id="zonbay-detected-count" style="color:#ffffff;">${count}</strong> active store listings on this page.
            </div>
            <div style="display: flex; gap: 8px;">
                <button id="zonbay-trigger-sync-btn" style="flex: 1; background: #28a745; color: white; border: none; padding: 8px 12px; border-radius: 6px; font-weight: bold; font-size: 12px; cursor: pointer;">
                    🔄 Sync All to Database
                </button>
                <a href="http://localhost:3000/" target="_blank" style="background: rgba(255,255,255,0.2); color: white; text-decoration: none; padding: 8px 10px; border-radius: 6px; font-size: 12px; display: flex; align-items: center;">
                    📊 Open Base
                </a>
            </div>
            <div id="zonbay-sync-status" style="font-size: 11px; display: none; padding: 6px 8px; border-radius: 4px;"></div>
        `;

        document.body.appendChild(banner);

        document.getElementById('zonbay-close-sync-btn').addEventListener('click', () => {
            banner.remove();
        });

        document.getElementById('zonbay-trigger-sync-btn').addEventListener('click', () => {
            syncAllListingsToLocalDatabase();
        });
    }

    function extractActiveListingsFromPage() {
        const listings = [];

        // 1. Check Seller Hub standard table rows
        const rows = Array.from(document.querySelectorAll('tbody tr, div[role="row"], .sh-table__row, .table-row'));

        rows.forEach((row) => {
            const itmLinks = Array.from(row.querySelectorAll('a[href*="/itm/"], a[href*="ebay.com/itm"]'));
            
            // Extract item ID
            let itemId = '';
            for (const l of itmLinks) {
                const href = l.getAttribute('href') || '';
                const m = href.match(/\/itm\/(?:[^\/]+\/)?(\d+)/);
                if (m && m[1]) {
                    itemId = m[1];
                    break;
                }
            }
            if (!itemId) {
                const textMatch = row.innerText.match(/\b(1\d{11})\b/);
                if (textMatch) itemId = textMatch[1];
            }
            if (!itemId || listings.some(l => l.itemId === itemId)) return;

            // Extract Title: Look for a link with substantive text
            let title = '';
            for (const l of itmLinks) {
                const txt = (l.innerText || '').trim();
                if (txt && txt.length > 5 && !txt.match(/^(edit|sell similar|view|promoted|research prices|buy it now)$/i)) {
                    title = txt.replace(/\s+/g, ' ').trim();
                    break;
                }
            }
            if (!title) {
                const rowLinks = Array.from(row.querySelectorAll('a'));
                for (const l of rowLinks) {
                    const txt = (l.innerText || '').trim();
                    if (txt && txt.length > 10 && !txt.match(/^(edit|sell similar|view|promoted|research prices|more)$/i)) {
                        title = txt.replace(/\s+/g, ' ').trim();
                        break;
                    }
                }
            }
            if (!title) {
                const titleCandidate = row.querySelector('[data-column="title"], .item-title, .title, [class*="itemTitle"], [class*="item-title"]');
                if (titleCandidate) {
                    const txt = titleCandidate.innerText.replace(/\s+/g, ' ').trim();
                    if (txt.length > 5) title = txt;
                }
            }
            if (!title) {
                title = `eBay Item #${itemId}`;
            }

            // Extract Image
            let imageUrl = '';
            const img = row.querySelector('img[src*="i.ebayimg.com"], img[src*="ebayimg"], img');
            if (img) {
                imageUrl = img.getAttribute('src') || img.getAttribute('data-src') || '';
                if (imageUrl) {
                    imageUrl = imageUrl.replace(/s-l\d+\.(?:jpg|png|webp)/i, 's-l500.jpg');
                }
            }

            // Extract Price
            let price = '0.00';
            const priceEl = row.querySelector('[data-column="currentPrice"], [data-column="price"], .item-price, [class*="price"], .sh-table__cell--price');
            if (priceEl) {
                const m = priceEl.innerText.replace(/,/g, '').match(/\$?\s*([0-9]+\.[0-9]{2})/);
                if (m) price = m[1];
            }
            if (price === '0.00') {
                const m = row.innerText.replace(/,/g, '').match(/\$\s*([0-9]+\.[0-9]{2})/);
                if (m) price = m[1];
            }

            // Extract Quantity
            let quantity = 1;
            const qtyEl = row.querySelector('[data-column="availableQuantity"], [data-column="quantity"], .item-quantity, [class*="quantity"]');
            if (qtyEl) {
                const qMatch = qtyEl.innerText.match(/\b([0-9]+)\b/);
                if (qMatch) quantity = parseInt(qMatch[1], 10);
            }

            // Extract SKU / Custom Label
            let sku = itemId;
            const skuEl = row.querySelector('[data-column="customLabel"], [data-column="sku"], .item-sku, [class*="custom-label"], [class*="sku"]');
            if (skuEl && skuEl.innerText.trim()) {
                const s = skuEl.innerText.replace(/Custom label:\s*/i, '').trim();
                if (s) sku = s;
            }

            listings.push({
                itemId,
                title,
                price,
                quantity,
                sku,
                imageUrl,
                itemUrl: `https://www.ebay.com/itm/${itemId}`,
                sourcePlatform: 'eBay Store',
                sellingPlatform: 'eBay',
                status: 'LIVE_ON_EBAY'
            });
        });

        // 2. Fallback: Search all item links on page if table structure is non-standard
        if (listings.length === 0) {
            const allLinks = Array.from(document.querySelectorAll('a[href*="/itm/"]'));
            allLinks.forEach(link => {
                const href = link.getAttribute('href') || '';
                const match = href.match(/\/itm\/(?:[^\/]+\/)?(\d+)/);
                if (match && match[1]) {
                    const itemId = match[1];
                    if (!listings.some(l => l.itemId === itemId)) {
                        const container = link.closest('tr, div[role="row"], li, [class*="row"]') || link.parentElement;
                        let title = (link.innerText || '').trim();
                        let price = '0.00';
                        let imageUrl = '';

                        if (container) {
                            if (!title || title.length < 5) {
                                const containerLinks = Array.from(container.querySelectorAll('a'));
                                for (const cl of containerLinks) {
                                    const t = (cl.innerText || '').trim();
                                    if (t && t.length > 5 && !t.match(/^(edit|view)$/i)) {
                                        title = t;
                                        break;
                                    }
                                }
                            }
                            const pm = container.innerText.replace(/,/g, '').match(/\$\s*([0-9]+\.[0-9]{2})/);
                            if (pm) price = pm[1];
                            const cImg = container.querySelector('img');
                            if (cImg) imageUrl = cImg.getAttribute('src') || '';
                        }

                        if (!title || title.length < 3) {
                            title = link.getAttribute('title') || `eBay Item #${itemId}`;
                        }

                        listings.push({
                            itemId,
                            title,
                            price,
                            quantity: 1,
                            sku: itemId,
                            imageUrl,
                            itemUrl: `https://www.ebay.com/itm/${itemId}`,
                            sourcePlatform: 'eBay Store',
                            sellingPlatform: 'eBay',
                            status: 'LIVE_ON_EBAY'
                        });
                    }
                }
            });
        }

        return listings;
    }

    async function transmitListingsToDatabase(listings) {
        // Method 1: Try extension background service worker (avoids Chrome Private Network Access prompt on ebay.com)
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            try {
                const response = await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage({ action: 'SYNC_EBAY_LISTINGS', listings }, res => {
                        if (chrome.runtime.lastError) {
                            return reject(new Error(chrome.runtime.lastError.message));
                        }
                        if (res && res.success) {
                            return resolve(res.data);
                        }
                        return reject(new Error(res?.error || 'Background sync failed'));
                    });
                });
                return response;
            } catch (bgErr) {
                console.warn('[Zonbay] Background worker sync fallback:', bgErr.message);
            }
        }

        // Method 2: Fallback to direct HTTP fetch
        const res = await fetch('http://localhost:3000/api/inventory/sync-ebay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ listings })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Server responded with status ${res.status}`);
        }

        return await res.json();
    }

    async function syncAllListingsToLocalDatabase() {
        const btn = document.getElementById('zonbay-trigger-sync-btn');
        const statusEl = document.getElementById('zonbay-sync-status');
        if (btn) {
            btn.disabled = true;
            btn.innerText = '⏳ Syncing Listings...';
        }
        if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.style.background = '#e6f0ff';
            statusEl.style.color = '#0046af';
            statusEl.innerText = 'Reading active store listings from page...';
        }

        const listings = extractActiveListingsFromPage();

        if (listings.length === 0) {
            if (statusEl) {
                statusEl.style.background = '#fff3cd';
                statusEl.style.color = '#856404';
                statusEl.innerText = '⚠️ No active listings found on this page. Navigate to Active Listings table.';
            }
            if (btn) {
                btn.disabled = false;
                btn.innerText = '🔄 Sync All to Database';
            }
            return;
        }

        try {
            if (statusEl) statusEl.innerText = `Transmitting ${listings.length} listings to Zonbay Base...`;

            const data = await transmitListingsToDatabase(listings);

            if (statusEl) {
                statusEl.style.background = '#d4edda';
                statusEl.style.color = '#155724';
                statusEl.innerHTML = `✅ <strong>Success!</strong> Synced ${data.addedCount} new, updated ${data.updatedCount}. Total Base: ${data.totalItems} items.`;
            }
            if (btn) {
                btn.disabled = false;
                btn.innerText = '✅ Store Synced!';
                setTimeout(() => { btn.innerText = '🔄 Re-Sync Store'; }, 3000);
            }
        } catch (err) {
            console.error('[Zonbay] Store sync failed:', err);
            if (statusEl) {
                statusEl.style.background = '#f8d7da';
                statusEl.style.color = '#721c24';
                statusEl.innerText = `Error: ${err.message}. If prompted by Chrome, click 'Allow' to connect with local server.`;
            }
            if (btn) {
                btn.disabled = false;
                btn.innerText = '🔄 Retry Sync';
            }
        }
    }

    setTimeout(() => {
        const found = extractActiveListingsFromPage();
        if (found.length > 0 || window.location.href.includes('/sh/lst/active')) {
            createSyncBanner(found.length);
        }
    }, 1500);

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
            if (req.action === 'SYNC_EBAY_ACTIVE') {
                syncAllListingsToLocalDatabase().then(() => {
                    sendResponse({ status: 'DONE' });
                });
                return true;
            }
            if (req.action === 'GET_EBAY_ACTIVE_COUNT') {
                const list = extractActiveListingsFromPage();
                sendResponse({ count: list.length, listings: list });
                return true;
            }
        });
    }
})();
