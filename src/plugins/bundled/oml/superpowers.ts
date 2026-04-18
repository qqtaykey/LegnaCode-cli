/**
 * OML Superpowers Skills
 *
 * Engineering discipline skills ported from obra/superpowers.
 * Each skill is a carefully tuned prompt that shapes AI behavior.
 * Prompt content stays in English (best AI comprehension),
 * descriptions use t() for i18n.
 */

import type { BundledSkillDefinition } from '../../../skills/bundledSkills.js'
import { t } from '../../../utils/i18n.js'

/** Wrap a prompt string into ContentBlockParam[] for skill system compatibility. */
const wrap = (text: string): Promise<Array<{ type: 'text'; text: string }>> =>
  Promise.resolve([{ type: 'text' as const, text }])

export function getSuperpowersSkills(): BundledSkillDefinition[] {
  return [
    {
      name: 'verify',
      description: t('[OML] 完成前验证 — 没有新鲜证据不能声称完成'),
      argumentHint: '<what to verify>',
      userInvocable: true,
      getPromptForCommand: (args: string) => wrap(VERIFY_PROMPT(args)),
    },
    {
      name: 'tdd',
      description: t('[OML] TDD 强制执行 — RED-GREEN-REFACTOR，先写测试再写代码'),
      argumentHint: '<feature or bugfix description>',
      userInvocable: true,
      getPromptForCommand: (args: string) => wrap(TDD_PROMPT(args)),
    },
    {
      name: 'debug',
      description: t('[OML] 系统化调试 — 4 阶段根因分析，3 次失败质疑架构'),
      argumentHint: '<bug or issue description>',
      userInvocable: true,
      getPromptForCommand: (args: string) => wrap(DEBUG_PROMPT(args)),
    },
    {
      name: 'brainstorm',
      description: t('[OML] 苏格拉底式设计 — 硬门控，设计未批准前禁止实现'),
      argumentHint: '<idea or feature description>',
      userInvocable: true,
      getPromptForCommand: (args: string) => wrap(BRAINSTORM_PROMPT(args)),
    },
    {
      name: 'write-plan',
      description: t('[OML] 写实现计划 — 将设计拆成 2-5 分钟的小任务'),
      argumentHint: '<spec or requirements>',
      userInvocable: true,
      getPromptForCommand: (args: string) => wrap(WRITE_PLAN_PROMPT(args)),
    },
    {
      name: 'sdd',
      description: t('[OML] 子代理驱动开发 — 实现→spec审查→质量审查三阶段'),
      argumentHint: '<plan file or task description>',
      userInvocable: true,
      getPromptForCommand: (args: string) => wrap(SDD_PROMPT(args)),
    },
    {
      name: 'exec-plan',
      description: t('[OML] 执行计划 — 加载计划文件，逐任务执行并验证'),
      argumentHint: '<plan file path>',
      userInvocable: true,
      getPromptForCommand: (args: string) => wrap(EXEC_PLAN_PROMPT(args)),
    },
    {
      name: 'dispatch',
      description: t('[OML] 并行子代理 — 2+ 独立任务同时派发'),
      argumentHint: '<tasks description>',
      userInvocable: true,
      getPromptForCommand: (args: string) => wrap(DISPATCH_PROMPT(args)),
    },
    {
      name: 'code-review',
      description: t('[OML] 请求代码审查 — 派发 reviewer 子代理检查代码质量'),
      argumentHint: '<what to review>',
      userInvocable: true,
      getPromptForCommand: (args: string) => wrap(CODE_REVIEW_PROMPT(args)),
    },
    {
      name: 'worktree',
      description: t('[OML] Git worktree — 创建隔离工作区，自动 setup + 基线测试'),
      argumentHint: '<branch name>',
      userInvocable: true,
      getPromptForCommand: (args: string) => wrap(WORKTREE_PROMPT(args)),
    },
    {
      name: 'finish-branch',
      description: t('[OML] 分支收尾 — 验证测试→合并/PR/保留/丢弃'),
      argumentHint: '',
      userInvocable: true,
      getPromptForCommand: (args: string) => wrap(FINISH_BRANCH_PROMPT(args)),
    },
  ]
}

// ── Prompt functions ──────────────────────────────────────────────

function VERIFY_PROMPT(args: string): string {
  return `# Verification Before Completion

**Iron Law:** NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE.

Before claiming ANY status:
1. IDENTIFY: What command proves this claim?
2. RUN: Execute the FULL command (fresh, complete)
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
5. ONLY THEN: Make the claim

**Red Flags — STOP if you catch yourself:**
- Using "should", "probably", "seems to"
- Expressing satisfaction before verification ("Great!", "Perfect!", "Done!")
- About to commit/push/PR without verification
- ANY wording implying success without having run verification

| Excuse | Reality |
|--------|---------|
| "Should work now" | RUN the verification |
| "I'm confident" | Confidence ≠ evidence |
| "Agent said success" | Verify independently |
| "Partial check is enough" | Partial proves nothing |

Task: ${args}`
}

function TDD_PROMPT(args: string): string {
  return `# Test-Driven Development

**Iron Law:** NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.
Write code before the test? Delete it. Start over. No exceptions.

## RED-GREEN-REFACTOR Cycle
1. **RED**: Write ONE minimal failing test showing desired behavior
2. **Verify RED**: Run test, confirm it FAILS for the right reason (feature missing, not typo)
3. **GREEN**: Write SIMPLEST code to pass the test. No extras, no YAGNI.
4. **Verify GREEN**: Run test, confirm it passes. All other tests still pass.
5. **REFACTOR**: Clean up. Keep tests green. Don't add behavior.
6. **Repeat**: Next failing test for next feature.

**Red Flags — Delete code and start over if:**
- Code before test
- Test passes immediately (testing existing behavior)
- Can't explain why test failed
- Rationalizing "just this once"

| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after" | Tests passing immediately prove nothing. |
| "TDD will slow me down" | TDD faster than debugging. |
| "Need to explore first" | Fine. Throw away exploration, start with TDD. |
| "Deleting X hours is wasteful" | Sunk cost fallacy. Keeping unverified code is debt. |

Task: ${args}`
}

function DEBUG_PROMPT(args: string): string {
  return `# Systematic Debugging

**Iron Law:** NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST.

## Phase 1: Root Cause Investigation (MANDATORY before any fix)
1. Read error messages carefully — stack traces, line numbers, error codes
2. Reproduce consistently — exact steps, every time?
3. Check recent changes — git diff, new deps, config changes
4. Gather evidence in multi-component systems — log at each boundary
5. Trace data flow — where does bad value originate? Keep tracing up.

## Phase 2: Pattern Analysis
- Find working examples in same codebase
- Compare against references — read COMPLETELY, don't skim
- Identify ALL differences between working and broken

## Phase 3: Hypothesis Testing
- Form SINGLE hypothesis: "X is root cause because Y"
- Make SMALLEST possible change to test
- One variable at a time. Don't fix multiple things at once.

## Phase 4: Implementation
1. Create failing test case FIRST
2. Implement SINGLE fix addressing root cause
3. Verify fix — test passes, no regressions
4. If fix doesn't work and tried 3+ times: STOP. Question the architecture.

**Red Flags — STOP and return to Phase 1:**
- "Quick fix for now, investigate later"
- "Just try changing X and see"
- Proposing solutions before tracing data flow
- "One more fix attempt" (when already tried 2+)

Issue: ${args}`
}

function BRAINSTORM_PROMPT(args: string): string {
  return `# Brainstorming Ideas Into Designs

<HARD-GATE>
Do NOT write any code, scaffold any project, or take any implementation action until you have presented a design and the user has approved it. This applies to EVERY project regardless of perceived simplicity.
</HARD-GATE>

## Checklist (complete in order):
1. Explore project context — check files, docs, recent commits
2. Ask clarifying questions — ONE at a time, understand purpose/constraints/success criteria
3. Propose 2-3 approaches — with trade-offs and your recommendation
4. Present design — in sections scaled to complexity, get user approval after each section
5. Write design doc — save and commit
6. Spec self-review — check for placeholders, contradictions, ambiguity
7. User reviews written spec
8. Transition to implementation — invoke /write-plan

**Anti-Pattern:** "This is too simple to need a design" — Every project goes through this process. "Simple" projects are where unexamined assumptions cause the most wasted work.

**Key Principles:**
- One question at a time — don't overwhelm
- YAGNI ruthlessly — remove unnecessary features
- Design for isolation — smaller units with clear boundaries
- In existing codebases, follow established patterns

Topic: ${args}`
}

function WRITE_PLAN_PROMPT(args: string): string {
  return `# Writing Implementation Plans

Write comprehensive plans assuming the engineer has zero context. Each step is one action (2-5 minutes). DRY. YAGNI. TDD. Frequent commits.

## Task Structure
Each task must contain:
- Exact file paths (create/modify/test)
- Complete code in every step — if a step changes code, show the code
- Exact commands with expected output
- Checkbox steps for tracking

## Bite-Sized Granularity
- "Write the failing test" — step
- "Run it to make sure it fails" — step
- "Implement minimal code to pass" — step
- "Run tests and verify" — step
- "Commit" — step

## No Placeholders — NEVER write:
- "TBD", "TODO", "implement later"
- "Add appropriate error handling"
- "Write tests for the above" (without actual test code)
- "Similar to Task N" (repeat the code)
- Steps without code blocks for code changes

## Self-Review (after writing):
1. Spec coverage — can you point to a task for each requirement?
2. Placeholder scan — any red flags from above?
3. Type consistency — do names match across tasks?

## Execution Handoff
After saving plan, offer: Subagent-Driven (/sdd, recommended) or Inline (/exec-plan).

Task: ${args}`
}

function SDD_PROMPT(args: string): string {
  return `# Subagent-Driven Development

Execute plan by dispatching fresh subagent per task, with two-stage review after each.

## Process
1. Read plan, extract ALL tasks with full text, create TodoWrite
2. Per task:
   a. Dispatch implementer subagent with full task text + context
   b. Handle status: DONE → review | NEEDS_CONTEXT → provide + re-dispatch | BLOCKED → assess
   c. Dispatch spec compliance reviewer — does code match spec?
   d. If issues: implementer fixes → re-review until ✅
   e. Dispatch code quality reviewer
   f. If issues: implementer fixes → re-review until ✅
   g. Mark task complete
3. After all tasks: dispatch final reviewer for entire implementation
4. Use /finish-branch to complete

## Model Selection
- Mechanical tasks (1-2 files, clear spec) → cheap/fast model
- Integration tasks (multi-file) → standard model
- Architecture/design/review → most capable model

## Red Flags — NEVER:
- Skip reviews (spec OR quality)
- Proceed with unfixed issues
- Dispatch parallel implementation subagents (conflicts)
- Start quality review before spec compliance is ✅
- Ignore subagent questions

Plan: ${args}`
}

function EXEC_PLAN_PROMPT(args: string): string {
  return `# Executing Plans

Load plan, review critically, execute all tasks, report when complete.

## Process
1. Read plan file, review critically — raise concerns before starting
2. Create TodoWrite with all tasks
3. Per task: mark in_progress → follow each step exactly → run verifications → mark completed
4. After all tasks: use /finish-branch to complete

## When to STOP and ask:
- Hit a blocker (missing dependency, test fails, instruction unclear)
- Plan has critical gaps
- Verification fails repeatedly

Plan: ${args}`
}

function DISPATCH_PROMPT(args: string): string {
  return `# Dispatching Parallel Agents

When you have 2+ independent tasks, dispatch one agent per problem domain concurrently.

## Parallel File Edit Mode
When the task involves editing multiple independent files, use the parallel file edit pattern:
1. For each file, spawn a sub-agent with: target file full text + sibling file skeletons
2. Each agent edits ONE file only — call Edit/Write immediately, no explanation
3. After all agents complete, check for conflicts (same file edited twice)

To build parallel edit tasks, use this pattern in your agent prompts:
- Include the FULL content of the target file
- Include function/class signatures from sibling files (same directory) for context
- Constrain: "You are editing ONE file: <path>. Do NOT edit any other file."

## When to Use
- 3+ test files failing with different root causes
- Multiple subsystems broken independently
- Each problem can be understood without context from others
- No shared state between investigations

## Pattern
1. Identify independent domains — group by what's broken
2. Create focused agent tasks: specific scope, clear goal, constraints, expected output
3. Dispatch in parallel using Task(run_in_background=true)
4. Review results, verify no conflicts, run full test suite

## Agent Prompt Structure
- Focused: one clear problem domain
- Self-contained: all context needed
- Specific output: what should agent return?

## DON'T use when:
- Failures are related (fix one might fix others)
- Agents would edit same files
- Need full system context first

Tasks: ${args}`
}

function CODE_REVIEW_PROMPT(args: string): string {
  return `# Requesting Code Review

Dispatch a code-reviewer subagent to catch issues before they cascade.

## When (mandatory):
- After each task in subagent-driven development
- After completing major feature
- Before merge to main

## How:
1. Get git SHAs: BASE_SHA (before changes), HEAD_SHA (after changes)
2. Dispatch code-reviewer subagent with: what was implemented, plan/requirements, SHAs, description
3. Act on feedback: fix Critical immediately, fix Important before proceeding, note Minor for later

## Red Flags — NEVER:
- Skip review because "it's simple"
- Ignore Critical issues
- Proceed with unfixed Important issues

Review: ${args}`
}

function WORKTREE_PROMPT(args: string): string {
  return `# Using Git Worktrees

Create isolated workspace for feature work.

## Directory Selection (priority order):
1. Check existing: .worktrees/ or worktrees/
2. Check CLAUDE.md/LEGNA.md for preference
3. Ask user

## Steps:
1. Verify directory is gitignored (if project-local) — add to .gitignore if not
2. Create worktree: git worktree add <path> -b <branch>
3. Run project setup (auto-detect: npm install / cargo build / pip install / go mod download)
4. Verify clean baseline — run tests, report failures

## Red Flags — NEVER:
- Create worktree without verifying it's ignored
- Skip baseline test verification
- Proceed with failing tests without asking

Branch: ${args}`
}

function FINISH_BRANCH_PROMPT(args: string): string {
  return `# Finishing a Development Branch

## Process:
1. Verify tests pass — if failing, STOP, cannot proceed
2. Present exactly 4 options:
   1. Merge back to base branch locally
   2. Push and create a Pull Request
   3. Keep the branch as-is
   4. Discard this work (requires typed "discard" confirmation)
3. Execute chosen option
4. Cleanup worktree (Options 1 & 4 only)

## Red Flags — NEVER:
- Proceed with failing tests
- Merge without verifying tests on result
- Delete work without confirmation
- Force-push without explicit request

${args}`
}

/** Session guidance injected at startup — the "1% rule" */
export const OML_SESSION_GUIDANCE = `You have access to OML (Oh-My-LegnaCode) engineering discipline skills. Before ANY response, check if a skill applies:

**Available skills:** /verify, /tdd, /debug, /brainstorm, /write-plan, /sdd, /exec-plan, /dispatch, /code-review, /worktree, /finish-branch, /ultrawork, /ralph, /autopilot, /ralplan, /plan-oml

**The 1% Rule:** If there is even a 1% chance a skill applies, invoke it. This is not optional.

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "Let me explore first" | Skills tell you HOW to explore. Check first. |
| "The skill is overkill" | Simple things become complex. Use it. |

**Magic keywords:** ultrawork, ralph, autopilot, ultrathink — detected automatically in your prompts.`
