/**
 * Browserbase MCP Adapter — Stateful Edition
 *
 * Browserbase requires session lifecycle management:
 * 1. Call "start" to create a session → get sessionId
 * 2. Pass sessionId to every subsequent tool call (navigate, act, observe)
 * 3. Call "end" to close the session
 *
 * Uses harness lifecycle hooks: preConnect, preTask, postConnect.
 */

export const SERVER_PATTERN = /browserbase/i

export const TOOL_ALIASES = {
  navigate: ["navigate"],
  screenshot: ["act"],
  snapshot: ["observe"],
  click: ["act"],
  fill: ["act"],
}

// Mutable state for the session (shared across hook calls)
let _sessionId = null

export function adaptTask(taskName, genericArgs, pageUrl) {
  switch (taskName) {
    case "navigate":
      return {
        tool: "navigate",
        arguments: { url: genericArgs.url || pageUrl },
      }
    case "screenshot":
      return {
        tool: "act",
        arguments: { action: "Take a screenshot of the current page" },
      }
    case "snapshot":
      return {
        tool: "observe",
        arguments: { instruction: "Describe the visible page elements" },
      }
    case "click":
      return {
        tool: "act",
        arguments: {
          action: "Click the 'Click Me' button",
        },
      }
    case "fill":
      return {
        tool: "act",
        arguments: {
          action: `Fill the text input field with "${genericArgs.text || "test"}"`,
        },
      }
    default:
      return null
  }
}

/**
 * preConnect: Start a Browserbase session before any tests run.
 *
 * NOTE: Browserbase manages session state internally; start/end are lifecycle
 * signals. The server does NOT accept sessionId as a tool argument — it tracks
 * the active session internally. We call start → run tests → call end.
 */
export async function preConnect(harness, _pageUrl) {
  const startTool = harness.findTool("start", ["start"])
  if (!startTool) {
    throw new Error("Browserbase 'start' tool not available")
  }

  const result = await harness.client.callTool(
    { name: startTool, arguments: {} },
    undefined,
    { timeout: 15000 }
  )

  // If start failed, propagate the error immediately
  if (result?.isError) {
    const msg = result.content?.[0]?.text || JSON.stringify(result)
    throw new Error(`Browserbase start failed: ${msg.slice(0, 200)}`)
  }

  console.log(`  🌐 Browserbase session started`)
  return {}
}

/**
 * preTask: No-op for Browserbase — session is managed server-side.
 * Tools do NOT accept a sessionId parameter.
 */
export async function preTask(_harness, _task, adapted, _context) {
  return {}
}

/**
 * postConnect: End the Browserbase session after all tests complete.
 */
export async function postConnect(harness, _context) {
  const endTool = harness.findTool("end", ["end"])
  if (!endTool) {
    console.warn("  ⚠️ Browserbase 'end' tool not available for cleanup")
    return
  }

  try {
    await harness.client.callTool(
      { name: endTool, arguments: {} },
      undefined,
      { timeout: 10000 }
    )
    console.log(`  🌐 Browserbase session ended`)
  } catch (e) {
    console.warn(`  ⚠️ Failed to end Browserbase session: ${e.message}`)
  }
}

export function validate(taskName, output) {
  if (output?.isError) return false
  if (!output?.content?.length) return false

  const text = JSON.stringify(output).toLowerCase()
  if (text.includes("error") || text.includes("failed") || text.includes("no session")) {
    return false
  }

  switch (taskName) {
    case "navigate":
      return text.includes("http") && !text.includes("error")
    case "screenshot":
      return text.includes("screenshot") || text.includes("image") || text.includes("png")
    case "snapshot":
      return text.length > 100 && (text.includes("button") || text.includes("input") || text.includes("heading"))
    case "click":
    case "fill":
      return text.includes("success") || text.includes("done") || text.includes("performed")
    default:
      return false
  }
}
