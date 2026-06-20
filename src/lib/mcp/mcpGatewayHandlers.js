import { getMcpServers } from "@/models";
import { sendToMcpServer } from "@/lib/mcp/mcpServerManager";

// ─── Aggregate tools/list from all active servers ───────────────────────────

// Map server names to short prefixes for tool names
function getServerPrefix(server) {
  const name = server.name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (name.includes("testsprite")) return "ts";
  if (name.includes("sentry")) return "sr";
  if (name.includes("firecrawl")) return "fc";
  if (name.includes("puppeteer")) return "pp";
  if (name.includes("astro")) return "ad";
  if (name.includes("stitch")) return "st";
  if (name.includes("github")) return "gh";
  if (name.includes("tavily")) return "tv";
  
  return name.slice(0, 3);
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

  const allTools = [];

  const promises = servers.map(async (server) => {
    try {
      const response = await sendToMcpServer(server, {
        jsonrpc: "2.0",
        id: `tools-list-${server.id}`,
        method: "tools/list",
        params: jsonRpc.params || {},
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
  if (servers.length === 0) {
    return {
      jsonrpc: "2.0",
      id: jsonRpc.id,
      result: { prompts: [] },
    };
  }

  const allPrompts = [];

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
  if (servers.length === 0) {
    return {
      jsonrpc: "2.0",
      id: jsonRpc.id,
      result: { resources: [] },
    };
  }

  const allResources = [];

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
  if (servers.length === 0) {
    return {
      jsonrpc: "2.0",
      id: jsonRpc.id,
      result: { resourceTemplates: [] },
    };
  }

  const allTemplates = [];

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
