/**
 * Exa MCP Adapter
 */

export const SERVER_PATTERN = /exa/i

export const TOOL_ALIASES = {
  web_search: ["web_search_exa", "exa_search", "search"],
  extract: ["web_fetch_exa", "exa_fetch", "fetch"],
}

export function adaptTask(taskName, genericArgs, _pageUrl) {
  switch (taskName) {
    case "web_search":
      return {
        tool: "web_search_exa",
        arguments: { query: genericArgs.query || "MCP servers", num_results: 3 },
      }
    case "extract":
      return {
        tool: "web_fetch_exa",
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
  if (text.includes("error") && text.includes("api key")) return false
  return text.length > 50
}
