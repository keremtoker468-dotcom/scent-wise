---
name: verification-before-completion
description: Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running verification commands and confirming output before making any success claims; evidence before assertions always
---

# Verification Before Completion

## Overview

Claiming work is complete without verification is dishonesty, not efficiency.

**Core principle:** Evidence before claims, always.

**Violating the letter of this rule is violating the spirit of this rule.**

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command in this message, you cannot claim it passes.

## The Gate Function

```
BEFORE claiming any status or expressing satisfaction:

1. IDENTIFY: What command proves this claim?
2. RUN: Execute the FULL command (fresh, complete)
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
   - If NO: State actual status with evidence
   - If YES: State claim WITH evidence
5. ONLY THEN: Make the claim

Skip any step = lying, not verifying
```

## Common Failures

| Claim | Requires | Not Sufficient |
|-------|----------|-----------------|
| Tests pass | Test command output: 0 failures | Previous run, "should pass" |
| Linter clean | Linter output: 0 errors | Partial check, extrapolation |
| Build succeeds | Build command: exit 0 | Linter passing, logs look good |
| Bug fixed | Test original symptom: passes | Code changed, assumed fixed |
| Regression test works | Red-green cycle verified | Test passes once |
| Agent completed | VCS diff shows changes | Agent reports "success" |
| Requirements met | Line-by-line checklist | Tests passing |
| Type checks pass | Type checker output: 0 errors | Build succeeds, tests pass |

## Red Flags - STOP

- Using "should", "probably", "seems to"
- Expressing satisfaction before verification ("Great!", "Perfect!", "Done!", etc.)
- About to commit/push/PR without verification
- Trusting agent success reports
- Relying on partial verification
- Thinking "just this once"
- Tired and wanting work over
- **ANY wording implying success without having run verification**

## Rationalization Prevention

| Excuse | Reality |
|--------|---------|
| "Should work now" | RUN the verification |
| "I'm confident" | Confidence is not evidence |
| "Just this once" | No exceptions |
| "Linter passed" | Linter is not compiler |
| "Agent said success" | Verify independently |
| "I'm tired" | Exhaustion is not excuse |
| "Partial check is enough" | Partial proves nothing |
| "Different words so rule doesn't apply" | Spirit over letter |

## Key Patterns

**Tests:**
```
CORRECT: [Run test command] [See: 34/34 pass] "All tests pass"
WRONG:   "Should pass now" / "Looks correct"
```

**Linting and Type Checking:**
```
CORRECT: [Run linter] [See: 0 errors, 0 warnings] "Linter is clean"
CORRECT: [Run type checker] [See: 0 errors] "Type checks pass"
WRONG:   "I only changed one file so it should be fine"
```

**Regression tests (TDD Red-Green):**
```
CORRECT: Write -> Run (pass) -> Revert fix -> Run (MUST FAIL) -> Restore -> Run (pass)
WRONG:   "I've written a regression test" (without red-green verification)
```

**Build:**
```
CORRECT: [Run build] [See: exit 0] "Build passes"
WRONG:   "Linter passed" (linter doesn't check compilation)
```

**Requirements:**
```
CORRECT: Re-read plan -> Create checklist -> Verify each -> Report gaps or completion
WRONG:   "Tests pass, phase complete"
```

**Agent delegation:**
```
CORRECT: Agent reports success -> Check VCS diff -> Verify changes -> Report actual state
WRONG:   Trust agent report
```

## Self-Review Checklist Before Marking Work Done

Before declaring ANY task complete, walk through every item:

### 1. Run All Verification Commands
- [ ] Run the full test suite (not just related tests)
- [ ] Run the linter with zero errors and zero warnings
- [ ] Run the type checker with zero errors
- [ ] Run the build and confirm exit code 0
- [ ] Run any project-specific checks (formatting, security scans, etc.)

### 2. Review Changes Against Requirements
- [ ] Re-read the original task description or issue
- [ ] Create an explicit checklist of every requirement
- [ ] Verify each requirement is addressed with evidence
- [ ] Confirm no requirements were missed or partially implemented

### 3. Check for Edge Cases and Error Handling
- [ ] Identify boundary conditions for the changes made
- [ ] Verify error paths are handled (null, undefined, empty, overflow, timeout)
- [ ] Confirm invalid inputs produce meaningful errors, not crashes
- [ ] Check concurrency and race condition implications if applicable

### 4. Verify No Regressions Were Introduced
- [ ] Run the FULL test suite, not just new or modified tests
- [ ] Compare test counts before and after (no tests accidentally deleted)
- [ ] Check that previously passing tests still pass
- [ ] Verify no new warnings were introduced

### 5. Validate File Change Scope
- [ ] Review `git diff` to see exactly what changed
- [ ] Confirm no unintended files were modified
- [ ] Check for accidentally committed debug code, console logs, or TODOs
- [ ] Verify no sensitive data (keys, credentials, tokens) in the diff
- [ ] Ensure formatting-only changes are intentional, not noise

### 6. Confirm the Solution Solves the Stated Problem
- [ ] Reproduce the original problem scenario
- [ ] Apply the fix and verify the problem is resolved
- [ ] Test the fix from the user's perspective, not just the code's perspective
- [ ] Verify the fix does not introduce new problems in related areas

## Why This Matters

From documented failure patterns:
- Trust broken when claims don't match reality
- Undefined functions shipped that would crash at runtime
- Missing requirements shipped as incomplete features
- Time wasted on false completion leading to redirect and rework
- Unverified claims erode credibility over time

## When To Apply

**ALWAYS before:**
- ANY variation of success/completion claims
- ANY expression of satisfaction
- ANY positive statement about work state
- Committing, PR creation, task completion
- Moving to next task
- Delegating to agents

**Rule applies to:**
- Exact phrases
- Paraphrases and synonyms
- Implications of success
- ANY communication suggesting completion or correctness

## The Bottom Line

**No shortcuts for verification.**

Run the command. Read the output. THEN claim the result.

This is non-negotiable.
