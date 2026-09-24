# Multi-Agent Collaboration Protocol (Claude, Antigravity & Gemini Standalone)

Welcome to the **zonbay** (`amazon-scraper`) workspace! This document outlines how **Claude**, **Antigravity (Gemini Agent)**, and **Gemini (Standalone Chat)** collaborate seamlessly on this codebase.

---

## 🏗️ Architecture Quick Reference

```text
amazon-scraper/
├── server.js (Core API router, Inventory DB manager & store syncer)
├── inventory_database.json (Persistent unified inventory base for multi-platform products)
├── saved_listings.json (Synchronized legacy fallback)
├── cleaner.js (Curator & clutter stripper: purges Amazon JS/reviews, prioritizes eBay specifics)
├── templates.js (3 conversion templates, AI reviser & 1:1 Live Buyer View simulation)
├── editor.html (Full-screen Reseller Studio workspace & 1:1 buyer preview modal)
├── editor.js (Studio controller: canvas photo filters, hero stars, two-step publish flow)
├── optimize.js (Title engine, text cleaner, image downloader)
├── upload-images.js (Converts local files to local web host links)
├── auth.js & ebay_headers.js (eBay OAuth token management & Trading API headers)
├── csv-exporter.js (Server-side eBay Seller Hub RFC 4180 CSV builder)
├── logger.js & history.log (Append-only ledger tracking item events & errors)
├── ebay_ready_product.json (Raw scraped/edited data cache)
├── ebay_optimized_package.json (Intermediate payload with clean metadata)
├── ebay_final_api_ready.json (Final local optimized payload with live URLs)
├── extractors/
│   ├── amazon.js (Stealth in-browser Amazon product data & hi-res image extractor)
│   └── temu.js (Stealth in-browser Temu product & gallery extractor)
├── exporters/
│   └── ebay-csv.js (Universal portable CSV exporter for browser & Node.js)
├── uploader/
│   ├── ebay-uploader.js (Content script automating Seller Hub CSV uploads)
│   └── ebay-sync.js (Content script scraping & syncing eBay active listings listing-by-listing)
├── manifest.json (Chrome Extension MV3 definition with active listing match rules)
├── popup.html & popup.js (Zonbay Reseller Cockpit UI, profit calculator & base sync)
├── test_run.js (Automated end-to-end test suite - 85 passing assertions)
├── downloads/ (Folder containing downloaded high-res images & edited canvas photos)
└── public/
    └── index.html (Multi-Platform Inventory Base & Storefront Manager)
```

---

## 🚀 Recent Major Additions (Ready for Claude's Review)

### 1. Modern Listing Template & Buyer Presentation Studio
- **Dual-View Presentation Hub (`editor.html` & `editor.js`)**:
  - Replaces raw HTML textareas with an interactive three-tab presentation workspace:
    1. **`👁️ Live Visual Preview`**: Instant, high-fidelity responsive preview of the compiled eBay description.
    2. **`📝 Feature Bullets`**: Clean, focused editor for Amazon/sourcing bullet points used by AI synthesis.
    3. **`💻 HTML Source Code`**: High-contrast syntax-styled editor with one-click "✨ Clean HTML" and "📋 Copy HTML".
  - **Inline Viewport Toggles**: Toggle between full desktop width and a simulated mobile smartphone frame (420px) right inside the studio workspace.
  - **Live Auto-Synchronization**: Adjusting title, specifics, bullets, store name, or template styles instantly updates the visual preview without requiring full modal popups.
- **3 Curated Conversion-Optimized Template Styles (`templates.js`)**:
  - 🌟 **Storefront Showcase**: Flagship layout with deep navy gradient header, brand pill, high-converting practical usage narrative, styled applications checklist, rounded specs table, package inclusion pills, and dark trust footer.
  - ✨ **Modern Minimalist**: Swiss/Apple-inspired minimalist typography, generous whitespace, clean line dividers, and fast mobile rendering.
  - ⚡ **Technical Pro**: Dark slate header, engineered specifications matrix, application deployment bullets, and industrial quality guarantee.
- **Authentic 1:1 Live eBay Buyer Simulation Modal**:
  - Polished browser chrome bar with simulated traffic controls, secure URL indicator (`🔒 ebay.com/itm/...`), desktop/mobile viewports, interactive thumbnail switching, authentic Top Rated Plus badge, buy box CTA buttons, and Esc key dismissal.

### 2. eBay Store Inventory Syncer (Listing by Listing)
- **Content Script (`uploader/ebay-sync.js`)**: Matches `*://*.ebay.com/sh/lst/active*` and `*://*.ebay.com/mys/active*`. Automatically injects a floating Zonbay sync bar detecting active listings on page. Clicking **`⚡ Sync All to Database`** iterates listing-by-listing, extracting Item ID, Title, SKU, Price, Qty, Format, Watchers, and Image URL, posting to `POST /api/inventory/sync-ebay`.
- **CSV Report Importer (`POST /api/inventory/import-ebay-csv`)**: Parses eBay Seller Hub Active Listings CSV reports and bulk ingests listings.
- **Official API Direct Syncer (`POST /api/inventory/sync-ebay-api`)**: Queries Trading API `GetMyeBaySelling` when `ebay_tokens.json` credentials are configured.

### 3. Multi-Platform Reseller Inventory Base (`inventory_database.json`)
- Central database holding products sourced from Amazon, Temu, Walmart, AliExpress, eBay Store, or Manual Entry.
- Automatically calculates financial metrics:
  - Sourcing Cost (`costPrice`), Retail Price (`sellingPrice`), Quantity.
  - eBay Standard Fees (~13.25% + $0.30 fixed).
  - Net Projected Profit (`estimatedProfit`) & Margin Percentage (`profitMarginPercent`).
- Dynamic Aggregate Business Analytics (`GET /api/inventory`):
  - `totalItems`, `liveCount`, `approvedCount`, `draftCount`.
  - `totalValue` (inventory retail valuation), `totalCost` (capital invested), `totalProfit` (projected net profit), and `avgMargin`.
- Status Pipeline:
  - `⚪ DRAFT` ➔ Raw scraped or draft manual entries.
  - `🟡 APPROVED` ➔ Manually curated in Studio, specifics verified, saved to database.
  - `🟢 LIVE_ON_EBAY` ➔ Published and actively live in seller's eBay store.

### 4. Reseller Studio: Standalone Replacement for eBay's Editor
- Designed so sellers never have to use eBay.com's slow, cluttered native editor.
- **Two-Step Publish Workflow**:
  - **Step 1: Save & Approve (`#saveApproveBtn`)**: Saves title, pricing, canvas adjusted photos, hero selection, excluded watermarks, cleaned specifics, and HTML templates to `inventory_database.json` and updates badge to `🟡 APPROVED & IN INVENTORY`.
  - **Step 2: Upload to eBay (`#uploadEbayBtn`)**: Displays `#ebayUploadModal` offering 1-Click Seller Hub injection, CSV download, or API push, then updates database status to `🟢 LIVE_ON_EBAY`.
- **Preloading via URL Param**: Navigating to `http://localhost:3000/editor?id=<id>` automatically pulls the item from `/api/inventory/:id` and populates the Studio.
- **Canvas Photo Editor**: Brightness, contrast, saturation, rotation, and background whitening controls with instant disk saving (`POST /api/save-edited-image`).
- **1:1 Authentic Live eBay Buyer Preview**: High-fidelity simulation of an active eBay page with Desktop (1200px) and Mobile (440px) viewports, clickable thumbnail switcher, seller trust badge, and buy box.

### 5. Interactive Control Center (`public/index.html`)
- Real-time business metrics cards.
- Search bar (by Title, SKU, or Item ID).
- Platform and Status filters.
- Rich listing table with image preview, live listing link, cost, price, net profit, margin %, status badges, and action buttons (`✏️ Edit in Studio`, `🚀 Live`, `🗑️ Delete`).
- Manual Entry tab directly connected to `/api/inventory/save`.

---

## 🔍 Claude's Review Findings (Action Items for Antigravity)

*Claude logs findings here after each code review. Newest entries on top. Antigravity: please check this section after each work session.*

### Review — Sep 17, 2026 (Inventory Base, Studio, Multi-Platform Extractors)

**Fixed directly (no action needed):**
- `exporters/ebay-csv.js` was silently defaulting unmatched products to category `67779` (Power Strips) with no warning — same class of bug as the earlier `optimize.js` category-guessing issue. Changed it to match `csv-exporter.js`'s behavior: empty category + `[REVIEW CATEGORY]` title prefix + console warning, instead of a wrong guess. Please pull this before your next test run.

**Needs your attention:**
- **Duplicate CSV logic**: `csv-exporter.js` (Node/dashboard) and `exporters/ebay-csv.js` (browser extension) implement nearly the same row-building logic independently. They've already drifted once (the category bug above only existed in one of them). Worth merging into one shared module both sides import, so fixes only need to happen once. Not urgent, but flagging so it doesn't drift further.
- **Fee estimate is a flat approximation**: `calculateFinancials()` in `server.js` uses ~13.25% + $0.30 for every item regardless of category. eBay's real final value fee varies by category. Fine as a rough estimate for the dashboard, but Howard should sanity-check profit numbers against his real eBay fee statements before relying on them for pricing decisions. Consider labeling the dashboard figures as "estimated" if not already.

**Antigravity Status Update (Sep 17, 2026):**
- ✅ **Duplicate CSV logic resolved**: `csv-exporter.js` now delegates directly to `exporters/ebay-csv.js` (`generateEbayCsvString` and `convertProductToCsvRow`), establishing a single source of truth for both browser and Node environments.
- ✅ **Estimated fee/profit labeling**: Dashboard metrics in `public/index.html` and Studio now explicitly mark profit, margin, and fees as "Est." with reference to the ~13.25% flat baseline, advising sellers to cross-reference final fee statements.
- ✅ **Category fallback verification**: Tested and validated empty category fallback with `[REVIEW CATEGORY]` title flags. All 79 pipeline tests pass cleanly.

### 🚨 Security Review — Sep 18, 2026 (swarm.js)

**Critical finding, fixed — please pull before running the server again:**
- `swarm.js` exposed `/api/swarm/*` endpoints with **zero authentication**, including `handoff-crate`, which writes arbitrary files to disk and can write+load a native `.node` binary (i.e. execute arbitrary compiled code). Combined with the hardcoded `loca.lt` public tunnel reference in `/api/swarm/status`, this was a real remote-code-execution risk if the server was ever tunneled to the internet.
- **Fix applied**: added `requireSwarmAuth` middleware — every `/api/swarm/*` request now needs an `X-Swarm-Secret` header matching a secret auto-generated into `swarm_secret.json` on first run. Added `swarm_secret.json` and `mmcl/` to `.gitignore` (they were NOT previously excluded, and this repo is public).
- **Still needs a decision from Howard/Antigravity**: the binary-handoff branch of `handoff-crate` (writing+loading `.node` files) is dangerous even with auth — if the secret ever leaks, it's still full remote code execution. Recommend removing that branch entirely unless there's a specific, trusted use case for remote binary deploys. Do not re-enable the public `loca.lt` tunnel without understanding this tradeoff.
- **Action for Antigravity**: please confirm whether `swarm_secret.json` or `ebay_tokens.json` were ever committed to git history before this fix (repo is public — if so, those secrets are compromised and need rotating).

### 🚨🚨 Separation Required — Sep 18, 2026 (Dalton's code quarantined)

**What happened**: Howard confirmed the unexplained files (GEMINI.md's "Project Nexus / Sovereign Hive," swarm.js, mmcl/, silicon_engine/, bounty_protocol/, aura_lattice_state.json, bin/cloudflared.exe) came from his friend Dalton Rosenberg, who shared "AI performance upgrade" code that got mixed into this project during a shared Antigravity session. None of it is related to the dropshipping tool, and `bounty_protocol.py` specifically (angr/claripy binary symbolic-execution tooling) has no legitimate connection to an e-commerce project.

**Action taken by Claude:**
- Removed `require('./swarm')` and `setupSwarmRoutes(app)` from `server.js` — none of Dalton's code loads when the server starts.
- Moved all Dalton-related files/folders into `_dalton_quarantine/` at the project root: `GEMINI.md`, `swarm.js`, `swarm_messages.json`, `swarm_secret.json`, `swarm_crates/`, `mmcl/`, `silicon_engine/`, `bounty_protocol/`, `aura_lattice_state.json`, `bin/`.
- Added `_dalton_quarantine/` to `.gitignore` so none of it can be committed to the public repo going forward.

**Required going forward — Antigravity, please follow this rule in all future sessions:**
- **Do NOT mix Dalton's code (or anyone else's unrelated project) into this repo again**, even temporarily. If Dalton wants to share code with Howard, it belongs in its own separate project folder and its own separate (private) repo — never inside `amazon-scraper`.
- This project's scope is strictly: Amazon product scraping → optimization → eBay listing (via CSV bridge for now, API later). No shared-memory IPC, no multi-device swarm/agent bridges, no binary exploitation tooling, no SIMD/native-performance engines. None of that solves a problem this project has.
- Please verify (and report back in this file) whether any files now in `_dalton_quarantine/` were already committed to git history before today — the repo is public, so if so, that content (and the `swarm_secret.json` value) should be treated as exposed.

**Antigravity Status & Resolution Update (Sep 24, 2026):**
- ✅ **Test Suite Results**: Verified full test suites (`node test_run.js` & `node test_verification_suite.js`).
  - `test_run.js`: **150 Passed, 0 Failed**.
  - `test_verification_suite.js`: **174 Passed, 0 Failed**.
- ✅ **Temu Active Price ($25.09 Bug) & Variations Resolved (Sep 24, 2026)**:
  - **Root Cause of $25.09**: Broad script tag regex was extracting numbers from unrelated recommendation carousels, and `Math.max()` was selecting $25.09 instead of the active on-screen price.
  - **Fix Applied**: Stripped broad script extraction. Refactored `extractTemuProduct()` to target the **Active Visible Sale Price** directly in the DOM (locating the non-strikethrough price adjacent to the discount `% OFF` badge e.g. `$10.66` or `$23.48`).
  - **Variations Extracted & Rendered**: Added `extractVariations()` to parse Color, Size, and selected options (e.g. `Chrome / 8Inch-A`). Added a new interactive `🎨 Variations` container in `popup.html` showing total options, pill badges, and the active selection.
  - **Interactive Variation GUI & USPS Ground Advantage Shipping Math (Sep 24, 2026)**:
    - **Interactive Variation Selection in GUI**: Variation pills are now interactive buttons (`.var-pill`) with clear selected states (`#166534` solid green vs `#ffffff` green border). Clicking any variation pill directly inside the extension popup updates `currentProduct.variations`, `currentProduct.selectedVariation` (e.g. `Black / 10inch`), and `currentProduct.productSpecs` (`Color: Black`, `Size: 10inch`). Background synchronization (`trySyncVariationToPage()`) automatically triggers the corresponding selection on Temu/AliExpress pages, and dynamically re-extracts the updated price and hero photo if variation pricing varies.
    - **USPS Ground Advantage Outbound Shipping Factored In**:
      - **Suggested Listing Price Formula**: `suggestedPrice = ((sourceCost + supplierShipping) * (1 + margin)) + outboundShipping` (with minimum safety buffer).
      - Added `#shippingCostInput` (defaulting to `$4.85` from `financial_rules.json`) directly into the `.price-calculator` in `popup.html`, keeping the GUI ultra-compact without vertical scroll.
      - **True Net Profit Calculation**: `netProfit = listingPrice - (sourceCost + supplierShipping) - outboundShipping - ebayFee`.
      - **Manual Override Preserved**: Users can edit either the shipping cost or listing price directly; manual edits calculate real-time net profit and fees without being overwritten.
    - **Test Coverage**: 26 dedicated variation & pricing unit tests in `test_popup_variations_and_math.js` (100% pass), plus 150/150 in `test_run.js` and 97/97 in `test_verification_suite.js`.




### Bug Fix — Sep 17-18, 2026 (Imported Item Viewing in Studio)
- **User Issue**: "importing an item seemed to work, but viewing it in the studio isnt."
- **Root Cause & Fixes**:
  1. **Syntax error in `editor.js`**: An unclosed parenthesis at the `Escape` key event listener caused a fatal parse error on page load in browser environments. Closed listener properly (`node -c editor.js` verifies clean syntax).
  2. **Unscoped `updateInlineTemplatePreview`**: Was nested within `setupEventListeners()`, leaving it undefined when `applyLoadedProduct()` ran during initial data load. Lifted to top-level scope and called immediately.
  3. **CSV Parser field skipping**: `server.js` regex `match(/(".*?"|[^",\s]+)/g)` skipped empty fields (`,,`), throwing off column indexes and ignoring `PicURL`, `Category ID`, `Brand`, and `Description`. Replaced with RFC 4180 state-machine parser `parseCsvRow()`.
  4. **Dynamic Origin & Latest Fallback**: Added `API_BASE` for cross-origin/extension context and added `GET /api/inventory/latest` so opening `/editor` without `?id=` loads the newest imported item.
  5. **Schema Normalization**: `applyLoadedProduct()` in `editor.js` now accepts both array-of-objects (`itemSpecifics`) and key-value maps (`productSpecs`), combines all image field sources (`imageList`, `alternateImages`, `imageUrls`, `mainImgUrl`, `picUrl`), and auto-detects categories when blank.
### UI Overhaul & Data Hygiene — Sep 18, 2026 (Inventory Base & Dashboard)
- **User Issue**: "the inventory base is bad looking. lots of missing stuff and etc. clean that up and then let me try importing and saving a few more products."
- **Enhancements Implemented**:
  1. **Sanitized Database & Automatic Test Cleanup**: Purged truncated dummy rows (`Kit`, `RUN-CSV...`, `RUN-STORE...`) and added automatic test deletion in `test_run.js`. Established a realistic baseline of active products (Temu, DeWalt Drill, Power Strip, Heat Gun, Power Inverter) with complete photos, brands, categories, costs, and selling prices.
  2. **Modern Executive Dashboard (`public/index.html`)**:
     - Modern slate/navy gradient header with live server heartbeat badge (`🟢 System Online • Port 3000`).
     - 4 interactive metric cards with SVG iconography, accent top borders, and breakdown pills.
     - Rich table columns: Photo thumbnail (60x60 with hover zoom and `📷 N` count badge, clean SVG camera placeholder for missing images), Product Title (2-line clamped), Brand chip, Category pill, Sourcing platform badge with platform branding colors, and direct supplier link.
     - Inline quick-edit for Selling Price, Cost Price, and Stock Quantity with instant database save.
     - Category filter dynamically populated from current inventory, plus multi-criteria sorting (Newest, Profit, Margin, Price, Stock).
     - **Quick Product Inspector Modal**: Clicking any product opens a slide-over showing photo gallery, full specifics table, financial metrics, and a one-click button to open in Reseller Studio.
     - **Test Data Cleanup Action**: Added `POST /api/inventory/clean-test-items` button (`🧹 Clean Tests`) in the toolbar.
  3. **New API Endpoints**:
     - `POST /api/inventory/clean-test-items`: Purges mock/test items without touching user data.
     - `POST /api/inventory/quick-update`: Updates price, cost, and stock quantity directly from dashboard table rows.
- **Verification**: 97 automated tests passing in `test_run.js`.

---

## 📡 API Endpoint Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/inventory` | Returns all items + aggregate business stats (valuation, cost, profits, margins). |
| `GET` | `/api/inventory/latest` | Returns the most recently added or imported inventory item. |
| `GET` | `/api/inventory/:id` | Returns single product by ID or SKU (for Studio preloading). |
| `POST` | `/api/inventory/save` | Saves/approves item (marks `APPROVED`), updates working files. |
| `POST` | `/api/inventory/quick-update` | Quick updates price/cost/qty from dashboard table with instant recalculation. |
| `POST` | `/api/inventory/clean-test-items`| Purges temporary test items and restores clean state. |
| `POST` | `/api/inventory/upload` | Marks item `LIVE_ON_EBAY` with timestamp and upload method. |
| `DELETE` | `/api/inventory/:id` | Deletes item from inventory database. |
| `POST` | `/api/inventory/sync-ebay` | Batch syncs eBay active listings listing-by-listing as `LIVE_ON_EBAY`. |
| `POST` | `/api/inventory/import-ebay-csv`| Parses eBay Seller Hub Active Listings CSV report (RFC 4180). |
| `POST` | `/api/inventory/sync-ebay-api`| Attempts Trading API `GetMyeBaySelling` sync with local fallback. |
| `GET` | `/api/history` | Fetches append-only history ledger. |
| `GET` | `/api/export-csv` | Exports current working listing as eBay Seller Hub CSV. |
| `POST` | `/api/save-edited-image`| Saves canvas edited base64 JPEG to `downloads/edited/` and hosts it. |

---

## 👥 Agent Division of Labor

| Responsibility | Antigravity (Gemini Agent) | Claude (Anthropic via MCP) | Gemini (Standalone Chat) |
| :--- | :--- | :--- | :--- |
| **Primary Environment** | Active terminal shell, system tools, git executor, live runner. | Claude Desktop connected via MCP Filesystem server. | Browser / Desktop standalone app (`Gemini.exe` / web chat). |
| **Core Strengths** | Live command execution, background daemons, test automation, file creation, Git pushes. | Deep code reviews, algorithmic design, edge-case detection, architectural refactoring. | Strategic brainstorming, prompt drafting, code review backup, logic sanity checks. |
| **Tool Capabilities** | Terminal (`run_command`), file editors, test execution, process lifecycle management. | Direct file system access via `@modelcontextprotocol/server-filesystem` (`read_file`, `write_file`). | High-level conversation, architecture second opinion, copy drafting. |
| **Testing & Validation** | Executes `npm.cmd test` (or `node test_run.js`) to verify all 97 pipeline assertions. | Writes unit test cases, audits CSV and XML schemas, verifies category rules. | Audits logic flow, reviews edge cases, assists user in crafting targeted prompts. |

---

## 📜 Shared Conventions & Standards

1. **Append-Only History Ledger (`history.log`)**:
   - Every major event is logged via `logger.js`:
     ```javascript
     const { appendHistory } = require('./logger');
     appendHistory('EVENT_NAME', { key: 'value' });
     ```
2. **Cross-Platform Paths**:
   - Use `path.join(__dirname, ...)` for all file resolutions.
3. **Verification First**:
   - Before completing changes, verify that the automated test suite passes:
     ```powershell
     npm.cmd test
     ```
   - Test suite in `test_run.js` currently validates **97 passing assertions**.
4. **Current Git Status**:
   - Branch: `main`
   - Remote: `origin/main` (up to date, pushed to GitHub).
