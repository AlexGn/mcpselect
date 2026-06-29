/**
 * Brave Search MCP Adapter
 */

export const SERVER_PATTERN = /brave/i

export const TOOL_ALIASES = {
  web_search: ["brave_web_search", "web_search", "search"],
  extract: ["brave_local_search", "local_search"],
}

export function adaptTask(taskName, genericArgs, _pageUrl) {
  switch (taskName) {
    case "web_search":
      return {
        tool: "brave_web_search",
        arguments: { query: genericArgs.query || "MCP servers", count: 3 },
      }
    case "extract":
      // Brave doesn't have a direct extract tool; use web search as fallback
      return {
        tool: "brave_web_search",
        arguments: { query: genericArgs.url || "modelcontextprotocol.io", count: 1 },
      }
    default:
      return null
  }
}

export function validate(taskName, output) {
  if (output?.isError) return false
  if (!output?.content?.length) return false
  const text = JSON.stringify(output).toLowerCase()
  if (text.includes("error") && text.includes("api key")) return false
  return text.length > 50
}
