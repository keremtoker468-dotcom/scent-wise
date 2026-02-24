---
name: prd
description: Create comprehensive Product Requirements Documents (PRDs). Use when asked to write a PRD, define product requirements, create feature specifications, document user stories, or plan product features with acceptance criteria and success metrics.
---

# Product Requirements Document (PRD)

Create structured, actionable PRDs that align stakeholders and guide implementation.

## PRD Structure

### 1. Overview
- **Problem statement**: What problem are we solving? Why now?
- **Target users**: Who experiences this problem? Include user personas.
- **Proposed solution**: High-level description of what we're building
- **Success metrics**: How will we measure success? (KPIs with targets)

### 2. Goals and Non-Goals

**Goals** (in scope):
- List specific, measurable outcomes this project aims to achieve
- Prioritize using MoSCoW (Must have, Should have, Could have, Won't have)

**Non-goals** (explicitly out of scope):
- List things this project intentionally does NOT address
- Prevents scope creep and sets clear boundaries

### 3. User Stories

Format: "As a [user type], I want to [action] so that [benefit]"

Include:
- Primary user flows (happy paths)
- Edge cases and error scenarios
- Accessibility requirements
- Each story should have clear acceptance criteria

### 4. Functional Requirements

For each feature:
- **Description**: What it does
- **User interaction**: How the user interacts with it
- **Acceptance criteria**: Specific, testable conditions for completion
- **Priority**: Must have / Should have / Could have
- **Dependencies**: What must exist first

### 5. Non-Functional Requirements

- **Performance**: Response times, throughput targets
- **Scalability**: Expected load, growth projections
- **Security**: Auth, data protection, compliance requirements
- **Accessibility**: WCAG level, supported assistive technologies
- **Compatibility**: Browsers, devices, OS versions
- **Reliability**: Uptime targets, error budgets

### 6. Technical Constraints

- Existing system architecture and integrations
- Technology stack requirements or restrictions
- Third-party service dependencies
- Data migration needs
- API contracts

### 7. Design and UX

- Wireframes or mockup references
- User flow diagrams
- Key interaction patterns
- Brand and style guide references

### 8. Timeline and Milestones

- Phase breakdown with deliverables
- Key milestones and dates
- Dependencies between phases
- Launch criteria (what must be true to ship)

### 9. Risks and Mitigations

For each risk:
- **Risk**: What could go wrong
- **Likelihood**: Low / Medium / High
- **Impact**: Low / Medium / High
- **Mitigation**: How to reduce likelihood or impact

## Writing Guidelines

- Be specific and testable - avoid vague language ("fast", "easy", "intuitive")
- Use concrete numbers for requirements (load time < 2s, support 10k concurrent users)
- Write for engineers - include enough technical context for implementation
- Keep it concise - long PRDs don't get read
- Include diagrams and visual references where they add clarity
- Version the document and track changes
