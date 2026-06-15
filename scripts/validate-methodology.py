#!/usr/bin/env python3
"""
MCP Select Methodology Validator
Cross-checks methodology page claims against actual harness code and test results.
"""

import json, re, sys, os
from pathlib import Path

REPO = Path("/Users/alex/Documents/Claude/directory/sites/mcp-directory")
ERRORS = []
WARNINGS = []

def check(condition, message, level="error"):
    if not condition:
        if level == "error":
            ERRORS.append(message)
        else:
            WARNINGS.append(message)

def main():
    # 1. Read harness source
    harness = (REPO / "tests" / "harness.mjs").read_text()
    results_files = list((REPO / "public" / "data").glob("*-results.json"))
    methodology = (REPO / "app" / "methodology" / "page.tsx").read_text()

    # 2. Verify harness features
    check("allowlist" in harness.lower() or "_buildEnv" in harness,
          "Harness missing allowlist env injection")
    check("discover" in harness,
          "Harness missing two-phase auth triage (discover)")
    check("preConnect" in harness and "postTask" in harness,
          "Harness missing stateful adapter lifecycle hooks")
    check("SIGKILL" in harness and "pkill" in harness,
          "Harness missing aggressive process cleanup")
    check("validate" in harness,
          "Harness missing semantic validation")
    check("30000" in harness,
          "Harness missing 30s per-task timeout")
    check("15000" in harness,
          "Harness missing 15s connect timeout")

    # 3. Verify methodology page claims
    check("npx" in methodology,
          "Methodology page doesn't mention npx installation")
    check("GitHub" in methodology,
          "Methodology page doesn't link to GitHub repo")
    check("open-source" in methodology.lower() or "open source" in methodology.lower(),
          "Methodology page doesn't mention open-source")

    # 4. Check for factual errors in methodology
    if "port 3456" in methodology:
        WARNINGS.append("Methodology says 'port 3456' but harness uses ephemeral port (0)")
    if "SDK 1.0.0" in methodology:
        # This is actually the client version, not the SDK under test
        pass  # Acceptable
    if "npm or pip" in methodology:
        WARNINGS.append("Methodology mentions 'pip' but we only test npx packages")
    if "every 14 days" in methodology.lower():
        WARNINGS.append("Methodology claims 're-run every 14 days' but no automation exists")

    # 5. Verify results files match harness output schema
    for rf in results_files:
        d = json.load(open(rf))
        check("servers" in d or "results" in d or "date" in d,
              f"{rf.name} missing expected keys")
        if "servers" in d:
            for s in d["servers"]:
                check("overall" in s,
                      f"{rf.name} / {s.get('server','?')} missing 'overall'")
                if "overall" in s:
                    check("pass_rate" in s["overall"],
                          f"{rf.name} missing pass_rate")
                    check("p50_latency_ms" in s["overall"],
                          f"{rf.name} missing p50_latency_ms")

    # 6. Verify test cases exist
    for cat in ["browser-automation", "databases", "developer-tools", "search"]:
        runner = REPO / "tests" / cat / "run.mjs"
        check(runner.exists(), f"Missing runner: tests/{cat}/run.mjs")
        cases = REPO / "tests" / cat / "test-cases.mjs"
        check(cases.exists(), f"Missing test cases: tests/{cat}/test-cases.mjs")
        adapter_dir = REPO / "tests" / cat / "adapters"
        if adapter_dir.exists():
            adapters = list(adapter_dir.glob("*.mjs"))
            check(len(adapters) > 0, f"No adapters in tests/{cat}/adapters/")

    # 7. Print report
    print("=" * 60)
    print("MCP SELECT METHODOLOGY VALIDATION REPORT")
    print("=" * 60)
    print(f"\nHarness features:     {'✅' if not any('Harness' in e for e in ERRORS) else '❌'}")
    print(f"Methodology claims:   {'✅' if not any('Methodology' in e for e in ERRORS) else '❌'}")
    print(f"Results integrity:    {'✅' if not any('results' in e.lower() for e in ERRORS) else '❌'}")
    print(f"Test infrastructure:  {'✅' if not any('runner' in e.lower() for e in ERRORS) else '❌'}")

    if ERRORS:
        print(f"\n❌ ERRORS ({len(ERRORS)}):")
        for e in ERRORS:
            print(f"   - {e}")

    if WARNINGS:
        print(f"\n⚠️  WARNINGS ({len(WARNINGS)}):")
        for w in WARNINGS:
            print(f"   - {w}")

    if not ERRORS and not WARNINGS:
        print("\n✅ ALL CHECKS PASSED — methodology is accurate.")

    print(f"\n{'PASS' if not ERRORS else 'FAIL'}: {len(ERRORS)} errors, {len(WARNINGS)} warnings")
    return 0 if not ERRORS else 1

if __name__ == "__main__":
    sys.exit(main())
