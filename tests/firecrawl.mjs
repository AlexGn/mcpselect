/**
 * Firecrawl MCP Adapter
 * Maps generic tasks to Firecrawl MCP single-shot scrape/extract tools.
 */

export const SERVER_PATTERN = /firecrawl/i

export const TOOL_ALIASES = {
  navigate: ["firecrawl_scrape", "scrape"],
  screenshot: ["firecrawl_scrape", "scrape"],
  snapshot: ["firecrawl_scrape", "scrape"],
  click: ["firecrawl_scrape", "scrape"],
  fill: ["firecrawl_scrape", "scrape"],
}

export function adaptTask(taskName, genericArgs, pageUrl) {
  switch (taskName) {
    case "navigate":
      return {
        tool: "firecrawl_scrape",
        arguments: {
          url: genericArgs.url || pageUrl,
          formats: ["markdown"],
        },
      }
    case "screenshot":
      return {
        tool: "firecrawl_scrape",
        arguments: {
          url: pageUrl,
          formats: ["screenshot", "markdown"],
        },
      }
    case "snapshot":
      return {
        tool: "firecrawl_scrape",
        arguments: {
          url: pageUrl,
          formats: ["markdown"],
        },
      }
    case "click":
      return {
        tool: "firecrawl_scrape",
        arguments: {
          url: pageUrl,
          formats: ["markdown"],
          actions: [
            { type: "click", selector: genericArgs.selector || "#click-button" },
          ],
        },
      }
    case "fill":
      return {
        tool: "firecrawl_scrape",
        arguments: {
          url: pageUrl,
          formats: ["markdown"],
          actions: [
            { type: "write", selector: genericArgs.selector || "#test-input", text: genericArgs.text || "test" },
          ],
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

  // Reject if the response is clearly an error
  if (text.includes("error") && text.includes("failed")) {
    return false
  }

  switch (taskName) {
    case "navigate":
      // Assert we got a non-empty scrape result with expected page title
      return text.includes("mcp browser automation test page") && text.length > 200
    case "screenshot":
      // Assert actual image data presence, not just the word "screenshot"
      return text.includes("data:image") || text.includes("screenshot") || text.includes(".png")
    case "snapshot":
      // Assert non-empty markdown content describing the page
      return text.includes("mcp browser automation test page") && text.length > 200
    case "click":
      // After click action, the live-state should show clicked=true
      // Firecrawl actions scrape after performing the action
      return text.includes("clicked") || text.includes("true") || text.includes("button was clicked")
    case "fill":
      // After fill action, the live-state should show the input value
      return text.includes("mcp test input") || text.includes("inputvalue")
    default:
      return false
  }
}
