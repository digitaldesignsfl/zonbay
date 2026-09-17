# Multi-Agent Collaboration Protocol (Claude & Antigravity)

Welcome to the **zonbay** (`amazon-scraper`) workspace! This document outlines how **Claude** and **Antigravity (Gemini)** collaborate seamlessly on this codebase.

---

## 🏗️ Architecture Quick Reference

```text
amazon-scraper/
├── server.js (Core dashboard/API router)
├── optimize.js (Title engine, text cleaner, image downloader)
├── upload-images.js (Converts local files to local web host links)
├── auth.js & ebay_headers.js (API placeholders - currently paused)
├── ebay_ready_product.json (Raw scraped data cache)
├── ebay_final_api_ready.json (Final local optimized payload)
├── history.log (Append-only text file ledger tracking item histories)
├── downloads/ (Folder containing downloaded high-res images)
└── public/
    └── index.html (Responsive multi-tab GUI control dashboard)
```

---

## 👥 Agent Division of Labor

| Responsibility | Antigravity (Gemini) | Claude (Anthropic) |
| :--- | :--- | :--- |
| **Local Terminal / Execution** | Runs commands, servers (`node server.js`), background tasks, and Git ops. | Uses MCP tools (`read_file`, `write_file`, `search_files`) to read and edit project files. |
| **Core Strengths** | Live command execution, interactive debugging, test automation, environment setup. | Deep code reviews, algorithmic design (SEO title rules, token optimization), edge-case detection, architectural refactoring. |
| **Testing & Validation** | Executes `node test_run.js` (or `npm.cmd test`) to verify all 16 pipeline assertions. | Writes unit test cases, refines logic, audits XML schemas (`ebay_new_item_blueprint.xml`). |

---

## 📜 Shared Conventions & Standards

1. **Append-Only History Ledger (`history.log`)**:
   - Every major event (scrape, manual entry, optimization, image upload, listing revision) is logged via `logger.js`:
     ```javascript
     const { appendHistory } = require('./logger');
     appendHistory('EVENT_NAME', { key: 'value' });
     ```
   - Do not manually truncate or overwrite `history.log`.

2. **Cross-Platform Paths**:
   - Use `path.join(__dirname, ...)` for file resolutions.
   - When parsing file paths, split on `/[/\\]/` to support both Windows (`\`) and POSIX (`/`) separators.

3. **Verification First**:
   - Before completing changes, verify that the automated test suite passes:
     ```powershell
     npm.cmd test
     ```
   - Test suite is defined in `test_run.js`.

---

## 🔄 Collaboration Hand-Off Workflow

1. **Claude**:
   - Reads files using the Claude Desktop MCP Filesystem server.
   - Proposes improvements or writes code changes directly to disk.
   - Prompts the user: *"I've updated `optimize.js` with improved title SEO. Ask Antigravity to run `test_run.js` to verify."*

2. **Antigravity**:
   - Checks the modified files and runs `git diff`.
   - Executes `node test_run.js` to ensure the full pipeline passes.
   - Commits and pushes the updates to `origin/main` on GitHub.
