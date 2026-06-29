import { existsSync } from "fs";
import path from "path";
import { execFileSync } from "child_process";
import coworkPlugins from "@/shared/constants/coworkPlugins";

const { LOCAL_STDIO_PLUGINS } = coworkPlugins;

const ALLOWED_STDIO_SPECS = new Set(
  LOCAL_STDIO_PLUGINS.map((plugin) =>
    JSON.stringify({ command: plugin.command, args: plugin.args || [] }),
  ),
);

// Windows: these commands are script shims (.cmd/.bat), not real .exe files.
// Node's spawn() without a shell can't execute them directly (throws ENOENT),
// so we route them through cmd.exe with the correct shim extension.
const WINDOWS_SHIM_COMMANDS = {
  npm: "cmd",
  npx: "cmd",
  pnpm: "cmd",
  yarn: "cmd",
  bun: "cmd",
  dart: "bat",
  flutter: "bat",
};

export function resolveLocalStdioSpawn(command, args = []) {
  if (process.platform !== "win32") return { command, args };
  if (typeof command !== "string") return { command, args };

  const trimmed = command.trim();
  const shimExt = WINDOWS_SHIM_COMMANDS[trimmed.toLowerCase()];
  if (!shimExt || /\.(exe|cmd|bat)$/i.test(trimmed)) {
    return { command: trimmed, args };
  }

  const comspec = process.env.ComSpec || process.env.COMSPEC || "cmd.exe";
  return { command: comspec, args: ["/d", "/c", `${trimmed}.${shimExt}`, ...args] };
}

export function resolveLocalStdioCommand(command) {
  return resolveLocalStdioSpawn(command).command;
}

export function isAllowedLocalStdioCommand(command, args = []) {
  if (typeof command !== "string" || !Array.isArray(args)) return false;
  return ALLOWED_STDIO_SPECS.has(
    JSON.stringify({ command: command.trim(), args }),
  );
}

export function validateLocalStdioServer(server) {
  if (server?.type !== "local-stdio") return { ok: true };

  if (!isAllowedLocalStdioCommand(server.command, server.args || [])) {
    return {
      ok: false,
      error: `Local stdio command and args are not allowed: ${server.command || "<empty>"}`,
    };
  }

  if (
    server.env !== undefined &&
    (server.env === null ||
      Array.isArray(server.env) ||
      typeof server.env !== "object")
  ) {
    return { ok: false, error: "Local stdio env must be an object" };
  }

  if (server.args !== undefined && !Array.isArray(server.args)) {
    return { ok: false, error: "Local stdio args must be an array" };
  }

  return { ok: true };
}

export function isCodeGraphServer(serverOrPlugin) {
  return (
    serverOrPlugin?.command === "codegraph" ||
    serverOrPlugin?.name === "CodeGraph" ||
    serverOrPlugin?.name === "codegraph" ||
    (serverOrPlugin?.command === "npx" &&
      Array.isArray(serverOrPlugin.args) &&
      serverOrPlugin.args.includes("@colbymchenry/codegraph"))
  );
}

export function ensureCodeGraphInitialized(projectRoot = process.cwd()) {
  const codegraphDir = path.join(
    /*turbopackIgnore: true*/ projectRoot,
    ".codegraph",
  );
  if (existsSync(/*turbopackIgnore: true*/ codegraphDir)) return;

  console.log(
    `[CodeGraph Auto-Init] .codegraph not found in ${projectRoot}. Running codegraph init...`,
  );
  try {
    const initSpawn = resolveLocalStdioSpawn("npx", [
      "-y",
      "@colbymchenry/codegraph",
      "init",
    ]);
    execFileSync(initSpawn.command, initSpawn.args, {
      /*turbopackIgnore: true*/ cwd: projectRoot,
      stdio: "ignore",
    });
    console.log("[CodeGraph Auto-Init] Successfully initialized CodeGraph.");
  } catch (err) {
    console.error("[CodeGraph Auto-Init] Failed to run codegraph init:", err);
  }
}
