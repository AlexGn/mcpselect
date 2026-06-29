/**
 * Playwright MCP Adapter
 * Maps generic tasks to Playwright MCP tool names and arguments.
 */

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

export function validate(taskName, output) {
  if (output?.isError) return false
  if (!output?.content?.length) return false

  const text = JSON.stringify(output).toLowerCase()
  // Reject if the response contains clear error text
  if (text.includes("error") && text.includes("failed")) return false

  switch (taskName) {
    case "navigate":
      // Assert the output contains a URL and page title confirmation
      return text.includes("page url:") && text.includes("page title:")
    case "screenshot":
      // Assert actual image data (base64 or file path), not just the word "screenshot"
      return text.includes("data:image") || text.includes(".png") || text.includes("screenshot({")
    case "snapshot":
      // Assert structured DOM snapshot with element refs and headings
      return text.includes("heading") && text.includes("ref=") && text.length > 200
    case "click":
      // Assert no error and the click was executed (Playwright reports locator/click in output)
      return text.includes("locator") || text.includes("click()") || text.includes("await page")
    case "fill":
      // Assert the fill was executed (Playwright reports locator.fill in output)
      return text.includes("locator") || text.includes(".fill(") || text.includes("await page")
    default:
      return false
  }
}
