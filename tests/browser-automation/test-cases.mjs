/**
 * Browser Automation MCP Server Test Cases
 * Task-based definitions: user intent, not tool calls.
 * Each server gets its own adapter to map tasks to correct tools + arguments.
 */

export const TASK_DEFINITIONS = [
  {
    name: "navigate",
    description: "Load a URL in the browser",
    defaultArgs: {},
  },
  {
    name: "screenshot",
    description: "Capture a screenshot of the current page",
    defaultArgs: {},
  },
  {
    name: "snapshot",
    description: "Get a DOM snapshot or page content",
    defaultArgs: {},
  },
  {
    name: "click",
    description: "Click an interactive element",
    defaultArgs: { selector: "#click-button" },
  },
  {
    name: "fill",
    description: "Fill a form input field",
    defaultArgs: { selector: "#test-input", text: "MCP test input" },
  },
]

/**
 * Server definitions with auth triage and adapter paths.
 */
export const SERVERS = [
  {
    name: "Playwright MCP",
    command: "npx",
    args: ["-y", "@playwright/mcp@latest"],
    env: {},
    envVar: null,
    authTriage: "free-to-test",
    adapter: "../adapters/playwright.mjs",
  },
  {
    name: "Puppeteer MCP",
    command: "npx",
    args: ["-y", "@hisma/server-puppeteer@latest"],
    env: {},
    envVar: null,
    authTriage: "free-to-test",
    adapter: "../adapters/puppeteer.mjs",
  },
  {
    name: "Firecrawl MCP",
    command: "npx",
    args: ["-y", "firecrawl-mcp@latest"],
    env: {},
    envVar: "FIRECRAWL_API_KEY",
    authTriage: "requires-auth",
    adapter: "../adapters/firecrawl.mjs",
  },
  {
    name: "Browserbase MCP",
    command: "npx",
    args: ["-y", "@browserbasehq/mcp@latest"],
    env: {},
    envVar: "BROWSERBASE_API_KEY",
    authTriage: "requires-auth",
    adapter: "../adapters/browserbase.mjs",
  },
]
