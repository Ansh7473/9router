/**
 * Wire-level transports for user-configured MCP servers.
 *
 * Two transports are supported:
 *  - Remote HTTP (`remote-http` / `remote-sse`) via `fetch`.
 *  - Local stdio (`local-stdio`) via a spawned child process managed here.
 *
 * `sendToMcpServer` is the single public dispatcher — callers pass a server
 * record and a JSON-RPC message and don't need to know which transport is in
 * use.
 */

import { spawn } from "child_process";
import crypto from "crypto";
import {
  ensureCodeGraphInitialized,
  isCodeGraphServer,
  resolveLocalStdioSpawn,
  validateLocalStdioServer,
} from "../security.js";
import {
  getConnections,
  isInCooldown,
  setCooldown,
  getCooldownRemaining,
  STDIO_QUICK_FAILURE_MS,
} from "./state.js";

// ─── Timeouts ──────────────────────────────────────────────────────────────

const INIT_TIMEOUT_MS = 8_000;
const REMOTE_REQUEST_TIMEOUT_MS = 120_000;
const STDIO_REQUEST_TIMEOUT_MS = 15_000;

// ─── Remote HTTP transport ─────────────────────────────────────────────────

/**
 * Send a JSON-RPC request to a remote MCP server via HTTP POST.
 * Returns the parsed JSON-RPC response, or `null` for fire-and-forget.
 */
async function sendToRemoteServer(server, jsonRpc) {
  const url = server.url;
  if (!url) throw new Error("No URL configured for remote MCP server");

  const store = getConnections();
  if (!store.remoteSessions) store.remoteSessions = new Map();
  let mcpSessionId = store.remoteSessions.get(server.id);

  // Auto-initialize if we haven't yet handshaken with this server.
  if (!mcpSessionId && jsonRpc.method !== "initialize") {
    mcpSessionId = await autoInitializeRemoteServer(server, url);
    if (mcpSessionId) store.remoteSessions.set(server.id, mcpSessionId);
  }

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    ...(server.headers || {}),
    ...(mcpSessionId ? { "mcp-session-id": mcpSessionId } : {}),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REMOTE_REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(jsonRpc),
      signal: controller.signal,
    });

    const newSessionId = res.headers.get("mcp-session-id");
    if (newSessionId) store.remoteSessions.set(server.id, newSessionId);

    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("text/event-stream")) {
      const text = await res.text();
      for (const line of text.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.jsonrpc === "2.0") return data;
        } catch {
          /* skip non-JSON payloads */
        }
      }
      throw new Error("No JSON-RPC response found in SSE stream");
    }

    const text = await res.text();
    if (!text || text.trim() === "") return null;

    if (contentType.includes("application/json")) {
      try {
        return JSON.parse(text);
      } catch (e) {
        throw new Error(`Failed to parse JSON response: ${e.message}`);
      }
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Unexpected response format: ${contentType}`);
    }
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(
        `Request to ${url} timed out after ${REMOTE_REQUEST_TIMEOUT_MS / 1000}s`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function autoInitializeRemoteServer(server, url) {
  console.log(
    `[mcp-manager] Auto-initializing remote server "${server.name}"...`,
  );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), INIT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(server.headers || {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "9router-mcp", version: "1.0.0" },
        },
        id: `auto-init-${crypto.randomUUID()}`,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(
        `[mcp-manager] Auto-initialize "${server.name}" returned status ${res.status}`,
      );
      return null;
    }

    const sid = res.headers.get("mcp-session-id");
    if (sid) {
      console.log(
        `[mcp-manager] Successfully auto-initialized "${server.name}", session ID: ${sid}`,
      );
    } else {
      console.log(
        `[mcp-manager] Auto-initialized "${server.name}" with status OK (no session ID header)`,
      );
    }
    return sid;
  } catch (err) {
    console.error(
      `[mcp-manager] Auto-initialize failed for "${server.name}":`,
      err.message,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Local stdio transport ─────────────────────────────────────────────────

async function initializeStdioServer(entry, server) {
  try {
    console.log(`[mcp-stdio:${server.name}] Starting auto-initialization...`);
    const initResponse = await new Promise((resolve) => {
      const requestId = `init-${crypto.randomUUID()}`;
      const timeout = setTimeout(() => {
        entry.pendingRequests.delete(requestId);
        console.log(`[mcp-stdio:${server.name}] Auto-initialization timed out`);
        resolve(null);
      }, INIT_TIMEOUT_MS);

      entry.pendingRequests.set(requestId, (res) => {
        clearTimeout(timeout);
        resolve(res);
      });

      entry.proc.stdin.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: requestId,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "9router-mcp", version: "1.0.0" },
          },
        }) + "\n",
      );
    });

    if (initResponse) {
      console.log(
        `[mcp-stdio:${server.name}] Auto-initialization response received`,
      );
      entry.proc.stdin.write(
        JSON.stringify({
          jsonrpc: "2.0",
          method: "notifications/initialized",
        }) + "\n",
      );
    }
  } catch (err) {
    console.error(
      `[mcp-stdio:${server.name}] Auto-initialization failed:`,
      err.message,
    );
  }
}

/**
 * Spawn (or reuse) a local stdio server child and return the connection
 * entry. Callers should `await entry.initPromise` before writing requests.
 */
export function spawnLocalServer(server) {
  const store = getConnections();
  const entryKey = `stdio:${server.id}`;
  let entry = store.transports.get(entryKey);
  if (entry?.proc && !entry.proc.killed && entry.proc.exitCode === null) {
    return entry;
  }

  if (isInCooldown(server.command, server.args, server.env)) {
    const remaining = getCooldownRemaining(
      server.command,
      server.args,
      server.env,
    );
    throw new Error(
      `Server "${server.name}" is in cooldown after crash. Retry in ${Math.ceil(remaining / 1000)}s.`,
    );
  }

  const validation = validateLocalStdioServer(server);
  if (!validation.ok) throw new Error(validation.error);

  if (isCodeGraphServer(server)) {
    ensureCodeGraphInitialized();
  }

  const commandStartTime = Date.now();
  const spawnConfig = resolveLocalStdioSpawn(server.command, server.args || []);
  const proc = spawn(spawnConfig.command, spawnConfig.args, {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, ...(server.env || {}) },
    windowsHide: true,
  });

  entry = {
    proc,
    sessions: new Map(),
    buffer: "",
    startTime: commandStartTime,
    pendingRequests: new Map(),
  };
  store.transports.set(entryKey, entry);

  proc.stdout.on("data", (chunk) => {
    entry.buffer += chunk.toString("utf8");
    let idx;
    while ((idx = entry.buffer.indexOf("\n")) >= 0) {
      const raw = entry.buffer.slice(0, idx).trim();
      entry.buffer = entry.buffer.slice(idx + 1);
      if (!raw) continue;

      // Route pending request responses back to their `sendToStdioServer` promise.
      try {
        const json = JSON.parse(raw);
        if (json.id && entry.pendingRequests.has(json.id)) {
          const resolve = entry.pendingRequests.get(json.id);
          entry.pendingRequests.delete(json.id);
          resolve(json);
          continue;
        }
      } catch {
        /* not JSON — fall through to SSE broadcast */
      }

      // Everything else is a server-initiated notification/log — fan out to SSE clients.
      for (const send of entry.sessions.values()) {
        try {
          send(`event: message\ndata: ${raw}\n\n`);
        } catch {}
      }
    }
  });

  proc.stderr.on("data", (d) => {
    const msg = d.toString().trim();
    if (!msg) return;
    console.log(`[mcp-stdio:${server.name}] stderr:`, msg);
    for (const send of entry.sessions.values()) {
      try {
        send(
          `event: stderr\ndata: ${JSON.stringify({ server: server.name, message: msg })}\n\n`,
        );
      } catch {}
    }
  });

  proc.on("error", (err) => {
    console.error(`[mcp-stdio:${server.name}] process error:`, err.message);
    store.transports.delete(entryKey);
  });

  proc.on("exit", (code, signal) => {
    const runtime = Date.now() - commandStartTime;
    console.log(
      `[mcp-stdio:${server.name}] exited code=${code} signal=${signal} runtime=${runtime}ms`,
    );

    if (runtime < STDIO_QUICK_FAILURE_MS && code !== 0) {
      setCooldown(server.command, server.args, server.env);
    }

    store.transports.delete(entryKey);

    for (const send of entry.sessions.values()) {
      try {
        send(
          `event: process_exit\ndata: ${JSON.stringify({ server: server.name, code, signal })}\n\n`,
        );
      } catch {}
    }
  });

  console.log(
    `[mcp-stdio:${server.name}] spawned (command: ${server.command} ${(server.args || []).join(" ")})`,
  );
  entry.initPromise = initializeStdioServer(entry, server);
  return entry;
}

function sendToStdioServer(server, jsonRpc) {
  return new Promise(async (resolve) => {
    const entryKey = `stdio:${server.id}`;
    let entry = getConnections().transports.get(entryKey);

    if (
      !entry ||
      !entry.proc ||
      entry.proc.killed ||
      entry.proc.exitCode !== null
    ) {
      try {
        entry = spawnLocalServer(server);
      } catch (e) {
        resolve({
          jsonrpc: "2.0",
          id: jsonRpc.id,
          error: { code: -32603, message: e.message },
        });
        return;
      }
    }

    if (!entry.pendingRequests) entry.pendingRequests = new Map();

    // Wait for the initialization handshake to complete.
    if (entry.initPromise) await entry.initPromise;

    const requestId = jsonRpc.id || crypto.randomUUID();
    const timeout = setTimeout(() => {
      if (entry.pendingRequests.has(requestId)) {
        entry.pendingRequests.delete(requestId);
        console.log(
          `[mcp-stdio:${server.name}] Request ${requestId} timed out`,
        );
        resolve({
          jsonrpc: "2.0",
          id: jsonRpc.id,
          error: { code: -32603, message: "Request timed out" },
        });
      }
    }, STDIO_REQUEST_TIMEOUT_MS);

    entry.pendingRequests.set(requestId, (res) => {
      clearTimeout(timeout);
      resolve({ ...res, id: jsonRpc.id }); // Map response id back to caller's id.
    });

    const msg = { ...jsonRpc, id: requestId };
    try {
      entry.proc.stdin.write(`${JSON.stringify(msg)}\n`);
    } catch (err) {
      clearTimeout(timeout);
      entry.pendingRequests.delete(requestId);
      resolve({
        jsonrpc: "2.0",
        id: jsonRpc.id,
        error: {
          code: -32603,
          message: `Failed to write to stdin: ${err.message}`,
        },
      });
    }
  });
}

// ─── Public dispatcher ─────────────────────────────────────────────────────

/**
 * Send a JSON-RPC request to an MCP server. Auto-detects the transport from
 * `server.type` and returns the parsed response (or `null` on fire-and-forget).
 */
export async function sendToMcpServer(server, jsonRpc) {
  if (server.type === "local-stdio") {
    return await sendToStdioServer(server, jsonRpc);
  }
  return await sendToRemoteServer(server, jsonRpc);
}
