---
name: ralph
description: Autonomous AI development loop that iteratively builds software from a plan until all tasks are complete. Activates on "ralph", "ralph loop", "ralph-loop", "ralph-new", "ralph-once", "ralph-afk", "run ralph", "start ralph", or when asked to autonomously build, iterate on a PRD, or run an unattended development loop. Implements the Ralph Wiggum technique of persistent iteration -- working through a task list in a loop, committing after each completed item, and continuing until every requirement is satisfied.
---

# Ralph -- Autonomous AI Development Loop

## Overview

Ralph is an autonomous, iterative development methodology. You receive a plan (PRD, task list, or feature description), then work through it task by task in a loop. Each iteration: pick the next uncompleted task, implement it, test it, commit it, and move on. Continue until every task is done.

**Named after Ralph Wiggum from The Simpsons** -- success comes from persistent iteration, not perfection on the first try.

**Announce at start:** "I'm using the ralph skill to run an autonomous development loop."

---

## Core Philosophy

1. **Iteration over perfection.** Do not aim for perfect on the first pass. Ship small increments and refine.
2. **Failures are data.** A failed test or broken build is information that guides the next attempt. Log what happened and try again.
3. **One task per iteration.** Focus on a single, small unit of work. Complete it fully before moving to the next.
4. **Commit after every completed task.** Each successful task produces a git commit. Small, reviewable, reversible increments.
5. **Persistence wins.** Keep going until every item is checked off. The loop handles retry logic.
6. **Operator skill matters.** The quality of the plan determines the quality of the output. Good plans yield good results.

---

## When to Use Ralph

**Good for:**
- Well-defined tasks with clear acceptance criteria
- Greenfield projects with a PRD or spec
- Feature implementation from a task list
- Tasks with automatic verification (tests, linters, typechecks)
- Batch work where you iterate until all items pass

**Not good for:**
- Tasks requiring subjective human judgment or design decisions
- One-shot operations with no iteration needed
- Tasks with unclear or missing success criteria
- Live production debugging (use systematic-debugging skill instead)

---

## The Ralph Loop

Each iteration follows this cycle:

```
1. READ PLAN       -- Load the task list and find the next uncompleted item
2. CHECK LEARNINGS -- Review progress log for patterns from previous attempts
3. IMPLEMENT       -- Write the code for this single task
4. TEST            -- Run tests, linters, typechecks relevant to the change
5. EVALUATE        -- Did it pass? If yes, proceed. If no, log learnings and retry.
6. COMMIT          -- On success: git add, git commit, mark task complete
7. LOG PROGRESS    -- Update the progress log with what was done
8. CONTINUE        -- Loop back to step 1 for the next task
```

**Exit condition:** All tasks are marked complete AND all tests pass.

---

## Plan Structure

Ralph works with two plan formats. Auto-detect which one is in use.

### Format 1: Single Task File

```
plans/{date}-{slug}/
  tasks.md        -- Checkboxes: [ ] incomplete, [x] complete
  context.md      -- (optional) Key files and architectural notes
  progress.md     -- Auto-generated log of completed work
```

### Format 2: Phased Plan (Recommended for Larger Work)

```
plans/{date}-{slug}/
  plan.md         -- High-level overview and goals
  phase-01-setup.md
  phase-02-core.md
  phase-03-ui.md
  context.md      -- (optional) Key files and architectural notes
  progress.md     -- Auto-generated log of completed work
```

### Creating a New Plan

If no plan exists and the user provides a feature description or PRD:

1. Create a timestamped plan directory: `plans/YYMMDD-feature-slug/`
2. Break the work into small, ordered tasks with checkboxes
3. Each task must have clear acceptance criteria
4. Order tasks by dependency: schema/data first, then logic, then UI, then integration
5. Create `context.md` listing key files in the codebase that are relevant
6. Create an empty `progress.md` with a header

---

## Task Format

Tasks use markdown checkboxes with acceptance criteria:

```markdown
- [ ] Add status column to tasks table
  - **AC:** Migration creates `status` column with default `'pending'`
  - **AC:** Typecheck passes

- [ ] Create status toggle component
  - **AC:** Component renders three states: pending, in-progress, done
  - **AC:** Clicking cycles through states
  - **AC:** Tests pass

- [x] Set up project scaffolding
  - **AC:** Project builds without errors
```

### Task Sizing Rules

**Each task must be completable in a single iteration.** If a task is too large, it will exhaust context and produce broken code.

**Right-sized tasks:**
- Add a database column and migration
- Add a single UI component to an existing page
- Implement one API endpoint with validation
- Write tests for one module
- Add a configuration option

**Too large (split these):**
- "Build the entire dashboard" --> split into schema, queries, layout, individual widgets, filters
- "Add authentication" --> split into schema, middleware, login form, session management, logout
- "Refactor the API" --> split per endpoint or per pattern

**Rule of thumb:** If you cannot describe the change in 2-3 sentences, it is too big. Split it.

### Task Ordering Rules

Tasks execute in order. Earlier tasks must never depend on later ones.

**Correct dependency order:**
1. Configuration and project setup
2. Schema and database changes (migrations)
3. Data models and type definitions
4. Server-side logic and API endpoints
5. UI components that consume the backend
6. Integration, dashboard, and summary views
7. Documentation and cleanup

### Acceptance Criteria Rules

Every criterion must be verifiable -- something that can be checked, not something vague.

**Good (verifiable):**
- "Migration adds `status` column with default `'pending'`"
- "GET /api/tasks returns 200 with JSON array"
- "Typecheck passes"
- "Tests pass"
- "Filter dropdown renders options: All, Active, Completed"

**Bad (vague):**
- "Works correctly"
- "Good user experience"
- "Handles edge cases"

**Always include as the final criterion of every task:** `"Typecheck passes"` (or equivalent for the project's language).

For tasks with testable logic, also include: `"Tests pass"`

---

## Running the Loop

### Mode 1: Human-In-The-Loop (HITL)

Run one iteration at a time. The user reviews each completed task before proceeding.

**When to use:** Learning the codebase, risky changes, early in a project, unfamiliar requirements.

**Workflow:**
1. Pick the next uncompleted task
2. Implement and test it
3. Show the user what was done
4. Wait for confirmation before proceeding to the next task

### Mode 2: Autonomous (AFK)

Run continuously through all tasks without stopping for approval.

**When to use:** Well-established patterns, low-risk work, comprehensive test coverage, trusted plan.

**Workflow:**
1. Pick the next uncompleted task
2. Implement, test, commit
3. Log progress
4. Immediately pick the next task
5. Continue until all tasks are complete or a blocker is hit

### Mode 3: Bounded Autonomous

Run a fixed number of iterations, then stop and report.

**When to use:** When the user wants progress but also wants periodic check-ins.

**Workflow:** Same as autonomous, but stop after N iterations and summarize what was accomplished.

---

## Progress Tracking

### The Progress Log

Maintain `progress.md` (or equivalent) with entries for each iteration:

```markdown
# Progress Log

## Iteration 1 - [timestamp]
- **Task:** Add status column to tasks table
- **Result:** PASS
- **Changes:** Created migration 003_add_status.sql, updated schema.ts
- **Commit:** abc1234

## Iteration 2 - [timestamp]
- **Task:** Create status toggle component
- **Result:** FAIL (attempt 1)
- **Issue:** Import path incorrect for shared types
- **Learning:** Types are exported from `src/types/index.ts`, not `src/shared/types.ts`

## Iteration 3 - [timestamp]
- **Task:** Create status toggle component (retry)
- **Result:** PASS
- **Changes:** Created StatusToggle.tsx, added tests
- **Commit:** def5678
```

### Marking Tasks Complete

When a task passes all acceptance criteria:
1. Mark the checkbox: `- [ ]` becomes `- [x]`
2. Stage the changed files: `git add <specific files>`
3. Commit with a descriptive message: `git commit -m "feat: add status column to tasks table"`
4. Log the result in `progress.md`

---

## Error Handling and Recovery

### Retry Strategy

If a task fails:

1. **Log the failure** -- Record what went wrong and why in `progress.md`
2. **Analyze the error** -- Read error messages thoroughly. Do not guess.
3. **Check learnings** -- Has this error pattern been seen before in this session?
4. **Retry with new approach** -- Apply what was learned. Do not repeat the same failing approach.

### The Three-Strike Rule

If a single task fails **three consecutive times**, STOP the loop. This signals a problem that requires human intervention:

- The task may be too large and needs splitting
- The acceptance criteria may be unclear or incorrect
- There may be a missing dependency or architectural issue
- The plan may need revision

**Report to the user:** What was attempted, what failed, what was learned, and a recommendation for how to proceed.

### Circuit Breaker Conditions

Stop the loop immediately if:

- Three consecutive task failures on the same task
- Tests that were previously passing now fail (regression detected)
- The same error message appears in three or more consecutive iterations
- Rate limits or API errors are encountered
- A task requires information or decisions not available in the plan

---

## Safeguards

### Preventing Infinite Loops

- **Max iterations:** If a maximum iteration count is specified, respect it absolutely.
- **No-progress detection:** If three consecutive iterations produce no meaningful change (no new commits, no task completions), stop and report.
- **Regression detection:** If a previously passing test starts failing, stop and investigate before continuing.

### Git Safety

- **Always commit on a feature branch**, never directly on main/master.
- **Never force push.** If there is a conflict, stop and report.
- **Each commit should be atomic** -- one task, one commit.
- **Use descriptive commit messages** that reference the task.

### Scope Discipline

- **Only implement what is in the plan.** Do not add features, refactor unrelated code, or "improve" things outside the current task.
- **If you discover something that needs fixing outside the plan,** log it as a note in `progress.md` but do not act on it.
- **YAGNI applies.** Do not build speculative abstractions or premature optimizations.

---

## Model Selection Guidance

When the user specifies or when auto-selecting based on task complexity:

| Task Type | Recommended Approach | Keywords |
|-----------|---------------------|----------|
| Simple fixes | Fast, focused execution | lint, format, fix typo, rename, clean, docs |
| Standard implementation | Balanced thoroughness | implement, create, add, build, feature, endpoint |
| Complex architecture | Deep reasoning, careful design | debug, architect, refactor, restructure, migrate, optimize |

---

## Iteration Prompt Structure

At the start of each iteration, internally follow this structure:

```
1. Read the plan file(s) to find the next uncompleted task (first [ ] item)
2. Read context.md (if it exists) to understand key files
3. Read progress.md to check for learnings from previous iterations
4. Implement the task:
   a. Write or modify the code
   b. Run tests/linter/typecheck
   c. If PASS: mark complete, commit, log progress
   d. If FAIL: log the failure, analyze, retry (up to 3 attempts)
5. Move to the next task
```

---

## Completion Protocol

When all tasks are marked complete:

1. **Run the full test suite** one final time to confirm no regressions
2. **Run typecheck/linter** to confirm clean output
3. **Review the progress log** for any noted issues that were deferred
4. **Report to the user:**
   - Total tasks completed
   - Total iterations (including retries)
   - Any deferred issues or notes
   - Summary of what was built
   - Any recommendations for follow-up work

**Only declare completion when ALL of the following are true:**
- Every task checkbox is marked `[x]`
- All tests pass
- Typecheck/linter passes
- No regressions detected

---

## Quick Start Examples

### Example 1: Start from a Feature Description

```
User: /ralph Build a REST API for managing todo items with CRUD operations and input validation.

Ralph will:
1. Create plans/260224-todo-api/plan.md with phased tasks
2. Create context.md with relevant existing files
3. Create empty progress.md
4. Begin the loop: implement task by task, test, commit, continue
5. Report completion when all tasks pass
```

### Example 2: Start from an Existing Plan

```
User: /ralph plans/260224-todo-api/

Ralph will:
1. Read the existing plan and find the first uncompleted task
2. Check progress.md for any learnings
3. Begin the loop from where it left off
4. Continue until all tasks are complete
```

### Example 3: Bounded Run

```
User: /ralph plans/260224-todo-api/ 5

Ralph will:
1. Read the plan, find next uncompleted task
2. Run up to 5 iterations
3. Stop after 5 iterations and report progress
4. User can resume later with another /ralph invocation
```

---

## Attribution

The Ralph technique originates from [Geoffrey Huntley's Ralph Wiggum methodology](https://ghuntley.com/ralph/) -- a philosophy of persistent, iterative AI-driven development. Implementations include the [official Anthropic ralph-wiggum plugin](https://github.com/anthropics/claude-code/blob/main/plugins/ralph-wiggum/README.md), [frankbria/ralph-claude-code](https://github.com/frankbria/ralph-claude-code), [snarktank/ralph](https://github.com/snarktank/ralph), [chrisdeuda/ralph-skill](https://github.com/chrisdeuda/ralph-skill), and [kroegha/Ralph-Skill](https://github.com/kroegha/Ralph-Skill).
