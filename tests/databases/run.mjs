#!/usr/bin/env node
import { McpTestHarness } from "../harness.mjs"
import { TASK_DEFINITIONS, SERVERS } from "./test-cases.mjs"
import { writeFileSync, mkdtempSync, writeFileSync as fsWriteFileSync, rmSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { tmpdir } from "os"
import { execSync } from "child_process"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "../..")

async function loadAdapter(adapterPath) {
  const fullPath = resolve(__dirname, adapterPath)
  return await import(fullPath)
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════")
  console.log("  MCP Database Test Suite — Trustworthy Edition")
  console.log("═══════════════════════════════════════════════════════════")
  console.log("")

  // Create a fresh temporary directory per run to avoid state pollution
  const tmpDir = mkdtempSync(resolve(tmpdir(), "mcp-db-test-"))
  const sqlitePath = resolve(tmpDir, "benchmark.db")
  // Seed the SQLite DB with a known schema so list_tables/describe_table/query work
  try {
    execSync(
      `sqlite3 "${sqlitePath}" "CREATE TABLE benchmark_test (id INTEGER PRIMARY KEY, name TEXT, score REAL); INSERT INTO benchmark_test VALUES (1, 'Test', 99.9);"`
    )
  } catch {
    console.warn("⚠️ sqlite3 CLI not available; SQLite tests will likely fail")
  }

  const allResults = []

  for (const serverDef of SERVERS) {
    // Patch SQLite path to use the fresh temp DB (passed as last arg, not env var)
    if (serverDef.name === "SQLite MCP" && serverDef.args.length >= 3) {
      serverDef.args = [...serverDef.args]
      serverDef.args[serverDef.args.length - 1] = sqlitePath
    }
    const adapter = await loadAdapter(serverDef.adapter)
    const harness = new McpTestHarness(serverDef)
    let result = null

    // Two-phase auth triage
    const discovery = await harness.discover(10000)
    if (discovery.status !== "ready") {
      console.log(`  ⏭️  Skipped — ${discovery.status}${discovery.error ? ": " + discovery.error : ""}`)
      result = {
        server: serverDef.name,
        package: serverDef.args[1],
        tool_count: 0,
        tests: [],
        overall: {
          total_tests: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          pass_rate: 0,
          avg_latency_ms: 0,
          p50_latency_ms: 0,
          p90_latency_ms: 0,
        },
        connect_time_ms: discovery.connect_time_ms,
        discovery_status: discovery.status,
        error: discovery.error,
        auth_triage: serverDef.authTriage,
        env_var: serverDef.envVar,
      }
      await harness.disconnect()
      allResults.push(result)
      console.log("")
      console.log(`  ${serverDef.name}: skipped (${discovery.status})`)
      console.log("")
      continue
    }

    try {
      result = await harness.run(TASK_DEFINITIONS, adapter, "")
      result.package = serverDef.args[1]
      result.auth_triage = serverDef.authTriage
      result.env_var = serverDef.envVar
      result.discovery_status = "ready"
    } catch (err) {
      console.error(`❌ Failed to test ${serverDef.name}: ${err.message}`)
      result = {
        server: serverDef.name,
        package: serverDef.args[1],
        tool_count: 0,
        tests: [],
        overall: {
          total_tests: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          pass_rate: 0,
          avg_latency_ms: 0,
          p50_latency_ms: 0,
          p90_latency_ms: 0,
        },
        connect_time_ms: 0,
        discovery_status: "ready",
        error: err.message,
        auth_triage: serverDef.authTriage,
        env_var: serverDef.envVar,
      }
    } finally {
      await harness.disconnect()
    }

    allResults.push(result)
    console.log("")
    console.log(`  ${serverDef.name}: ${result.overall.pass_rate}% pass rate`)
    console.log(`    Tests: ${result.overall.passed}/${result.overall.total_tests} passed`)
    console.log(`    Skipped: ${result.overall.skipped}`)
    console.log(`    Latency: p50=${result.overall.p50_latency_ms}ms p90=${result.overall.p90_latency_ms}ms`)
    console.log(`    Connect: ${result.connect_time_ms}ms`)
    if (result.error) console.log(`    ⚠️  Error: ${result.error}`)
    console.log("")
  }

  const outputPath = resolve(ROOT, "public/data/databases-results.json")
  const report = {
    date: new Date().toISOString(),
    category: "databases",
    test_framework_version: "2.0.0",
    mcp_sdk_version: "1.0.0",
    test_environment: "macOS, Node.js v25.7.0",
    servers: allResults,
  }

  writeFileSync(outputPath, JSON.stringify(report, null, 2))
  console.log(`✅ Results written to ${outputPath}`)

  // Clean up temp directory
  try {
    rmSync(tmpDir, { recursive: true, force: true })
  } catch {}
}

main().catch(console.error)
