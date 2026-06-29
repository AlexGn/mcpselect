/**
 * Playwright MCP Adapter — Semantic Validation Edition
 * Maps generic tasks to Playwright MCP tool names and arguments.
 */

import {
  browserValidators,
} from "../validators/semantic.mjs"

export const SERVER_PATTERN = /playwright/i

export const TOOL_ALIASES = {
  navigate: ["browser_navigate", "navigate", "goto"],
  screenshot: ["browser_take_screenshot", "screenshot", "capture"],
  snapshot: ["browser_snapshot", "snapshot", "dom", "get_page_content"],
  click: ["browser_click", "click"],
  fill: ["browser_type", "type", "fill", "input_text"],
}

export function adaptTask(taskName, genericArgs, pageUrl) {
  switch (taskName) {
    case "navigate":
      return {
        tool: "browser_navigate",
        arguments: { url: genericArgs.url || pageUrl },
      }
    case "screenshot":
      return {
        tool: "browser_take_screenshot",
        arguments: {},
      }
    case "snapshot":
      return {
        tool: "browser_snapshot",
        arguments: {},
      }
    case "click":
      return {
        tool: "browser_click",
        arguments: {
          target: genericArgs.selector || "#click-button",
          element: "Click Me button",
        },
      }
    case "fill":
      return {
        tool: "browser_type",
        arguments: {
          target: genericArgs.selector || "#test-input",
          text: genericArgs.text || "test",
          element: "Text input field",
        },
      }
    default:
      return null
  }
}

/**
 * validate(taskName, output, context)
 * context.pageUrl — the test server URL
 * context.genericArgs — the task defaultArgs (so we know expected text/selector)
 */
export function validate(taskName, output, context = {}) {
  switch (taskName) {
    case "navigate":
      return browserValidators.navigate(output, { expectedUrl: context.pageUrl }).pass
    case "screenshot":
      return browserValidators.screenshot(output).pass
    case "snapshot":
      return browserValidators.snapshot(output).pass
    case "click":
      return browserValidators.click(output).pass
    case "fill":
      return browserValidators.fill(output, { expectedText: context.genericArgs?.text }).pass
    default:
      return false
  }
}
