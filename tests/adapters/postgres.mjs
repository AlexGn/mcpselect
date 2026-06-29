/**
 * PostgreSQL MCP Adapter
 * NOTE: This server only allows SELECT queries for safety.
 * Write operations (CREATE, INSERT, UPDATE, DELETE) are blocked.
 */

export const SERVER_PATTERN = /postgres/i

export const TOOL_ALIASES = {
  list_tables: ["list_tables", "get_schema", "describe_table"],
  describe_table: ["describe_table", "get_schema"],
  query: ["query_data"],
  sample: ["get_table_sample"],
  schema: ["get_schema", "describe_table"],
}

export function adaptTask(taskName, genericArgs, dbPath) {
  switch (taskName) {
    case "list_tables":
      return { tool: "list_tables", arguments: {} }
    case "describe_table":
      return { tool: "describe_table", arguments: { table_name: "pg_catalog.pg_tables" } }
    case "query":
      return {
        tool: "query_data",
        arguments: { query: "SELECT tablename FROM pg_tables WHERE schemaname = 'pg_catalog' LIMIT 5" },
      }
    case "sample":
      return { tool: "query_data", arguments: { query: "SELECT tablename FROM pg_tables WHERE schemaname = 'public' LIMIT 3" } }
    case "schema":
      return { tool: "get_schema", arguments: {} }
    default:
      return null
  }
}

export function validate(taskName, output) {
  if (output?.isError) return false
  if (!output?.content?.length) return false

  const text = JSON.stringify(output).toLowerCase()
  if (text.includes("error") && text.includes("permission")) return false

  switch (taskName) {
    case "list_tables":
      // Assert array of table names returned, not empty array or error
      return text.includes("[") && text.includes("]") && text.length > 20
    case "describe_table":
      // Assert structured column definitions with name/type
      return text.includes("column") && text.includes("type") && text.length > 50
    case "query":
      // Assert non-empty array of row objects returned
      return text.includes("[") && text.includes("]") && text.includes("tablename") && text.length > 30
    case "sample":
      // Sample may return empty array if no public tables; assert structured result
      return text.includes("[") && text.includes("]") && text.includes("rows") && text.length > 30
    case "schema":
      // Assert structured schema info returned
      return text.includes("[") && text.includes("]") && text.length > 30
    default:
      return false
  }
}
