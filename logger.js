const fs = require('fs');
const path = require('path');

const LOG_PATH = path.join(__dirname, 'history.log');

/**
 * Append-only ledger logger for tracking item histories
 * @param {string} event - The category of event (e.g., 'SCRAPED', 'MANUAL_ENTRY', 'OPTIMIZED', 'UPLOADED', 'REVISION')
 * @param {Object|string} details - Detailed attributes of the event
 */
function appendHistory(event, details) {
    const timestamp = new Date().toISOString();
    let detailStr = '';
    if (typeof details === 'object' && details !== null) {
        detailStr = Object.entries(details)
            .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
            .join(' | ');
    } else {
        detailStr = String(details || '');
    }
    const logLine = `[${timestamp}] [${event.toUpperCase()}] ${detailStr}\n`;
    try {
        fs.appendFileSync(LOG_PATH, logLine, 'utf8');
    } catch (err) {
        console.error('Failed to append to history.log:', err.message);
    }
    return logLine;
}

/**
 * Read the recent lines of the history ledger
 * @param {number} limit
 * @returns {string[]}
 */
function getHistory(limit = 100) {
    if (!fs.existsSync(LOG_PATH)) return [];
    try {
        const content = fs.readFileSync(LOG_PATH, 'utf8');
        const lines = content.split('\n').filter(l => l.trim().length > 0);
        return lines.slice(-limit);
    } catch (err) {
        console.error('Failed to read history.log:', err.message);
        return [];
    }
}

module.exports = { appendHistory, getHistory, LOG_PATH };
