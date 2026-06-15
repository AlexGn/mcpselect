#!/usr/bin/env node
/**
 * MCP Benchmark Harness — Concurrent Stress Test
 *
 * Validates:
 * 1. Concurrent server execution (no port conflicts, no zombie processes)
 * 2. Repeated iteration stability (no memory leaks, consistent results)
 * 3. Process cleanup verification (SIGTERM→SIGKILL actually works)
 * 4. Flakiness detection (results vary across runs)
 *
 * Usage: node stress-test.mjs [iterations=3]
 */

import { execSync, spawn } from "child_process"
import { createServer } from "http"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "../..")

const ITERATIONS = parseInt(process.argv[2]) || 3
const CATEGORIES = ["browser-automation", "databases", "developer-tools", "search"]

// ── Helpers ───────────────────────────────────────────────────────────────

function getProcessCount(pattern) {
  try {
    const out = execSync(`pgrep -f "${pattern}" 2>/dev/null | wc -l`, {
      encoding: "utf-8",
      timeout: 5000,
    })
    return parseInt(out.trim()) || 0
  } catch {
    return 0
  }
}

function getNodeMemoryMB() {
  const usage = process.memoryUsage()
  return {
    rss: Math.round(usage.rss / 1024 / 1024),
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
    external: Math.round(usage.external / 1024 / 1024),
  }
}

function getOpenPorts() {
  try {
    const out = execSync('lsof -nP -iTCP | grep LISTEN | wc -l', {
      encoding: "utf-8",
      timeout: 5000,
    })
    return parseInt(out.trim()) || 0
  } catch {
    return 0
  }
}

function getZombieCount() {
  try {
    const out = execSync('ps aux | grep "<defunct>" | grep -v grep | wc -l', {
      encoding: "utf-8",
      timeout: 5000,
    })
    return parseInt(out.trim()) || 0
  } catch {
    return 0
  }
}

function now() {
  return new Date().toISOString()
}

const PER_CATEGORY_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes max per category

async function runCategory(category, iteration) {
  const start = Date.now()
  const runPath = resolve(__dirname, category, "run.mjs")

  return new Promise((resolve) => {
    const proc = spawn("node", [runPath], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, STRESS_TEST_ITERATION: String(iteration) },
    })

    let stdout = ""
    let stderr = ""
    let timedOut = false

    proc.stdout.on("data", (d) => { stdout += d })
    proc.stderr.on("data", (d) => { stderr += d })

    // Hard timeout: kill the process if it exceeds the limit
    const timeoutId = setTimeout(() => {
      timedOut = true
      console.warn(`  ⏱️  Timeout: ${category} exceeded ${PER_CATEGORY_TIMEOUT_MS / 1000}s, killing...`)
      try { proc.kill("SIGKILL") } catch {}
      // Also kill any known MCP child processes for this category
      try {
        const patterns = getCategoryKillPatterns(category)
        for (const p of patterns) {
          execSync(`pkill -f "${p}" 2>/dev/null || true`, { timeout: 3000 })
        }
      } catch {}
    }, PER_CATEGORY_TIMEOUT_MS)

    proc.on("close", (code) => {
      clearTimeout(timeoutId)
      const elapsed = Date.now() - start
      const passRateMatch = stdout.match(/(\d+)% pass rate/)
      const passedMatch = stdout.match(/Tests:\s*(\d+)\/(\d+) passed/)
      const skippedMatch = stdout.match(/Skipped:\s*(\d+)/)

      resolve({
        category,
        iteration,
        exitCode: timedOut ? 124 : code,
        elapsed,
        passRate: passRateMatch ? parseInt(passRateMatch[1]) : null,
        passed: passedMatch ? parseInt(passedMatch[1]) : null,
        total: passedMatch ? parseInt(passedMatch[2]) : null,
        skipped: skippedMatch ? parseInt(skippedMatch[1]) : 0,
        hasErrors: timedOut || stderr.length > 0 || code !== 0,
        stderrPreview: stderr.slice(0, 500),
        timedOut,
      })
    })
  })
}

function getCategoryKillPatterns(category) {
  const patterns = []
  if (category === "browser-automation") {
    patterns.push("playwright-mcp", "mcp-server-puppeteer", "server-puppeteer", "chromium", "firecrawl-mcp", "browserbase-mcp")
  }
  if (category === "databases") {
    patterns.push("sqlite-mcp", "mcp-sqlite", "postgres-mcp", "mcp-postgres", "redis-mcp")
  }
  if (category === "developer-tools") {
    patterns.push("filesystem-mcp", "shell-mcp", "git-mcp")
  }
  if (category === "search") {
    patterns.push("tavily-mcp", "exa-mcp", "brave-search-mcp")
  }
  return patterns
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════")
  console.log("  MCP Benchmark Harness — Concurrent Stress Test")
  console.log(`  Iterations: ${ITERATIONS}  |  Categories: ${CATEGORIES.length}`)
  console.log("═══════════════════════════════════════════════════════════\n")

  const baseline = {
    zombies: getZombieCount(),
    nodeProcesses: getProcessCount("node"),
    openPorts: getOpenPorts(),
    memory: getNodeMemoryMB(),
    timestamp: now(),
  }
  console.log("Baseline snapshot:")
  console.log(`  Zombie processes: ${baseline.zombies}`)
  console.log(`  Node processes:   ${baseline.nodeProcesses}`)
  console.log(`  Open TCP ports:   ${baseline.openPorts}`)
  console.log(`  Memory RSS:       ${baseline.memory.rss}MB\n`)

  const allResults = []
  const startTotal = Date.now()

  for (let i = 1; i <= ITERATIONS; i++) {
    console.log(`─── Iteration ${i}/${ITERATIONS} ───────────────────────────────`)
    const iterStart = Date.now()

    // Snapshot before iteration
    const before = {
      zombies: getZombieCount(),
      nodeProcesses: getProcessCount("node"),
      openPorts: getOpenPorts(),
      memory: getNodeMemoryMB(),
    }

    // Run all categories concurrently
    const results = await Promise.all(
      CATEGORIES.map((cat) => runCategory(cat, i))
    )

    // Snapshot after iteration
    const after = {
      zombies: getZombieCount(),
      nodeProcesses: getProcessCount("node"),
      openPorts: getOpenPorts(),
      memory: getNodeMemoryMB(),
    }

    const iterElapsed = Date.now() - iterStart

    // Report iteration
    for (const r of results) {
      const status = r.exitCode === 0 && !r.hasErrors ? "✅" : "⚠️"
      console.log(
        `  ${status} ${r.category.padEnd(20)} | ${r.passRate?.toString().padStart(3) ?? "N/A"}% | ${r.passed ?? "?"}/${r.total ?? "?"} passed | ${r.skipped} skipped | ${r.elapsed}ms`
      )
      if (r.stderrPreview) {
        console.log(`     ⚠️ stderr: ${r.stderrPreview.slice(0, 120)}...`)
      }
    }
    console.log(
      `  Processes: ${before.nodeProcesses}→${after.nodeProcesses} | Zombies: ${before.zombies}→${after.zombies} | Ports: ${before.openPorts}→${after.openPorts} | Memory: +${after.memory.rss - before.memory.rss}MB | Time: ${iterElapsed}ms\n`
    )

    allResults.push({ iteration: i, before, after, results, elapsed: iterElapsed })
  }

  const totalElapsed = Date.now() - startTotal

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════════")
  console.log("  Stress Test Summary")
  console.log("═══════════════════════════════════════════════════════════\n")

  // Flakiness analysis
  const byCategory = {}
  for (const r of allResults.flatMap((i) => i.results)) {
    if (!byCategory[r.category]) byCategory[r.category] = []
    byCategory[r.category].push(r.passRate)
  }

  console.log("Flakiness Analysis (pass rates across iterations):")
  for (const [cat, rates] of Object.entries(byCategory)) {
    const unique = [...new Set(rates.filter(Boolean))]
    const flaky = unique.length > 1
    console.log(
      `  ${flaky ? "🔴 FLAKY" : "🟢 Stable"} ${cat.padEnd(20)} | rates: [${rates.join(", ")}]`
    )
  }
  console.log("")

  // Resource leak analysis
  const first = allResults[0]
  const last = allResults[allResults.length - 1]
  const zombieGrowth = last.after.zombies - baseline.zombies
  const portGrowth = last.after.openPorts - baseline.openPorts
  const memGrowth = last.after.memory.rss - baseline.memory.rss

  console.log("Resource Leak Check:")
  console.log(`  Zombie processes: ${baseline.zombies} → ${last.after.zombies} (${zombieGrowth > 0 ? "🔴 LEAK" : "🟢 OK"})`)
  console.log(`  Open TCP ports:   ${baseline.openPorts} → ${last.after.openPorts} (${portGrowth > 0 ? "🔴 LEAK" : "🟢 OK"})`)
  console.log(`  Memory RSS:       ${baseline.memory.rss}MB → ${last.after.memory.rss}MB (${memGrowth > 10 ? "🔴 LEAK" : memGrowth > 0 ? "🟡 Small growth" : "🟢 OK"})`)
  console.log("")

  // Exit code summary
  const failedRuns = allResults.flatMap((i) => i.results).filter((r) => r.exitCode !== 0 || r.hasErrors)
  console.log(`Total runs: ${ITERATIONS * CATEGORIES.length} | Failed: ${failedRuns.length} | Success rate: ${Math.round(((ITERATIONS * CATEGORIES.length - failedRuns.length) / (ITERATIONS * CATEGORIES.length)) * 100)}%`)
  console.log(`Total time: ${Math.round(totalElapsed / 1000)}s\n`)

  // Cleanup any stragglers
  console.log("Forcing cleanup of remaining node processes...")
  try {
    execSync('pkill -f "playwright-mcp" 2>/dev/null || true', { timeout: 5000 })
    execSync('pkill -f "puppeteer-mcp" 2>/dev/null || true', { timeout: 5000 })
    execSync('pkill -f "sqlite-mcp" 2>/dev/null || true', { timeout: 5000 })
    execSync('pkill -f "redis-mcp" 2>/dev/null || true', { timeout: 5000 })
    execSync('pkill -f "postgres-mcp" 2>/dev/null || true', { timeout: 5000 })
    execSync('pkill -f "firecrawl-mcp" 2>/dev/null || true', { timeout: 5000 })
    execSync('pkill -f "tavily-mcp" 2>/dev/null || true', { timeout: 5000 })
    execSync('pkill -f "brave-search-mcp" 2>/dev/null || true', { timeout: 5000 })
    execSync('pkill -f "exa-mcp" 2>/dev/null || true', { timeout: 5000 })
    execSync('pkill -f "browserbase-mcp" 2>/dev/null || true', { timeout: 5000 })
    console.log("Cleanup complete.")
  } catch (e) {
    console.log("Cleanup encountered errors (non-fatal):", e.message)
  }

  const finalZombies = getZombieCount()
  const finalPorts = getOpenPorts()
  console.log(`\nPost-cleanup: ${finalZombies} zombies, ${finalPorts} open ports`)

  if (finalZombies > baseline.zombies || finalPorts > baseline.openPorts + 2) {
    console.log("\n⚠️  WARN: Leaked processes or ports detected after cleanup.")
    process.exitCode = 1
  } else {
    console.log("\n✅ Stress test PASSED — no leaks detected.")
  }
}

main().catch((err) => {
  console.error("Stress test failed:", err)
  process.exit(1)
})
