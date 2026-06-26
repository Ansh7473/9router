// Prefix assignment for MCP gateway tool namespacing.
//
// Every active MCP server gets a short, human-readable, UNIQUE prefix that is
// prepended to its tool names in the aggregated gateway (e.g. "bro__navigate").
// The prefix is what lets the gateway route a `prefix__tool` call back to the
// right upstream server, so it MUST be unique across servers. Prefixes are
// persisted per server (in the server record) so they stay stable as servers
// are added/removed/toggled.

// Friendly base prefixes for well-known servers. Falls back to the first three
// alphanumeric characters of the name.
const SPECIAL_PREFIXES = [
  ["testsprite", "ts"],
  ["sentry", "sr"],
  ["firecrawl", "fc"],
  ["puppeteer", "pp"],
  ["astro", "ad"],
  ["stitch", "st"],
  ["github", "gh"],
  ["tavily", "tv"],
];

// Compute the (non-unique) base prefix for a server name.
export function computeBasePrefix(name) {
  const n = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  for (const [needle, prefix] of SPECIAL_PREFIXES) {
    if (n.includes(needle)) return prefix;
  }
  return n.slice(0, 3) || "mcp";
}

// Sanitize a user-provided prefix override: lowercase, alphanumeric only,
// capped length. Returns "" when nothing usable remains.
export function normalizePrefix(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12);
}

// Given a desired base and a set of already-taken prefixes, return a unique
// prefix by appending the smallest free number on collision (bro -> bro2 -> bro3).
export function makeUniquePrefix(base, taken) {
  const b = base || "mcp";
  if (!taken.has(b)) return b;
  let i = 2;
  while (taken.has(`${b}${i}`)) i++;
  return `${b}${i}`;
}
