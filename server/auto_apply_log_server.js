#!/usr/bin/env node

const fs = require("fs");
const http = require("http");
const path = require("path");

const PORT = Number(process.env.BOSS_LOG_PORT || 17321);
const TOKEN = process.env.BOSS_LOG_TOKEN || "";
const LOG_DIR = process.env.BOSS_LOG_DIR || path.join(__dirname, "logs");
const LOG_FILE = path.join(LOG_DIR, "auto_apply_logs.jsonl");
const MAX_BODY_BYTES = Number(process.env.BOSS_LOG_MAX_BODY_BYTES || 2 * 1024 * 1024);

fs.mkdirSync(LOG_DIR, { recursive: true });

function sendJson(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Log-Token"
    });
    res.end(JSON.stringify(data));
}

function isAuthorized(req) {
    if (!TOKEN) return true;
    const auth = req.headers.authorization || "";
    const headerToken = req.headers["x-log-token"] || "";
    return auth === `Bearer ${TOKEN}` || headerToken === TOKEN;
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];

        req.on("data", chunk => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                reject(new Error("body too large"));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });

        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        req.on("error", reject);
    });
}

const server = http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
        sendJson(res, 204, {});
        return;
    }

    if (req.method === "GET" && req.url === "/health") {
        sendJson(res, 200, { ok: true, logFile: LOG_FILE });
        return;
    }

    if (req.method !== "POST" || req.url !== "/log") {
        sendJson(res, 404, { ok: false, error: "not found" });
        return;
    }

    if (!isAuthorized(req)) {
        sendJson(res, 401, { ok: false, error: "unauthorized" });
        return;
    }

    try {
        const body = await readBody(req);
        const payload = JSON.parse(body);
        const record = {
            receivedAt: new Date().toISOString(),
            ip: req.socket.remoteAddress || "",
            payload
        };

        fs.appendFile(LOG_FILE, `${JSON.stringify(record)}\n`, err => {
            if (err) {
                sendJson(res, 500, { ok: false, error: err.message });
                return;
            }
            sendJson(res, 200, { ok: true });
        });
    } catch (err) {
        sendJson(res, 400, { ok: false, error: err.message });
    }
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`[boss-agent-log] listening on 0.0.0.0:${PORT}`);
    console.log(`[boss-agent-log] writing to ${LOG_FILE}`);
});
