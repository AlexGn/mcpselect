/**
 * Minimal HTTP server for the browser-automation test page.
 *
 * Serves tests/browser-automation/test-page.html on a local port so that
 * all MCP servers (including those with restrictions on file:// URLs)
 * can navigate to it reliably.
 */

import { createServer } from "http"
import { readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

const HTML_PATH = resolve(__dirname, "test-page.html")
const HTML = readFileSync(HTML_PATH, "utf-8")

export function startTestServer(port = 0) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      if (req.url === "/" || req.url === "/index.html") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
        res.end(HTML)
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" })
        res.end("Not found")
      }
    })

    server.listen(port, "127.0.0.1", () => {
      const addr = server.address()
      const url = `http://127.0.0.1:${addr.port}`
      console.log(`🌐 Test server running at ${url}`)
      resolve({ server, url })
    })

    server.on("error", reject)
  })
}

export function stopTestServer(server) {
  return new Promise((resolve) => {
    server.close(() => {
      console.log("🌐 Test server stopped")
      resolve()
    })
  })
}
