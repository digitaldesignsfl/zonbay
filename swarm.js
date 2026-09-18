/**
 * Zonbay Sovereign Swarm Bridge
 * Zero-friction peer-to-peer agent-to-agent communication module.
 * Bridges Zonbay (Windows) with Sentinel AURA / remote Antigravity agents (Android/Termux, Linux, Cloud).
 */

const fs = require('fs');
const path = require('path');

const SWARM_STORE_FILE = path.join(__dirname, 'swarm_messages.json');
const MMCL_DIR = path.join(__dirname, 'mmcl');

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
            publicUrl: "https://zonbay-swarm.loca.lt",
            mmclBinaryPresent: fs.existsSync(path.join(__dirname, 'mmcl_bridge.node'))
        });
    });

    // 2. Peer Handshake
    app.post('/api/swarm/handshake', (req, res) => {
        const { peerId = 'Anonymous-Agent', platform = 'Unknown', capabilities = [] } = req.body || {};
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

    // 3. Post Message
    app.post('/api/swarm/message', (req, res) => {
        const { sender = 'External-Agent', recipient = 'Zonbay', type = 'CHAT', text = '', payload = null } = req.body || {};
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

    // 5. Crate Handoff (Code Ingestion Engine)
    app.post('/api/swarm/handoff-crate', (req, res) => {
        try {
            const { crateName = 'mmcl_bridge', files = {}, binaryBase64 = null, binaryName = 'mmcl_bridge.node' } = req.body || {};

            if (!fs.existsSync(MMCL_DIR)) {
                fs.mkdirSync(MMCL_DIR, { recursive: true });
            }

            const writtenFiles = [];
            for (const [relPath, content] of Object.entries(files)) {
                const fullPath = path.join(MMCL_DIR, relPath);
                const parentDir = path.dirname(fullPath);
                if (!fs.existsSync(parentDir)) {
                    fs.mkdirSync(parentDir, { recursive: true });
                }
                fs.writeFileSync(fullPath, content, 'utf8');
                writtenFiles.push(relPath);
            }

            // Write precompiled .node binary if included
            let binaryPath = null;
            if (binaryBase64) {
                const binBuffer = Buffer.from(binaryBase64, 'base64');
                const targetBin = path.join(__dirname, binaryName);
                fs.writeFileSync(targetBin, binBuffer);
                binaryPath = targetBin;
                writtenFiles.push(binaryName);
            }

            const logMsg = {
                id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                sender: req.body.sender || "Sentinel-AURA",
                recipient: "Zonbay-Antigravity",
                type: "CRATE_RECEIVED",
                text: `📦 Ingested Rust crate '${crateName}' (${writtenFiles.length} files). Binary: ${binaryPath ? '✅ Received' : '❌ Source only'}`,
                payload: { writtenFiles, binaryPath },
                timestamp: new Date().toISOString()
            };

            const msgs = getSwarmMessages();
            msgs.push(logMsg);
            saveSwarmMessages(msgs);
            broadcastSSE('crate_received', logMsg);

            res.status(200).json({
                success: true,
                message: `Successfully unpacked crate '${crateName}'.`,
                writtenFiles,
                binaryDeployed: Boolean(binaryPath)
            });
        } catch (err) {
            console.error("Crate handoff error:", err.message);
            res.status(500).json({ error: "Failed unpacking crate: " + err.message });
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
