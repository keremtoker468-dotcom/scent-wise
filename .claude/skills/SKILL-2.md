---
name: code-testing
description: "Best-in-class testing methodology for all code. Use this skill whenever Claude creates, modifies, debugs, or reviews code in any language — Python, JavaScript, TypeScript, HTML, or anything else. This includes writing new functions, scripts, components, or applications; editing existing code; fixing bugs; or when the user asks for tests, QA, validation, or 'make sure this works.' Also trigger when delivering code artifacts the user will rely on — tests must accompany the code. Covers risk classification, test plan generation, smoke, unit, property-based, contract, integration, regression, observability, and UI testing. Trigger even if the user doesn't explicitly ask for tests — quality code includes tests by default."
---

# Code Testing Skill

Best-in-class testing methodology. This skill makes testing operational, not optional.

## Core Workflow

Every code task follows this sequence. Do not skip steps.

```
1. CLASSIFY  → Risk tier (Critical/High/Medium/Low)
2. PLAN      → Generate test plan (template below)
3. STATIC    → Lint + type check (fail = stop)
4. TEST      → Write and run tests (pyramid order)
5. REVIEW    → SMURF review pass (flag violations)
6. REPORT    → Coverage + summary
```

---

## Step 1: Risk Classification

Before writing any tests, classify the code. State it explicitly.

| Trigger | Tier |
|---------|------|
| Handles money, financial calculations, transactions | **Critical** |
| Handles authentication, authorization, secrets | **Critical** |
| Transforms, validates, or persists user data | **Critical** |
| Core business logic driving decisions | **High** |
| API endpoint or external-facing interface | **High** |
| UI component or internal utility | **Medium** |
| Configuration, constants, thin wrappers | **Low** |

State the classification:
```
Risk Tier: CRITICAL — this function calculates portfolio returns
Required: Unit + property-based + integration + mutation strategy
Coverage target: ≥90% line, ≥80% branch, ≥90% change-based
```

---

## Step 2: Generate Test Plan

Produce this structured plan before writing test code. The risk tier determines which sections are required.

```
TEST PLAN
═════════════════════════════════════════════
CODE UNDER TEST:   [module/function and purpose]
RISK TIER:         [Critical / High / Medium / Low]

1. UNIT TEST PLAN
   - function_a() → [purpose, expected test count]
   - function_b() → [purpose, expected test count]

2. PROPERTY INVARIANTS (Critical/High)
   - [e.g., "output length == input length"]
   - [e.g., "roundtrip: decode(encode(x)) == x"]

3. EDGE-CASE MATRIX
   | Input Category  | Test Value         | Expected Behavior  |
   |-----------------|--------------------|--------------------|
   | Null/None       | None               | Raises ValueError  |
   | Empty           | "", [], {}         | Returns default    |
   | Boundary low    | 0, -1, MIN_INT     | [expected]         |
   | Boundary high   | MAX_INT            | [expected]         |
   | Type mismatch   | "abc" where int    | Raises TypeError   |

4. ERROR PATH CHECKLIST
   - [ ] Invalid input → [error type]
   - [ ] Missing data → [handling]
   - [ ] Dependency failure → [graceful degradation]
   - [ ] Timeout → [cleanup]

5. COVERAGE TARGETS
   Line: [target]%  Branch: [target]%  Change-based: ≥90%

6. MISSING CATEGORIES
   - Contract test needed? [Yes/No]
   - Integration test needed? [Yes/No]
   - Observability test needed? [Yes/No]

7. MUTATION CANDIDATES (Critical/High)
   - [function]: arithmetic operators
   - [function]: comparison operators

8. FLAKINESS RISKS
   - [ ] Network calls → mock
   - [ ] Time-dependent → freeze clock
   - [ ] Shared state → isolate
```

**Plan scope by tier:**
- **Critical/High:** All 8 sections required
- **Medium:** Sections 1, 3, 4, 5
- **Low:** Section 1 only (list smoke tests)

---

## Step 3: Static Analysis Gate

Run before any tests. Fail = stop.

```
Lint → Type Check → Security Scan → (proceed to tests)
```

For language-specific tools, read `references/languages/python.md` or `references/languages/javascript.md`.

---

## Step 4: Write and Run Tests

Execute in pyramid order. If any level fails, stop — don't run higher levels.

```
Smoke → Unit (+ property-based) → Contract → Integration → Observability → UI → Regression
```

### Test Type Quick Reference

**Smoke** — "Does it import/start/render?" Under 5 seconds. Every tier.

**Unit** — Isolated functions, mocked dependencies. Bulk of suite (60-70%).
- Naming: `test_<what>_<condition>_<expected>`
- Pattern: Arrange-Act-Assert
- Edge cases: null, empty, boundary, type mismatch, large input
- Every try/except must have a test triggering the except path
- For detailed patterns → read `references/patterns/test-design.md`

**Property-Based** — Test invariants across random inputs (Critical/High).
- Python: Hypothesis (`@given(st.integers())`)
- JS: fast-check (`fc.assert(fc.property(...))`)
- Target: ≥1 property test per function taking arbitrary input

**Contract** — Verify API/interface schemas match expectations (Critical/High).
- Validate against live schema where possible (catches drift)
- Tools: Pact, JSON Schema, custom validators

**Integration** — Test component interaction at boundaries.
- Real (test) dependencies where practical, mock what you can't control
- One interaction path per test (one happy OR one error)
- For mocking guidance → read `references/patterns/mocking-strategy.md`

**Observability** — Verify logs/metrics emission (Critical/High).
- Assert critical operations log at correct level
- Assert no PII appears in log output
- For examples → read `references/patterns/observability.md`

**UI/Component** — Test user-visible behavior, not implementation.
- Never assert on CSS class names or internal state
- Include accessibility checks (axe-core)

**Regression** — Mandatory for every bug fix.
1. Write test that reproduces the bug (verify it fails)
2. Fix the code
3. Verify test passes
4. Never delete regression tests

### Test Data Rules

- No PII — use obviously synthetic data (`"Test User Alpha"`, `"test@example.com"`)
- No production data or real credentials
- Teardown mandatory — clean up files, DB records, temp dirs
- Include only fields relevant to the assertion
- For fixtures/factories/data patterns → read `references/patterns/test-data.md`

---

## Step 5: SMURF Review Pass

After writing tests, scan for violations. Flag problems, don't score numerically.

| Dimension | Flag if... | Fix |
|-----------|-----------|-----|
| **Speed** | Unit test >500ms | Mock the slow dependency |
| **Speed** | Full unit suite >60s | Parallelize or split |
| **Maintainability** | Asserts on implementation details | Test behavior/public API |
| **Maintainability** | Breaks on refactor without behavior change | Decouple from structure |
| **Utilization** | Spins up heavy resources unnecessarily | Use mocks/fakes for unit |
| **Reliability** | Uses sleep(), real network, system clock, unseeded random | Mock time/network, seed RNG |
| **Reliability** | Depends on test execution order | Isolate with fresh fixtures |
| **Fidelity** | All tests use mocks, no real integration | Add boundary integration tests |

Output format:
```
SMURF REVIEW — [file]
⚠ SPEED:         [test] takes 3.2s → mock the API call
⚠ RELIABILITY:   [test] uses datetime.now() → freeze time
✓ UTILIZATION:   All tests lightweight
✓ FIDELITY:      Integration test covers real DB
```

Mandatory for **Critical/High**. Recommended for Medium.

---

## Step 6: Coverage and Reporting

### Coverage Targets

| Metric | Target |
|--------|--------|
| Line coverage (overall) | ≥80% |
| Branch coverage (overall) | ≥70% |
| Change-based coverage (new/modified lines) | ≥90% |
| Critical path line coverage | ≥90% |
| Mutation score (Critical paths) | ≥70% |

### Report Format

**On success:** Summary only.
```
Tests: 247 passed, 0 failed | Coverage: 83% line, 74% branch | 12.4s
```

**On failure:** Full diagnostic per failure — expected vs actual, input that caused it, file and line.

---

## Flaky Test Prevention

- Run new tests **5x in isolation** before considering them stable
- No `sleep()` — use explicit waits
- Seed all random generators
- Mock all network, time, filesystem
- No shared mutable state between tests
- If flaky: quarantine, fix within sprint, verify 10x before restoring

---

## What NOT to Test

- Third-party library internals
- Trivial getters/setters with no logic
- Private methods (test through public API)
- Implementation details (CSS classes, internal state)
- Constants and configuration values
- Tests that restate implementation (`assert add(2,3) == 2+3`)
- LLM eval harnesses (belongs in project-specific testing layer, not here)

---

## Anti-Patterns

| Anti-Pattern | Fix |
|-------------|-----|
| Testing after all code written | Write tests first or alongside |
| 100% coverage target | 80% line + mutation on critical paths |
| Shared mutable state between tests | Fresh setup per test |
| Mocking everything | Mock at boundaries only |
| `sleep()` in tests | Explicit waits with timeouts |
| Deleting failing tests | Fix the code, not the test |
| No assertion messages | Every assertion explains what went wrong |
| Snapshot tests without purpose | Only snapshot when exact output matters |

---

## Checklist: Before Shipping Code

**Planning**
- [ ] Risk tier classified and stated
- [ ] Test plan generated (sections per tier)

**Static**
- [ ] Lint, type check, security scan pass

**Tests**
- [ ] Smoke tests pass
- [ ] Unit tests with ≥90% critical path coverage
- [ ] Edge cases: null, empty, boundary, type mismatch
- [ ] Error paths: every try/except triggered
- [ ] Property-based tests (Critical/High)
- [ ] Contract tests (Critical/High)
- [ ] Integration tests (Critical/High)
- [ ] Observability tests (Critical/High)
- [ ] Regression tests for any bug fixes

**Data & Security**
- [ ] No PII in test data
- [ ] Teardown cleans up all created data
- [ ] No real secrets in test config

**Quality Gates**
- [ ] No flaky tests (5x isolation pass)
- [ ] Diagnostic failure messages on all assertions
- [ ] Change-based coverage ≥90%
- [ ] Overall ≥80% line, ≥70% branch
- [ ] SMURF review pass (Critical/High)

**Final**
- [ ] Code does what was requested

---

## Reference Files

Read these for detailed guidance on specific topics:

| When you need... | Read |
|-----------------|------|
| Python tools and patterns | `references/languages/python.md` |
| JavaScript/TypeScript tools | `references/languages/javascript.md` |
| HTML/CSS testing | `references/languages/html-css.md` |
| Test design patterns (AAA, parametrize, TDD) | `references/patterns/test-design.md` |
| Mocking strategy and test doubles | `references/patterns/mocking-strategy.md` |
| Observability test examples | `references/patterns/observability.md` |
| Test data management | `references/patterns/test-data.md` |
| Error path testing | `references/patterns/error-paths.md` |
| Root cause analysis protocol | `references/patterns/rca.md` |
| Advanced: mutation testing | `references/patterns/mutation-testing.md` |
| Advanced: fuzzing | `references/patterns/fuzzing.md` |
| Advanced: performance regression | `references/patterns/performance.md` |
