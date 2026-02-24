---
name: test-driven-development
description: Apply test-driven development (TDD) methodology when writing code. Use when the user asks to implement features using TDD, write tests first, or follow Red-Green-Refactor workflow. Also use when asked to ensure thorough test coverage alongside implementation.
---

# Test-Driven Development

Follow the Red-Green-Refactor cycle to build reliable, well-tested software.

## The TDD Cycle

### 1. Red - Write a Failing Test
- Write the smallest test that describes the next piece of desired behavior
- Run the test and confirm it fails for the expected reason
- The failure message should clearly indicate what's missing

### 2. Green - Make It Pass
- Write the minimum code to make the test pass
- Resist adding extra functionality not required by the test
- It's okay if the code isn't elegant yet

### 3. Refactor - Clean Up
- Improve the code while keeping all tests green
- Remove duplication, improve naming, simplify logic
- Run tests after each refactoring step

## Test Writing Guidelines

**Test naming**: Use descriptive names that read like specifications
```
// Good: describes behavior
"returns empty array when no items match filter"
"throws ValidationError when email format is invalid"

// Bad: describes implementation
"test filter method"
"test email validation"
```

**Test structure**: Arrange-Act-Assert (AAA)
```
// Arrange: set up test data and preconditions
// Act: execute the behavior under test
// Assert: verify the expected outcome
```

**One assertion per behavior**: Each test should verify one logical concept. Multiple assertions are fine if they verify different aspects of the same behavior.

## What to Test First

1. **Happy path**: The most common successful scenario
2. **Edge cases**: Empty inputs, boundaries, null/undefined
3. **Error cases**: Invalid input, missing data, failure conditions
4. **Business rules**: Domain-specific logic and constraints

## Test Granularity

- **Unit tests**: Test individual functions/methods in isolation. Fast, focused, many of these.
- **Integration tests**: Test how components work together. Moderate speed, fewer of these.
- **E2E tests**: Test full user workflows. Slow, fewest of these.

Prefer the testing pyramid: many unit tests, fewer integration tests, fewest E2E tests.

## Mocking Strategy

- Mock external dependencies (APIs, databases, file system)
- Don't mock the unit under test
- Prefer real implementations over mocks when practical
- Use dependency injection to make code testable
- Avoid mocking implementation details

## When to Adapt TDD

TDD works best for business logic, data transformations, and algorithmic code. For UI layout, infrastructure glue code, or exploratory prototyping, write tests after implementation if TDD slows you down. Always have tests before merging.
