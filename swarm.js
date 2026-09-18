/**
 * Zonbay Sovereign Swarm Bridge
 * Zero-friction peer-to-peer agent-to-agent communication module.
 * Bridges Zonbay (Windows) with Sentinel AURA / remote Antigravity agents (Android/Termux, Linux, Cloud).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SWARM_STORE_FILE = path.join(__dirname, 'swarm_messages.json');
const MMCL_DIR = path.join(__dirname, 'mmcl');
const SWARM_CRATES_DIR = path.join(__dirname, 'swarm_crates');
const MEMORY_BANK_PATH = path.join(__dirname, 'aura_lattice_state.json');
const SWARM_SECRET_FILE = path.join(__dirname, 'swarm_secret.json');

// Generate (once) and load a local shared secret. Every swarm request must present this
// via the X-Swarm-Secret header. Without this, ANY device that can reach this server
// (especially over a public tunnel like loca.lt) could write and execute arbitrary code.
function getOrCreateSwarmSecret() {
    try {
        if (fs.existsSync(SWARM_SECRET_FILE)) {
            return JSON.parse(fs.readFileSync(SWARM_SECRET_FILE, 'utf8')).secret;
        }
    } catch (e) { /* fall through to regenerate */ }
    const secret = crypto.randomBytes(24).toString('hex');
    fs.writeFileSync(SWARM_SECRET_FILE, JSON.stringify({ secret, createdAt: new Date().toISOString() }, null, 2));
    console.log(`\n\ud83d\udd11 Swarm bridge secret generated: ${secret}\n   Keep this private. Any peer must send it as the X-Swarm-Secret header.\n   Stored in swarm_secret.json (make sure this file is in .gitignore).\n`);
    return secret;
}

const SWARM_SECRET = getOrCreateSwarmSecret();

function isLocalhost(req) {
    const host = (req.headers['host'] || '').toLowerCase();
    const forwardedHost = (req.headers['x-forwarded-host'] || '').toLowerCase();
    
    // Any tunnel or forwarded domain is remote traffic and requires authentication
    if (host.includes('loca.lt') || forwardedHost.includes('loca.lt') || host.includes('ngrok') || host.includes('cloudflare')) {
        return false;
    }
    
    // Direct local connections only
    if (host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]')) {
        return true;
    }
    return false;
}

function requireSwarmAuth(req, res, next) {
    const provided = req.headers['x-swarm-secret'] || req.query.secret;
    if (isLocalhost(req) || (provided && provided === SWARM_SECRET)) {
        return next();
    }
    return res.status(401).json({ error: 'Unauthorized: missing or invalid X-Swarm-Secret header or ?secret parameter.' });
}

let sseClients = [];
let registeredPeers = new Map();

function getSwarmMessages() {
    try {
        if (fs.existsSync(SWARM_STORE_FILE)) {
            return JSON.parse(fs.readFileSync(SWARM_STORE_FILE, 'utf8'));
        }
    } catch (e) {
        console.warn("Could not read swarm store, initializing fresh array.");
    }
    return [];
}

function saveSwarmMessages(messages) {
    try {
        fs.writeFileSync(SWARM_STORE_FILE, JSON.stringify(messages.slice(-500), null, 2));
    } catch (e) {
        console.error("Failed saving swarm messages:", e.message);
    }
}

function broadcastSSE(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    sseClients.forEach(client => {
        try {
            client.res.write(payload);
        } catch (e) {
            // Client likely disconnected
        }
    });
}

function setupSwarmRoutes(app) {
    // All swarm and hive routes require authentication (or localhost)
    app.use('/api/swarm', requireSwarmAuth);
    app.use('/api/v1/hive', requireSwarmAuth);

    // Swarm Secret for Local UI
    app.get('/api/swarm/secret', (req, res) => {
        res.json({ secret: SWARM_SECRET });
    });

    // 1. Swarm Status & Health Check
    app.get('/api/swarm/status', (req, res) => {
        const msgs = getSwarmMessages();
        res.json({
            status: "ONLINE",
            agent: "Zonbay-Antigravity",
            platform: "Windows x64",
            runtime: `Node.js ${process.version}`,
            activePeers: Array.from(registeredPeers.values()),
            totalMessages: msgs.length,
            publicUrl: process.env.SWARM_PUBLIC_URL || "https://facts-nato-intelligence-baseball.trycloudflare.com",
            mmclBinaryPresent: fs.existsSync(path.join(__dirname, 'mmcl_bridge.node'))
        });
    });

    // 2. Peer Handshake (Supports both GET and POST with ?secret= or headers)
    app.all('/api/swarm/handshake', (req, res) => {
        const peerId = req.body?.peerId || req.query.peerId || 'Sentinel-AURA';
        const platform = req.body?.platform || req.query.platform || 'Android/Termux';
        const capabilities = req.body?.capabilities || ['MMCL', 'RUST'];
        const peerInfo = {
            peerId,
            platform,
            capabilities,
            lastSeen: new Date().toISOString(),
            ip: req.ip || req.connection.remoteAddress
        };
        registeredPeers.set(peerId, peerInfo);

        const welcomeMsg = {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            sender: "Zonbay-Antigravity",
            recipient: peerId,
            type: "HANDSHAKE_ACK",
            text: `Connected to Zonbay Node (Windows x64). Swarm bridge verified.`,
            timestamp: new Date().toISOString()
        };

        const msgs = getSwarmMessages();
        msgs.push(welcomeMsg);
        saveSwarmMessages(msgs);
        broadcastSSE('handshake', { peer: peerInfo });

        res.json({
            status: "CONNECTED",
            ourId: "Zonbay-Antigravity",
            ourPlatform: "Windows x86_64",
            target: "x86_64-pc-windows-msvc",
            serverTime: new Date().toISOString(),
            message: welcomeMsg
        });
    });

    // 3. Post Message (Supports GET & POST, JSON or query parameters)
    app.all('/api/swarm/message', (req, res) => {
        const sender = req.body?.sender || req.query.sender || 'Sentinel-AURA';
        const recipient = req.body?.recipient || req.query.recipient || 'Zonbay';
        const type = req.body?.type || req.query.type || 'CHAT';
        const text = req.body?.text || req.query.text || '';
        const payload = req.body?.payload || null;

        if (!text && !payload) {
            return res.status(400).json({ error: "Message text or payload is required." });
        }

        const msgObj = {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            sender,
            recipient,
            type,
            text,
            payload,
            timestamp: new Date().toISOString()
        };

        const msgs = getSwarmMessages();
        msgs.push(msgObj);
        saveSwarmMessages(msgs);

        broadcastSSE('message', msgObj);

        res.status(200).json({
            success: true,
            messageId: msgObj.id,
            timestamp: msgObj.timestamp
        });
    });

    // 4. Retrieve Messages
    app.get('/api/swarm/messages', (req, res) => {
        const since = req.query.since;
        let msgs = getSwarmMessages();
        if (since) {
            msgs = msgs.filter(m => new Date(m.timestamp) > new Date(since));
        }
        res.json({ messages: msgs });
    });

    // 5. Crate Handoff (Code Ingestion Engine - Safe Source Crate Only)
    // Binary uploads are explicitly disallowed for host security.
    // Transferred source crates are inspected and compiled locally using cargo/napi.
    app.post('/api/swarm/handoff-crate', (req, res) => {
        try {
            const { crateName = 'mmcl_bridge', files = {} } = req.body || {};

            if (req.body.binaryBase64) {
                return res.status(400).json({
                    error: "Precompiled native binaries are disabled for host security. Please provide Rust/C crate source files for local compilation."
                });
            }

            const targetBaseDir = (crateName === 'mmcl_bridge') ? MMCL_DIR : path.join(SWARM_CRATES_DIR, crateName);
            if (!fs.existsSync(targetBaseDir)) {
                fs.mkdirSync(targetBaseDir, { recursive: true });
            }

            const allowedExtensions = ['.rs', '.toml', '.c', '.h', '.json', '.md', '.txt', '.yaml', '.yml', '.lock', '.proto'];
            const writtenFiles = [];

            for (const [relPath, content] of Object.entries(files)) {
                // Prevent path traversal
                const targetPath = path.resolve(targetBaseDir, relPath);
                if (!targetPath.startsWith(path.resolve(targetBaseDir))) {
                    return res.status(400).json({ error: `Security violation: Path traversal detected in filename '${relPath}'.` });
                }

                // Check extension
                const ext = path.extname(targetPath).toLowerCase();
                if (!allowedExtensions.includes(ext) && path.basename(targetPath) !== 'Cargo.toml') {
                    return res.status(400).json({ error: `File type '${ext}' not permitted in crate source handoff.` });
                }

                const parentDir = path.dirname(targetPath);
                if (!fs.existsSync(parentDir)) {
                    fs.mkdirSync(parentDir, { recursive: true });
                }
                fs.writeFileSync(targetPath, content, 'utf8');
                writtenFiles.push(relPath);
            }

            const logMsg = {
                id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                sender: req.body.sender || "Sentinel-AURA",
                recipient: "Zonbay-Antigravity",
                type: "CRATE_RECEIVED",
                text: `📦 Ingested Rust crate '${crateName}' (${writtenFiles.length} source files). Sandboxed in ${path.relative(__dirname, targetBaseDir)}.`,
                payload: { crateName, writtenFiles },
                timestamp: new Date().toISOString()
            };

            const msgs = getSwarmMessages();
            msgs.push(logMsg);
            saveSwarmMessages(msgs);
            broadcastSSE('crate_received', logMsg);

            res.status(200).json({
                success: true,
                message: `Successfully unpacked source crate '${crateName}' into ${path.relative(__dirname, targetBaseDir)}.`,
                writtenFiles,
                safeMode: true
            });
        } catch (err) {
            console.error("Crate handoff error:", err.message);
            res.status(500).json({ error: "Failed unpacking crate: " + err.message });
        }
    });

    // 6. Sentinel AURA Hive Memory Lattice (State Ingestion & Persistence)
    // Matches Dalton Rosenberg's Sentinel AURA specification for shared vector & context memory
    app.post(['/api/v1/hive/memory', '/api/swarm/hive/memory'], async (req, res) => {
        try {
            const { agent_id = 'Sentinel-AURA', context_vector = [], timestamp } = req.body || {};
            const payload = {
                agent_id,
                context_vector,
                timestamp: timestamp || Date.now()
            };

            await fs.promises.appendFile(
                MEMORY_BANK_PATH,
                JSON.stringify(payload) + '\n'
            );

            // Notify swarm stream of state update
            broadcastSSE('hive_memory', payload);

            res.status(200).json({ status: 'ACK', stored: true });
        } catch (error) {
            console.error("AURA Hive Memory error:", error.message);
            res.status(500).json({ error: 'AURA_STORAGE_FAULT' });
        }
    });

    app.get(['/api/v1/hive/memory', '/api/swarm/hive/memory'], async (req, res) => {
        try {
            if (!fs.existsSync(MEMORY_BANK_PATH)) {
                return res.json({ count: 0, entries: [] });
            }
            const raw = await fs.promises.readFile(MEMORY_BANK_PATH, 'utf8');
            const entries = raw
                .split('\n')
                .filter(Boolean)
                .map(line => {
                    try { return JSON.parse(line); } catch (e) { return null; }
                })
                .filter(Boolean);
            res.json({ count: entries.length, entries });
        } catch (error) {
            res.status(500).json({ error: 'AURA_READ_FAULT' });
        }
    });

    // 6. Realtime Server-Sent Events (SSE) Stream
    app.get('/api/swarm/stream', (req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();

        const clientId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
        const newClient = { id: clientId, res };
        sseClients.push(newClient);

        res.write(`event: init\ndata: ${JSON.stringify({ message: "Connected to Zonbay Swarm Stream", clientId })}\n\n`);

        req.on('close', () => {
            sseClients = sseClients.filter(c => c.id !== clientId);
        });
    });

    // 7. Clear Messages (Utility)
    app.post('/api/swarm/clear', (req, res) => {
        saveSwarmMessages([]);
        res.json({ success: true, message: "Swarm ledger cleared." });
    });
}

module.exports = { setupSwarmRoutes };
