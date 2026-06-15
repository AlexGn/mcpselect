import { Client } from "./sdk/node_modules/@modelcontextprotocol/sdk/dist/client/index.js"
import { StdioClientTransport } from "./sdk/node_modules/@modelcontextprotocol/sdk/dist/client/stdio.js"
import { CallToolResultSchema } from "./sdk/node_modules/@modelcontextprotocol/sdk/dist/types.js"
import { performance } from "perf_hooks"
import { execSync } from "child_process"

/**
 * MCP Server Test Harness — Trustworthy Edition v2
 *
 * Features:
 * - Capability probing: listTools() first, then match tasks dynamically
 * - Allowlist env injection: only passes declared env vars to each server
 * - Discovery timeout: hard timeout for auth-walled servers
 * - Two-phase auth triage: classifies failures as auth_required/auth_invalid/timeout/error
 * - Stateful adapter lifecycle: preConnect/preTask/postTask/postConnect hooks
 * - Process cleanup: SIGTERM → SIGKILL for zombie child processes
 * - Honest reporting: no aggregate "score", reports percentiles + pass rate
 */

export class McpTestHarness {
  constructor({ name, command, args, env = {}, envVar = null, authTriage = "free-to-test" }) {
    this.name = name
    this.command = command
    this.args = args
    this.env = env
    this.envVar = envVar
    this.authTriage = authTriage
    this.client = null
    this.transport = null
    this.tools = []
    this.startTime = null
    this.connectTime = null
    this._childPid = null
  }

  /**
   * Build allowlist env: only PATH, system locale, and explicitly declared env vars.
   * Never leaks unrelated host configuration into server processes.
   */
  _buildEnv() {
    const allowed = ["PATH", "HOME", "USER", "SHELL", "LANG", "LC_ALL", "TZ", "TMPDIR", "NODE_PATH"]
    const whitelist = {}
    for (const key of allowed) {
      if (process.env[key]) whitelist[key] = process.env[key]
    }
    for (const [key, value] of Object.entries(this.env)) {
      whitelist[key] = value
    }
    if (this.envVar && process.env[this.envVar]) {
      whitelist[this.envVar] = process.env[this.envVar]
    }
    return whitelist
  }

  async connect() {
    this.startTime = performance.now()
    const env = this._buildEnv()

    this.transport = new StdioClientTransport({
      command: this.command,
      args: this.args,
      env: env,
      stderr: "pipe",
    })

    // Try to capture the spawned child PID for cleanup
    try {
      const transportAny = /** @type {any} */ (this.transport)
      if (transportAny._process?.pid) {
        this._childPid = transportAny._process.pid
      } else if (transportAny.process?.pid) {
        this._childPid = transportAny.process.pid
      }
    } catch {}

    this.client = new Client(
      { name: "curated-mcp-tester", version: "1.0.0" },
      { capabilities: {} }
    )

    const CONNECT_TIMEOUT_MS = 15000
    await Promise.race([
      this.client.connect(this.transport),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Connection timed out after ${CONNECT_TIMEOUT_MS}ms`)), CONNECT_TIMEOUT_MS)
      ),
    ])

    const toolsResponse = await Promise.race([
      this.client.listTools(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`listTools() timed out after ${CONNECT_TIMEOUT_MS}ms`)), CONNECT_TIMEOUT_MS)
      ),
    ])
    this.tools = toolsResponse.tools || []

    this.connectTime = Math.round(performance.now() - this.startTime)
    console.log(`✅ Connected to ${this.name} in ${this.connectTime}ms — ${this.tools.length} tool(s) found`)
  }

  /**
   * Two-phase discovery: attempt connect + listTools with a short timeout.
   * Returns a classification instead of throwing, so runners can decide
   * whether to skip auth-requiring servers or continue testing.
   */
  async discover(timeoutMs = 10000) {
    const start = performance.now()
    const env = this._buildEnv()

    this.transport = new StdioClientTransport({
      command: this.command,
      args: this.args,
      env: env,
      stderr: "pipe",
    })

    try {
      const transportAny = /** @type {any} */ (this.transport)
      if (transportAny._process?.pid) {
        this._childPid = transportAny._process.pid
      } else if (transportAny.process?.pid) {
        this._childPid = transportAny.process.pid
      }
    } catch {}

    this.client = new Client(
      { name: "curated-mcp-tester", version: "1.0.0" },
      { capabilities: {} }
    )

    let stderr = ""
    try {
      // Try to capture stderr for auth classification
      const transportAny = /** @type {any} */ (this.transport)
      if (transportAny.stderr) {
        transportAny.stderr.on("data", (chunk) => { stderr += chunk.toString() })
      }
    } catch {}

    try {
      await Promise.race([
        this.client.connect(this.transport),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("TIMEOUT")), timeoutMs)
        ),
      ])

      const toolsResponse = await Promise.race([
        this.client.listTools(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("TIMEOUT")), timeoutMs)
        ),
      ])
      this.tools = toolsResponse.tools || []
      this.connectTime = Math.round(performance.now() - start)
      return { status: "ready", tool_count: this.tools.length, connect_time_ms: this.connectTime, stderr }
    } catch (err) {
      const elapsed = Math.round(performance.now() - start)
      const message = err.message || String(err)

      // Classify the failure
      if (message === "TIMEOUT" || message.includes("timed out")) {
        return { status: "timeout", tool_count: 0, connect_time_ms: elapsed, stderr, error: message }
      }

      const lowerStderr = stderr.toLowerCase()
      const lowerMessage = message.toLowerCase()

      if (lowerStderr.includes("api key") || lowerStderr.includes("authentication") || lowerStderr.includes("auth")) {
        return { status: "auth_required", tool_count: 0, connect_time_ms: elapsed, stderr, error: message }
      }
      if (lowerStderr.includes("invalid key") || lowerStderr.includes("unauthorized") || lowerStderr.includes("401")) {
        return { status: "auth_invalid", tool_count: 0, connect_time_ms: elapsed, stderr, error: message }
      }
      if (lowerMessage.includes("connection closed") && !this.envVar) {
        return { status: "auth_required", tool_count: 0, connect_time_ms: elapsed, stderr, error: message }
      }

      return { status: "error", tool_count: 0, connect_time_ms: elapsed, stderr, error: message }
    }
  }

  /**
   * Find the actual tool name from the server's tool list using aliases.
   */
  findTool(preferredName, aliases) {
    const allNames = [preferredName, ...(aliases || [])]
    for (const name of allNames) {
      const exact = this.tools.find((t) => t.name === name)
      if (exact) return exact.name
    }
    for (const name of allNames) {
      const partial = this.tools.find((t) => t.name.includes(name))
      if (partial) return partial.name
    }
    return null
  }

  async run(taskDefinitions, adapter, pageUrl) {
    const results = []
    let totalPassed = 0
    let totalFailed = 0
    let totalSkipped = 0
    const latencies = []

    // Stateful adapter lifecycle: preConnect hook
    let adapterContext = {}
    let preConnectFailed = false
    if (adapter.preConnect) {
      try {
        adapterContext = (await adapter.preConnect(this, pageUrl)) || {}
      } catch (e) {
        preConnectFailed = true
        console.warn(`⚠️ ${this.name} preConnect hook failed: ${e.message}`)
      }
    }

    for (const task of taskDefinitions) {
      // Skip all tests if preConnect failed — subsequent calls are guaranteed to fail
      if (preConnectFailed) {
        results.push({
          name: task.name,
          status: "skipped",
          reason: "preConnect failed: session initialization required",
          latency_ms: 0,
        })
        totalSkipped++
        continue
      }
      const adapted = adapter.adaptTask(task.name, task.defaultArgs || {}, pageUrl)

      if (!adapted) {
        results.push({
          name: task.name,
          status: "skipped",
          reason: "No adapter mapping for this task",
          latency_ms: 0,
        })
        totalSkipped++
        continue
      }

      const actualTool = this.findTool(adapted.tool, adapter.TOOL_ALIASES?.[task.name])

      if (!actualTool) {
        results.push({
          name: task.name,
          status: "skipped",
          reason: `Tool '${adapted.tool}' not available (have: ${this.tools.map((t) => t.name).join(", ")})`,
          latency_ms: 0,
        })
        totalSkipped++
        continue
      }

      // Stateful adapter lifecycle: preTask hook
      let taskContext = adapterContext
      if (adapter.preTask) {
        try {
          const injected = await adapter.preTask(this, task, adapted, adapterContext)
          if (injected?.arguments) {
            adapted.arguments = { ...adapted.arguments, ...injected.arguments }
          }
          if (injected?.context) {
            taskContext = injected.context
          }
        } catch (e) {
          console.warn(`⚠️ ${this.name} preTask hook failed for ${task.name}: ${e.message}`)
        }
      }

      const testStart = performance.now()
      let output = null
      let error = null

      try {
        output = await this.client.callTool(
          { name: actualTool, arguments: adapted.arguments },
          CallToolResultSchema,
          { timeout: 30000 }
        )
      } catch (err) {
        error = err.message
      }

      const latency = Math.round(performance.now() - testStart)
      latencies.push(latency)

      // Stateful adapter lifecycle: postTask hook
      if (adapter.postTask) {
        try {
          await adapter.postTask(this, task, output, error, taskContext)
        } catch (e) {
          console.warn(`⚠️ ${this.name} postTask hook failed for ${task.name}: ${e.message}`)
        }
      }

      let passed = false
      if (!error && adapter.validate) {
        passed = adapter.validate(task.name, output)
      }

      if (passed) {
        totalPassed++
      } else {
        totalFailed++
      }

      results.push({
        name: task.name,
        status: passed ? "passed" : error ? "error" : "failed",
        latency_ms: latency,
        output: output ? JSON.stringify(output).slice(0, 500) : null,
        error: error || null,
        reason: passed ? null : error || "Validation failed",
      })

      await new Promise((r) => setTimeout(r, 500))
    }

    // Stateful adapter lifecycle: postConnect hook
    if (adapter.postConnect) {
      try {
        await adapter.postConnect(this, adapterContext)
      } catch (e) {
        console.warn(`⚠️ ${this.name} postConnect hook failed: ${e.message}`)
      }
    }

    const totalTests = taskDefinitions.length
    const passRate = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0
    const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0
    const sortedLatencies = [...latencies].sort((a, b) => a - b)
    const p50 = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] || 0
    const p90 = sortedLatencies[Math.floor(sortedLatencies.length * 0.9)] || 0

    return {
      server: this.name,
      tool_count: this.tools.length,
      tests: results,
      overall: {
        total_tests: totalTests,
        passed: totalPassed,
        failed: totalFailed,
        skipped: totalSkipped,
        pass_rate: passRate,
        avg_latency_ms: avgLatency,
        p50_latency_ms: p50,
        p90_latency_ms: p90,
      },
      connect_time_ms: this.connectTime,
    }
  }

  async disconnect() {
    try { await this.client?.close() } catch {}
    try { await this.transport?.close() } catch {}

    // Force-kill the tracked child process and any descendants
    if (this._childPid) {
      try {
        // Kill children first (prevents orphans), then parent
        execSync(`pkill -P ${this._childPid} 2>/dev/null || true`, { timeout: 3000 })
      } catch {}
      try {
        process.kill(-this._childPid, "SIGKILL")
      } catch {
        // Process group kill failed — try direct kill
        try {
          process.kill(this._childPid, "SIGTERM")
          await new Promise((r) => setTimeout(r, 1500))
          try { process.kill(this._childPid, 0) } catch { /* already gone */ }
          process.kill(this._childPid, "SIGKILL")
        } catch {}
      }
    }

    // Aggressive fallback: pkill by npx package pattern
    try {
      const pattern = this.args.slice(0, 3).join(" ").replace(/[^a-zA-Z0-9\-_@./]/g, " ")
      execSync(`pkill -f "${pattern}" 2>/dev/null || true`, { timeout: 3000 })
    } catch {}

    // Server-specific binary name patterns (npx spawns different process names)
    const nameLower = this.name.toLowerCase()
    const binaryPatterns = []
    if (nameLower.includes("playwright")) {
      binaryPatterns.push("playwright-mcp")
    }
    if (nameLower.includes("puppeteer")) {
      binaryPatterns.push("mcp-server-puppeteer", "server-puppeteer")
    }
    if (nameLower.includes("firecrawl")) {
      binaryPatterns.push("firecrawl-mcp")
    }
    if (nameLower.includes("browserbase")) {
      binaryPatterns.push("browserbase-mcp")
    }
    if (nameLower.includes("tavily")) {
      binaryPatterns.push("tavily-mcp")
    }
    if (nameLower.includes("exa")) {
      binaryPatterns.push("exa-mcp")
    }
    if (nameLower.includes("brave")) {
      binaryPatterns.push("brave-search-mcp")
    }
    if (nameLower.includes("sqlite")) {
      binaryPatterns.push("sqlite-mcp", "mcp-sqlite")
    }
    if (nameLower.includes("postgres")) {
      binaryPatterns.push("postgres-mcp", "mcp-postgres")
    }
    if (nameLower.includes("redis")) {
      binaryPatterns.push("redis-mcp")
    }
    if (nameLower.includes("filesystem")) {
      binaryPatterns.push("filesystem-mcp")
    }
    if (nameLower.includes("shell")) {
      binaryPatterns.push("shell-mcp")
    }
    if (nameLower.includes("git")) {
      binaryPatterns.push("git-mcp")
    }

    for (const bin of binaryPatterns) {
      try {
        execSync(`pkill -f "${bin}" 2>/dev/null || true`, { timeout: 2000 })
      } catch {}
    }

    // Browser-specific cleanup: Playwright / Puppeteer leave Chromium zombies
    if (nameLower.includes("playwright") || nameLower.includes("puppeteer")) {
      try {
        execSync('pkill -f "chromium" 2>/dev/null || true', { timeout: 3000 })
        execSync('pkill -f "Chrome" 2>/dev/null || true', { timeout: 3000 })
      } catch {}
    }

    console.log(`🔌 Disconnected from ${this.name}`)
  }
}
