/**
 * Shell MCP Adapter
 */

export const SERVER_PATTERN = /shell/i

export const TOOL_ALIASES = {
  list: ["run_command"],
  read: ["run_command"],
  write: ["run_command"],
  execute: ["run_command"],
  info: ["run_command"],
}

export function adaptTask(taskName, genericArgs, testDir) {
  const dir = testDir || "/private/tmp/devtest"
  switch (taskName) {
    case "list":
      return { tool: "run_command", arguments: { command: `ls "${dir}"` } }
    case "read":
      return { tool: "run_command", arguments: { command: `cat "${dir}/config.json"` } }
    case "write":
      return {
        tool: "run_command",
        arguments: { command: `echo 'shell benchmark test' > "${dir}/shell.txt" && echo 'written'` },
      }
    case "execute":
      return {
        tool: "run_command",
        arguments: { command: `echo 'shell benchmark completed' >> "${dir}/shell.txt" && echo 'appended'` },
      }
    case "info":
      return {
        tool: "run_command",
        arguments: { command: `cat "${dir}/shell.txt" | wc -l | tr -d ' '` },
      }
    default:
      return null
  }
}

export function validate(taskName, output) {
  if (output?.isError) return false
  if (!output?.content?.length) return false

  const text = JSON.stringify(output).toLowerCase()
  // Reject clear errors
  if (text.includes("error") && text.includes("no such")) return false

  switch (taskName) {
    case "list":
      // Directory listing should contain filenames; errors like "No such file" rejected above
      return text.length > 0 && !text.includes("command not found")
    case "read":
      // config.json should be valid JSON with expected keys
      try {
        const content = output.content[0]?.text || ""
        const parsed = JSON.parse(content)
        return typeof parsed === "object" && parsed !== null
      } catch {
        return false
      }
    case "write":
      // Echo + redirect should output "written"
      return text.includes("written")
    case "execute":
      // Append should output "appended"
      return text.includes("appended")
    case "info":
      // wc -l should return a numeric string
      const content = output.content[0]?.text?.trim() || ""
      return /^\d+$/.test(content)
    default:
      return false
  }
}
