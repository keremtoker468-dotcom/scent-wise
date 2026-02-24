---
name: systematic-debugging
description: Four-phase hypothesis-driven debugging methodology with root cause analysis. Activates when investigating bugs, fixing test failures, diagnosing runtime errors, troubleshooting unexpected behavior, analyzing performance issues, or resolving race conditions. Enforces NO FIXES WITHOUT ROOT CAUSE FIRST.
---

# Systematic Debugging

## Iron Law

**NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST.**

Never apply symptom-focused patches that mask underlying problems. Understand WHY something fails before attempting to fix it. Symptom fixes are failures, not solutions.

Systematic debugging achieves ~95% first-time fix rate vs ~40% with ad-hoc approaches. The investment in investigation pays for itself.

---

## The Four-Phase Framework

### Phase 1: Root Cause Investigation

Before touching any code:

1. **Read error messages thoroughly** - Every word matters. Do not skim stack traces.
2. **Reproduce the issue consistently** - If you cannot reproduce it, you cannot verify a fix.
3. **Examine recent changes** - What changed before this started failing? Use `git log`, `git diff`, and `git bisect`.
4. **Gather diagnostic evidence** - Logs, stack traces, state dumps, network traces.
5. **Trace data flow backward** - Follow the call chain to find where bad values originate.

#### Root Cause Tracing Technique

```
1. Observe the symptom     - Where does the error manifest?
2. Find immediate cause    - Which code directly produces the error?
3. Ask "What called this?" - Map the call chain upward
4. Keep tracing up         - Follow invalid data backward through the stack
5. Find original trigger   - Where did the problem actually start?
```

**Key principle:** Never fix problems solely where errors appear -- always trace to the original trigger.

#### Diagnostic Logging Strategy

When adding debug logging, use a consistent tagged format for easy filtering:

```
[DEBUG][hypothesis-name][module:function] descriptive message with values
```

Route debug output to files rather than stdout when possible to protect terminal context. Query logs surgically with `grep` and `tail` rather than dumping raw output.

### Phase 2: Pattern Analysis

1. **Locate working examples** - Find similar code that works correctly.
2. **Compare implementations completely** - Do not just skim. Read every line.
3. **List all differences** - What is different between working and broken code?
4. **Understand dependencies** - What does this code depend on? What depends on it?
5. **Check assumptions** - Are there implicit assumptions that no longer hold?

### Phase 3: Hypothesis and Testing

Apply the scientific method:

1. **Formulate ONE clear hypothesis** - "The error occurs because X"
2. **Design a minimal test** - Change ONE variable at a time
3. **Predict the outcome** - What should happen if the hypothesis is correct?
4. **Run the test** - Execute and observe
5. **Compare actual vs predicted** - Did it behave as predicted?
6. **Iterate or proceed** - Refine hypothesis if wrong, implement if right

Never test multiple hypotheses simultaneously. Changing multiple variables makes results uninterpretable.

### Phase 4: Implementation

1. **Create a failing test case** - Captures the bug behavior before you fix it
2. **Implement a single fix** - Address root cause, not symptoms
3. **Verify the test passes** - Confirms the fix works
4. **Run the full test suite** - Ensure no regressions
5. **Verify red-to-green** - Test passes with fix, fails without it

#### The Three-Strike Rule

**Critical:** If THREE or more fixes fail consecutively, STOP. This signals architectural problems requiring discussion, not more patches. Document findings and reassess the approach.

---

## Red Flags -- Process Violations

Stop immediately if you catch yourself thinking:

- "Quick fix for now, investigate later"
- "One more fix attempt" (after multiple failures)
- "This should work" (without understanding why)
- "Let me just try..." (without a hypothesis)
- "It works on my machine" (without investigating the difference)
- "It's probably just..." (dismissing without evidence)

Each of these signals a deviation from systematic debugging back toward guessing.

---

## Using Logs, Stack Traces, and Error Messages Effectively

### Stack Traces

- Read from **bottom to top** for the call chain, **top to bottom** for the triggering point.
- Identify the boundary between your code and library/framework code.
- Focus on the **last frame in your code** before entering library code.
- Check for "Caused by" chains -- the innermost cause is usually the real problem.

### Error Messages

- Parse the message into: **what** went wrong, **where** it happened, and **what was expected**.
- Search the codebase for the exact error message text to find where it is thrown.
- If the message includes values, note what those values are vs what was expected.

### Log Analysis

- Establish the **timeline** of events leading to the failure.
- Look for the **last successful operation** before the failure.
- Compare logs from a working run vs a failing run.
- Search for warnings or errors that precede the main failure -- cascading failures often have an earlier root cause.

---

## Binary Search / Bisection for Isolating Issues

### Git Bisect

When a regression is introduced and you know a good commit and a bad commit:

```bash
git bisect start
git bisect bad                  # Current commit is broken
git bisect good <known-good>    # This commit was working
# Git checks out a midpoint; test it, then:
git bisect good   # or
git bisect bad
# Repeat until the breaking commit is identified
git bisect reset  # Return to original state
```

Automate with a test script:
```bash
git bisect run ./test-script.sh
```

### Code Bisection

When bisecting within a single change:

1. Comment out half the suspect code.
2. Test. Does the bug persist?
3. If yes, the bug is in the remaining half. If no, it is in the commented-out half.
4. Repeat on the identified half until the offending lines are isolated.

### Configuration Bisection

For environment or configuration issues:

1. Start with a known-good configuration.
2. Apply half the differences.
3. Test and narrow down which configuration change introduces the problem.

---

## Reproducing Bugs Reliably

Reproduction is **mandatory** before fixing. Ranked by effectiveness:

1. **Automated test** - A failing unit/integration test is the gold standard.
2. **Standalone script** - A minimal script that triggers the bug outside the test framework.
3. **API call** - A `curl` command or HTTP request that triggers the issue.
4. **Loop-based reproduction** - For intermittent bugs, a loop that runs until failure occurs.
5. **Manual steps** - Documented step-by-step reproduction as a last resort.

### Making Intermittent Bugs Reproducible

- Increase logging around the suspect area.
- Add assertions that fail fast when invalid state is detected.
- Introduce stress conditions (higher concurrency, larger data sets, constrained resources).
- Fix the random seed if randomness is involved.
- Use deterministic scheduling tools for concurrency issues.

### The Commit Hack

Commit your reproduction test/script **before** adding debug instrumentation. This allows you to use `git restore .` to cleanly remove all debug logging while preserving the reproduction test.

---

## Common Bug Patterns and Anti-Patterns

### Frequent Root Causes

| Pattern | Description |
|---------|-------------|
| Off-by-one errors | Incorrect loop bounds, fence-post errors in indexing |
| Null/undefined access | Missing null checks, uninitialized variables |
| State mutation | Shared mutable state modified unexpectedly |
| Type coercion | Implicit type conversions producing unexpected results |
| Stale closures | Closures capturing outdated variable references |
| Resource leaks | Unclosed connections, file handles, event listeners |
| Incorrect defaults | Default values that are wrong for certain code paths |
| Missing error handling | Swallowed exceptions, unchecked error returns |
| Boundary conditions | Edge cases at limits of valid input ranges |
| Encoding issues | Character encoding mismatches, especially UTF-8 vs Latin-1 |

### Anti-Patterns in Bug Fixing

- **Shotgun debugging** - Making random changes and hoping something works.
- **Cargo cult fixes** - Copying solutions from Stack Overflow without understanding them.
- **Fix and pray** - Applying a fix without a test to verify it.
- **Whack-a-mole** - Fixing symptoms as they appear without investigating the root cause.
- **Gold plating during debug** - Refactoring or adding features while debugging.
- **Blame the tools** - Assuming the compiler, framework, or OS is wrong before checking your code.

---

## Debugging Strategies by Issue Type

### Runtime Errors (Crashes, Exceptions)

```
1. Capture the full stack trace
2. Identify the exact line that throws
3. Check what values are null, undefined, or out of range
4. Trace backward to find where the bad value originated
5. Add validation at the source, not at the crash site
```

### Logic Errors (Wrong Output, Incorrect Behavior)

```
1. Define the expected behavior precisely
2. Identify the exact point where actual diverges from expected
3. Add assertions at intermediate steps to narrow the gap
4. Check conditionals -- are the boolean expressions correct?
5. Check arithmetic -- operator precedence, integer overflow, floating-point precision
6. Check data transformations -- is each step producing the expected shape/values?
```

### Performance Issues

```
1. Measure before optimizing -- use profiling tools, not intuition
2. Identify the bottleneck -- CPU, memory, I/O, network?
3. Check algorithmic complexity -- is an O(n^2) hiding in a loop?
4. Look for N+1 query patterns in database access
5. Check for unnecessary work -- redundant computations, repeated allocations
6. Profile memory usage -- look for leaks, excessive garbage collection
7. Verify caching is working as expected
```

### Race Conditions and Concurrency Bugs

```
1. Identify all shared mutable state
2. Map the timing dependencies between concurrent operations
3. Look for missing locks, incorrect lock ordering, or missing atomicity
4. Check for assumptions about execution order
5. Use thread-safe data structures or proper synchronization
6. Test under high concurrency -- increase thread count, add random delays
7. Use race detection tools (e.g., Go race detector, ThreadSanitizer)
```

### Intermittent / Flaky Failures

```
1. Run in a loop to determine failure frequency
2. Look for race conditions and timing dependencies
3. Check for shared mutable state across tests
4. Examine test isolation -- are tests leaking state?
5. Check for external dependencies (network, filesystem, time)
6. Add deterministic controls -- fixed seeds, mocked clocks, stubbed I/O
```

### Environment-Specific Bugs ("Works on My Machine")

```
1. Compare environments precisely -- OS, runtime version, dependencies, config
2. Check environment variables and configuration files
3. Verify dependency versions match exactly (lock files)
4. Check filesystem differences -- paths, permissions, line endings
5. Test in a clean environment (container, fresh VM)
```

---

## When to Use Print Debugging vs Debugger Tools

### Print / Log Debugging Is Best When

- The bug involves **timing or ordering** of events (debugger breakpoints alter timing).
- You need to see behavior **across many iterations** of a loop.
- The issue is in **production** or a remote environment without debugger access.
- You are working in an **async or multi-threaded** context where stepping is impractical.
- You want a **persistent record** of execution flow to compare across runs.
- The codebase is **unfamiliar** and you want a broad overview of flow.

### Interactive Debugger Is Best When

- You need to **inspect complex state** (deep object trees, large data structures).
- You want to **test hypotheses interactively** by modifying values at runtime.
- The bug is in a **specific narrow code path** that is easy to reach with breakpoints.
- You need to **step through logic** to understand control flow.
- The issue involves **subtle value differences** that are hard to spot in logs.

### Combined Approach

Use logging to narrow down the general area, then attach a debugger to step through the specific section. This gives you the breadth of logging with the depth of interactive debugging.

---

## Post-Mortem Analysis and Prevention

After fixing a bug, conduct a brief post-mortem:

### Document the Bug

1. **What was the symptom?** - How did the bug manifest to users or tests?
2. **What was the root cause?** - What was the actual underlying problem?
3. **Why was it introduced?** - What process gap allowed this bug in?
4. **How was it found?** - Was it caught by tests, monitoring, or users?
5. **How was it fixed?** - What was the actual code change?

### Prevent Recurrence

1. **Add regression tests** - Ensure this specific bug can never recur undetected.
2. **Add defense-in-depth** - Validation at multiple layers, not just the fix point.
3. **Update linting or static analysis** - Can tooling catch this class of bug automatically?
4. **Improve error messages** - If the original error message was misleading, improve it.
5. **Document the pattern** - Add to team knowledge base if it is a novel failure mode.
6. **Review similar code** - Search for the same pattern elsewhere in the codebase.

### Systemic Improvements

- If the bug class is recurring, consider **architectural changes** rather than more patches.
- If it was missed by testing, consider **improving test coverage strategy**.
- If it was hard to diagnose, consider **improving observability** (logging, metrics, tracing).

---

## Safety Practices

### Before Debugging

- Create a branch or stash changes before making investigative modifications.
- Note the current working state so you can return to it.

### During Debugging

- Keep debug instrumentation clearly tagged for easy removal.
- Do not mix debugging changes with feature changes.
- Commit reproduction tests separately from debug logging.

### After Debugging

- Remove all debug instrumentation (use `git restore .` if you followed the commit hack).
- Verify the final commit contains only the fix and the regression test.
- Run the full test suite one final time.

---

## Debugging Checklist

Before claiming a bug is fixed:

- [ ] Root cause identified and documented
- [ ] Hypothesis formed and tested
- [ ] Fix addresses root cause, not symptoms
- [ ] Failing test created that reproduces the bug
- [ ] Test passes with the fix applied
- [ ] Test fails without the fix (red-to-green verification)
- [ ] Full test suite passes with no regressions
- [ ] No "quick fix" rationalization was used
- [ ] Fix is minimal and focused
- [ ] Debug instrumentation has been removed
- [ ] Post-mortem notes recorded for future reference
