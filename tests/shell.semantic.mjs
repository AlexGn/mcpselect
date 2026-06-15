/**
 * Shell MCP Adapter — Semantic Validation Edition
 */

import { shellValidators } from "../validators/semantic.mjs"

export const SERVER_PATTERN = /shell/i

export const TOOL_ALIASES = {
  list: ["run_command"],
  read: ["run_command"],
  write: ["run_command"],
  execute: ["run_command"],
  info: ["run_command"],
}

export function adaptTask(taskName, genericArgs, _pageUrl) {
  switch (taskName) {
    case "list":
      return { tool: "run_command", arguments: { command: "ls /private/tmp/devtest" } }
    case "read":
      return { tool: "run_command", arguments: { command: "cat /private/tmp/devtest/config.json" } }
    case "write":
      return { tool: "run_command", arguments: { command: "echo 'shell benchmark test' > /private/tmp/devtest/shell.txt && echo 'written'" } }
    case "execute":
      return { tool: "run_command", arguments: { command: "echo 'shell benchmark completed' >> /private/tmp/devtest/shell.txt && echo 'appended'" } }
    case "info":
      return { tool: "run_command", arguments: { command: "cat /private/tmp/devtest/shell.txt | wc -l" } }
    default:
      return null
  }
}

export function validate(taskName, output) {
  switch (taskName) {
    case "list":
      // Assert exit OK and stdout contains expected files
      return shellValidators.run_command(output, {
        expectedPhrases: ["config.json"],
      }).pass
    case "read":
      return shellValidators.run_command(output, {
        expectedPhrases: ['"test": true'],
      }).pass
    case "write":
      return shellValidators.run_command(output, {
        expectedPhrases: ["written"],
      }).pass
    case "execute":
      return shellValidators.run_command(output, {
        expectedPhrases: ["appended"],
      }).pass
    case "info":
      // Line count should be a small positive integer
      return shellValidators.run_command(output, {
        expectedPhrases: [],
      }).pass
    default:
      return false
  }
}
