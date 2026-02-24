---
name: test-driven-development
description: Use when implementing any feature or bugfix, before writing implementation code. Enforces RED-GREEN-REFACTOR cycle, test-first discipline, and systematic testing practices across languages and frameworks.
---

# Test-Driven Development (TDD)

## Overview

Write the test first. Watch it fail. Write minimal code to pass.

**Core principle:** If you didn't watch the test fail, you don't know if it tests the right thing.

**Violating the letter of the rules is violating the spirit of the rules.**

## When to Use

**Always:**
- New features
- Bug fixes
- Refactoring
- Behavior changes

**Exceptions (ask your human partner):**
- Throwaway prototypes
- Generated code (e.g., scaffolding, migrations)
- Configuration files
- Trivial one-line changes with no logic

Thinking "skip TDD just this once"? Stop. That's rationalization.

## When TDD Is Most Valuable vs When to Adapt

**TDD is most valuable for:**
- Business logic and domain rules
- Data transformations and validation
- API contract verification
- Bug fixes (write a test that reproduces the bug first)
- Code that will be maintained long-term
- Anything with edge cases

**Adapt the approach (but still test) for:**
- Exploratory prototypes: Explore freely, then delete and rebuild with TDD
- UI layout and styling: Visual regression tools may be more effective than unit tests
- Glue code with no logic: Simple wiring between components; integration tests suffice
- Performance-critical hot paths: Profile first, then TDD the optimized version
- Third-party API wrappers: Integration tests against real (or sandboxed) APIs add more value

Even in adapted cases, tests are mandatory. The adaptation is in when you write them and at what granularity, not whether you write them.

## The Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Write code before the test? Delete it. Start over.

**No exceptions:**
- Don't keep it as "reference"
- Don't "adapt" it while writing tests
- Don't look at it
- Delete means delete

Implement fresh from tests. Period.

## Red-Green-Refactor

### RED - Write Failing Test

Write one minimal test showing what should happen.

**Good:**
```typescript
test('retries failed operations 3 times', async () => {
  let attempts = 0;
  const operation = () => {
    attempts++;
    if (attempts < 3) throw new Error('fail');
    return 'success';
  };

  const result = await retryOperation(operation);

  expect(result).toBe('success');
  expect(attempts).toBe(3);
});
```
Clear name, tests real behavior, one thing.

**Bad:**
```typescript
test('retry works', async () => {
  const mock = jest.fn()
    .mockRejectedValueOnce(new Error())
    .mockRejectedValueOnce(new Error())
    .mockResolvedValueOnce('success');
  await retryOperation(mock);
  expect(mock).toHaveBeenCalledTimes(3);
});
```
Vague name, tests mock not code.

**Requirements:**
- One behavior per test
- Clear, descriptive name
- Real code (no mocks unless unavoidable)

### Verify RED - Watch It Fail

**MANDATORY. Never skip.**

Run the test. Confirm:
- Test fails (not errors from typos or missing imports)
- Failure message is what you expected
- Fails because the feature is missing, not because of setup problems

**Test passes?** You're testing existing behavior. Fix or replace the test.

**Test errors?** Fix the error, re-run until it fails correctly.

### GREEN - Minimal Code

Write the simplest code to pass the test.

**Good:**
```typescript
async function retryOperation<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === 2) throw e;
    }
  }
  throw new Error('unreachable');
}
```
Just enough to pass.

**Bad:**
```typescript
async function retryOperation<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    backoff?: 'linear' | 'exponential';
    onRetry?: (attempt: number) => void;
  }
): Promise<T> {
  // YAGNI - over-engineered without tests demanding it
}
```

Don't add features, refactor other code, or "improve" beyond what the test demands.

### Verify GREEN - Watch It Pass

**MANDATORY.**

Run the test. Confirm:
- The new test passes
- All other tests still pass
- Output is pristine (no errors, no warnings)

**Test fails?** Fix code, not the test.

**Other tests fail?** Fix them now before proceeding.

### REFACTOR - Clean Up

After green only:
- Remove duplication
- Improve names
- Extract helpers
- Simplify structure

Keep all tests green throughout. Do not add new behavior during refactoring.

### Repeat

Next failing test for the next behavior.

## Test Naming Conventions

Good test names describe the behavior being tested, not the implementation. They serve as documentation.

### Pattern: `[unit] [condition] [expected result]`

```typescript
// Good - describes behavior
test('submitForm rejects empty email with validation error', ...);
test('retryOperation stops after 3 failed attempts', ...);
test('parseConfig returns defaults when file is missing', ...);

// Bad - vague or implementation-focused
test('test1', ...);
test('submitForm works', ...);
test('calls the validator', ...);
```

### Naming rules

| Rule | Example |
|------|---------|
| Name describes behavior, not implementation | "rejects invalid email" not "calls regex" |
| "and" in name means split into two tests | "validates and saves" should be two tests |
| Include the condition/scenario | "when user is admin, shows dashboard" |
| State expected outcome | "returns empty array" not "handles edge case" |

### Language-specific conventions

**JavaScript/TypeScript (Jest, Vitest):**
```typescript
describe('UserService', () => {
  describe('createUser', () => {
    it('creates user with valid email', () => {});
    it('throws ValidationError for duplicate email', () => {});
  });
});
```

**Python (pytest):**
```python
def test_create_user_with_valid_email():
    ...

def test_create_user_raises_on_duplicate_email():
    ...

class TestUserService:
    def test_returns_none_for_missing_user(self):
        ...
```

**Go:**
```go
func TestCreateUser_ValidEmail(t *testing.T) { ... }
func TestCreateUser_DuplicateEmail_ReturnsError(t *testing.T) { ... }

// Table-driven:
func TestCreateUser(t *testing.T) {
    tests := []struct{
        name string
        ...
    }{
        {"valid email creates user", ...},
        {"duplicate email returns error", ...},
    }
}
```

**Rust:**
```rust
#[cfg(test)]
mod tests {
    #[test]
    fn create_user_with_valid_email_succeeds() { ... }

    #[test]
    fn create_user_with_duplicate_email_returns_error() { ... }
}
```

## Test Granularity: Unit, Integration, and E2E

### The Testing Pyramid

```
        /  E2E  \        Few, slow, high confidence
       /----------\
      / Integration \    Some, moderate speed
     /----------------\
    /    Unit Tests     \  Many, fast, focused
   /--------------------\
```

### Unit Tests

**What:** Test a single function, method, or component in isolation.

**When to write first:** Business logic, data transformations, pure functions, validation rules.

**Characteristics:**
- Fast (milliseconds)
- No external dependencies (no database, no network, no filesystem)
- Test one behavior per test
- Use dependency injection to isolate

```typescript
// Unit test - pure logic, no I/O
test('calculateDiscount applies 10% for orders over $100', () => {
  const result = calculateDiscount({ subtotal: 150 });
  expect(result).toBe(15);
});
```

### Integration Tests

**What:** Test how multiple units work together, or how code interacts with external systems.

**When to write first:** Database queries, API endpoints, middleware chains, component trees with state.

**Characteristics:**
- Moderate speed (seconds)
- May use real databases (test instances), real HTTP, real filesystem
- Test workflows and data flow across boundaries

```typescript
// Integration test - tests the full request/response cycle
test('POST /users creates user and returns 201', async () => {
  const response = await request(app)
    .post('/users')
    .send({ email: 'alice@example.com', name: 'Alice' });

  expect(response.status).toBe(201);
  expect(response.body.email).toBe('alice@example.com');

  // Verify in database
  const user = await db.users.findByEmail('alice@example.com');
  expect(user).toBeDefined();
});
```

### End-to-End (E2E) Tests

**What:** Test complete user workflows through the full stack.

**When to write first:** Critical user journeys, smoke tests for deployment verification.

**Characteristics:**
- Slow (seconds to minutes)
- Exercise the entire system as a user would
- Catch integration issues unit tests miss
- More expensive to maintain

```typescript
// E2E test - full user workflow
test('user can register, log in, and view dashboard', async ({ page }) => {
  await page.goto('/register');
  await page.fill('[name=email]', 'alice@example.com');
  await page.fill('[name=password]', 'securePass123');
  await page.click('button[type=submit]');

  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('h1')).toHaveText('Welcome, alice@example.com');
});
```

### Choosing What to Test First

| Scenario | Start with | Why |
|----------|-----------|-----|
| New business rule | Unit test | Fast feedback, isolates logic |
| New API endpoint | Integration test | Tests the full request path |
| Bug fix | Whichever level reproduces the bug | Prove the bug exists, then fix it |
| New UI component | Unit/component test | Test behavior, not appearance |
| Critical user flow | E2E test | Validates the complete journey |
| Database query | Integration test | Must verify real query behavior |
| Utility function | Unit test | Pure logic, fast to test |

**General rule:** Start at the lowest level that gives you confidence. Move up when the interaction between components is the thing you need to verify.

## Mocking and Stubbing Strategies

### When to Mock

Mock when the real dependency is:
- **Slow:** Network calls, database queries in unit tests
- **Non-deterministic:** Time, random numbers, external APIs
- **Destructive:** Payment processing, email sending, file deletion
- **Unavailable:** Third-party service not accessible in CI

### When NOT to Mock

- **Your own code:** If you're mocking your own modules extensively, your design is too coupled
- **The thing under test:** Never mock the subject of your test
- **Everything:** If your test is mostly mock setup, use an integration test instead

### Mocking Hierarchy (Prefer Higher)

1. **No mock** - Use real implementations when possible
2. **Fake** - Lightweight in-memory implementation (e.g., in-memory database)
3. **Stub** - Returns canned responses, no behavior verification
4. **Spy** - Wraps real implementation, records calls
5. **Mock** - Full replacement with expectations; use as last resort

### Language-Specific Mocking Patterns

**TypeScript/JavaScript (Jest/Vitest):**
```typescript
// Stub: Replace module with controlled return
jest.mock('./emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue({ sent: true }),
}));

// Spy: Observe without replacing
const spy = jest.spyOn(logger, 'warn');
doSomethingRisky();
expect(spy).toHaveBeenCalledWith('risk detected');

// Factory: Reusable test data
const getMockUser = (overrides?: Partial<User>): User => ({
  id: 'user-123',
  name: 'Alice',
  email: 'alice@example.com',
  role: 'user',
  ...overrides,
});
```

**Python (pytest + unittest.mock):**
```python
from unittest.mock import patch, MagicMock

# Stub with patch
@patch('myapp.services.email.send_email')
def test_registration_sends_welcome_email(mock_send):
    mock_send.return_value = True
    register_user("alice@example.com")
    mock_send.assert_called_once_with("alice@example.com", subject="Welcome")

# Fixture as factory
@pytest.fixture
def make_user():
    def _make_user(**overrides):
        defaults = {"id": "123", "name": "Alice", "email": "alice@example.com"}
        defaults.update(overrides)
        return User(**defaults)
    return _make_user
```

**Go (interfaces + test doubles):**
```go
// Define interface for dependency
type EmailSender interface {
    Send(to, subject, body string) error
}

// Fake implementation for tests
type fakeEmailSender struct {
    sent []string
}

func (f *fakeEmailSender) Send(to, subject, body string) error {
    f.sent = append(f.sent, to)
    return nil
}

func TestRegisterUser_SendsWelcomeEmail(t *testing.T) {
    sender := &fakeEmailSender{}
    svc := NewUserService(sender)

    err := svc.Register("alice@example.com")

    require.NoError(t, err)
    assert.Equal(t, []string{"alice@example.com"}, sender.sent)
}
```

**Rust (trait objects + test implementations):**
```rust
trait EmailSender {
    fn send(&self, to: &str, subject: &str) -> Result<(), SendError>;
}

struct FakeEmailSender {
    sent: RefCell<Vec<String>>,
}

impl EmailSender for FakeEmailSender {
    fn send(&self, to: &str, _subject: &str) -> Result<(), SendError> {
        self.sent.borrow_mut().push(to.to_string());
        Ok(())
    }
}

#[test]
fn register_sends_welcome_email() {
    let sender = FakeEmailSender { sent: RefCell::new(vec![]) };
    let svc = UserService::new(&sender);

    svc.register("alice@example.com").unwrap();

    assert_eq!(sender.sent.borrow().as_slice(), &["alice@example.com"]);
}
```

### Mocking Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Testing mock behavior | Verifies mock exists, not that code works | Test real component behavior |
| Test-only methods in production | Pollutes production API, dangerous if called | Move to test utilities |
| Mocking without understanding | Mock removes side effects test depends on | Understand dependency chain first, mock minimally |
| Incomplete mocks | Missing fields cause silent downstream failures | Mirror real data structures completely |
| Mock setup longer than test | Test is unreadable, fragile | Use integration test or simplify design |

**The iron rule:** Mock the COMPLETE data structure as it exists in reality, not just the fields your immediate test uses.

## TDD for Different Languages and Frameworks

### JavaScript/TypeScript

**Frameworks:** Jest, Vitest, Mocha, Testing Library

**Run tests:**
```bash
npm test path/to/test.test.ts     # Jest/Vitest
npx vitest run path/to/test.ts    # Vitest
```

**Key patterns:**
- Use `@testing-library/*` for component tests (test behavior, not DOM structure)
- Prefer `screen.getByRole()` over `getByTestId()` for accessibility
- Use `describe`/`it` blocks for organization
- `beforeEach` with `jest.clearAllMocks()` to prevent test pollution

### Python

**Frameworks:** pytest, unittest

**Run tests:**
```bash
pytest path/to/test_module.py -v
pytest -k "test_specific_function"
```

**Key patterns:**
- Use pytest fixtures for setup/teardown and dependency injection
- Use `@pytest.mark.parametrize` for data-driven tests
- Use `conftest.py` for shared fixtures
- Prefer `pytest.raises` for exception testing

```python
@pytest.mark.parametrize("email,valid", [
    ("alice@example.com", True),
    ("", False),
    ("no-at-sign", False),
    ("@no-local", False),
])
def test_email_validation(email, valid):
    assert is_valid_email(email) == valid
```

### Go

**Frameworks:** Built-in `testing` package, testify

**Run tests:**
```bash
go test ./path/to/package -v -run TestSpecificFunction
```

**Key patterns:**
- Table-driven tests are idiomatic and preferred
- Use interfaces for dependency injection (no mocking framework needed)
- `t.Helper()` for custom assertion functions
- `t.Parallel()` for concurrent test execution
- Test files live alongside source: `foo.go` and `foo_test.go`

```go
func TestParseConfig(t *testing.T) {
    tests := []struct {
        name    string
        input   string
        want    Config
        wantErr bool
    }{
        {"valid config", `{"port":8080}`, Config{Port: 8080}, false},
        {"empty input", "", Config{}, true},
        {"invalid json", "{bad", Config{}, true},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := ParseConfig(tt.input)
            if tt.wantErr {
                require.Error(t, err)
                return
            }
            require.NoError(t, err)
            assert.Equal(t, tt.want, got)
        })
    }
}
```

### Rust

**Frameworks:** Built-in `#[test]`, `#[cfg(test)]`

**Run tests:**
```bash
cargo test specific_test_name
cargo test --lib           # Unit tests only
cargo nextest run          # With cargo-nextest for better output
```

**Key patterns:**
- Unit tests go in `#[cfg(test)] mod tests` inside the source file
- Integration tests go in `tests/` directory
- Use `assert_eq!`, `assert_ne!`, `assert!()`
- Use `#[should_panic(expected = "message")]` for panic testing
- Use trait objects for dependency injection

### React / Frontend

**Frameworks:** Testing Library, Jest, Vitest, Playwright/Cypress (E2E)

**Key patterns:**
- Test user behavior, not component internals
- Query by role, label, or text (not test IDs)
- Use `userEvent` over `fireEvent` for realistic interactions
- Test all states: loading, error, empty, success

```typescript
test('shows error message when login fails', async () => {
  server.use(
    http.post('/api/login', () => HttpResponse.json(
      { error: 'Bad credentials' }, { status: 401 }
    ))
  );

  render(<LoginForm />);
  await userEvent.type(screen.getByLabelText('Email'), 'alice@example.com');
  await userEvent.type(screen.getByLabelText('Password'), 'wrong');
  await userEvent.click(screen.getByRole('button', { name: /log in/i }));

  expect(await screen.findByText('Bad credentials')).toBeInTheDocument();
});
```

## Good Tests

| Quality | Good | Bad |
|---------|------|-----|
| **Minimal** | Tests one thing. "and" in name? Split it. | `test('validates email and domain and whitespace')` |
| **Clear** | Name describes behavior | `test('test1')` |
| **Shows intent** | Demonstrates desired API | Obscures what code should do |
| **Deterministic** | Same result every run | Depends on time, randomness, or ordering |
| **Independent** | No reliance on other tests | Breaks when run in different order |
| **Fast** | Milliseconds for unit tests | Seconds due to unnecessary I/O |

## Why Order Matters

**"I'll write tests after to verify it works"**

Tests written after code pass immediately. Passing immediately proves nothing:
- Might test the wrong thing
- Might test implementation, not behavior
- Might miss edge cases you forgot
- You never saw it catch the bug

Test-first forces you to see the test fail, proving it actually tests something.

**"I already manually tested all the edge cases"**

Manual testing is ad-hoc. You think you tested everything but:
- No record of what you tested
- Can't re-run when code changes
- Easy to forget cases under pressure
- "It worked when I tried it" is not comprehensive

Automated tests are systematic. They run the same way every time.

**"Deleting X hours of work is wasteful"**

Sunk cost fallacy. The time is already gone. Your choice now:
- Delete and rewrite with TDD (X more hours, high confidence)
- Keep it and add tests after (30 min, low confidence, likely bugs)

The "waste" is keeping code you can't trust.

**"TDD is dogmatic, being pragmatic means adapting"**

TDD IS pragmatic:
- Finds bugs before commit (faster than debugging after)
- Prevents regressions (tests catch breaks immediately)
- Documents behavior (tests show how to use code)
- Enables refactoring (change freely, tests catch breaks)

"Pragmatic" shortcuts = debugging in production = slower.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after" | Tests passing immediately prove nothing. |
| "Tests after achieve same goals" | Tests-after = "what does this do?" Tests-first = "what should this do?" |
| "Already manually tested" | Ad-hoc is not systematic. No record, can't re-run. |
| "Deleting X hours is wasteful" | Sunk cost fallacy. Keeping unverified code is technical debt. |
| "Keep as reference, write tests first" | You'll adapt it. That's testing after. Delete means delete. |
| "Need to explore first" | Fine. Throw away exploration, start fresh with TDD. |
| "Test hard = design unclear" | Listen to the test. Hard to test = hard to use. |
| "TDD will slow me down" | TDD is faster than debugging. Pragmatic = test-first. |
| "Manual test faster" | Manual doesn't prove edge cases. You'll re-test every change. |
| "Existing code has no tests" | You're improving it. Add tests for the code you're changing. |

## Red Flags - STOP and Start Over

- Code written before test
- Test written after implementation
- Test passes immediately on first run
- Can't explain why test failed
- Tests added "later"
- Rationalizing "just this once"
- "I already manually tested it"
- "Tests after achieve the same purpose"
- "Keep as reference" or "adapt existing code"
- "Already spent X hours, deleting is wasteful"
- "This is different because..."

**All of these mean: Delete code. Start over with TDD.**

## Example: Bug Fix with TDD

**Bug:** Empty email accepted by form submission

**RED:**
```typescript
test('rejects empty email with validation error', async () => {
  const result = await submitForm({ email: '' });
  expect(result.error).toBe('Email required');
});
```

**Verify RED:**
```
FAIL: expected 'Email required', got undefined
```
Good. Fails because the validation is missing, not a typo.

**GREEN:**
```typescript
function submitForm(data: FormData) {
  if (!data.email?.trim()) {
    return { error: 'Email required' };
  }
  // ... existing logic
}
```

**Verify GREEN:**
```
PASS - all tests green
```

**REFACTOR:**
Extract validation for reuse across multiple fields if the pattern repeats.

## Verification Checklist

Before marking work complete:

- [ ] Every new function/method has a test
- [ ] Watched each test fail before implementing
- [ ] Each test failed for the expected reason (feature missing, not typo)
- [ ] Wrote minimal code to pass each test
- [ ] All tests pass
- [ ] Output is pristine (no errors, warnings)
- [ ] Tests use real code (mocks only when unavoidable)
- [ ] Edge cases and error paths covered
- [ ] Test names describe behavior, not implementation

Can't check all boxes? You skipped TDD. Start over.

## When Stuck

| Problem | Solution |
|---------|----------|
| Don't know how to test | Write the wished-for API. Write the assertion first. Ask your human partner. |
| Test too complicated | Design too complicated. Simplify the interface. |
| Must mock everything | Code too coupled. Use dependency injection. |
| Test setup is huge | Extract helpers and factories. Still complex? Simplify the design. |
| Unclear which test level | Start with unit. Move to integration if the interaction is the risk. |

## Debugging Integration

Bug found? Write a failing test reproducing it. Follow the TDD cycle. The test proves the fix and prevents regression.

Never fix bugs without a test.

## Final Rule

```
Production code -> test exists and failed first
Otherwise -> not TDD
```

No exceptions without your human partner's explicit permission.
