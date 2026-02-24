---
name: get-shit-done
description: >
  Lightweight meta-prompting, context engineering, and spec-driven development system.
  Solves context rot by orchestrating milestones, phases, plans, and subagents.
  Activates on "gsd", "get shit done", "/gsd:new-project", "/gsd:execute-phase",
  "/gsd:progress", or when asked to run the GSD workflow. Supports new projects,
  milestone planning, phase execution, verification, research, debugging, and
  codebase mapping through slash commands.
---

# Get Shit Done (GSD)

A meta-prompting and context engineering system for Claude Code that solves context rot — the quality degradation that happens as Claude fills its context window.

**Source:** [github.com/gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done)

---

## How It Works

GSD breaks work into a hierarchy:

```
Milestone (the big goal)
  └── Phase (a coherent chunk of work)
       └── Plan (a single implementable unit)
            └── Task (an atomic code change)
```

Each phase is planned, executed, and verified independently — keeping context windows small and focused.

---

## Core Concepts

### Context Engineering
- Each subagent gets only what it needs — no context bloat
- State is persisted to disk (`STATE.md`, `ROADMAP.md`, phase files)
- Checkpoints let you pause and resume without losing progress

### Spec-Driven Development
- Deep questioning extracts requirements before any code is written
- Requirements are locked before planning begins
- Plans reference specific requirements by ID

### Wave-Based Execution
- Plans within a phase are analyzed for dependencies
- Independent plans execute in parallel waves
- Dependent plans wait for their prerequisites

---

## Slash Commands

| Command | Purpose |
|---------|---------|
| `/gsd:new-project` | Initialize a new project (questioning → research → requirements → roadmap) |
| `/gsd:new-milestone` | Create a new milestone within an existing project |
| `/gsd:execute-phase` | Execute all plans in a phase via wave-based parallel execution |
| `/gsd:plan-phase` | Plan implementation details for a phase |
| `/gsd:verify-work` | Verify completed work against requirements |
| `/gsd:progress` | Show current project progress |
| `/gsd:resume-work` | Resume work from last checkpoint |
| `/gsd:pause-work` | Save state and pause |
| `/gsd:research-phase` | Research unknowns before planning |
| `/gsd:discuss-phase` | Discuss a phase before planning or executing |
| `/gsd:debug` | Diagnose and fix issues |
| `/gsd:map-codebase` | Analyze and document codebase structure |
| `/gsd:quick` | Quick task without full project setup |
| `/gsd:health` | Check project health and state |
| `/gsd:add-phase` | Add a new phase to the roadmap |
| `/gsd:insert-phase` | Insert a phase between existing phases |
| `/gsd:remove-phase` | Remove a phase from the roadmap |
| `/gsd:add-todo` | Add a TODO item |
| `/gsd:add-tests` | Add tests for completed work |
| `/gsd:check-todos` | Review outstanding TODOs |
| `/gsd:complete-milestone` | Finalize and archive a milestone |
| `/gsd:audit-milestone` | Audit milestone for gaps |
| `/gsd:cleanup` | Clean up project files |
| `/gsd:settings` | View/modify GSD settings |
| `/gsd:set-profile` | Set model profile for execution |
| `/gsd:update` | Update GSD to latest version |
| `/gsd:help` | Show available commands |

---

## Project Structure

After initialization, GSD creates:

```
.planning/
├── STATE.md              # Current project state
├── REQUIREMENTS.md       # Locked requirements
├── ROADMAP.md            # Milestone roadmap with phases
├── context.md            # Project context and conventions
├── milestone-1/
│   ├── phase-1-setup/
│   │   ├── plan-01-*.md  # Individual implementation plans
│   │   └── plan-02-*.md
│   ├── phase-2-core/
│   └── ...
└── research/             # Research outputs (if applicable)
```

---

## Workflow

### 1. New Project
```
/gsd:new-project
```
GSD asks deep questions about your idea, optionally researches the problem space, extracts requirements, and builds a phased roadmap.

### 2. Plan a Phase
```
/gsd:plan-phase 1
```
Breaks a phase into concrete implementation plans with tasks, each referencing requirement IDs.

### 3. Execute a Phase
```
/gsd:execute-phase 1
```
Orchestrates subagents to execute plans in dependency-ordered waves. Each plan is implemented and committed independently.

### 4. Verify
```
/gsd:verify-work
```
Verifies completed work against original requirements.

---

## Key Features

- **Subagent orchestration** — Dedicated agents for planning, execution, verification, research, and debugging
- **Model profiles** — Configure which models handle which tasks (executor, verifier, planner)
- **Git integration** — Automatic commits after each plan, optional branching strategies (per-phase or per-milestone)
- **Checkpoint system** — Pause and resume at any point without losing progress
- **Auto mode** — `/gsd:new-project --auto @prd.md` for hands-off project setup from a PRD
- **Parallel execution** — Independent plans execute concurrently in waves
- **Research phase** — Built-in web research before planning for unfamiliar domains
- **TDD support** — Test-driven development patterns integrated into execution
