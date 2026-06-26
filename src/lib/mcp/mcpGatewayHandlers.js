import { getMcpServers } from "@/models";
import { sendToMcpServer } from "@/lib/mcp/mcpServerManager";
import { computeBasePrefix } from "@/lib/mcp/mcpServerPrefix";

// ─── Aggregate tools/list from all active servers ───────────────────────────

// Short-lived cache for the expensive tools/list fan-out. A cold aggregation
// can take many seconds (upstream connections warming up); caching the raw
// aggregated list makes repeated calls (reopening the combo modal, or
// successive gateway tools/list calls) effectively instant. Combo filtering is
// applied per-call AFTER the cache, so the cache itself is combo-agnostic.
const TOOLS_LIST_TTL_MS = 30_000;
let _toolsListCache = { key: null, tools: null, expires: 0 };

// Invalidate the cache when the set of MCP servers changes (add/remove/toggle).
export function invalidateToolsListCache() {
  _toolsListCache = { key: null, tools: null, expires: 0 };
}

// Resolve a server's tool-name prefix. Prefer the persisted unique prefix;
// fall back to a computed base for any server not yet backfilled.
function getServerPrefix(server) {
  if (server && server.prefix) return server.prefix;
  return computeBasePrefix(server?.name);
}

// Aggregate (prefixed) tools from all active servers, with caching when no
// request-specific params (e.g. pagination cursor) are supplied.
async function aggregateAllTools(servers, params) {
  const hasParams = params && Object.keys(params).length > 0;
  const cacheKey = servers.map((s) => s.id).sort().join(",");

  if (
    !hasParams &&
    _toolsListCache.tools &&
    _toolsListCache.key === cacheKey &&
    _toolsListCache.expires > Date.now()
  ) {
    return _toolsListCache.tools;
  }

  const allTools = [];
  const promises = servers.map(async (server) => {
    try {
      const response = await sendToMcpServer(server, {
        jsonrpc: "2.0",
        id: `tools-list-${server.id}`,
        method: "tools/list",
        params: params || {},
      });

      if (response?.result?.tools) {
        const prefix = getServerPrefix(server);
        for (const tool of response.result.tools) {
          allTools.push({
            name: `${prefix}__${tool.name}`,
            description: tool.description,
            inputSchema: tool.inputSchema,
          });
        }
      }
    } catch (err) {
      console.error(`[mcp-gateway] tools/list failed for ${server.name}:`, err.message);
    }
  });

  await Promise.all(promises);

  // Only cache successful, non-empty aggregations so a transient upstream
  // failure doesn't pin an empty list for the full TTL.
  if (!hasParams && allTools.length > 0) {
    _toolsListCache = {
      key: cacheKey,
      tools: allTools,
      expires: Date.now() + TOOLS_LIST_TTL_MS,
    };
  }

  return allTools;
}

export async function handleToolsList(jsonRpc, activeCombo) {
  const servers = await getMcpServers({ isActive: true });
  if (servers.length === 0) {
    return {
      jsonrpc: "2.0",
      id: jsonRpc.id,
      result: { tools: [] },
    };
  }

  const allTools = await aggregateAllTools(servers, jsonRpc.params);

  let filteredTools = allTools;
  if (activeCombo) {
    if (activeCombo.tools && Array.isArray(activeCombo.tools) && activeCombo.tools.length > 0) {
      filteredTools = allTools.filter(t => {
        const originalName = t.name.includes("__") ? t.name.split("__").slice(1).join("__") : t.name;
        return activeCombo.tools.some(ct => {
          const normalizedCt = ct.trim();
          return t.name === normalizedCt || originalName === normalizedCt;
        });
      });
    }
    if (activeCombo.maxTools !== null && activeCombo.maxTools !== undefined) {
      const max = parseInt(activeCombo.maxTools, 10);
      if (!isNaN(max) && max > 0) {
        filteredTools = filteredTools.slice(0, max);
      }
    }
  }

  return {
    jsonrpc: "2.0",
    id: jsonRpc.id,
    result: {
      tools: filteredTools,
    },
  };
}

// ─── Auto-route tools/call by prefix ────────────────────────────────────────

export async function handleToolsCall(jsonRpc, activeCombo) {
  const toolName = jsonRpc.params?.name || "";
  if (activeCombo) {
    if (activeCombo.tools && Array.isArray(activeCombo.tools) && activeCombo.tools.length > 0) {
      const originalName = toolName.includes("__") ? toolName.split("__").slice(1).join("__") : toolName;
      const isAllowed = activeCombo.tools.some(ct => {
        const normalizedCt = ct.trim();
        return toolName === normalizedCt || originalName === normalizedCt;
      });
      if (!isAllowed) {
        return {
          jsonrpc: "2.0",
          id: jsonRpc.id,
          error: {
            code: -32601,
            message: `Tool "${toolName}" is not allowed for combo "${activeCombo.name}".`,
          },
        };
      }
    }
  }

  const servers = await getMcpServers({ isActive: true });

  // Check if tool name has a prefix (e.g. "stitch__create_project" or "Hacker-News__get_stories")
  const prefixMatch = toolName.match(/^(.+?)__(.+)$/);

  if (prefixMatch) {
    const [, prefix, originalName] = prefixMatch;
    // Find server matching this prefix by normalized prefix or exact name match
    const normalizedPrefix = prefix.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
    const server = servers.find((s) => {
      const sPrefix = getServerPrefix(s);
      return sPrefix === normalizedPrefix || s.name.toLowerCase() === prefix.toLowerCase();
    });
    if (!server) {
      return {
        jsonrpc: "2.0",
        id: jsonRpc.id,
        result: {
          content: [{ type: "text", text: `No server found with prefix "${prefix}". Available: ${servers.map((s) => getServerPrefix(s)).join(", ")}` }],
          isError: true,
        },
      };
    }

    const response = await sendToMcpServer(server, {
      jsonrpc: "2.0",
      id: jsonRpc.id,
      method: "tools/call",
      params: { ...jsonRpc.params, name: originalName },
    });
    return response;
  }

  // No prefix — try all servers, return first success
  for (const server of servers) {
    try {
      const response = await sendToMcpServer(server, {
        jsonrpc: "2.0",
        id: jsonRpc.id,
        method: "tools/call",
        params: jsonRpc.params,
      });
      if (response?.result) return response;
    } catch { /* try next server */ }
  }

  return {
    jsonrpc: "2.0",
    id: jsonRpc.id,
    result: {
      content: [{ type: "text", text: `No server could handle tool "${toolName}". Try prefixed name like "stitch__${toolName}".` }],
      isError: true,
    },
  };
}

// ─── Aggregate and route prompts ───────────────────────────────────────────

export async function handlePromptsList(jsonRpc) {
  const servers = await getMcpServers({ isActive: true });

  const allPrompts = [
    {
      name: "gateway__diagnose",
      description: "Diagnose 9router MCP gateway connection issues and view server status",
      arguments: [
        {
          name: "serverId",
          description: "Optional ID of a specific MCP server to test",
          required: false,
        }
      ]
    }
  ];

  if (servers.length > 0) {
    const promises = servers.map(async (server) => {
      try {
        const response = await sendToMcpServer(server, {
          jsonrpc: "2.0",
          id: `prompts-list-${server.id}`,
          method: "prompts/list",
          params: jsonRpc.params || {},
        });

        if (response?.result?.prompts) {
          const prefix = getServerPrefix(server);
          for (const prompt of response.result.prompts) {
            allPrompts.push({
              name: `${prefix}__${prompt.name}`,
              description: prompt.description,
              arguments: prompt.arguments,
            });
          }
        }
      } catch (err) {
        console.error(`[mcp-gateway] prompts/list failed for ${server.name}:`, err.message);
      }
    });

    await Promise.all(promises);
  }

  return {
    jsonrpc: "2.0",
    id: jsonRpc.id,
    result: {
      prompts: allPrompts,
    },
  };
}

export async function handlePromptsGet(jsonRpc) {
  const promptName = jsonRpc.params?.name || "";

  if (promptName === "gateway__diagnose") {
    const servers = await getMcpServers({ isActive: true });
    const diagnosticsText = `9router MCP Gateway Diagnostics:
Active Upstream Servers: ${servers.length}
${servers.map((s, idx) => `${idx + 1}. ${s.name} (${s.type}) - Active: ${s.isActive}`).join("\n")}

Please review the logs or run a direct ping to test individual downstream tools.`;

    return {
      jsonrpc: "2.0",
      id: jsonRpc.id,
      result: {
        description: "Diagnose 9router MCP gateway connection issues",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: diagnosticsText,
            }
          }
        ]
      }
    };
  }

  const prefixMatch = promptName.match(/^(.+?)__(.+)$/);

  if (prefixMatch) {
    const [, prefix, originalName] = prefixMatch;
    const servers = await getMcpServers({ isActive: true });
    const normalizedPrefix = prefix.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
    const server = servers.find((s) => {
      const sPrefix = getServerPrefix(s);
      return sPrefix === normalizedPrefix || s.name.toLowerCase() === prefix.toLowerCase();
    });

    if (server) {
      const response = await sendToMcpServer(server, {
        jsonrpc: "2.0",
        id: jsonRpc.id,
        method: "prompts/get",
        params: {
          ...jsonRpc.params,
          name: originalName,
        },
      });
      return response;
    }
  }

  return {
    jsonrpc: "2.0",
    id: jsonRpc.id,
    error: {
      code: -32602,
      message: `Prompt "${promptName}" not found or prefix invalid.`,
    },
  };
}

// ─── Aggregate and route resources ─────────────────────────────────────────

export async function handleResourcesList(jsonRpc) {
  const servers = await getMcpServers({ isActive: true });

  const allResources = [
    {
      uri: "mcp-gateway://gateway/status",
      name: "9router Gateway Status",
      description: "Real-time status and active connections of the 9router MCP Gateway",
      mimeType: "application/json",
    }
  ];

  if (servers.length > 0) {
    const promises = servers.map(async (server) => {
      try {
        const response = await sendToMcpServer(server, {
          jsonrpc: "2.0",
          id: `resources-list-${server.id}`,
          method: "resources/list",
          params: jsonRpc.params || {},
        });

        if (response?.result?.resources) {
          const prefix = getServerPrefix(server);
          for (const res of response.result.resources) {
            allResources.push({
              uri: `mcp-gateway://${prefix}?uri=${encodeURIComponent(res.uri)}`,
              name: res.name,
              description: res.description,
              mimeType: res.mimeType,
            });
          }
        }
      } catch (err) {
        console.error(`[mcp-gateway] resources/list failed for ${server.name}:`, err.message);
      }
    });

    await Promise.all(promises);
  }

  return {
    jsonrpc: "2.0",
    id: jsonRpc.id,
    result: {
      resources: allResources,
    },
  };
}

export async function handleResourceTemplatesList(jsonRpc) {
  const servers = await getMcpServers({ isActive: true });

  const allTemplates = [
    {
      uriTemplate: "mcp-gateway://gateway/logs{?level}",
      name: "9router Gateway Logs",
      description: "Filterable system logs for the 9router MCP Gateway",
      mimeType: "text/plain",
    }
  ];

  if (servers.length > 0) {
    const promises = servers.map(async (server) => {
      try {
        const response = await sendToMcpServer(server, {
          jsonrpc: "2.0",
          id: `resource-templates-${server.id}`,
          method: "resources/templates/list",
          params: jsonRpc.params || {},
        });

        if (response?.result?.resourceTemplates) {
          const prefix = getServerPrefix(server);
          for (const tpl of response.result.resourceTemplates) {
            allTemplates.push({
              uriTemplate: `mcp-gateway://${prefix}?uriTemplate=${encodeURIComponent(tpl.uriTemplate)}`,
              name: tpl.name,
              description: tpl.description,
              mimeType: tpl.mimeType,
            });
          }
        }
      } catch (err) {
        console.error(`[mcp-gateway] resources/templates/list failed for ${server.name}:`, err.message);
      }
    });

    await Promise.all(promises);
  }

  return {
    jsonrpc: "2.0",
    id: jsonRpc.id,
    result: {
      resourceTemplates: allTemplates,
    },
  };
}

export async function handleResourcesRead(jsonRpc) {
  const uriStr = jsonRpc.params?.uri || "";

  if (uriStr === "mcp-gateway://gateway/status") {
    const servers = await getMcpServers({ isActive: true });
    const activeServers = await Promise.all(
      servers.map(async (s) => {
        let tools = [];
        try {
          const response = await sendToMcpServer(s, {
            jsonrpc: "2.0",
            id: `status-tools-${s.id}`,
            method: "tools/list",
            params: {},
          });
          if (response?.result?.tools) {
            const prefix = getServerPrefix(s);
            tools = response.result.tools.map((t) => ({
              name: `${prefix}__${t.name}`,
              description: t.description,
              inputSchema: t.inputSchema,
            }));
          }
        } catch (err) {
          console.error(`[mcp-gateway] status tools/list failed for ${s.name}:`, err.message);
        }
        return {
          id: s.id,
          name: s.name,
          type: s.type,
          isActive: s.isActive,
          tools,
        };
      })
    );

    const statusInfo = {
      gateway: "active",
      activeServersCount: servers.length,
      activeServers,
    };
    return {
      jsonrpc: "2.0",
      id: jsonRpc.id,
      result: {
        contents: [
          {
            uri: "mcp-gateway://gateway/status",
            mimeType: "application/json",
            text: JSON.stringify(statusInfo, null, 2),
          },
        ],
      },
    };
  }

  if (uriStr.startsWith("mcp-gateway://gateway/logs")) {
    // This gateway does not expose raw server logs over MCP for security
    // reasons. Return an honest, non-fabricated notice instead of synthetic
    // log lines so clients are not misled.
    const level = uriStr.includes("level=error") ? "error" : "info";
    const text =
      `9router gateway log streaming is not exposed via this resource.\n` +
      `Requested level: ${level}. Consult your server/container logs for details.`;
    return {
      jsonrpc: "2.0",
      id: jsonRpc.id,
      result: {
        contents: [
          {
            uri: uriStr,
            mimeType: "text/plain",
            text,
          },
        ],
      },
    };
  }

  if (uriStr.startsWith("mcp-gateway://")) {
    try {
      const url = new URL(uriStr);
      const prefix = url.hostname;
      const originalUri = url.searchParams.get("uri");

      if (originalUri) {
        const servers = await getMcpServers({ isActive: true });
        const normalizedPrefix = prefix.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
        const server = servers.find((s) => {
          const sPrefix = getServerPrefix(s);
          return sPrefix === normalizedPrefix || s.name.toLowerCase() === prefix.toLowerCase();
        });

        if (server) {
          const response = await sendToMcpServer(server, {
            jsonrpc: "2.0",
            id: jsonRpc.id,
            method: "resources/read",
            params: {
              ...jsonRpc.params,
              uri: originalUri,
            },
          });
          return response;
        }
      }
    } catch (err) {
      console.error(`[mcp-gateway] Failed to parse resource read URI:`, err.message);
    }
  }

  return {
    jsonrpc: "2.0",
    id: jsonRpc.id,
    error: {
      code: -32602,
      message: `Resource URI "${uriStr}" not found or invalid.`,
    },
  };
}

export async function handleCompletionComplete(jsonRpc) {
  const ref = jsonRpc.params?.ref;
  if (!ref) {
    return {
      jsonrpc: "2.0",
      id: jsonRpc.id,
      error: {
        code: -32602,
        message: "Missing 'ref' parameter.",
      },
    };
  }

  // Handle prompt completion
  if (ref.type === "ref/prompt") {
    const promptName = ref.name || "";

    if (promptName === "gateway__diagnose") {
      const servers = await getMcpServers({ isActive: true });
      const argument = jsonRpc.params?.argument || {};
      const val = (argument.value || "").toLowerCase();

      const suggestions = servers
        .map(s => s.name)
        .filter(name => name.toLowerCase().includes(val));

      return {
        jsonrpc: "2.0",
        id: jsonRpc.id,
        result: {
          completion: {
            values: suggestions,
            hasMore: false,
          }
        }
      };
    }

    const prefixMatch = promptName.match(/^(.+?)__(.+)$/);

    if (prefixMatch) {
      const [, prefix, originalName] = prefixMatch;
      const servers = await getMcpServers({ isActive: true });
      const normalizedPrefix = prefix.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
      const server = servers.find((s) => {
        const sPrefix = getServerPrefix(s);
        return sPrefix === normalizedPrefix || s.name.toLowerCase() === prefix.toLowerCase();
      });

      if (server) {
        const response = await sendToMcpServer(server, {
          jsonrpc: "2.0",
          id: jsonRpc.id,
          method: "completion/complete",
          params: {
            ...jsonRpc.params,
            ref: {
              ...ref,
              name: originalName,
            },
          },
        });
        return response;
      }
    }
  }

  // Handle resource completion
  if (ref.type === "ref/resource") {
    const uriStr = ref.uri || "";

    if (uriStr.startsWith("mcp-gateway://gateway/logs")) {
      const argument = jsonRpc.params?.argument || {};
      const val = (argument.value || "").toLowerCase();
      const levels = ["info", "error", "warn", "debug"];
      const suggestions = levels.filter(lvl => lvl.startsWith(val));

      return {
        jsonrpc: "2.0",
        id: jsonRpc.id,
        result: {
          completion: {
            values: suggestions,
            hasMore: false,
          }
        }
      };
    }

    if (uriStr.startsWith("mcp-gateway://")) {
      try {
        const url = new URL(uriStr);
        const prefix = url.hostname;
        const originalUri = url.searchParams.get("uri") || url.searchParams.get("uriTemplate");

        if (originalUri) {
          const servers = await getMcpServers({ isActive: true });
          const normalizedPrefix = prefix.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
          const server = servers.find((s) => {
            const sPrefix = getServerPrefix(s);
            return sPrefix === normalizedPrefix || s.name.toLowerCase() === prefix.toLowerCase();
          });

          if (server) {
            const response = await sendToMcpServer(server, {
              jsonrpc: "2.0",
              id: jsonRpc.id,
              method: "completion/complete",
              params: {
                ...jsonRpc.params,
                ref: {
                  ...ref,
                  uri: originalUri,
                },
              },
            });
            return response;
          }
        }
      } catch (err) {
        console.error(`[mcp-gateway] Failed to parse resource completion URI:`, err.message);
      }
    }
  }

  // If no prefix matched, fallback/error
  return {
    jsonrpc: "2.0",
    id: jsonRpc.id,
    error: {
      code: -32602,
      message: "Prompt/Resource not found or prefix invalid for completion.",
    },
  };
}
