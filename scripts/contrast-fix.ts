/**
 * Applies the DESIGN.md §2 contrast rules to the shadcn primitives.
 *
 * The primitives ship `text-muted-foreground` and `ring-ring`, both of which
 * DESIGN.md §2.1 measured as failing WCAG AA on white (4.26:1 and 2.32:1).
 * ADR-020 forbids editing globals.css, so the fix has to be at the class level
 * — which is exactly what that ADR anticipates.
 *
 *   npm run contrast:fix
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const DIR = join(process.cwd(), "components", "ui")

/** [pattern, replacement, reason] */
const RULES: [RegExp, string, string][] = [
  [
    /text-muted-foreground/g,
    "text-secondary-foreground dark:text-muted-foreground",
    "DESIGN.md 2.2 — muted-foreground is 4.26:1 on white; swap per theme",
  ],
  [
    /focus-visible:border-ring/g,
    "focus-visible:border-foreground",
    "DESIGN.md 2.3 — --ring is 2.32:1, fails the 3:1 focus requirement",
  ],
  [
    /focus-visible:ring-ring\/50/g,
    "focus-visible:ring-foreground",
    "DESIGN.md 2.3 — --ring is 2.32:1, fails the 3:1 focus requirement",
  ],
  [
    /(link:\s*")text-primary\b/g,
    '$1text-primary-foreground dark:text-primary',
    "DESIGN.md 2.2 — lime is 1.54:1 on white and must never be light-mode text",
  ],
  [
    /(^|[\s"'])text-primary(?!-)/gm,
    "$1text-primary-foreground dark:text-primary",
    "DESIGN.md 2.2 — lime is a surface in light mode, text only in dark",
  ],
]

let filesChanged = 0
const touched: string[] = []

for (const file of readdirSync(DIR)) {
  if (!file.endsWith(".tsx")) continue
  const path = join(DIR, file)
  const original = readFileSync(path, "utf8")
  let next = original

  for (const [pattern, replacement] of RULES) {
    next = next.replace(pattern, replacement)
  }

  if (next !== original) {
    writeFileSync(path, next, "utf8")
    filesChanged++
    touched.push(file)
  }
}

console.log(`${filesChanged} primitives updated:`)
for (const file of touched) console.log(`  ${file}`)

console.log("\nrules applied:")
for (const [, , reason] of RULES) console.log(`  - ${reason}`)