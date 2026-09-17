# Multi-Agent Collaboration Protocol (Claude, Antigravity & Gemini Standalone)

Welcome to the **zonbay** (`amazon-scraper`) workspace! This document outlines how **Claude**, **Antigravity (Gemini Agent)**, and **Gemini (Standalone Chat)** collaborate seamlessly on this codebase.

---

## 🏗️ Architecture Quick Reference

```text
amazon-scraper/
├── server.js (Core dashboard/API router)
├── optimize.js (Title engine, text cleaner, image downloader)
├── upload-images.js (Converts local files to local web host links)
├── auth.js & ebay_headers.js (API placeholders - currently paused)
├── csv-exporter.js (Server-side eBay Seller Hub RFC 4180 CSV builder)
├── logger.js & history.log (Append-only ledger tracking item events & errors)
├── ebay_ready_product.json (Raw scraped data cache)
├── ebay_optimized_package.json (Intermediate payload with clean metadata)
├── ebay_final_api_ready.json (Final local optimized payload with live URLs)
├── extractors/
│   ├── amazon.js (Stealth in-browser Amazon product data & hi-res image extractor)
│   └── temu.js (Stealth in-browser Temu product & carousel image extractor)
├── exporters/
│   └── ebay-csv.js (Universal portable CSV exporter for browser & Node.js)
├── uploader/
│   └── ebay-uploader.js (Content script automating Seller Hub CSV uploads)
├── manifest.json (Chrome Extension MV3 definition)
├── popup.html & popup.js (Zonbay Reseller Cockpit UI & profit calculator)
├── test_run.js (Automated end-to-end regression & assertion test suite)
├── downloads/ (Folder containing downloaded high-res images)
└── public/
    └── index.html (Responsive multi-tab GUI control dashboard)
```

---

## 👥 Agent Division of Labor

| Responsibility | Antigravity (Gemini Agent) | Claude (Anthropic via MCP) | Gemini (Standalone Chat) |
| :--- | :--- | :--- | :--- |
| **Primary Environment** | Active terminal shell, system tools, git executor, live runner. | Claude Desktop connected via MCP Filesystem server. | Browser / Desktop standalone app (`Gemini.exe` / web chat). |
| **Core Strengths** | Live command execution, background daemons, test automation, file creation, Git pushes. | Deep code reviews, algorithmic design (SEO title rules, token optimization), edge-case detection, architectural refactoring. | Strategic brainstorming, prompt drafting, code review backup, logic sanity checks, quota overflow resilience. |
| **Tool Capabilities** | Terminal (`run_command`), file editors, test execution, process lifecycle management. | Direct file system access via `@modelcontextprotocol/server-filesystem` (`read_file`, `write_file`). | High-level conversation, architecture second opinion, copy drafting, emergency code review when MCP is offline. |
| **Testing & Validation** | Executes `npm.cmd test` (or `node test_run.js`) to verify all 28 pipeline assertions. | Writes unit test cases, audits CSV and XML schemas, verifies category rules. | Audits logic flow, reviews edge cases, assists user in crafting targeted prompts for Antigravity or Claude. |

---

## 📜 Shared Conventions & Standards

1. **Append-Only History Ledger (`history.log`)**:
   - Every major event (scrape, manual entry, optimization, image upload, listing revision, or edge-case error) is logged via `logger.js`:
     ```javascript
     const { appendHistory } = require('./logger');
     appendHistory('EVENT_NAME', { key: 'value' });
     ```
   - Do not manually truncate or overwrite `history.log`.

2. **Cross-Platform Paths**:
   - Use `path.join(__dirname, ...)` for all file resolutions.
   - When parsing file paths, split on `/[/\\]/` to support both Windows (`\`) and POSIX (`/`) separators.

3. **Verification First**:
   - Before completing changes, verify that the automated test suite passes:
     ```powershell
     npm.cmd test
     ```
   - Test suite is defined in `test_run.js` (currently 28 passing assertions).

4. **Stealth In-Browser Ingestion**:
   - Scraping occurs in-browser via extension content scripts (`extractors/amazon.js`, `extractors/temu.js`) using the user's authentic session and residential IP to eliminate Cloudflare/bot blocks.

---

## 🔄 Collaboration Hand-Off Workflow

1. **Claude**:
   - Reads project files using the Claude Desktop MCP Filesystem server.
   - Proposes improvements or writes code changes directly to disk.
   - Prompts the user: *"I've updated `optimize.js` with improved title SEO. Ask Antigravity to run `test_run.js` to verify."*

2. **Gemini (Standalone Chat)**:
   - Acts as an on-demand strategic sounding board, backup reviewer, and prompt generator.
   - User pastes snippets or error messages into Gemini Standalone for rapid second opinions or logic brainstorming without consuming Antigravity/Claude context.
   - Helps draft precise tasks for Antigravity or Claude to execute.

3. **Antigravity**:
   - Inspects the modified files and runs `git diff`.
   - Executes `node test_run.js` (or `npm.cmd test`) to ensure the full pipeline passes.
   - Commits and pushes the updates to `origin/main` on GitHub.
