/**
 * Puppeteer MCP Adapter
 * Maps generic tasks to Puppeteer MCP tool names and arguments.
 */

export const SERVER_PATTERN = /puppeteer/i

export const TOOL_ALIASES = {
  navigate: ["puppeteer_navigate", "navigate", "goto"],
  screenshot: ["puppeteer_screenshot", "screenshot", "capture"],
  snapshot: ["puppeteer_getPageContent", "get_page_content", "dom", "snapshot", "puppeteer_evaluate"],
  click: ["puppeteer_click", "click"],
  fill: ["puppeteer_fill", "fill", "type", "input_text"],
}

export function adaptTask(taskName, genericArgs, pageUrl) {
  switch (taskName) {
    case "navigate":
      return {
        tool: "puppeteer_navigate",
        arguments: { url: genericArgs.url || pageUrl },
      }
    case "screenshot":
      return {
        tool: "puppeteer_screenshot",
        arguments: { name: "test-screenshot" },
      }
    case "snapshot":
      // Puppeteer has no dedicated snapshot tool; we use evaluate to get title + body
      return {
        tool: "puppeteer_evaluate",
        arguments: {
          script: "document.title + ' ' + document.body.innerText.slice(0, 200)",
        },
      }
    case "click":
      return {
        tool: "puppeteer_click",
        arguments: {
          selector: genericArgs.selector || "#click-button",
        },
      }
    case "fill":
      return {
        tool: "puppeteer_fill",
        arguments: {
          selector: genericArgs.selector || "#test-input",
          value: genericArgs.text || "test",
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
  // Reject clear error markers
  if (text.includes("error") && text.includes("failed")) return false

  switch (taskName) {
    case "navigate":
      // Assert actual navigation confirmation with URL
      return text.includes("navigated") && text.includes("http")
    case "screenshot":
      // Assert image data or screenshot filename present
      return text.includes("screenshot") && (text.includes(".png") || text.includes("data:image") || text.includes("800x600"))
    case "snapshot":
      // Assert non-empty page content with expected page elements (not literal marketing strings)
      return text.length > 100 && (text.includes("mcp") || text.includes("browser") || text.includes("automation"))
    case "click":
      // Assert explicit click confirmation
      return text.includes("clicked")
    case "fill":
      // Assert explicit fill confirmation
      return text.includes("filled")
    default:
      return false
  }
}
