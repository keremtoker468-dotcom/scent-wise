---
name: writing-plans
description: Create detailed implementation plans before writing code. Activate when facing multi-step tasks, new features, refactors, or any work that benefits from upfront planning. Triggers on requests like "plan this", "write a plan", "break this down", or when a spec/requirements/design document is provided and the next step is implementation.
---

# Writing Plans

## Overview

Write comprehensive implementation plans before touching code. The plan assumes the implementing engineer has zero prior context for the codebase. Document everything they need to know: which files to create or modify, what code to write, what tests to add, what documentation to check, and how to verify each step. Deliver the plan as a sequence of bite-sized, actionable tasks.

**Announce at start:** "I'm using the writing-plans skill to create the implementation plan."

**Save plans to:** `docs/plans/YYYY-MM-DD-<feature-name>.md`

## Core Principles

- **Plan before you build.** Resist the urge to start coding. Invest time upfront to think through the full scope.
- **DRY.** Don't repeat yourself -- in the plan or the code it describes.
- **YAGNI.** Only plan what is actually needed. Resist speculative features.
- **TDD.** Every task writes a failing test first, then the minimal implementation to make it pass.
- **Frequent commits.** Each task ends with a commit. Small, reviewable increments.
- **Assume the implementer is skilled but has no domain context.** They can write code, but they don't know this codebase, this toolset, or this problem domain well. Spell things out.

## Creating the Plan

### Step 1: Understand the Requirements

Before writing anything, gather and clarify:

- **Goal:** What is being built and why? Write a single sentence.
- **Scope:** What is in scope and what is explicitly out of scope?
- **Inputs:** What specs, designs, requirements, or prior discussions exist?
- **Constraints:** Performance targets, compatibility requirements, deadlines, technology restrictions.
- **Dependencies:** What existing code, services, or libraries does this depend on? What depends on this?

If requirements are ambiguous, list specific questions and resolve them before proceeding.

### Step 2: Identify Architecture and Trade-offs

Document key architectural decisions:

- **Approach:** Describe the chosen approach in 2-3 sentences.
- **Alternatives considered:** Briefly note other approaches and why they were rejected.
- **Trade-offs:** What are you gaining and giving up with this approach? (e.g., simplicity vs. flexibility, performance vs. maintainability)
- **Tech stack:** List key technologies, libraries, and frameworks involved.
- **Risk areas:** Where is complexity highest? What could go wrong?

### Step 3: Break Down into Tasks

Decompose the work into ordered tasks. Each task should be:

- **Small:** 2-5 minutes of focused work. One logical change.
- **Independent where possible:** Minimize coupling between tasks, but respect real dependencies.
- **Ordered by dependency:** A task never references code that hasn't been written in a prior task.
- **Complete:** Contains all file paths, code, commands, and expected outputs.

**Ordering rules:**
1. Infrastructure and configuration first (project setup, dependencies, config files).
2. Data models and types before business logic.
3. Core logic before integrations and UI.
4. Tests accompany every task (TDD: test first, then implementation).
5. Documentation and cleanup last.

### Step 4: Identify Edge Cases and Blockers

For each task or for the plan as a whole, explicitly call out:

- **Edge cases:** Unusual inputs, boundary conditions, empty states, error paths, concurrent access, large data volumes.
- **Potential blockers:** Missing APIs, unclear requirements, external dependencies, permissions, environment setup.
- **Mitigations:** For each blocker, describe how to handle or work around it.

### Step 5: Estimate Scope and Complexity

Provide a summary estimate:

- **Total number of tasks.**
- **Estimated total time** (sum of task estimates).
- **Complexity rating:** Low / Medium / High, with a brief justification.
- **Confidence level:** How confident are you that the plan is complete? Note any areas of uncertainty.

### Step 6: Define Acceptance Criteria

Write clear, testable acceptance criteria for the overall feature:

```markdown
## Acceptance Criteria

- [ ] [Criterion 1: specific, observable, testable behavior]
- [ ] [Criterion 2: ...]
- [ ] All new code has test coverage
- [ ] All tests pass
- [ ] No regressions in existing tests
- [ ] Code reviewed and approved
```

Each criterion must be verifiable by running a command, observing a behavior, or checking a measurable outcome. Avoid vague criteria like "works correctly."

## Plan Document Format

Every plan MUST use this structure:

```markdown
# [Feature Name] Implementation Plan

**Goal:** [One sentence describing what this builds and why]

**Architecture:** [2-3 sentences about the chosen approach]

**Alternatives Considered:**
- [Alternative 1]: Rejected because [reason]
- [Alternative 2]: Rejected because [reason]

**Trade-offs:** [What this approach gains and gives up]

**Tech Stack:** [Key technologies, libraries, frameworks]

**Dependencies:** [What this work depends on; what depends on this work]

**Risk Areas:** [Where complexity is highest; what could go wrong]

**Scope Estimate:** [N tasks, ~X minutes total, Complexity: Low/Medium/High]

**Confidence:** [High/Medium/Low -- brief note on uncertainty areas]

---

## Acceptance Criteria

- [ ] [Specific, testable criterion]
- [ ] [Specific, testable criterion]
- [ ] All new code has test coverage
- [ ] All tests pass
- [ ] No regressions in existing tests

---

## Edge Cases and Blockers

- **Edge case:** [description] -- handled in Task N
- **Blocker:** [description] -- mitigation: [approach]

---

## Tasks

### Task 1: [Component/Feature Name]

**Files:**
- Create: `exact/path/to/new_file.py`
- Modify: `exact/path/to/existing_file.py` (lines ~XX-YY)
- Test: `tests/exact/path/to/test_file.py`

**Step 1: Write the failing test**

    ```python
    def test_specific_behavior():
        result = function_under_test(input_value)
        assert result == expected_value
    ```

**Step 2: Run the test to verify it fails**

    Run: `pytest tests/path/test_file.py::test_specific_behavior -v`
    Expected: FAIL with "[specific error message]"

**Step 3: Write the minimal implementation**

    ```python
    def function_under_test(input_value):
        return expected_value
    ```

**Step 4: Run the test to verify it passes**

    Run: `pytest tests/path/test_file.py::test_specific_behavior -v`
    Expected: PASS

**Step 5: Commit**

    ```bash
    git add tests/path/test_file.py src/path/new_file.py
    git commit -m "feat: add specific behavior for component"
    ```

---

### Task 2: [Next Component/Feature Name]
...
```

## Task Granularity

Each step within a task is ONE action:

- "Write the failing test" -- one step
- "Run the test to verify it fails" -- one step
- "Write the minimal implementation" -- one step
- "Run the test to verify it passes" -- one step
- "Commit" -- one step

If a task has more than 5 steps, it is too large. Split it.

## Plan Quality Checklist

Before finalizing the plan, verify every item:

- [ ] Every task has exact file paths (no placeholders like "the config file")
- [ ] Every task has complete code (not "add validation" -- show the actual validation code)
- [ ] Every task has runnable test commands with expected output
- [ ] Every task has clear success criteria
- [ ] Tasks are ordered by dependency (nothing references code from a later task)
- [ ] Edge cases are identified and addressed in specific tasks
- [ ] Blockers are identified with mitigations
- [ ] Architectural decisions and trade-offs are documented
- [ ] Acceptance criteria are specific and testable
- [ ] Scope estimate is provided
- [ ] The plan is DRY (no duplicated logic across tasks)
- [ ] The plan follows YAGNI (no speculative features)

## Reviewing and Iterating

After writing the plan, review it:

1. **Read it as the implementer.** Could someone with no context follow this plan start to finish without asking questions?
2. **Check dependency order.** Walk through the tasks sequentially. Does each task have everything it needs from prior tasks?
3. **Verify completeness.** Are there gaps between the last task and the acceptance criteria? If acceptance criteria aren't fully covered, add tasks.
4. **Challenge scope.** Is every task necessary? Can any be removed or combined without losing clarity?
5. **Stress-test edge cases.** For each edge case, trace through the plan to confirm it is handled.

If the plan fails any of these checks, revise it before presenting.

## Presenting the Plan

After saving the plan, present a summary:

**"Plan complete and saved to `docs/plans/<filename>.md`."**

Then provide:
- A brief summary of the approach
- The total number of tasks and estimated time
- Any open questions or areas of uncertainty
- A recommendation for how to proceed (e.g., execute sequentially, parallelize independent tasks, resolve blockers first)

Ask for feedback before execution begins. Plans are living documents -- update them as new information emerges during implementation.
