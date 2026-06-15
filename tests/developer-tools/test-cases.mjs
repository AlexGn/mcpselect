/**
 * Developer Tools MCP Server Test Cases
 */

export const TASK_DEFINITIONS = [
  { name: "list", description: "List directory contents or repository status", defaultArgs: {} },
  { name: "read", description: "Read file contents or repository history", defaultArgs: {} },
  { name: "write", description: "Write or create a file/resource", defaultArgs: {} },
  { name: "execute", description: "Execute a command or operation", defaultArgs: {} },
  { name: "info", description: "Get metadata or system information", defaultArgs: {} },
]

export const SERVERS = [
  {
    name: "Filesystem MCP",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem@latest", "/private/tmp/devtest"],
    env: {},
    envVar: null,
    authTriage: "free-to-test",
    adapter: "../adapters/filesystem.mjs",
  },
  {
    name: "Shell MCP",
    command: "npx",
    args: ["-y", "mcp-shell@latest"],
    env: {},
    envVar: null,
    authTriage: "free-to-test",
    adapter: "../adapters/shell.mjs",
  },
  {
    name: "Git MCP",
    command: "npx",
    args: ["-y", "mcp-git@latest"],
    env: {},
    envVar: null,
    authTriage: "free-to-test",
    adapter: "../adapters/git.mjs",
  },
]
