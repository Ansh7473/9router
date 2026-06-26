import { NextResponse } from "next/server";
import { handleToolsList } from "@/lib/mcp/mcpGatewayHandlers";

export const dynamic = "force-dynamic";

// GET /api/mcp-servers/tools
// Aggregates the tools exposed by all active MCP servers for the dashboard
// (e.g. the "Create MCP Combo" tool picker).
//
// This is an INTERNAL dashboard endpoint and is intentionally NOT gated by an
// `mcp_` gateway API key — it runs behind the app's existing dashboard auth,
// the same as the other /api/mcp-servers routes. The public gateway endpoint
// (/api/mcp-gateway/message) still requires an mcp_ key.
export async function GET() {
  try {
    const result = await handleToolsList({ id: "dashboard-tools" }, null);
    const tools = result?.result?.tools || [];
    return NextResponse.json({ tools });
  } catch (error) {
    console.error("Error aggregating MCP tools:", error);
    return NextResponse.json(
      { error: "Failed to aggregate MCP tools", tools: [] },
      { status: 500 },
    );
  }
}
