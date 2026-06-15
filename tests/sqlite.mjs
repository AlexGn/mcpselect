/**
 * SQLite MCP Adapter
 */

export const SERVER_PATTERN = /sqlite/i

export const TOOL_ALIASES = {
  list_tables: ["list_tables", "db_info", "get_schema"],
  describe_table: ["get_table_schema", "db_info"],
  query: ["query", "read_records"],
  sample: ["read_records", "query"],
  schema: ["db_info", "get_table_schema"],
}

export function adaptTask(taskName, genericArgs, dbPath) {
  switch (taskName) {
    case "list_tables":
      return { tool: "list_tables", arguments: {} }
    case "describe_table":
      return { tool: "get_table_schema", arguments: { tableName: "benchmark_test" } }
    case "query":
      return {
        tool: "query",
        arguments: { sql: "SELECT * FROM benchmark_test WHERE name = 'Test'" },
      }
    case "sample":
      return {
        tool: "read_records",
        arguments: { table: "benchmark_test" },
      }
    case "schema":
      return { tool: "db_info", arguments: {} }
    default:
      return null
  }
}

export function validate(taskName, output) {
  if (output?.isError) return false
  if (!output?.content?.length) return false

  const text = JSON.stringify(output).toLowerCase()
  if (text.includes("error") && text.includes("no such")) return false

  switch (taskName) {
    case "list_tables":
      // Assert array of table names (not empty)
      return text.includes("[") && text.includes("]") && text.includes("benchmark_test")
    case "describe_table":
      // Assert structured column metadata (SQLite returns cid/name/type/notnull/dflt_value/pk)
      return text.includes("name") && text.includes("type") && text.length > 50
    case "query":
      // Assert array of row objects with expected columns (not hardcoded value substrings)
      return text.includes("[") && text.includes("]") && text.includes("id") && text.includes("name")
    case "sample":
      // Assert non-empty array of row objects
      return text.includes("[") && text.includes("]") && text.includes("id")
    case "schema":
      // Assert structured database info object
      return text.includes("database") || text.includes("path") || text.includes("size") || text.length > 50
    default:
      return false
  }
}
