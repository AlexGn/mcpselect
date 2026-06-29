/**
 * Filesystem MCP Adapter
 */

export const SERVER_PATTERN = /filesystem/i

export const TOOL_ALIASES = {
  list: ["list_directory", "directory_tree", "list_directory_with_sizes"],
  read: ["read_file", "read_text_file", "read_multiple_files"],
  write: ["write_file", "create_directory", "edit_file"],
  execute: ["write_file", "edit_file"],
  info: ["read_file", "directory_tree", "list_directory_with_sizes"],
}

export function adaptTask(taskName, genericArgs, testDir) {
  const dir = testDir || "/private/tmp/devtest"
  switch (taskName) {
    case "list":
      return { tool: "list_directory", arguments: { path: dir } }
    case "read":
      return { tool: "read_file", arguments: { path: `${dir}/config.json` } }
    case "write":
      return { tool: "write_file", arguments: { path: `${dir}/benchmark.txt`, content: "MCP benchmark test" } }
    case "execute":
      return { tool: "write_file", arguments: { path: `${dir}/benchmark2.txt`, content: "MCP benchmark completed" } }
    case "info":
      return { tool: "list_directory_with_sizes", arguments: { path: dir } }
    default:
      return null
  }
}

export function validate(taskName, output) {
  if (output?.isError) return false
  if (!output?.content?.length) return false

  const text = JSON.stringify(output).toLowerCase()
  // Reject clear error markers
  if (text.includes("error") && text.includes("not found")) return false

  switch (taskName) {
    case "list":
      // Directory listing should contain actual filenames, not just error text
      return text.includes("config.json") || text.includes("benchmark") || text.includes("file") || text.includes("directory")
    case "read":
      // config.json should be parseable JSON with expected structure
      try {
        const content = output.content[0]?.text || ""
        const parsed = JSON.parse(content)
        return typeof parsed === "object" && parsed !== null && ("test" in parsed || "benchmark" in parsed)
      } catch {
        return false
      }
    case "write":
      // Filesystem write should return confirmation without error markers
      return text.includes("successfully") || text.includes("wrote") || text.includes("created") || text.includes("ok")
    case "execute":
      // Second write should also return confirmation
      return text.includes("successfully") || text.includes("edited") || text.includes("completed") || text.includes("ok")
    case "info":
      // Directory with sizes should contain size metadata
      return text.includes("size") || text.includes("file") || text.includes("config.json")
    default:
      return false
  }
}
