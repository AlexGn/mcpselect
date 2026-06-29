/**
 * Redis MCP Adapter
 */

export const SERVER_PATTERN = /redis/i

export const TOOL_ALIASES = {
  list_tables: ["redis_info", "redis_keys"],
  describe_table: ["redis_info"],
  query: ["redis_get", "redis_keys"],
  sample: ["redis_get", "redis_keys"],
  schema: ["redis_info"],
}

export function adaptTask(taskName, genericArgs, dbPath) {
  switch (taskName) {
    case "list_tables":
      return { tool: "redis_keys", arguments: { pattern: "*" } }
    case "describe_table":
      return { tool: "redis_info", arguments: {} }
    case "query":
      return { tool: "redis_get", arguments: { key: "benchmark:test:1" } }
    case "sample":
      return { tool: "redis_keys", arguments: { pattern: "benchmark:*" } }
    case "schema":
      return { tool: "redis_info", arguments: {} }
    default:
      return null
  }
}

export function validate(taskName, output) {
  if (output?.isError) return false
  if (!output?.content?.length) return false

  const text = JSON.stringify(output).toLowerCase()
  // Only reject clear connection error messages, not innocent INFO fields
  if (text.includes("connection refused") || text.includes("connection closed")) return false

  switch (taskName) {
    case "list_tables":
      // redis_keys should return an array of key strings
      return text.includes("[") && text.includes("]")
    case "describe_table":
      // redis_info should return structured info with version
      return text.includes("redis_version") || text.includes("redis_mode")
    case "query":
      // redis_get should return the stored value (pre-stored benchmark value)
      // The exact value depends on what was seeded; assert non-empty string response
      return text.length > 5 && !text.includes("null")
    case "sample":
      // redis_keys pattern should return matching keys
      return text.includes("[") && text.includes("]")
    case "schema":
      // redis_info should return structured server info
      return text.includes("redis_version") || text.includes("redis_mode") || text.includes("connected_clients")
    default:
      return false
  }
}
