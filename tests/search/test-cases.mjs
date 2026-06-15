/**
 * Search MCP Server Test Cases
 * Tests for web search, extract, and related operations.
 */

export const TASK_DEFINITIONS = [
  {
    name: "web_search",
    description: "Perform a web search query",
    defaultArgs: { query: "Model Context Protocol servers 2026" },
  },
  {
    name: "extract",
    description: "Extract content from a URL",
    defaultArgs: { url: "https://modelcontextprotocol.io" },
  },
]

export const SERVERS = [
  {
    name: "Tavily MCP",
    command: "npx",
    args: ["-y", "tavily-mcp@latest"],
    env: {},
    envVar: "TAVILY_API_KEY",
    authTriage: "requires-auth",
    adapter: "../adapters/tavily.mjs",
  },
  {
    name: "Exa MCP",
    command: "npx",
    args: ["-y", "exa-mcp-server@latest"],
    env: {},
    envVar: "EXA_API_KEY",
    authTriage: "requires-auth",
    adapter: "../adapters/exa.mjs",
  },
  {
    name: "Brave Search MCP",
    command: "npx",
    args: ["-y", "brave-search-mcp-server@latest"],
    env: {},
    envVar: "BRAVE_API_KEY",
    authTriage: "requires-auth",
    adapter: "../adapters/brave.mjs",
  },
]
