/**
 * Tavily MCP Adapter
 */

export const SERVER_PATTERN = /tavily/i

export const TOOL_ALIASES = {
  web_search: ["tavily-search", "tavily_search", "search"],
  extract: ["tavily-extract", "tavily_extract", "extract"],
}

export function adaptTask(taskName, genericArgs, _pageUrl) {
  switch (taskName) {
    case "web_search":
      return {
        tool: "tavily-search",
        arguments: { query: genericArgs.query || "MCP servers" },
      }
    case "extract":
      return {
        tool: "tavily-extract",
        arguments: { url: genericArgs.url || "https://modelcontextprotocol.io" },
      }
    default:
      return null
  }
}

export function validate(taskName, output) {
  if (output?.isError) return false
  if (!output?.content?.length) return false
  const text = JSON.stringify(output).toLowerCase()
  // Tavily extract returns API error without key, but web_search works
  if (text.includes("api error") || text.includes("field required")) return false
  if (text.includes("error") && text.includes("api key")) return false
  return text.length > 50 && (text.includes("http") || text.includes("title") || text.includes("content"))
}
