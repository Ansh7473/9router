"use client";

import { useState, useEffect, useCallback } from "react";
import Button from "@/shared/components/Button";
import Modal, { ConfirmModal } from "@/shared/components/Modal";
import Input from "@/shared/components/Input";
import { useNotificationStore } from "@/store/notificationStore";

const SERVER_TYPES = [
  {
    id: "remote-http",
    label: "Remote (HTTP)",
    icon: "cloud",
    description: "Streamable HTTP transport — sends JSON-RPC via POST",
  },
  {
    id: "remote-sse",
    label: "Remote (SSE)",
    icon: "cell_tower",
    description: "Server-Sent Events transport — subscribes to SSE stream",
  },
  {
    id: "local-stdio",
    label: "Local (stdio)",
    icon: "terminal",
    description: "Spawns a local process and communicates via stdin/stdout",
  },
];

const PRESET_SERVERS = [
  {
    name: "Exa Search",
    type: "remote-http",
    url: "https://mcp.exa.ai/mcp",
    description: "Real-time web search and code documentation",
    toolNames: ["web_search_exa", "web_fetch_exa"],
  },
  {
    name: "Tavily",
    type: "remote-http",
    url: "https://mcp.tavily.com/mcp",
    description: "Real-time web search optimized for LLM agents",
    headers: { Authorization: "Bearer " },
    toolNames: ["tavily_search", "tavily_extract"],
  },
  {
    name: "Google Stitch",
    type: "remote-http",
    url: "https://stitch.googleapis.com/mcp",
    description:
      "Generate UI screens and manage design systems with Google Stitch",
    headers: { "X-Goog-Api-Key": "" },
    toolNames: [
      "list_projects",
      "list_screens",
      "get_project",
      "get_screen",
      "create_project",
      "generate_screen_from_text",
      "edit_screens",
      "generate_variants",
      "create_design_system",
      "update_design_system",
      "apply_design_system",
      "upload_design_md",
      "create_design_system_from_design_md",
      "list_design_systems",
    ],
  },
  {
    name: "Astro Docs",
    type: "remote-http",
    url: "https://mcp.docs.astro.build/mcp",
    description: "Astro documentation and resources search",
  },
  {
    name: "Sentry",
    type: "local-stdio",
    command: "npx",
    args: ["-y", "@sentry/mcp-server"],
    env: { SENTRY_ACCESS_TOKEN: "" },
    description:
      "Retrieve error data, manage projects, and analyze application issues via Sentry API",
  },
  {
    name: "Firecrawl",
    type: "local-stdio",
    command: "npx",
    args: ["-y", "firecrawl-mcp"],
    env: { FIRECRAWL_API_KEY: "" },
    description: "Convert websites into LLM-ready markdown or structured data",
  },
  {
    name: "Git",
    type: "local-stdio",
    command: "npx",
    args: ["-y", "@cyanheads/git-mcp-server"],
    description:
      "Run git commands, inspect repository history, diffs, and staging",
  },
  {
    name: "Puppeteer",
    type: "local-stdio",
    command: "npx",
    args: ["-y", "@hisma/server-puppeteer"],
    description: "Web scraping and browser automation using headless Chrome",
  },
  {
    name: "PostgreSQL",
    type: "local-stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres"],
    description: "Inspect and query PostgreSQL databases",
  },
  {
    name: "Memory",
    type: "local-stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
    description: "Graph-based knowledge representation and semantic memory",
  },
  {
    name: "Filesystem",
    type: "local-stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
    description: "Read/write files on local filesystem",
  },
  {
    name: "GitHub",
    type: "local-stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    description: "GitHub API integration",
  },
  {
    name: "Browser MCP",
    type: "local-stdio",
    command: "npx",
    args: ["-y", "@browsermcp/mcp@latest"],
    description: "Control your running Chrome browser",
  },
  {
    name: "CodeGraph",
    type: "local-stdio",
    command: "npx",
    args: ["-y", "@colbymchenry/codegraph", "serve", "--mcp"],
    description:
      "Local semantic code intelligence using tree-sitter, SQLite, and AST relationships",
    toolNames: [
      "codegraph_explore",
      "codegraph_node",
      "codegraph_search",
      "codegraph_callers",
      "codegraph_callees",
      "codegraph_impact",
      "codegraph_files",
      "codegraph_status",
    ],
  },
  {
    name: "TestSprite",
    type: "local-stdio",
    command: "npx",
    args: ["-y", "@testsprite/testsprite-mcp@latest"],
    env: { API_KEY: "" },
    description: "Autonomous AI-powered testing assistant for IDEs",
  },
  {
    name: "Vercel",
    type: "remote-http",
    url: "https://mcp.vercel.com",
    description:
      "Deployments, projects, domains, and Vercel analytics management",
  },
  {
    name: "Postman",
    type: "local-stdio",
    command: "npx",
    args: ["-y", "@postman/postman-mcp-server"],
    description: "API development, contract testing, and collection management",
  },
  {
    name: "Insomnia",
    type: "local-stdio",
    command: "npx",
    args: ["-y", "mcp-insomnia"],
    description: "API design, debugging, and collection runner",
  },
  {
    name: "Supabase (Remote)",
    type: "remote-http",
    url: "https://mcp.supabase.com/mcp",
    description:
      "Database schema inspection, query execution, and migration management",
  },
  {
    name: "Supabase (Local)",
    type: "local-stdio",
    command: "npx",
    args: ["-y", "@supabase/mcp-server-supabase"],
    description: "Inspect and query local Supabase database schemas",
  },

  {
    name: "Browserbase (Remote)",
    type: "remote-http",
    url: "https://mcp.browserbase.com/mcp",
    description:
      "Cloud headless browser automation, web interaction, and extraction",
  },
  {
    name: "Browserbase (Local)",
    type: "local-stdio",
    command: "npx",
    args: ["-y", "@browserbasehq/mcp"],
    env: { BROWSERBASE_API_KEY: "", BROWSERBASE_PROJECT_ID: "" },
    description: "Local headless browser manager and stagehand web interaction",
  },
  {
    name: "Playwright",
    type: "local-stdio",
    command: "npx",
    args: ["-y", "@playwright/mcp@latest"],
    description:
      "Web scraping, end-to-end testing, and browser automation via Playwright accessibility trees",
  },
  {
    name: "Netlify",
    type: "local-stdio",
    command: "npx",
    args: ["-y", "@netlify/mcp@latest"],
    description:
      "Deployments, serverless functions, form submissions, and Netlify hosting management",
  },
  {
    name: "Render (Remote)",
    type: "remote-http",
    url: "https://mcp.render.com/mcp",
    headers: { Authorization: "Bearer " },
    description:
      "Cloud infrastructure manager for Render services, deploys, and logs",
  },
  {
    name: "Render (Local)",
    type: "local-stdio",
    command: "npx",
    args: ["-y", "@niyogi/render-mcp@latest"],
    env: { RENDER_API_KEY: "" },
    description: "Local CLI bridge for Render infrastructure management",
  },
  {
    name: "n8n",
    type: "local-stdio",
    command: "npx",
    args: ["-y", "n8n-mcp"],
    env: { N8N_API_URL: "", N8N_API_KEY: "" },
    description: "Control, trigger, and manage your n8n workflow automations",
  },
  {
    name: "Grafana",
    type: "local-stdio",
    command: "npx",
    args: ["-y", "@leval/mcp-grafana"],
    env: { GRAFANA_URL: "", GRAFANA_SERVICE_ACCOUNT_TOKEN: "" },
    description:
      "Query Grafana metrics, Loki logs, dashboards, and alerting rules",
  },
  {
    name: "Lighthouse",
    type: "local-stdio",
    command: "npx",
    args: ["-y", "lighthouse-mcp"],
    description:
      "Run Google Lighthouse audits for performance, accessibility, SEO, and Core Web Vitals",
  },
  {
    name: "PageSpeed Insights",
    type: "local-stdio",
    command: "npx",
    args: ["-y", "pagespeed-insights-mcp"],
    env: { GOOGLE_API_KEY: "" },
    description:
      "Google PageSpeed Insights API auditor for Core Web Vitals, metrics, and screenshots",
  },
  {
    name: "Figma",
    type: "remote-http",
    url: "https://mcp.figma.com/mcp",
    description:
      "Read Figma design tokens, component hierarchies, layouts, and write content to Figma files",
  },
  {
    name: "GTmetrix",
    type: "remote-http",
    url: "https://api.gtmetrix.com/mcp",
    headers: { Authorization: "Basic " },
    description:
      "Integrate GTmetrix API for speed audits, CrUX reports, and performance monitoring",
  },
  {
    name: "Chrome DevTools",
    type: "local-stdio",
    command: "npx",
    args: ["-y", "chrome-devtools-mcp@latest"],
    description:
      "Inspect, debug, profile, and interact with a live Chrome browser via Chrome DevTools Protocol",
  },
  {
    name: "Ahrefs",
    type: "remote-http",
    url: "https://api.ahrefs.com/mcp/mcp",
    description:
      "Search Ahrefs SEO metrics, crawl audits, keyword volumes, backlink parameters, and competitor analysis",
  },
  {
    name: "Builder.io DevTools",
    type: "local-stdio",
    command: "npx",
    args: ["-y", "@builder.io/dev-tools@latest", "mcp"],
    description:
      "Connect AI coding agents to Builder.io branches and design system documentation",
  },
  {
    name: "Builder.io CMS",
    type: "remote-http",
    url: "https://cdn.builder.io/api/v1/mcp/builder-content",
    headers: { Authorization: "Bearer " },
    description:
      "Expose Builder.io CMS content spaces, models, and entries to AI agents",
  },
  {
    name: "PlanetScale",
    type: "remote-http",
    url: "https://mcp.pscale.dev/mcp/planetscale",
    description:
      "Manage PlanetScale databases, branches, schemas, and query Insights data",
  },
  {
    name: "Flowbite / Tailwind",
    type: "local-stdio",
    command: "npx",
    args: ["-y", "flowbite-mcp"],
    description:
      "Access Flowbite component library snippets and Figma-to-Tailwind-code conversion assets",
  },
  {
    name: "LangSmith",
    type: "local-stdio",
    command: "npx",
    args: ["-y", "langsmith-mcp-server"],
    env: { LANGSMITH_API_KEY: "" },
    description:
      "Trace, debug, and optimize AI backend chains, prompts, and LLM calls in LangSmith",
  },
];

export default function McpServersPageClient() {
  const notify = useNotificationStore();
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [editingServer, setEditingServer] = useState(null);
  const [testingId, setTestingId] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [expandedServer, setExpandedServer] = useState(null);
  const [mounted, setMounted] = useState(false);

  const [activeTab, setActiveTab] = useState("servers");
  const [combos, setCombos] = useState([]);
  const [showComboModal, setShowComboModal] = useState(false);
  const [editingCombo, setEditingCombo] = useState(null);
  const [mcpApiKeys, setMcpApiKeys] = useState([]);
  const [showMcpKeyModal, setShowMcpKeyModal] = useState(false);
  const [newMcpKeyName, setNewMcpKeyName] = useState("");
  const [creatingMcpKey, setCreatingMcpKey] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchServers = useCallback(async () => {
    try {
      const res = await fetch("/api/mcp-servers");
      if (res.ok) {
        const data = await res.json();
        setServers(data.servers || []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCombos = useCallback(async () => {
    try {
      const res = await fetch("/api/combos");
      if (res.ok) {
        const data = await res.json();
        setCombos((data.combos || []).filter((c) => c.kind === "mcp"));
      }
    } catch (error) {
      console.error("Error fetching combos:", error);
    }
  }, []);

  const fetchMcpApiKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/mcp-keys");
      if (res.ok) {
        const data = await res.json();
        setMcpApiKeys(data.keys || []);
      }
    } catch (error) {
      console.error("Error fetching MCP API keys:", error);
    }
  }, []);

  useEffect(() => {
    fetchServers();
    fetchCombos();
    fetchMcpApiKeys();
  }, [fetchServers, fetchCombos, fetchMcpApiKeys]);

  const handleTest = async (server) => {
    setTestingId(server.id);
    setTestResults((prev) => ({ ...prev, [server.id]: null }));
    try {
      const res = await fetch(`/api/mcp-servers/${server.id}/test`, {
        method: "POST",
      });
      const result = await res.json();
      setTestResults((prev) => ({ ...prev, [server.id]: result }));
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [server.id]: { ok: false, error: err.message },
      }));
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (server) => {
    try {
      const res = await fetch(`/api/mcp-servers/${server.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setServers((prev) => prev.filter((s) => s.id !== server.id));
        setDeleteTarget(null);
      }
    } catch {}
  };

  const handleToggleLocalServers = async (newActive) => {
    const localServers = servers.filter((s) => s.type === "local-stdio");
    if (localServers.length === 0) {
      notify.info(
        "No local stdio servers configured. Please add a local server first.",
      );
      return;
    }

    await Promise.all(
      localServers.map((s) =>
        fetch(`/api/mcp-servers/${s.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: newActive }),
        }),
      ),
    );

    setServers((prev) =>
      prev.map((s) =>
        s.type === "local-stdio" ? { ...s, isActive: newActive } : s,
      ),
    );
    notify.success(
      `${newActive ? "Enabled" : "Disabled"} all local stdio servers`,
    );
  };

  const handleToggleActive = async (server) => {
    try {
      const res = await fetch(`/api/mcp-servers/${server.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !server.isActive }),
      });
      if (res.ok) {
        setServers((prev) =>
          prev.map((s) =>
            s.id === server.id ? { ...s, isActive: !s.isActive } : s,
          ),
        );
      }
    } catch {}
  };

  const handleAddServer = async (formData) => {
    try {
      const res = await fetch("/api/mcp-servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        const data = await res.json();
        setServers((prev) => [...prev, data.server]);
        setShowAddModal(false);
      }
    } catch {}
  };

  const handleUpdateServer = async (formData) => {
    if (!editingServer) return;
    try {
      const res = await fetch(`/api/mcp-servers/${editingServer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        const data = await res.json();
        setServers((prev) =>
          prev.map((s) => (s.id === editingServer.id ? data.server : s)),
        );
        setEditingServer(null);
      }
    } catch {}
  };

  const handleAddCombo = async (comboData) => {
    try {
      const res = await fetch("/api/combos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...comboData, kind: "mcp" }),
      });
      if (res.ok) {
        await fetchCombos();
        setShowComboModal(false);
        notify.success("MCP Combo created successfully");
      } else {
        const err = await res.json();
        notify.error(err.error || "Failed to create MCP combo");
      }
    } catch (err) {
      notify.error("Error creating combo");
    }
  };

  const handleUpdateCombo = async (id, comboData) => {
    try {
      const res = await fetch(`/api/combos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...comboData, kind: "mcp" }),
      });
      if (res.ok) {
        await fetchCombos();
        setEditingCombo(null);
        notify.success("MCP Combo updated successfully");
      } else {
        const err = await res.json();
        notify.error(err.error || "Failed to update MCP combo");
      }
    } catch (err) {
      notify.error("Error updating combo");
    }
  };

  const handleDeleteCombo = async (id) => {
    try {
      const res = await fetch(`/api/combos/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCombos((prev) => prev.filter((c) => c.id !== id));
        notify.success("MCP Combo deleted");
      }
    } catch (err) {
      notify.error("Failed to delete combo");
    }
  };

  const handleToggleComboActive = async (combo) => {
    try {
      const res = await fetch(`/api/combos/${combo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !combo.isActive }),
      });
      if (res.ok) {
        await fetchCombos();
        notify.success(
          combo.isActive
            ? "MCP Combo disabled"
            : `MCP Combo "${combo.name}" activated`,
        );
      } else {
        notify.error("Failed to toggle combo status");
      }
    } catch {
      notify.error("Error toggling combo status");
    }
  };

  const handleCreateMcpKey = async () => {
    if (!newMcpKeyName.trim()) {
      notify.error("Please enter a name for the API key");
      return;
    }
    setCreatingMcpKey(true);
    try {
      const res = await fetch("/api/mcp-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newMcpKeyName.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchMcpApiKeys();
        setShowMcpKeyModal(false);
        setNewMcpKeyName("");
        notify.success(`MCP API key created: ${data.key.key}`);
      } else {
        const err = await res.json();
        notify.error(err.error || "Failed to create MCP API key");
      }
    } catch (err) {
      notify.error("Error creating MCP API key");
    } finally {
      setCreatingMcpKey(false);
    }
  };

  const handleToggleMcpKey = async (key) => {
    try {
      const res = await fetch(`/api/mcp-keys/${key.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !key.isActive }),
      });
      if (res.ok) {
        await fetchMcpApiKeys();
        notify.success(
          key.isActive ? "MCP API key disabled" : "MCP API key enabled",
        );
      } else {
        notify.error("Failed to toggle MCP API key");
      }
    } catch {
      notify.error("Error toggling MCP API key");
    }
  };

  const handleDeleteMcpKey = async (key) => {
    if (!confirm(`Delete MCP API key "${key.name}"?`)) return;
    try {
      const res = await fetch(`/api/mcp-keys/${key.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchMcpApiKeys();
        notify.success("MCP API key deleted");
      } else {
        notify.error("Failed to delete MCP API key");
      }
    } catch {
      notify.error("Error deleting MCP API key");
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-main flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px] text-primary">
              hub
            </span>
            MCP Servers
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Configure MCP servers to add tools and capabilities to your AI
            agents
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === "servers" ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                icon="auto_awesome"
                onClick={() => setShowPresetModal(true)}
              >
                Presets
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon="add"
                onClick={() => setShowAddModal(true)}
              >
                Add Server
              </Button>
            </>
          ) : activeTab === "combos" ? (
            <Button
              variant="primary"
              size="sm"
              icon="add"
              onClick={() => setShowComboModal(true)}
            >
              Create MCP Combo
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              icon="add"
              onClick={() => setShowMcpKeyModal(true)}
            >
              Create MCP Key
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border-subtle">
        <button
          onClick={() => setActiveTab("servers")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === "servers"
              ? "border-primary text-primary"
              : "border-transparent text-text-muted hover:text-text-main"
          }`}
        >
          MCP Servers
        </button>
        <button
          onClick={() => setActiveTab("combos")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === "combos"
              ? "border-primary text-primary"
              : "border-transparent text-text-muted hover:text-text-main"
          }`}
        >
          MCP Combos
        </button>
        <button
          onClick={() => setActiveTab("api-keys")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === "api-keys"
              ? "border-primary text-primary"
              : "border-transparent text-text-muted hover:text-text-main"
          }`}
        >
          API Keys
        </button>
      </div>

      {/* Servers Tab Content */}
      {activeTab === "servers" && (
        <>
          {/* Warning/Guideline Advisory */}
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-4 flex gap-3">
            <span className="material-symbols-outlined text-amber-500 text-[20px] shrink-0 mt-0.5">
              warning
            </span>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-amber-400">
                Environment Advisory for MCP Servers
              </h4>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                <strong>Local stdio tools</strong> (command-line/binary
                processes running on localhost) require running 9Router on a{" "}
                <strong>local host / development machine</strong> for full
                functionality. For <strong>VPS or remote deployments</strong>,
                please configure and use{" "}
                <strong>remote HTTPS / SSE tools</strong> instead, as local
                stdio processes are not executable/runnable in typical cloud
                server virtual environments.
              </p>
            </div>
          </div>

          {/* Quick Controls Bar */}
          <div className="flex flex-col gap-3 p-4 bg-surface-1 border border-border-subtle rounded-xl sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-0.5">
              <h3 className="font-semibold text-sm">
                Local Server Quick Controls
              </h3>
              <p className="text-xs text-text-muted">
                Quickly enable or disable all local stdio MCP servers that you
                have added.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                icon="pause_circle"
                onClick={() => handleToggleLocalServers(false)}
                className="w-full sm:w-auto"
              >
                Disable Local stdio
              </Button>
              <Button
                size="sm"
                icon="play_circle"
                onClick={() => handleToggleLocalServers(true)}
                className="w-full sm:w-auto"
              >
                Enable Local stdio
              </Button>
            </div>
          </div>

          {/* Gateway Info */}
          <div className="rounded-xl bg-surface-1 border border-border-subtle p-4">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center size-9 rounded-lg bg-brand-500/10 shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[18px] text-brand-500">
                  swap_horiz
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-text-main">
                  Unified Gateway Endpoint
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  All active servers are accessible through a single gateway.
                  Configure your MCP client to use:
                </p>
                <code className="block mt-2 px-3 py-1.5 rounded-lg bg-surface-2 text-xs font-mono text-brand-400 break-all">
                  {mounted
                    ? `${window.location.origin}/api/mcp-gateway`
                    : "/api/mcp-gateway"}
                </code>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-text-muted">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">
                      cell_tower
                    </span>
                    SSE: <code className="text-brand-400">/sse</code>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">
                      send
                    </span>
                    Message: <code className="text-brand-400">/message</code>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">
                      select_all
                    </span>
                    Per-server:{" "}
                    <code className="text-brand-400">/[serverId]/...</code>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Server List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <span className="material-symbols-outlined animate-spin text-2xl text-text-muted">
                progress_activity
              </span>
            </div>
          ) : servers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-xl bg-surface-1 border border-border-subtle border-dashed">
              <div className="flex items-center justify-center size-14 rounded-full bg-surface-2 mb-4">
                <span className="material-symbols-outlined text-2xl text-text-muted">
                  hub
                </span>
              </div>
              <h3 className="text-base font-medium text-text-main mb-1">
                No MCP servers configured
              </h3>
              <p className="text-sm text-text-muted mb-4 text-center max-w-md">
                Add MCP servers to give your AI agents access to tools like web
                search, file system, GitHub, and more.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon="auto_awesome"
                  onClick={() => setShowPresetModal(true)}
                >
                  Browse Presets
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon="add"
                  onClick={() => setShowAddModal(true)}
                >
                  Add Server
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              {servers.map((server) => (
                <ServerCard
                  key={server.id}
                  server={server}
                  isExpanded={expandedServer === server.id}
                  onToggleExpand={() =>
                    setExpandedServer(
                      expandedServer === server.id ? null : server.id,
                    )
                  }
                  testingId={testingId}
                  testResult={testResults[server.id]}
                  onTest={handleTest}
                  onToggleActive={handleToggleActive}
                  onEdit={() => setEditingServer(server)}
                  onDelete={() => setDeleteTarget(server)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* API Keys Tab Content */}
      {activeTab === "api-keys" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-main">
                MCP API Keys
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Manage API keys for MCP gateway access. These keys use the mcp_
                prefix and are separate from v1 API keys.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon="add"
              onClick={() => setShowMcpKeyModal(true)}
            >
              Create MCP Key
            </Button>
          </div>

          {mcpApiKeys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-xl bg-surface-1 border border-border-subtle border-dashed">
              <div className="flex items-center justify-center size-14 rounded-full bg-surface-2 mb-4">
                <span className="material-symbols-outlined text-2xl text-text-muted">
                  key
                </span>
              </div>
              <h3 className="text-base font-medium text-text-main mb-1">
                No MCP API Keys
              </h3>
              <p className="text-sm text-text-muted mb-4 text-center max-w-md">
                Create an MCP API key to authenticate requests to the MCP
                gateway.
              </p>
              <Button
                variant="primary"
                size="sm"
                icon="add"
                onClick={() => setShowMcpKeyModal(true)}
              >
                Create MCP Key
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {mcpApiKeys.map((key) => (
                <div
                  key={key.id}
                  className={`p-4 border rounded-xl flex items-center justify-between gap-4 transition-all duration-200 ${
                    key.isActive
                      ? "bg-surface-1 border-border-subtle hover:border-border"
                      : "bg-surface-1/50 border-border-subtle/50 opacity-60"
                  }`}
                >
                  {/* Toggle */}
                  <button
                    onClick={() => handleToggleMcpKey(key)}
                    className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer shrink-0 ${
                      key.isActive ? "bg-brand-500" : "bg-surface-3"
                    }`}
                    title={key.isActive ? "Disable Key" : "Enable Key"}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform ${
                        key.isActive ? "translate-x-5" : ""
                      }`}
                    />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-text-main">
                        {key.name}
                      </span>
                      {key.isActive && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <code className="text-xs px-2 py-1 rounded bg-surface-2 font-mono text-brand-400 break-all">
                        {key.key}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(key.key);
                          notify.success("API key copied to clipboard");
                        }}
                        className="p-1 rounded hover:bg-surface-3 text-text-muted hover:text-text-main transition-colors cursor-pointer"
                        title="Copy to clipboard"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          content_copy
                        </span>
                      </button>
                    </div>
                    <p className="text-[10px] text-text-muted mt-1">
                      Created: {new Date(key.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleDeleteMcpKey(key)}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-500 transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        delete
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Combos Tab Content */}
      {activeTab === "combos" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-main">
                Custom MCP Combos
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Limit and customize which tools are exposed to your editor
                client / IDE. Use `combo=name` parameter.
              </p>
            </div>
          </div>

          {combos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-xl bg-surface-1 border border-border-subtle border-dashed">
              <div className="flex items-center justify-center size-14 rounded-full bg-surface-2 mb-4">
                <span className="material-symbols-outlined text-2xl text-text-muted">
                  construction
                </span>
              </div>
              <h3 className="text-base font-medium text-text-main mb-1">
                No MCP Combos configured
              </h3>
              <p className="text-sm text-text-muted mb-4 text-center max-w-md">
                Create a combo to restrict specific tools and expose them
                selectively to the IDE client.
              </p>
              <Button
                variant="primary"
                size="sm"
                icon="add"
                onClick={() => setShowComboModal(true)}
              >
                Create MCP Combo
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {combos.map((combo) => (
                <div
                  key={combo.id}
                  className={`p-4 border rounded-xl flex items-center justify-between gap-4 transition-all duration-200 ${
                    combo.isActive
                      ? "bg-surface-1 border-border-subtle hover:border-border"
                      : "bg-surface-1/50 border-border-subtle/50 opacity-60"
                  }`}
                >
                  {/* Toggle */}
                  <button
                    onClick={() => handleToggleComboActive(combo)}
                    className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer shrink-0 ${
                      combo.isActive ? "bg-brand-500" : "bg-surface-3"
                    }`}
                    title={combo.isActive ? "Disable Combo" : "Enable Combo"}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform ${
                        combo.isActive ? "translate-x-5" : ""
                      }`}
                    />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-semibold font-mono text-brand-400">
                        {combo.name}
                      </code>
                      {combo.isActive && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                          Active Exposer
                        </span>
                      )}
                      {combo.maxTools !== null &&
                        combo.maxTools !== undefined && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-text-muted">
                            Max Tools: {combo.maxTools}
                          </span>
                        )}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {!combo.tools || combo.tools.length === 0 ? (
                        <span className="text-xs text-text-muted italic bg-surface-2 px-2 py-0.5 rounded">
                          All active tools exposed
                        </span>
                      ) : (
                        combo.tools.map((t) => (
                          <code
                            key={t}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 font-mono text-text-muted"
                          >
                            {t}
                          </code>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setEditingCombo(combo)}
                      className="p-2 rounded-lg hover:bg-surface-2 text-text-muted hover:text-text-main transition-colors cursor-pointer"
                      title="Edit"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        edit
                      </span>
                    </button>
                    <button
                      onClick={() => handleDeleteCombo(combo.id)}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-500 transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        delete
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Server Modal */}
      {showAddModal && (
        <ServerFormModal
          title="Add MCP Server"
          onSubmit={handleAddServer}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Preset Modal */}
      {showPresetModal && (
        <PresetModal
          onSelect={(preset) => {
            setShowPresetModal(false);
            handleAddServer(preset);
          }}
          onClose={() => setShowPresetModal(false)}
        />
      )}

      {/* Edit Modal */}
      {editingServer && (
        <ServerFormModal
          title="Edit MCP Server"
          server={editingServer}
          onSubmit={handleUpdateServer}
          onClose={() => setEditingServer(null)}
        />
      )}

      {/* MCP Combo Modals */}
      {showComboModal && (
        <McpComboFormModal
          isOpen={showComboModal}
          onClose={() => setShowComboModal(false)}
          onSave={handleAddCombo}
        />
      )}

      {editingCombo && (
        <McpComboFormModal
          isOpen={!!editingCombo}
          combo={editingCombo}
          onClose={() => setEditingCombo(null)}
          onSave={(data) => handleUpdateCombo(editingCombo.id, data)}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget)}
        title="Delete MCP Server"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Create MCP API Key Modal */}
      <Modal
        isOpen={showMcpKeyModal}
        onClose={() => {
          setShowMcpKeyModal(false);
          setNewMcpKeyName("");
        }}
        title="Create MCP API Key"
      >
        <div className="flex flex-col gap-4">
          <div>
            <Input
              label="Key Name"
              value={newMcpKeyName}
              onChange={(e) => setNewMcpKeyName(e.target.value)}
              placeholder="e.g., Claude Desktop, Cursor IDE"
            />
            <p className="text-[10px] text-text-muted mt-0.5">
              A descriptive name to identify this API key. Use this key to
              authenticate MCP gateway requests.
            </p>
          </div>

          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
            <p className="text-xs text-blue-400">
              <strong>Note:</strong> MCP API keys use the{" "}
              <code className="font-mono bg-surface-2 px-1 rounded">mcp_</code>{" "}
              prefix and are completely separate from v1 API keys (sk- prefix)
              used for AI model endpoints.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setShowMcpKeyModal(false);
                setNewMcpKeyName("");
              }}
              disabled={creatingMcpKey}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateMcpKey}
              loading={creatingMcpKey}
              disabled={!newMcpKeyName.trim()}
            >
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Server Card ───────────────────────────────────────────────────────────

function ServerCard({
  server,
  isExpanded,
  onToggleExpand,
  testingId,
  testResult,
  onTest,
  onToggleActive,
  onEdit,
  onDelete,
}) {
  const typeInfo =
    SERVER_TYPES.find((t) => t.id === server.type) || SERVER_TYPES[0];
  const isTesting = testingId === server.id;

  return (
    <div
      className={`rounded-xl border transition-all duration-200 ${server.isActive ? "bg-surface-1 border-border-subtle hover:border-border" : "bg-surface-1/50 border-border-subtle/50 opacity-60"}`}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Toggle */}
        <button
          onClick={() => onToggleActive(server)}
          className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer shrink-0 ${server.isActive ? "bg-brand-500" : "bg-surface-3"}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform ${server.isActive ? "translate-x-5" : ""}`}
          />
        </button>

        {/* Icon + Name */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className={`flex items-center justify-center size-9 rounded-lg shrink-0 ${server.isActive ? "bg-brand-500/10" : "bg-surface-2"}`}
          >
            <span
              className={`material-symbols-outlined text-[18px] ${server.isActive ? "text-brand-500" : "text-text-muted"}`}
            >
              {typeInfo.icon}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-text-main truncate">
                {server.name}
              </h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-text-muted shrink-0">
                {typeInfo.label}
              </span>
              {testResult && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${testResult.ok ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}
                >
                  {testResult.ok ? "Connected" : "Failed"}
                </span>
              )}
            </div>
            {server.description && (
              <p className="text-xs text-text-muted truncate mt-0.5">
                {server.description}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onTest(server)}
            disabled={isTesting}
            className="p-1.5 rounded-lg hover:bg-surface-2 text-text-muted hover:text-brand-500 transition-colors cursor-pointer disabled:opacity-50"
            title="Test connection"
          >
            <span
              className={`material-symbols-outlined text-[16px] ${isTesting ? "animate-spin" : ""}`}
            >
              {isTesting ? "progress_activity" : "play_arrow"}
            </span>
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-surface-2 text-text-muted hover:text-text-main transition-colors cursor-pointer"
            title="Edit"
          >
            <span className="material-symbols-outlined text-[16px]">edit</span>
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-500 transition-colors cursor-pointer"
            title="Delete"
          >
            <span className="material-symbols-outlined text-[16px]">
              delete
            </span>
          </button>
          <button
            onClick={onToggleExpand}
            className="p-1.5 rounded-lg hover:bg-surface-2 text-text-muted hover:text-text-main transition-colors cursor-pointer"
          >
            <span
              className="material-symbols-outlined text-[16px] transition-transform"
              style={{ transform: isExpanded ? "rotate(180deg)" : "" }}
            >
              expand_more
            </span>
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-4 pb-3 pt-1 border-t border-border-subtle/50">
          <div className="grid gap-2 text-xs">
            {server.url && (
              <div className="flex items-center gap-2">
                <span className="text-text-muted w-16 shrink-0">URL</span>
                <code className="text-text-main font-mono truncate break-all">
                  {server.url}
                </code>
              </div>
            )}
            {server.command && (
              <div className="flex items-center gap-2">
                <span className="text-text-muted w-16 shrink-0">Command</span>
                <code className="text-text-main font-mono">
                  {server.command} {(server.args || []).join(" ")}
                </code>
              </div>
            )}
            {server.toolNames?.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-text-muted w-16 shrink-0">Tools</span>
                <div className="flex flex-wrap gap-1">
                  {server.toolNames.map((tool) => (
                    <span
                      key={tool}
                      className="px-1.5 py-0.5 rounded bg-surface-2 text-text-muted"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-text-muted w-16 shrink-0">Endpoint</span>
              <code className="text-brand-400 font-mono">
                /api/mcp-gateway/{server.id}
              </code>
            </div>
          </div>
          {testResult && (
            <div
              className={`mt-2 px-3 py-2 rounded-lg border ${testResult.ok ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"}`}
            >
              {testResult.ok ? (
                <div>
                  <p className="text-xs text-green-500 font-medium mb-1">
                    ✓ Connected — {testResult.toolCount ?? 0} tool
                    {testResult.toolCount !== 1 ? "s" : ""} available
                  </p>
                  {testResult.serverInfo && (
                    <p className="text-[10px] text-text-muted">
                      {testResult.serverInfo.name} v
                      {testResult.serverInfo.version}
                    </p>
                  )}
                  {testResult.tools?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {testResult.tools.map((tool) => (
                        <span
                          key={tool}
                          className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 text-[10px]"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-xs text-red-500">{testResult.error}</p>
                  {testResult.hint && (
                    <p className="text-[10px] text-red-400/70 mt-1">
                      {testResult.hint}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Server Form Modal ─────────────────────────────────────────────────────

function ServerFormModal({ title, server, onSubmit, onClose }) {
  const [name, setName] = useState(server?.name || "");
  const [type, setType] = useState(server?.type || "remote-http");
  const [url, setUrl] = useState(server?.url || "");
  const [command, setCommand] = useState(server?.command || "");
  const [argsStr, setArgsStr] = useState((server?.args || []).join(" "));
  const [description, setDescription] = useState(server?.description || "");
  const [headersStr, setHeadersStr] = useState(
    server?.headers ? JSON.stringify(server.headers, null, 2) : "",
  );
  const [toolNamesStr, setToolNamesStr] = useState(
    (server?.toolNames || []).join(", "),
  );
  const [envStr, setEnvStr] = useState(
    server?.env ? JSON.stringify(server.env, null, 2) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const isRemote = type === "remote-http" || type === "remote-sse";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const data = { name, type };
      if (isRemote) data.url = url;
      if (type === "local-stdio") {
        data.command = command;
        data.args = argsStr.trim() ? argsStr.trim().split(/\s+/) : [];
        if (envStr.trim()) {
          try {
            data.env = JSON.parse(envStr);
          } catch {
            setError("Invalid JSON in environment variables");
            setSaving(false);
            return;
          }
        }
      }
      if (description) data.description = description;
      if (headersStr.trim()) {
        try {
          data.headers = JSON.parse(headersStr);
        } catch {
          setError("Invalid JSON in headers");
          setSaving(false);
          return;
        }
      }
      if (toolNamesStr.trim()) {
        data.toolNames = toolNamesStr
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      await onSubmit(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-surface-1 border border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h2 className="text-base font-semibold text-text-main">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-2 text-text-muted transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My MCP Server"
              required
              className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm text-text-main placeholder:text-text-muted/50 focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">
              Transport Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SERVER_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setType(t.id)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all cursor-pointer ${
                    type === t.id
                      ? "border-brand-500 bg-brand-500/10 text-brand-500"
                      : "border-border bg-surface-2 text-text-muted hover:border-border hover:text-text-main"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {t.icon}
                  </span>
                  <span className="text-[11px] font-medium">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* URL (for remote) */}
          {isRemote && (
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">
                Server URL *
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://mcp.example.com/mcp"
                required
                className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm text-text-main font-mono placeholder:text-text-muted/50 focus:outline-none focus:border-brand-500 transition-colors"
              />
            </div>
          )}

          {/* Command (for stdio) */}
          {type === "local-stdio" && (
            <>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Command *
                </label>
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="npx"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm text-text-main font-mono placeholder:text-text-muted/50 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Arguments (space-separated)
                </label>
                <input
                  type="text"
                  value={argsStr}
                  onChange={(e) => setArgsStr(e.target.value)}
                  placeholder="-y @modelcontextprotocol/server-filesystem /tmp"
                  className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm text-text-main font-mono placeholder:text-text-muted/50 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Environment Variables (JSON)
                </label>
                <textarea
                  value={envStr}
                  onChange={(e) => setEnvStr(e.target.value)}
                  placeholder='{"API_KEY": "sk-...", "DEBUG": "true"}'
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm text-text-main font-mono placeholder:text-text-muted/50 focus:outline-none focus:border-brand-500 transition-colors resize-none"
                />
              </div>
            </>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this server provides..."
              className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm text-text-main placeholder:text-text-muted/50 focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>

          {/* Tool Names */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">
              Tool Names (comma-separated)
            </label>
            <input
              type="text"
              value={toolNamesStr}
              onChange={(e) => setToolNamesStr(e.target.value)}
              placeholder="web_search, file_read, execute_command"
              className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-sm text-text-main font-mono placeholder:text-text-muted/50 focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>

          {/* Custom Headers (JSON) */}
          {isRemote && (
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">
                Custom Headers (JSON)
              </label>
              <textarea
                value={headersStr}
                onChange={(e) => setHeadersStr(e.target.value)}
                placeholder='{"Authorization": "Bearer ..."}'
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-xs text-text-main font-mono placeholder:text-text-muted/50 focus:outline-none focus:border-brand-500 transition-colors resize-none"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              loading={saving}
              icon="save"
            >
              {server ? "Update" : "Add Server"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Preset Modal ──────────────────────────────────────────────────────────

function PresetModal({ onSelect, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-surface-1 border border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h2 className="text-base font-semibold text-text-main">
            Add from Preset
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-2 text-text-muted transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="p-4 grid gap-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {PRESET_SERVERS.map((preset) => {
            const typeInfo =
              SERVER_TYPES.find((t) => t.id === preset.type) || SERVER_TYPES[0];
            return (
              <button
                key={preset.name}
                onClick={() => onSelect(preset)}
                className="flex items-center w-full min-w-0 gap-3 p-3 rounded-xl bg-surface-2 hover:bg-surface-3 border border-transparent hover:border-border-subtle transition-all cursor-pointer text-left"
              >
                <div className="flex items-center justify-center size-9 rounded-lg bg-brand-500/10 shrink-0">
                  <span className="material-symbols-outlined text-[18px] text-brand-500">
                    {typeInfo.icon}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-text-main">
                      {preset.name}
                    </h4>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-1 text-text-muted">
                      {typeInfo.label}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5 truncate">
                    {preset.description}
                  </p>
                </div>
                <span className="material-symbols-outlined text-[16px] text-text-muted">
                  add_circle
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function McpComboFormModal({ isOpen, combo, onClose, onSave }) {
  const [name, setName] = useState(combo?.name || "");
  const [maxTools, setMaxTools] = useState(
    combo?.maxTools !== undefined && combo?.maxTools !== null
      ? combo.maxTools
      : "",
  );
  const [selectedTools, setSelectedTools] = useState(combo?.tools || []);
  const [availableTools, setAvailableTools] = useState([]);
  const [toolSearch, setToolSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");

  const validateName = (value) => {
    if (!value.trim()) {
      setNameError("Name is required");
      return false;
    }
    const VALID_NAME_REGEX = /^[a-zA-Z0-9_.\-]+$/;
    if (!VALID_NAME_REGEX.test(value)) {
      setNameError("Only letters, numbers, -, _ and . allowed");
      return false;
    }
    setNameError("");
    return true;
  };

  const handleNameChange = (e) => {
    const value = e.target.value;
    setName(value);
    if (value) validateName(value);
    else setNameError("");
  };

  const fetchTools = async () => {
    try {
      const toolsRes = await fetch("/api/mcp-gateway/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "mcp-combos-page",
          method: "tools/list",
        }),
      });
      if (toolsRes.ok) {
        const toolsData = await toolsRes.json();
        setAvailableTools(toolsData?.result?.tools || []);
      }
    } catch (error) {
      console.error("Error fetching tools:", error);
    }
  };

  useEffect(() => {
    if (isOpen) fetchTools();
  }, [isOpen]);

  const handleSave = async () => {
    if (!validateName(name)) return;
    setSaving(true);
    const maxVal = maxTools === "" ? null : parseInt(maxTools, 10);
    await onSave({
      name: name.trim(),
      tools: selectedTools,
      maxTools: isNaN(maxVal) ? null : maxVal,
      models: [], // Empty for MCP combos
    });
    setSaving(false);
  };

  const filteredToolsList = availableTools.filter(
    (t) =>
      t.name.toLowerCase().includes(toolSearch.toLowerCase()) ||
      (t.description || "").toLowerCase().includes(toolSearch.toLowerCase()),
  );

  const isEdit = !!combo;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit MCP Combo" : "Create MCP Combo"}
    >
      <div className="flex flex-col gap-4">
        {/* Name */}
        <div>
          <Input
            label="Combo Name"
            value={name}
            onChange={handleNameChange}
            placeholder="my-mcp-combo"
            error={nameError}
          />
          <p className="text-[10px] text-text-muted mt-0.5">
            Only letters, numbers, -, _ and . allowed. Use this name parameter
            as `combo=name` in query.
          </p>
        </div>

        {/* Max Tools */}
        <div>
          <Input
            label="Max Tools to Expose"
            type="number"
            value={maxTools}
            onChange={(e) => {
              const val = e.target.value;
              setMaxTools(val === "" ? "" : parseInt(val, 10));
            }}
            placeholder="e.g. 10 (Leave blank for no limit)"
            min="0"
          />
          <p className="text-[10px] text-text-muted mt-0.5">
            Limit the maximum number of tools returned to the outer IDE.
          </p>
        </div>

        {/* Tools Selection */}
        <div>
          <label className="text-sm font-medium mb-1.5 block">
            Exposed MCP Tools
          </label>
          <div className="flex flex-col gap-2">
            <Input
              value={toolSearch}
              onChange={(e) => setToolSearch(e.target.value)}
              placeholder="Search active tools..."
            />

            {/* List of all active tools with +/- buttons */}
            <div className="border border-border rounded-lg bg-surface-2 max-h-[200px] overflow-y-auto divide-y divide-border">
              {availableTools.length === 0 ? (
                <div className="text-center py-6 text-text-muted text-xs">
                  No active MCP tools found. Ensure your MCP servers are
                  connected.
                </div>
              ) : filteredToolsList.length === 0 ? (
                <div className="text-center py-6 text-text-muted text-xs">
                  No tools matching "{toolSearch}"
                </div>
              ) : (
                filteredToolsList.map((tool) => {
                  const isSelected = selectedTools.includes(tool.name);
                  return (
                    <div
                      key={tool.name}
                      className="flex items-center justify-between px-3 py-2 text-xs transition-colors"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <code className="font-semibold block font-mono text-text-main break-all">
                          {tool.name}
                        </code>
                        {tool.description && (
                          <span className="text-[10px] text-text-muted block mt-0.5 line-clamp-2">
                            {tool.description}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedTools(
                              selectedTools.filter((t) => t !== tool.name),
                            );
                          } else {
                            setSelectedTools([...selectedTools, tool.name]);
                          }
                        }}
                        className={`p-1.5 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                            : "bg-brand-500/10 text-brand-400 hover:bg-brand-500/20"
                        }`}
                        title={
                          isSelected ? "Remove from Combo" : "Add to Combo"
                        }
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {isSelected ? "remove" : "add"}
                        </span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Tag/Summary of Selected Tools */}
            <div className="flex flex-wrap gap-1.5 mt-1">
              <span className="text-[10px] text-text-muted font-medium w-full">
                Exposed ({selectedTools.length}):
              </span>
              {selectedTools.length === 0 ? (
                <span className="text-[10px] text-text-muted italic bg-surface-2 px-2 py-0.5 rounded">
                  All active tools exposed by default
                </span>
              ) : (
                selectedTools.map((tName) => (
                  <span
                    key={tName}
                    className="inline-flex items-center gap-1 bg-brand-500/10 border border-brand-500/20 text-brand-400 px-2 py-0.5 rounded text-[10px]"
                  >
                    <code className="font-mono">{tName}</code>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedTools(
                          selectedTools.filter((t) => t !== tName),
                        )
                      }
                      className="hover:text-red-500 font-bold ml-1 cursor-pointer"
                    >
                      &times;
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            loading={saving}
            disabled={!name.trim() || !!nameError}
          >
            {isEdit ? "Save" : "Create"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
