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

---


## 📡 API Endpoint Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/inventory` | Returns all items + aggregate business stats (valuation, cost, profits, margins). |
| `GET` | `/api/inventory/:id` | Returns single product by ID or SKU (for Studio preloading). |
| `POST` | `/api/inventory/save` | Saves/approves item (marks `APPROVED`), updates working files. |
| `POST` | `/api/inventory/upload` | Marks item `LIVE_ON_EBAY` with timestamp and upload method. |
| `DELETE` | `/api/inventory/:id` | Deletes item from inventory database. |
| `POST` | `/api/inventory/sync-ebay` | Batch syncs eBay active listings listing-by-listing as `LIVE_ON_EBAY`. |
| `POST` | `/api/inventory/import-ebay-csv`| Parses eBay Seller Hub Active Listings CSV report. |
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
| **Testing & Validation** | Executes `npm.cmd test` (or `node test_run.js`) to verify all 85 pipeline assertions. | Writes unit test cases, audits CSV and XML schemas, verifies category rules. | Audits logic flow, reviews edge cases, assists user in crafting targeted prompts. |

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
   - Test suite in `test_run.js` currently validates **85 passing assertions**.
4. **Current Git Status**:
   - Branch: `main`
   - Remote: `origin/main` (up to date, pushed to GitHub).

