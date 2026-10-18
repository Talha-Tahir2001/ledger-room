/**
 * Greps every build artifact for every secret (NFR-6, PRIVACY.md §5).
 *
 *   npm run verify:secrets
 *
 * The check is deliberately blunt: read the values from the environment, then
 * search the entire `.next` directory for those exact strings. A key that
 * appears anywhere in a client bundle, a server chunk, a source map or a
 * prerendered HTML file is a leak, regardless of what the variable is named.
 */
import { readFileSync, readdirSync, statSync } from "node:fs"
import { extname, join } from "node:path"

const BUILD_DIR = join(process.cwd(), ".next")

const SECRETS: [string, string][] = [
  ["OPENROUTER_API_KEY", process.env.OPENROUTER_API_KEY ?? ""],
  ["TABPFN_API_KEY", process.env.TABPFN_API_KEY ?? ""],
  ["MONGODB_URI", process.env.MONGODB_URI ?? ""],
  ["GEMINI_API_KEY", process.env.GEMINI_API_KEY ?? ""],
  ["SENTRY_AUTH_TOKEN", process.env.SENTRY_AUTH_TOKEN ?? ""],
]

const SCANNABLE = new Set([
  ".js", ".mjs", ".cjs", ".map", ".html", ".json", ".txt", ".css", ".svg",
])

/** Keys shorter than this would produce false positives against common words. */
const MIN_SECRET_LENGTH = 12

function walk(dir: string, files: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return files
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    try {
      if (statSync(full).isDirectory()) walk(full, files)
      else if (SCANNABLE.has(extname(entry))) files.push(full)
    } catch {
      // A file that vanished mid-walk is not a finding.
    }
  }
  return files
}

function main() {
  const active = SECRETS.filter(([, value]) => value && value.length >= MIN_SECRET_LENGTH)

  if (active.length === 0) {
    console.log("No secrets present in the environment to check against.")
    console.log("That either means the variables are unset, or they are placeholders.")
    console.log("A green result with no keys to search for proves nothing.")
    return
  }

  console.log(`scanning ${BUILD_DIR} against ${active.length} secret value(s)\n`)

  const files = walk(BUILD_DIR)
  console.log(`scanning ${files.length} text artifacts\n`)

  let leaks = 0

  for (const [name, value] of active) {
    const hits: string[] = []
    for (const file of files) {
      let content: string
      try {
        content = readFileSync(file, "utf8")
      } catch {
        continue
      }
      if (content.includes(value)) hits.push(file.replace(BUILD_DIR, ""))
    }

    if (hits.length === 0) {
      console.log(`  clean  ${name}`)
    } else {
      leaks += hits.length
      console.log(`  LEAK   ${name} in ${hits.length} artifact(s):`)
      for (const hit of hits.slice(0, 5)) console.log(`           ${hit}`)
    }
  }

  console.log("")
  if (leaks > 0) {
    console.error(`${leaks} leak(s) found. Do not deploy.`)
    process.exit(1)
  }
  console.log("No secret value appears in any build artifact.")
}

main()
