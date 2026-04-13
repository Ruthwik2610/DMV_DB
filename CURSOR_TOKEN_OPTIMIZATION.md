# Cursor IDE — Token Optimization Guide

Practical strategies to reduce token consumption by 40-60% without losing productivity.

---

## 1. The Biggest Lever: `.cursorignore`

Create a `.cursorignore` in your project root. This stops Cursor from indexing and including irrelevant files in context.

```
# Dependencies (massive token sinks)
node_modules/
.venv/
vendor/

# Lock files (can be 50k+ tokens each)
package-lock.json
yarn.lock
pnpm-lock.yaml

# Build output
dist/
build/
.next/
out/

# Assets (binary, not useful for context)
*.png
*.jpg
*.svg
*.ico
*.woff
*.woff2

# Large data files
*.csv
*.sql
*.parquet

# Logs and coverage
*.log
coverage/
.nyc_output/

# Environment (also security)
.env
.env.local
```

**Impact: HIGH. This alone can cut 30%+ of wasted tokens.**

---

## 2. Keep `.cursorrules` Lean (<300 words)

Your `.cursorrules` file is injected into EVERY prompt. Bloated rules = wasted tokens on every single interaction.

### Bad (700+ words of verbose prose):
```
When writing React components, please ensure that you always use functional
components with hooks. We prefer using the useState hook for local state
management and useEffect for side effects. Please make sure to always...
```

### Good (concise, scannable):
```
Stack: Vite + React 19, Express 5, Tailwind CSS, shadcn/ui.
Style: JSX (not TSX), functional components, named exports.
State: React hooks only. No Redux/Zustand.
API: src/lib/api.js wrapper. Never raw fetch in components.
Naming: camelCase files, PascalCase components.
Backend: server/ directory, Express Router pattern.
DB: BigQuery (@google-cloud/bigquery), Salesforce (jsforce), Vercel REST API.
```

**Impact: MEDIUM. Saves tokens on every single message.**

---

## 3. Use the Right Mode for the Job

| Mode | Token Cost | Best For |
|------|-----------|----------|
| **Tab completion** | Lowest | Line-by-line autocomplete, small edits |
| **Edit mode** (Cmd+K) | Low-Medium | Refactoring a selected block |
| **Ask mode** (Cmd+L) | Medium | Targeted questions about specific code |
| **Agent mode** (Composer) | Highest | Multi-file changes spanning the codebase |

**Rule: Use the least powerful mode that gets the job done.**

- Need to rename a variable? Tab completion, not Agent.
- Need to refactor one function? Edit mode (Cmd+K), not Agent.
- Need to understand how auth works? Ask mode, not Agent.
- Need to add a new feature across 5 files? Agent mode.

**Impact: HIGH. Agent mode can use 10-50x the tokens of Edit mode.**

---

## 4. Reference Files Precisely with `@`

```
Bad:  @codebase how does the API work?        (scans entire project)
Good: @src/lib/api.js what endpoints exist?    (scans one file)

Bad:  @codebase fix the login bug              (searches everything)
Good: @src/pages/Login.jsx the form doesn't submit when... (targeted)
```

- `@filename` — includes just that file
- `@filename:15-40` — includes only those lines
- `@codebase` — scans entire indexed project (expensive, use sparingly)
- `@web` — searches the web (separate token budget)

**Impact: HIGH. `@codebase` vs `@file` can be a 10-100x difference.**

---

## 5. Start Fresh Conversations Frequently

Every message in a conversation carries the FULL conversation history as context. A 20-message conversation means message #20 sends all 19 prior messages as input tokens.

- Finish a task? **Cmd+N** for a new chat.
- Context getting muddled? **Cmd+N** for a new chat.
- Bug fixed? **Cmd+N** for a new chat.

**Don't:** Have one mega-conversation for an entire coding session.
**Do:** One conversation per task/feature/bug.

**Impact: HIGH. Prevents exponential token growth in long sessions.**

---

## 6. Ask for Code-Only Responses

Append this to prompts when you just need implementation:

```
Reply with code only. No explanation.
```

or

```
Just the code, no commentary.
```

This cuts output tokens by 50-70%. LLMs default to verbose explanations — tell them not to.

**Impact: MEDIUM. Directly reduces output tokens.**

---

## 7. Scope Agent Mode Explicitly

When using Agent/Composer, tell it exactly what to touch:

```
Bad:  "Add a BigQuery connector to the project"
Good: "Create server/connectors/bigquery.js with connect() and query() functions.
       Then add a route in server/routes/bigquery.js with POST /api/bigquery/query.
       Wire into server.js. Only modify these 3 files."
```

This prevents the agent from:
- Reading 20 files to "understand the codebase"
- Making unnecessary changes to unrelated files
- Going on multi-step exploration tangents

**Impact: HIGH. Can reduce Agent mode tokens by 50%+.**

---

## 8. Disable Codebase Indexing When Not Needed

If you never use `@codebase` queries:

Settings → Features → Codebase Indexing → **OFF**

For large monorepos, open only the subdirectory you're working in:
```bash
# Instead of:
cursor ~/monorepo

# Do:
cursor ~/monorepo/packages/my-service
```

**Impact: MEDIUM. Reduces background token usage from indexing.**

---

## 9. Close Unrelated Tabs

Cursor may include recently viewed/edited files as context. Close tabs for files you're done with.

**Impact: LOW-MEDIUM. Easy win.**

---

## 10. Use the Blueprint Prompt Pattern

Instead of iterating with the AI over multiple rounds ("now do this... now do that..."), give it a single comprehensive blueprint (like the `CURSOR_BLUEPRINT_SKILL.md` file in this repo).

**Multi-round approach (expensive):**
```
Message 1: "Set up BigQuery connection"          → 5k tokens
Message 2: "Now add Salesforce too"              → 8k tokens (includes msg 1)
Message 3: "Can you also add Vercel?"            → 12k tokens (includes msgs 1-2)
Message 4: "Now build the frontend for all three" → 18k tokens (includes msgs 1-3)
Message 5: "Wire it all together"                → 25k tokens (includes msgs 1-4)
Total: ~68k tokens
```

**Single blueprint approach (efficient):**
```
Message 1: [Full blueprint with all requirements] → 8k tokens
Message 2: "Continue from step 5"                → 12k tokens
Total: ~20k tokens
```

**Impact: VERY HIGH. Can reduce total tokens by 60-70% for complex tasks.**

---

## Quick Reference

| Strategy | Token Savings | Effort |
|----------|:------------:|:------:|
| `.cursorignore` (lock files, node_modules) | 30%+ | 2 min |
| Single blueprint vs multi-round | 60-70% | 15 min upfront |
| Use lightest mode (Tab > Edit > Ask > Agent) | 50%+ per task | Habit |
| `@file` instead of `@codebase` | 10-100x per query | Habit |
| Start new chat per task (Cmd+N) | Prevents 2-5x bloat | Habit |
| Lean `.cursorrules` (<300 words) | 10-20% per message | 5 min |
| "Code only, no explanation" | 50-70% output | Habit |
| Scope Agent mode explicitly | 50%+ in Agent | Habit |
| Close unrelated tabs | 5-15% | Habit |
| Disable codebase indexing if unused | 10-20% background | 1 min |
