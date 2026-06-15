# MCP Select — Independent MCP Server Benchmarks

This repository contains the open-source benchmark harness, raw test data, and methodology validator behind [MCP Select](https://mcpselect.com).

## What we measure

We personally install and test MCP servers in a clean environment. No cached credentials. No pre-configured setups. We run exactly what the README says, measure pass rates and latency, and publish the raw numbers.

## Repository layout

```
├── data/                          # Raw benchmark results and server metadata
│   ├── browser-automation-results.json
│   ├── databases-results.json
│   ├── developer-tools-results.json
│   ├── search-results.json
│   └── *-static.json              # Server metadata for researched categories
├── scripts/
│   └── validate-methodology.py  # Sanity checks for published data
├── tests/
│   ├── harness.mjs                # Shared benchmark harness
│   ├── adapters/                  # Per-server test adapters
│   ├── browser-automation/        # Playwright, Puppeteer, Firecrawl, Browserbase
│   ├── databases/                 # SQLite, PostgreSQL, Redis
│   ├── developer-tools/           # Filesystem, Shell, Git
│   ├── search/                    # Tavily, Exa, Brave Search
│   ├── validators/                # Semantic output validators
│   └── sdk/                       # MCP SDK dependency
└── README.md
```

## Quick start

```bash
# Install dependencies
cd tests/sdk && npm install && cd ../..

# Run browser automation benchmarks
cd tests/browser-automation
node run.mjs

# Run database benchmarks
cd tests/databases
node run.mjs

# Validate published data
python3 scripts/validate-methodology.py
```

## Methodology

1. **Discovery** — Scan GitHub, npm, and the official MCP registry for candidate servers.
2. **Installation** — Install via `npx` in a clean Node.js environment with no global packages or cached credentials.
3. **Connection** — Run `listTools()` and classify the result: ready, auth_required, timeout, or error.
4. **Tasks** — Run five production tasks per server matching its actual purpose.
5. **Validation** — Check semantic outcomes, not substring matches.
6. **Cleanup** — Aggressively kill child processes to avoid zombies.

See the full methodology at https://mcpselect.com/methodology/.

## Data freshness

Benchmarks are rerun on a rolling basis. Each results JSON includes a `date` field. Stale results are labeled, not hidden.

## License

MIT — see [LICENSE](./LICENSE).

## Contact

Alex Guyenne — alex.guyenne@gmail.com  
MCP Select — https://mcpselect.com
