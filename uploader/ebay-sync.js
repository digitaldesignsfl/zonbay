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

    function findListingContainers() {
        const containers = [];

        // Strategy 1: Table rows in tbody or table (excluding header thead / th)
        const trs = Array.from(document.querySelectorAll('table tbody tr, table tr, [role="row"], .sh-table__row'));
        for (const tr of trs) {
            if (tr.querySelector('th') || tr.closest('thead')) continue;
            const text = tr.innerText || '';
            const hasItm = tr.querySelector('a[href*="/itm/"], a[href*="ebay.com/itm"]');
            const has12Digits = /\b[0-9]{12}\b/.test(text);
            const hasCheckbox = tr.querySelector('input[type="checkbox"]');
            if (hasItm || (has12Digits && (tr.querySelectorAll('td, [role="cell"]').length >= 2 || text.includes('$')))) {
                containers.push(tr);
            }
        }
        if (containers.length > 0) return containers;

        // Strategy 2: Upward traversal from /itm/ links or 12-digit listing IDs
        const itemAnchors = Array.from(document.querySelectorAll('a[href*="/itm/"]'));
        const seen = new Set();
        for (const a of itemAnchors) {
            let curr = a.parentElement;
            let bestContainer = null;
            while (curr && curr !== document.body && curr !== document.documentElement) {
                if (curr.tagName === 'TR' || curr.getAttribute('role') === 'row') {
                    bestContainer = curr;
                    break;
                }
                const text = curr.innerText || '';
                if (/\$\s*[0-9]+(?:\.[0-9]{2})?/.test(text) && curr.querySelectorAll('a, button, img').length >= 3) {
                    bestContainer = curr;
                }
                curr = curr.parentElement;
            }
            if (bestContainer && !seen.has(bestContainer)) {
                seen.add(bestContainer);
                containers.push(bestContainer);
            }
        }
        return containers;
    }

    function extractActiveListingsFromPage() {
        const listings = [];
        const seenItemIds = new Set();
        const containers = findListingContainers();

        containers.forEach((container) => {
            // 1. Extract Item ID
            let itemId = '';

            // Checkbox value or data attribute
            const cb = container.querySelector('input[type="checkbox"]');
            if (cb) {
                const val = (cb.value || '').trim();
                if (/^[0-9]{12}$/.test(val)) itemId = val;
                if (!itemId) {
                    const dId = cb.getAttribute('data-listing-id') || cb.getAttribute('data-item-id') || cb.getAttribute('data-id');
                    if (dId && /^[0-9]{12}$/.test(dId)) itemId = dId;
                }
            }

            // /itm/ links in row
            if (!itemId) {
                const itmLinks = Array.from(container.querySelectorAll('a[href*="/itm/"], a[href*="ebay.com/itm"]'));
                for (const l of itmLinks) {
                    const href = l.getAttribute('href') || '';
                    const m = href.match(/\/itm\/(?:[^\/]+\/)?(\d{10,14})/);
                    if (m && m[1]) {
                        itemId = m[1];
                        break;
                    }
                }
            }

            // Regex from text (eBay listing IDs are 12 digits, often shown after '·')
            if (!itemId) {
                const textMatch = container.innerText.match(/\b([0-9]{12})\b/);
                if (textMatch) itemId = textMatch[1];
            }

            if (!itemId || seenItemIds.has(itemId)) return;

            // 2. Extract Product Title
            let title = '';
            const titleCandidates = [];

            // A. Anchors in container with substantive text
            const links = Array.from(container.querySelectorAll('a'));
            for (const a of links) {
                const txt = (a.innerText || '').replace(/\s+/g, ' ').trim();
                if (!txt || txt.length < 8) continue;
                // Exclude pure numbers, item ID, and system buttons
                if (/^[0-9\s·.-]+$/.test(txt)) continue;
                if (/^(edit|sell similar|view|promoted|research prices|buy it now|actions|more|send offers|status|customize table|all filters|eligible)$/i.test(txt)) continue;
                titleCandidates.push({ text: txt, priority: a.getAttribute('href')?.includes('/itm/') ? 100 : 50 });
            }

            // B. Specific item title selectors
            const titleEl = container.querySelector('[data-column="title"], [data-column="item"], .item-title, .title, [class*="itemTitle"], [class*="item-title"], .sh-table__cell--item, .sh-item-title');
            if (titleEl) {
                // If titleEl contains child anchors, extract text from non-action children
                const cleanTxt = titleEl.innerText.split('\n')
                    .map(l => l.trim())
                    .filter(l => l.length >= 8 && !/^[0-9\s·.-]+$/.test(l) && !/^(buy it now|auction|edit|sell similar|promoted|research)/i.test(l))
                    .join(' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                if (cleanTxt && cleanTxt.length >= 8) {
                    titleCandidates.push({ text: cleanTxt, priority: 80 });
                }
            }

            // Pick the best candidate (highest priority then longest length)
            if (titleCandidates.length > 0) {
                titleCandidates.sort((a, b) => (b.priority - a.priority) || (b.text.length - a.text.length));
                title = titleCandidates[0].text;
            }

            // C. Fallback: Parse substantive lines from container text before the item ID
            if (!title) {
                const lines = container.innerText.split('\n')
                    .map(l => l.trim())
                    .filter(l => l.length >= 8 && !/^[0-9\s·.-]+$/.test(l) && !/^(edit|sell similar|promoted|buy it now|current price|\$|actions)/i.test(l));
                if (lines.length > 0) {
                    title = lines[0];
                }
            }

            if (!title) {
                title = `eBay Item #${itemId}`;
            }

            // 3. Extract High-Resolution Product Image
            let imageUrl = '';
            const imgs = Array.from(container.querySelectorAll('img'));
            for (const img of imgs) {
                const candidates = [
                    img.currentSrc,
                    img.getAttribute('src'),
                    img.getAttribute('data-src'),
                    img.getAttribute('data-lazy-src'),
                    img.getAttribute('data-highres'),
                    img.src
                ].filter(Boolean);

                // Handle srcset if present
                const srcset = img.getAttribute('srcset');
                if (srcset) {
                    const setUrls = srcset.split(',').map(s => s.trim().split(/\s+/)[0]).filter(Boolean);
                    candidates.push(...setUrls);
                }

                for (let u of candidates) {
                    if (!u) continue;
                    // Ignore spacer gifs, data SVGs, icons, and loaders
                    if (u.includes('s_1x2.gif') || u.includes('blank.gif') || u.includes('spacer.gif') || u.startsWith('data:image') || u.includes('/cr/v/c1/')) {
                        continue;
                    }
                    if (u.startsWith('//')) u = 'https:' + u;
                    // Upgrade thumbnail to 500px high-res master asset
                    u = u.replace(/s-l\d+\.(?:jpg|png|webp)/i, 's-l500.jpg');
                    imageUrl = u;
                    break;
                }
                if (imageUrl && imageUrl.includes('ebayimg.com')) break;
            }

            // Check CSS background-image if no img tag succeeded
            if (!imageUrl) {
                const bgEls = Array.from(container.querySelectorAll('[style*="ebayimg"], [style*="background"]'));
                for (const el of bgEls) {
                    const style = el.getAttribute('style') || '';
                    const bgMatch = style.match(/url\(['"]?(https?:\/\/[^'")]+ebayimg\.com[^'")]+)['"]?\)/i);
                    if (bgMatch) {
                        imageUrl = bgMatch[1].replace(/s-l\d+\.(?:jpg|png|webp)/i, 's-l500.jpg');
                        break;
                    }
                }
            }

            // 4. Extract Authentic Selling Price
            let price = '0.00';
            const priceEl = container.querySelector('[data-column="currentPrice"], [data-column="price"], .item-price, [class*="price"], .sh-table__cell--price');
            if (priceEl) {
                const m = priceEl.innerText.replace(/,/g, '').match(/\$?\s*([0-9]+(?:\.[0-9]{2})?)/);
                if (m && parseFloat(m[1]) > 0) price = parseFloat(m[1]).toFixed(2);
            }
            if (price === '0.00') {
                // Search cells that start with dollar sign
                const cells = Array.from(container.querySelectorAll('td, [role="cell"], [role="gridcell"]'));
                for (const c of cells) {
                    const txt = c.innerText.trim();
                    const pm = txt.replace(/,/g, '').match(/^\$?\s*([0-9]+\.[0-9]{2})/);
                    if (pm && parseFloat(pm[1]) > 0) {
                        price = parseFloat(pm[1]).toFixed(2);
                        break;
                    }
                }
            }
            if (price === '0.00') {
                const m = container.innerText.replace(/,/g, '').match(/\$\s*([0-9]+\.[0-9]{2})/);
                if (m && parseFloat(m[1]) > 0) price = parseFloat(m[1]).toFixed(2);
            }

            // 5. Extract Quantity
            let quantity = 1;
            const qtyEl = container.querySelector('[data-column="availableQuantity"], [data-column="quantity"], .item-quantity, [class*="quantity"]');
            if (qtyEl) {
                const qMatch = qtyEl.innerText.match(/\b([0-9]+)\b/);
                if (qMatch) quantity = parseInt(qMatch[1], 10);
            }

            // 6. Extract SKU / Custom Label
            let sku = itemId;
            const skuEl = container.querySelector('[data-column="customLabel"], [data-column="sku"], .item-sku, [class*="custom-label"], [class*="sku"]');
            if (skuEl && skuEl.innerText.trim()) {
                const s = skuEl.innerText.replace(/Custom label:\s*/i, '').trim();
                if (s) sku = s;
            } else {
                const labelMatch = container.innerText.match(/Custom label:\s*([^\n\r]+)/i);
                if (labelMatch && labelMatch[1].trim()) sku = labelMatch[1].trim();
            }

            seenItemIds.add(itemId);
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

        // Fallback: If containers were not found, extract from all /itm/ links
        if (listings.length === 0) {
            const allLinks = Array.from(document.querySelectorAll('a[href*="/itm/"]'));
            allLinks.forEach(link => {
                const href = link.getAttribute('href') || '';
                const match = href.match(/\/itm\/(?:[^\/]+\/)?(\d{10,14})/);
                if (match && match[1]) {
                    const itemId = match[1];
                    if (!seenItemIds.has(itemId)) {
                        seenItemIds.add(itemId);
                        const rowAncestor = link.closest('tr') || link.closest('[role="row"]') || link.parentElement;
                        let title = (link.innerText || '').trim();
                        let price = '0.00';
                        let imageUrl = '';

                        if (rowAncestor) {
                            if (!title || title.length < 5) {
                                const rowLinks = Array.from(rowAncestor.querySelectorAll('a'));
                                for (const cl of rowLinks) {
                                    const t = (cl.innerText || '').trim();
                                    if (t && t.length > 5 && !t.match(/^(edit|view|buy it now)$/i) && !/^[0-9]+$/.test(t)) {
                                        title = t;
                                        break;
                                    }
                                }
                            }
                            const pm = rowAncestor.innerText.replace(/,/g, '').match(/\$\s*([0-9]+\.[0-9]{2})/);
                            if (pm) price = pm[1];
                            const cImg = rowAncestor.querySelector('img[src*="ebayimg.com"], img');
                            if (cImg) {
                                const src = cImg.getAttribute('src') || cImg.getAttribute('data-src') || '';
                                if (src && !src.includes('s_1x2.gif')) {
                                    imageUrl = src.replace(/s-l\d+\.(?:jpg|png|webp)/i, 's-l500.jpg');
                                }
                            }
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

    if (typeof window !== 'undefined' && typeof document !== 'undefined' && typeof chrome !== 'undefined') {
        setTimeout(() => {
            try {
                const found = extractActiveListingsFromPage();
                if (found.length > 0 || (window.location && window.location.href.includes('/sh/lst/active'))) {
                    createSyncBanner(found.length);
                }
            } catch (e) {
                console.warn('[Zonbay] Banner init skipped:', e.message);
            }
        }, 1500);
    }

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

    // Expose helpers on window for direct devtools console access
    if (typeof window !== 'undefined') {
        window.zonbayExtractListings = extractActiveListingsFromPage;
        window.zonbaySyncStore = syncAllListingsToLocalDatabase;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            extractActiveListingsFromPage,
            findListingContainers
        };
    }
})();
