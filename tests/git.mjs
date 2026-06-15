/**
 * Git MCP Adapter
 *
 * NOTE: write (git_stash) and execute (git_stash_pop) are DESTRUCTIVE
 * and depend on the working tree state of the test repository.
 * They are skipped in the benchmark to avoid mutating the actual project repo.
 */

export const SERVER_PATTERN = /git/i

export const TOOL_ALIASES = {
  list: ["git_status", "git_log", "git_diff"],
  read: ["git_log", "git_diff", "git_show", "git_diff_staged"],
  write: ["git_add", "git_stash"],
  execute: ["git_commit", "git_stash", "git_stash_pop"],
  info: ["git_log", "git_status"],
}

export function adaptTask(taskName, genericArgs, _pageUrl) {
  const repoPath = "/Users/alex/Documents/Claude/directory/sites/mcp-directory"
  switch (taskName) {
    case "list":
      return { tool: "git_status", arguments: { repo_path: repoPath } }
    case "read":
      return { tool: "git_log", arguments: { repo_path: repoPath, max_count: 3 } }
    case "write":
      // Destructive — skip to avoid mutating the project repo
      return null
    case "execute":
      // Destructive — skip to avoid mutating the project repo
      return null
    case "info":
      return { tool: "git_log", arguments: { repo_path: repoPath, max_count: 1 } }
    default:
      return null
  }
}

export function validate(taskName, output) {
  if (output?.isError) return false
  if (!output?.content?.length) return false

  const text = JSON.stringify(output).toLowerCase()
  // Reject fatal errors and "not a git repo" errors
  if (text.includes("fatal:") || text.includes("not a git repository")) return false

  switch (taskName) {
    case "list":
      // git_status should return structured file states
      return text.includes("branch") || text.includes("modified") || text.includes("untracked") || text.includes("working tree clean")
    case "read":
      // git_log should contain commit hashes (hex strings) and date info
      return /[a-f0-9]{7,}/.test(text) && (text.includes("mon") || text.includes("tue") || text.includes("wed") || text.includes("thu") || text.includes("fri") || text.includes("sat") || text.includes("sun"))
    case "info":
      // Single commit log should have hash + author + timestamp
      return /[a-f0-9]{7,}/.test(text) && (text.includes("mon") || text.includes("tue") || text.includes("wed") || text.includes("thu") || text.includes("fri") || text.includes("sat") || text.includes("sun"))
    default:
      return false
  }
}
