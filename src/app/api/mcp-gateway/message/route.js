import { getMcpServers, getMcpServerById } from "@/models";
import { sendToMcpServer, getGatewaySession } from "@/lib/mcp/mcpServerManager";
import { handleToolsList, handleToolsCall, handlePromptsList, handlePromptsGet, handleResourcesList, handleResourceTemplatesList, handleResourcesRead } from "@/lib/mcp/mcpGatewayHandlers";
import { checkRateLimit } from "@/lib/mcp/rateLimiter";
import { validateApiKey, getComboByName, getCombos } from "@/lib/localDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/mcp-gateway/message - Unified message routing
// Routes a JSON-RPC request to the appropriate MCP server.
// When __mcpServerId is provided, routes to that specific server.
// For tools/list without __mcpServerId, aggregates from ALL active servers.
// For tools/call, auto-routes based on tool name prefix (e.g. "stitch__create_project").
// Auth: Accepts Bearer token, X-Api-Key, X-9r-Api-Key, or X-Goog-Api-Key headers.
export async function POST(request) {
  try {
    // Auth check: accept Bearer token, X-Api-Key, X-9r-Api-Key, or X-Goog-Api-Key
    const authHeader = request.headers.get("Authorization");
    const apiKeyHeader = request.headers.get("x-api-key") || request.headers.get("x-9r-api-key") || request.headers.get("x-goog-api-key");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : apiKeyHeader;
    if (token) {
      const valid = await validateApiKey(token);
      if (!valid) {
        return Response.json(
          { error: "Invalid API key" },
          { status: 401 }
        );
      }
    }

    // Rate limit: 60 requests per minute per IP
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const rateCheck = checkRateLimit(`mcp:message:${ip}`, {
      maxRequests: 60,
      windowMs: 60_000,
    });
    if (!rateCheck.allowed) {
      return Response.json(
        { error: "Rate limit exceeded", retryAfterMs: rateCheck.retryAfterMs },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(rateCheck.retryAfterMs / 1000)),
            "X-RateLimit-Remaining": String(rateCheck.remaining),
            "X-RateLimit-Reset": String(Date.now() + rateCheck.resetMs),
          },
        }
      );
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    const comboName = searchParams.get("combo");

    // Resolve target combo (explicit parameter takes priority, otherwise use the active database combo)
    let activeCombo = null;
    if (comboName) {
      activeCombo = await getComboByName(comboName);
    } else {
      const combos = await getCombos();
      activeCombo = combos.find(c => c.kind === "mcp" && c.isActive);
    }

    const text = await request.text();
    if (!text || text.trim() === "") {
      return new Response("", { status: 202 });
    }

    let body;
    try {
      body = JSON.parse(text);
    } catch (err) {
      return Response.json(
        { jsonrpc: "2.0", error: { code: -32700, message: "Parse error: invalid JSON" } },
        { status: 400 }
      );
    }

    const { __mcpServerId, ...jsonRpc } = body;

    // Intercept client's initialize/initialized notifications
    if (!__mcpServerId && jsonRpc.method === "initialize") {
      const response = {
        jsonrpc: "2.0",
        id: jsonRpc.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {
              listChanged: true
            },
            prompts: {
              listChanged: true
            },
            resources: {
              listChanged: true
            }
          },
          serverInfo: {
            name: "9router-mcp-gateway",
            version: "1.0.0"
          }
        }
      };
      return await sendResponse(response);
    }

    if (!__mcpServerId && jsonRpc.method === "notifications/initialized") {
      return new Response("", { status: 202 });
    }

    // ─── tools/list aggregation ──────────────────────────────────────────
    if (!__mcpServerId && jsonRpc.method === "tools/list") {
      const response = await handleToolsList(jsonRpc, activeCombo);
      return await sendResponse(response);
    }

    // ─── tools/call auto-routing ─────────────────────────────────────────
    if (!__mcpServerId && jsonRpc.method === "tools/call") {
      const response = await handleToolsCall(jsonRpc, activeCombo);
      return await sendResponse(response);
    }

    // ─── prompts/list aggregation ────────────────────────────────────────
    if (!__mcpServerId && jsonRpc.method === "prompts/list") {
      const response = await handlePromptsList(jsonRpc);
      return await sendResponse(response);
    }

    // ─── prompts/get auto-routing ────────────────────────────────────────
    if (!__mcpServerId && jsonRpc.method === "prompts/get") {
      const response = await handlePromptsGet(jsonRpc);
      return await sendResponse(response);
    }

    // ─── resources/list aggregation ──────────────────────────────────────
    if (!__mcpServerId && jsonRpc.method === "resources/list") {
      const response = await handleResourcesList(jsonRpc);
      return await sendResponse(response);
    }

    // ─── resources/templates/list aggregation ────────────────────────────
    if (!__mcpServerId && jsonRpc.method === "resources/templates/list") {
      const response = await handleResourceTemplatesList(jsonRpc);
      return await sendResponse(response);
    }

    // ─── resources/read auto-routing ─────────────────────────────────────
    if (!__mcpServerId && jsonRpc.method === "resources/read") {
      const response = await handleResourcesRead(jsonRpc);
      return await sendResponse(response);
    }

    // ─── Direct routing ──────────────────────────────────────────────────
    let server;
    if (__mcpServerId) {
      server = await getMcpServerById(__mcpServerId);
      if (!server) {
        return Response.json({ error: `Unknown MCP server: ${__mcpServerId}` }, { status: 404 });
      }
    } else {
      const servers = await getMcpServers({ isActive: true });
      if (servers.length === 0) {
        return Response.json({ error: "No active MCP servers configured" }, { status: 404 });
      }
      server = servers[0];
    }

    if (!server.isActive) {
      return Response.json({ error: "MCP server is disabled" }, { status: 400 });
    }

    const response = await sendToMcpServer(server, jsonRpc);

    // Helper function to return response or route it to SSE
    async function sendResponse(result) {
      let data = result;
      if (result instanceof Response) {
        data = await result.json();
      }

      let targetSessionId = sessionId;
      if (!targetSessionId) {
        const connections = globalThis.__9routerMcpServerConnections;
        const sessions = connections?.gatewaySessions;
        if (sessions && sessions.size > 0) {
          targetSessionId = Array.from(sessions.keys()).pop();
        }
      }

      if (targetSessionId) {
        const session = getGatewaySession(targetSessionId);
        if (session) {
          session.send(`event: message\ndata: ${JSON.stringify(data)}\n\n`);
          return Response.json(data);
        }
      }

      return Response.json(data);
    }

    if (response) {
      return await sendResponse(response);
    }
    return new Response("", { status: 202 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
