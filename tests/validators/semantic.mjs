/**
 * Semantic Validators — replaces substring-based validation for MCP server testing.
 *
 * Design principles:
 * 1. Check output?.isError first (already done in harness).
 * 2. Parse structured output and assert on actual outcomes, not keyword grepping.
 * 3. Reject text that contains error markers even if it also contains "success" words.
 * 4. Shared primitives + per-adapter overrides for extensibility.
 */

// ─── Extractors ─────────────────────────────────────────────────────────────

export function getOutputText(output) {
  if (!output?.content) return ""
  return output.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n")
}

export function getOutputJson(output) {
  const text = getOutputText(output).trim()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    // Some servers wrap JSON in markdown fences
    const cleaned = text.replace(/^```(?:json)?\n?/gm, "").replace(/\n?```$/gm, "").trim()
    try {
      return JSON.parse(cleaned)
    } catch {
      return null
    }
  }
}

export function hasImageContent(output) {
  return output?.content?.some((c) => c.type === "image" || c.type === "imageUrl")
}

// ─── Assertion primitives ───────────────────────────────────────────────────

function assertNotError(output) {
  if (output?.isError) return { pass: false, reason: "Server marked output as error" }
  return { pass: true }
}

function assertNoErrorMarkers(text) {
  const errorMarkers = /\b(error|failed|exception|unable to|could not|permission denied|non-zero|fatal|timeout)\b/i
  if (errorMarkers.test(text)) {
    return { pass: false, reason: "Error markers detected in output text" }
  }
  return { pass: true }
}

function assertJsonWithPredicate(output, predicate, reason) {
  const data = getOutputJson(output)
  if (data === null) return { pass: false, reason: "Output is not valid JSON" }
  const result = predicate(data)
  if (!result) return { pass: false, reason }
  return { pass: true, data }
}

function assertTextRegex(output, regex, reason) {
  const text = getOutputText(output)
  if (!regex.test(text)) return { pass: false, reason }
  return { pass: true, text }
}

function assertTextContainsPhrases(output, phrases) {
  const text = getOutputText(output).toLowerCase()
  for (const phrase of phrases) {
    if (!text.includes(phrase.toLowerCase())) {
      return { pass: false, reason: `Missing phrase: "${phrase}"` }
    }
  }
  return { pass: true }
}

// ─── Semantic validators per task ───────────────────────────────────────────

export const browserValidators = {
  navigate(output, { expectedUrl } = {}) {
    const err = assertNotError(output)
    if (!err.pass) return err

    const text = getOutputText(output)
    const lower = text.toLowerCase()

    // If JSON has a url field, assert it matches
    const json = getOutputJson(output)
    if (json?.url) {
      const ok = !expectedUrl || json.url.includes(expectedUrl)
      return { pass: ok, reason: ok ? null : `URL mismatch: ${json.url}` }
    }

    // Require positive confirmation language + actual URL pattern
    const hasConfirmation = /\b(navigated to|page url:|loaded|goto|title:)\b/i.test(text)
    const hasUrl = /https?:\/\/\S+/i.test(text)
    const noErrors = assertNoErrorMarkers(lower)
    if (!noErrors.pass) return noErrors

    if (hasConfirmation && hasUrl) return { pass: true }
    return { pass: false, reason: "No navigation confirmation or URL found" }
  },

  screenshot(output) {
    const err = assertNotError(output)
    if (!err.pass) return err

    // Prefer structured image content
    if (hasImageContent(output)) return { pass: true }

    const text = getOutputText(output)
    // Look for actual file/link references, not just the word "screenshot" in an error
    const hasImageRef = /\[screenshot of|\.png\b|image\/png|data:image|\[image\]|\(\.[^)]+\.png\)/i.test(text)
    if (hasImageRef) return { pass: true }

    return { pass: false, reason: "No screenshot or image reference found" }
  },

  snapshot(output) {
    const err = assertNotError(output)
    if (!err.pass) return err

    const text = getOutputText(output)
    if (text.length > 200) {
      // Substantial content returned — likely a real snapshot
      return { pass: true }
    }
    // For short text, require DOM-like structure
    const hasDom = /<(html|body|div|h1|button|input|p|span|ul|li|a)\b/i.test(text)
    if (hasDom) return { pass: true }

    // Puppeteer evaluate result: check for page title text
    const hasPageContent = /MCP Browser Automation Test Page|Click Me|Click Test|Form Fill Test/i.test(text)
    if (hasPageContent) return { pass: true }

    return { pass: false, reason: "No substantial snapshot content" }
  },

  click(output) {
    const err = assertNotError(output)
    if (!err.pass) return err

    const text = getOutputText(output)
    const lower = text.toLowerCase()
    const noErrors = assertNoErrorMarkers(lower)
    if (!noErrors.pass) return noErrors

    // Require explicit success phrasing
    const hasSuccess = /\b(clicked|success|done|performed|completed|action executed)\b/i.test(text)
    if (hasSuccess) return { pass: true }

    // Playwright specific: snapshot after click contains page content
    if (text.includes("Snapshot") && text.includes("Click Me")) return { pass: true }

    return { pass: false, reason: "No click success confirmation" }
  },

  fill(output, { expectedText } = {}) {
    const err = assertNotError(output)
    if (!err.pass) return err

    const text = getOutputText(output)
    const lower = text.toLowerCase()
    const noErrors = assertNoErrorMarkers(lower)
    if (!noErrors.pass) return noErrors

    // Best case: typed text appears in the result
    if (expectedText && lower.includes(expectedText.toLowerCase())) {
      return { pass: true, detail: "Output echoes typed text" }
    }

    // Require explicit fill success phrasing
    const hasSuccess = /\b(filled|typed|entered|wrote|input set|value set|success)\b/i.test(text)
    if (hasSuccess) return { pass: true }

    // Playwright specific: snapshot after fill contains the typed text
    if (text.includes("Snapshot") && expectedText && text.includes(expectedText)) {
      return { pass: true, detail: "Snapshot contains typed text" }
    }

    return { pass: false, reason: "No fill success confirmation" }
  },
}

export const databaseValidators = {
  list_tables(output) {
    const err = assertNotError(output)
    if (!err.pass) return err

    // SQLite / some servers return a JSON array of table objects
    const json = getOutputJson(output)
    if (Array.isArray(json) && json.length > 0) {
      const hasNames = json.some((r) => r.name || r.table_name || r.tablename)
      if (hasNames) return { pass: true, detail: `${json.length} tables` }
    }
    if (json?.tables && Array.isArray(json.tables) && json.tables.length > 0) {
      return { pass: true, detail: `${json.tables.length} tables` }
    }

    // Postgres sometimes returns [] for system schemas — that's valid but empty
    if (Array.isArray(json) && json.length === 0) {
      return { pass: true, detail: "Empty table list (valid)" }
    }

    return { pass: false, reason: "No table list structure found" }
  },

  describe_table(output, { expectedTable } = {}) {
    const err = assertNotError(output)
    if (!err.pass) return err

    const json = getOutputJson(output)
    if (json?.columns && Array.isArray(json.columns)) {
      return { pass: true, detail: `${json.columns.length} columns` }
    }
    if (json?.schema) return { pass: true }
    if (Array.isArray(json) && json.length > 0 && json[0].type) {
      return { pass: true, detail: "Schema columns returned" }
    }
    if (Array.isArray(json) && json.length > 0 && json[0].name && json[0].type) {
      return { pass: true, detail: "Schema columns returned" }
    }

    return { pass: false, reason: "No table description structure" }
  },

  query(output, { expectedColumns = [] } = {}) {
    const err = assertNotError(output)
    if (!err.pass) return err

    const json = getOutputJson(output)
    let rows = null
    if (Array.isArray(json) && json.length > 0) {
      rows = json
    } else if (json?.rows && Array.isArray(json.rows)) {
      rows = json.rows
    }

    if (rows === null) return { pass: false, reason: "No query result rows" }
    if (rows.length === 0) return { pass: false, reason: "Empty result set" }

    if (expectedColumns.length > 0) {
      const first = rows[0]
      const missing = expectedColumns.filter((c) => !(c in first))
      if (missing.length) {
        return { pass: false, reason: `Missing columns: ${missing.join(", ")}` }
      }
    }
    return { pass: true, detail: `${rows.length} rows` }
  },

  sample(output, { expectedColumns = [] } = {}) {
    // Same structural validation as query
    return databaseValidators.query(output, { expectedColumns })
  },

  schema(output) {
    const err = assertNotError(output)
    if (!err.pass) return err

    const json = getOutputJson(output)
    if (json?.tables || json?.database || json?.version || json?.server) {
      return { pass: true }
    }
    if (Array.isArray(json) && json.length > 0) return { pass: true }

    const text = getOutputText(output).toLowerCase()
    const hasMeta = /\b(database|version|server|schema|tables?)\b/i.test(text) && text.length > 40
    if (hasMeta) return { pass: true }

    return { pass: false, reason: "No schema metadata found" }
  },
}

export const shellValidators = {
  run_command(output, { expectedPhrases = [], exitCode = 0 } = {}) {
    const err = assertNotError(output)
    if (!err.pass) return err

    const json = getOutputJson(output)
    if (json?.exitCode !== undefined) {
      if (json.exitCode !== exitCode) {
        return { pass: false, reason: `Exit code ${json.exitCode}, expected ${exitCode}` }
      }
      const stdout = (json.stdout || "").toLowerCase()
      for (const phrase of expectedPhrases) {
        if (!stdout.includes(phrase.toLowerCase())) {
          return { pass: false, reason: `stdout missing: ${phrase}` }
        }
      }
      return { pass: true }
    }

    // Plain text fallback
    const text = getOutputText(output).toLowerCase()
    const noErrors = assertNoErrorMarkers(text)
    if (!noErrors.pass) return noErrors

    for (const phrase of expectedPhrases) {
      if (!text.includes(phrase.toLowerCase())) {
        return { pass: false, reason: `Missing expected content: ${phrase}` }
      }
    }
    return { pass: true }
  },
}

export const filesystemValidators = {
  list(output, { expectedFiles = [] } = {}) {
    const err = assertNotError(output)
    if (!err.pass) return err

    const text = getOutputText(output)
    const lower = text.toLowerCase()
    const noErrors = assertNoErrorMarkers(lower)
    if (!noErrors.pass) return noErrors

    for (const file of expectedFiles) {
      if (!lower.includes(file.toLowerCase())) {
        return { pass: false, reason: `Missing expected file: ${file}` }
      }
    }
    return { pass: true }
  },

  read(output, { expectedPhrases = [] } = {}) {
    return shellValidators.run_command(output, { expectedPhrases })
  },

  write(output, { expectedPath } = {}) {
    const err = assertNotError(output)
    if (!err.pass) return err

    const text = getOutputText(output).toLowerCase()
    const noErrors = assertNoErrorMarkers(text)
    if (!noErrors.pass) return noErrors

    if (expectedPath && text.includes(expectedPath.toLowerCase())) {
      return { pass: true }
    }
    if (/\b(successfully|wrote|created|saved|done)\b/i.test(text)) {
      return { pass: true }
    }
    return { pass: false, reason: "No write confirmation" }
  },

  execute(output, { expectedPhrases = [] } = {}) {
    return shellValidators.run_command(output, { expectedPhrases })
  },

  info(output, { expectedPhrases = [] } = {}) {
    return shellValidators.run_command(output, { expectedPhrases })
  },
}

export const gitValidators = {
  list(output, { expectedMarkers = ["branch", "commit", "modified", "untracked", "clean"] } = {}) {
    const err = assertNotError(output)
    if (!err.pass) return err

    const text = getOutputText(output).toLowerCase()
    const noErrors = assertNoErrorMarkers(text)
    if (!noErrors.pass) return noErrors

    const hasMarker = expectedMarkers.some((m) => text.includes(m.toLowerCase()))
    if (hasMarker) return { pass: true }
    return { pass: false, reason: "No git status markers found" }
  },

  read(output, { expectedPhrases = ["commit", "author", "date"] } = {}) {
    return shellValidators.run_command(output, { expectedPhrases })
  },

  write(output, { expectedPhrases = ["stash", "saved", "success"] } = {}) {
    const err = assertNotError(output)
    if (!err.pass) return err

    const text = getOutputText(output).toLowerCase()
    const noErrors = assertNoErrorMarkers(text)
    if (!noErrors.pass) return noErrors

    // "No local changes to save" is a valid success state for git stash
    if (text.includes("no local changes")) return { pass: true }

    const hasSuccess = expectedPhrases.some((p) => text.includes(p.toLowerCase()))
    if (hasSuccess) return { pass: true }
    return { pass: false, reason: "No git write confirmation" }
  },

  execute(output, { expectedPhrases = ["stash", "pop", "restored"] } = {}) {
    const err = assertNotError(output)
    if (!err.pass) return err

    const text = getOutputText(output).toLowerCase()
    const noErrors = assertNoErrorMarkers(text)
    if (!noErrors.pass) return noErrors

    if (text.includes("no stash")) return { pass: true } // valid empty state
    const hasSuccess = expectedPhrases.some((p) => text.includes(p.toLowerCase()))
    if (hasSuccess) return { pass: true }
    return { pass: false, reason: "No git execute confirmation" }
  },

  info(output, { expectedPhrases = ["commit", "author", "date"] } = {}) {
    return shellValidators.run_command(output, { expectedPhrases })
  },
}
