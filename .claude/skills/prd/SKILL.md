---
name: prd
description: Generate comprehensive Product Requirements Documents (PRDs). Use this skill when users ask to "create a PRD", "write product requirements", "document a feature", "spec out a project", "plan this feature", or need help structuring product specifications. Triggers on requests involving requirements gathering, feature planning, or product specification.
---

# PRD Generator

Create detailed, well-structured Product Requirements Documents that are clear, actionable, and suitable for implementation. This skill guides you through discovery, structuring, and validation to produce PRDs that align stakeholders and guide development teams.

---

## Core Workflow

When a user requests a PRD, follow these steps in order:

1. **Gather Context** -- Ask clarifying questions to understand the problem and scope
2. **Define the Problem & Users** -- Articulate the problem statement, personas, and user stories
3. **Structure the PRD** -- Generate the full document using the standard template
4. **Define Success** -- Establish metrics, KPIs, and acceptance criteria
5. **Validate & Review** -- Run through the quality checklist before delivering

**Important:** Do NOT start implementing the feature. The goal is to produce the PRD document only.

---

## Step 1: Gather Context (Discovery Phase)

Before generating the PRD, collect essential information through a discovery conversation. Ask 3-7 clarifying questions, offering lettered options for quick responses.

### Required Information

- **Feature/Product Name**: What are we building?
- **Problem Statement**: What problem does this solve? Who feels the pain?
- **Target Users**: Who is this for? (personas)
- **Business Goals**: What business objectives does this serve?
- **Success Metrics**: How will we measure success?
- **Timeline/Constraints**: Any deadlines, budget, or technical limitations?
- **Scope Boundaries**: What is explicitly out of scope?

### Format Questions Like This

```
1. What is the primary problem this solves?
   A. Users cannot complete [action] efficiently
   B. We are losing customers due to [issue]
   C. Regulatory/compliance requirement
   D. Other: [please specify]

2. Who is the primary target user?
   A. New users (onboarding)
   B. Existing power users
   C. Enterprise/admin users
   D. All user segments

3. What is the desired scope?
   A. Minimal viable version (MVP)
   B. Full-featured implementation
   C. Backend/API only
   D. Frontend/UI only

4. What is the timeline?
   A. 1-2 weeks (quick win)
   B. 1-2 months (standard feature)
   C. 3-6 months (major initiative)
   D. Flexible / no hard deadline
```

This lets users respond with "1A, 2C, 3B, 4B" for quick iteration.

**Note:** If the user provides a detailed brief upfront, skip questions already answered. Always ask for clarification on any missing critical information.

---

## Step 2: PRD Document Structure

Generate the PRD with the following sections. For smaller features, mark optional sections as such and include only what is relevant.

### Template

```markdown
# PRD: [Feature/Product Name]

**Author:** [Name]
**Date:** [Date]
**Status:** Draft | In Review | Approved
**Version:** 1.0

---

## 1. Executive Summary

[2-3 paragraph high-level overview of what we are building, why it matters, and
the expected impact. This section should be readable by any stakeholder in under
2 minutes.]

---

## 2. Problem Statement

### The Problem
[Clear, specific articulation of the problem. Include data, user quotes, or
evidence wherever possible.]

### Who Is Affected
[Which users or customer segments experience this problem, and how severely.]

### Current State
[How users currently work around the problem. What is the cost of inaction.]

---

## 3. Goals and Objectives

- **Goal 1:** [Specific, measurable objective]
- **Goal 2:** [Specific, measurable objective]
- **Goal 3:** [Specific, measurable objective]

Link goals to company OKRs or strategic initiatives where applicable.

---

## 4. User Personas

### Persona 1: [Name / Role]
- **Description:** [Who they are]
- **Goals:** [What they want to achieve]
- **Pain Points:** [Current frustrations]
- **Context:** [How and when they interact with the product]

### Persona 2: [Name / Role]
- **Description:** [Who they are]
- **Goals:** [What they want to achieve]
- **Pain Points:** [Current frustrations]
- **Context:** [How and when they interact with the product]

---

## 5. User Stories and Requirements

### US-001: [Title]
**Description:** As a [user type], I want [action/feature] so that [benefit/value].

**Acceptance Criteria:**
- [ ] [Specific, testable criterion]
- [ ] [Specific, testable criterion]
- [ ] [Specific, testable criterion]

**Priority:** P0 (Must Have) | P1 (Should Have) | P2 (Nice to Have)

### US-002: [Title]
**Description:** As a [user type], I want [action/feature] so that [benefit/value].

**Acceptance Criteria:**
- [ ] [Specific, testable criterion]
- [ ] [Specific, testable criterion]

**Priority:** P0 | P1 | P2

[Repeat for each user story. Keep stories small enough to implement in one
focused session.]

---

## 6. Functional Requirements

- **FR-1:** The system must allow users to [specific capability].
- **FR-2:** When a user performs [action], the system must [response].
- **FR-3:** The system must support [specific behavior] under [conditions].
- **FR-4:** [Continue numbering for all functional requirements.]

Be explicit and unambiguous. Avoid vague language like "fast" or "intuitive" --
use concrete, measurable descriptions.

---

## 7. Non-Functional Requirements

### Performance
- Page load time must be under [X] seconds
- API response time must be under [X]ms at the 95th percentile
- System must support [X] concurrent users

### Security
- Authentication requirements (SSO, MFA, etc.)
- Authorization and role-based access control
- Data encryption requirements (at rest, in transit)
- Compliance requirements (GDPR, HIPAA, SOC 2, etc.)

### Accessibility
- WCAG 2.1 AA compliance
- Screen reader compatibility
- Keyboard navigation support

### Scalability
- Expected growth trajectory
- Scaling requirements and thresholds

### Reliability
- Uptime SLA target (e.g., 99.9%)
- Disaster recovery requirements
- Data backup and retention policies

---

## 8. Scope Definition

### In Scope
- [Explicit list of features and capabilities included]
- [Link to relevant user stories]
- [Be detailed -- this prevents scope creep]

### Out of Scope
- [Explicit list of what is NOT included]
- [Features deliberately deferred to future phases]
- [Capabilities that might be assumed but are excluded]

### Future Considerations
- [Ideas for subsequent phases]
- [Features explicitly deferred, not rejected]

---

## 9. Success Metrics and KPIs

### Primary Metrics
| Metric | Current Baseline | Target | Measurement Method |
|--------|-----------------|--------|-------------------|
| [Metric 1] | [Current value] | [Target value] | [How to measure] |
| [Metric 2] | [Current value] | [Target value] | [How to measure] |

### Secondary Metrics
| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| [Metric 1] | [Target] | [How to measure] |

### Metrics Framework
Choose the appropriate framework for the product type:

- **AARRR (Pirate Metrics):** Acquisition, Activation, Retention, Revenue, Referral
- **HEART Framework:** Happiness, Engagement, Adoption, Retention, Task Success
- **North Star Metric:** Single key metric representing core user value
- **OKRs:** Objectives and Key Results tied to company goals

### Guardrail Metrics
[Metrics that must NOT degrade as a result of this feature, e.g., existing
conversion rates, page performance, error rates.]

---

## 10. Technical Constraints and Dependencies

### Technical Architecture
- High-level technical approach or constraints
- Key technology decisions or requirements

### Dependencies
- **Internal:** [Teams, services, or systems we depend on]
- **External:** [Third-party APIs, vendor services, libraries]
- **Data:** [Data sources, migrations, privacy considerations]

### Integration Points
- [How this feature integrates with existing systems]
- [API contracts or interface requirements]

### Constraints
- [Technical limitations that shape the solution]
- [Infrastructure or platform restrictions]
- [Legacy system compatibility requirements]

---

## 11. Design and UX Requirements

### Visual Design
- [UI requirements and design system components to use]
- [Brand guidelines or visual constraints]

### Interaction Patterns
- [User flows and interaction models]
- [Animation or transition requirements]

### Wireframes and Mockups
- [Links to Figma, Sketch, or other design files]
- [Embedded screenshots or wireframe references]
- [Note: Include links to wireframes/mockups when available. If none exist yet,
  specify what needs to be designed before implementation.]

### Responsive Design
- [Device and viewport requirements]
- [Mobile-specific considerations]

---

## 12. Timeline and Milestones

### Phase 1: [Name] -- [Date Range]
- [ ] Milestone 1: [Description]
- [ ] Milestone 2: [Description]
- [ ] Deliverable: [What is shipped]

### Phase 2: [Name] -- [Date Range]
- [ ] Milestone 3: [Description]
- [ ] Milestone 4: [Description]
- [ ] Deliverable: [What is shipped]

### Key Dates
| Date | Milestone | Owner |
|------|-----------|-------|
| [Date] | Design complete | [Team/Person] |
| [Date] | Development complete | [Team/Person] |
| [Date] | QA complete | [Team/Person] |
| [Date] | Launch | [Team/Person] |

---

## 13. Risk Assessment

| Risk | Likelihood | Impact | Mitigation Strategy |
|------|-----------|--------|-------------------|
| [Risk 1] | High/Med/Low | High/Med/Low | [How to mitigate] |
| [Risk 2] | High/Med/Low | High/Med/Low | [How to mitigate] |
| [Risk 3] | High/Med/Low | High/Med/Low | [How to mitigate] |

### Risk Categories to Consider
- **Technical:** Can we build this? Platform limitations, performance risks
- **Resource:** Do we have the people and skills?
- **Timeline:** Can we deliver on time? External dependencies
- **Market:** Will users want this? Competitive moves
- **Compliance:** Regulatory or legal risks
- **Operational:** Support, maintenance, monitoring burden

---

## 14. Stakeholder Alignment

### RACI Matrix
| Activity | Responsible | Accountable | Consulted | Informed |
|----------|------------|-------------|-----------|----------|
| PRD Approval | [Name] | [Name] | [Names] | [Names] |
| Design | [Name] | [Name] | [Names] | [Names] |
| Development | [Name] | [Name] | [Names] | [Names] |
| QA | [Name] | [Name] | [Names] | [Names] |
| Launch | [Name] | [Name] | [Names] | [Names] |

### Sign-Off Checklist
- [ ] Engineering reviewed technical feasibility
- [ ] Design reviewed UX requirements
- [ ] Product leadership approved scope and priority
- [ ] Stakeholders understand timeline and trade-offs
- [ ] Success metrics agreed upon by all parties
- [ ] Legal/compliance reviewed (if applicable)

---

## 15. Prioritization of Requirements

### MoSCoW Prioritization

**Must Have (P0):**
- [Requirements that are non-negotiable for launch]

**Should Have (P1):**
- [Important requirements that add significant value]

**Could Have (P2):**
- [Desirable requirements if time and resources allow]

**Won't Have (This Release):**
- [Explicitly excluded from this release but may come later]

### Prioritization Criteria
Rank requirements using these dimensions:
- **User Impact:** How many users benefit? How much pain does it relieve?
- **Business Value:** Revenue impact, strategic alignment, competitive advantage
- **Effort/Complexity:** Engineering effort, design effort, dependencies
- **Risk:** Technical risk, timeline risk, adoption risk

---

## 16. Open Questions

- [ ] [Unresolved question 1]
- [ ] [Unresolved question 2]
- [ ] [Unresolved question 3]

---

## Appendix

### Glossary
[Define domain-specific terms used in this PRD.]

### References
[Links to related documents, research, competitor analysis, user research
findings, etc.]

### Change Log
| Date | Version | Author | Changes |
|------|---------|--------|---------|
| [Date] | 1.0 | [Name] | Initial draft |
```

---

## Step 3: Writing User Stories

For each major requirement, generate user stories using the standard format:

```
As a [user type],
I want [action/feature],
So that [benefit/value].

Acceptance Criteria:
- [Specific, testable criterion 1]
- [Specific, testable criterion 2]
- [Specific, testable criterion 3]
```

### User Story Best Practices

**DO:**
- Focus on user value, not features
- Write from the user's perspective
- Include clear, verifiable acceptance criteria
- Keep stories independent and small (implementable in one focused session)
- Use consistent format across all stories
- Number stories (US-001, US-002) for easy reference

**DO NOT:**
- Write technical implementation details in the story
- Create hard dependencies between stories
- Make stories too large (break epics into smaller stories)
- Use internal jargon without explanation
- Skip acceptance criteria
- Use vague criteria like "works correctly" -- instead write "button shows confirmation dialog before deleting"

### Acceptance Criteria Guidelines

Each criterion must be:
- **Verifiable:** A tester can confirm pass/fail
- **Specific:** No ambiguity about what "done" means
- **Independent:** Testable on its own
- **Complete:** Covers the full scope of the story

Example of good acceptance criteria:
```
- [ ] User can upload files up to 10MB in PNG, JPG, or PDF format
- [ ] Upload progress bar displays percentage complete
- [ ] Error message appears if file exceeds size limit: "File must be under 10MB"
- [ ] Uploaded file appears in the gallery within 3 seconds
- [ ] Typecheck and lint pass with no new warnings
```

---

## Step 4: Defining Success Metrics

### Choosing the Right Framework

**AARRR (Pirate Metrics)** -- Best for growth-focused features:
- **Acquisition:** How do users find us?
- **Activation:** Do users have a great first experience?
- **Retention:** Do users come back?
- **Revenue:** How do we make money?
- **Referral:** Do users tell others?

**HEART Framework** -- Best for UX-focused features:
- **Happiness:** User satisfaction (NPS, CSAT, surveys)
- **Engagement:** Frequency and depth of interaction
- **Adoption:** New users or new feature uptake
- **Retention:** Continued usage over time
- **Task Success:** Completion rate, time-on-task, error rate

**North Star Metric** -- Best for aligning the whole team:
- Single metric representing the core value delivered to users
- Example: "Weekly active documents edited" for a collaboration tool

**OKRs** -- Best for strategic initiatives:
- **Objective:** Qualitative goal (what we want to achieve)
- **Key Results:** 2-4 quantitative measures of progress

### Metrics Best Practices

- Set specific numerical targets, not directional goals ("increase by 15%", not "improve")
- Include both leading indicators (early signals) and lagging indicators (final outcomes)
- Define guardrail metrics that must not degrade
- Specify measurement method and data source for each metric
- Establish baseline measurements before launch

---

## Step 5: Validate and Review

### Self-Review Checklist

Before delivering the PRD, verify:

- [ ] **Problem is clear:** Anyone can understand what we are solving and why
- [ ] **Users are identified:** We know who this is for with defined personas
- [ ] **User stories are complete:** Each has description, acceptance criteria, and priority
- [ ] **Requirements are specific:** No vague language; all requirements are testable
- [ ] **Success is measurable:** Metrics have baselines, targets, and measurement methods
- [ ] **Scope is bounded:** Clear in-scope and out-of-scope sections
- [ ] **Requirements are prioritized:** MoSCoW or similar framework applied
- [ ] **Timeline is realistic:** Milestones are defined with owners
- [ ] **Risks are identified:** Risk table is populated with mitigations
- [ ] **Technical constraints addressed:** Dependencies and integration points documented
- [ ] **Design requirements noted:** Wireframe references or design needs specified
- [ ] **Stakeholders identified:** RACI or sign-off checklist included
- [ ] **No placeholder text remains:** All brackets and template text replaced
- [ ] **Open questions captured:** Unresolved items listed for follow-up

---

## PRD Formats

The skill supports different levels of detail depending on the request:

### Standard PRD (Default)
Full comprehensive document with all 16 sections. Use for major features and initiatives.

### Lean PRD
Streamlined for agile teams. Includes: Problem Statement, User Stories, Acceptance Criteria, Scope, Success Metrics, and Timeline. Skip detailed personas, RACI, and appendix.

### One-Pager
Executive summary format. Includes: Problem, Solution, Key Metrics, Timeline, and Ask. Use for quick alignment or approval gates.

### Technical PRD
Engineering-focused. Emphasizes: Technical Constraints, Architecture, API Contracts, Performance Requirements, Dependencies, and Non-Functional Requirements. Lighter on personas and business context.

### Design PRD
UX/UI-focused. Emphasizes: User Flows, Wireframes, Interaction Patterns, Accessibility, Design System Components. Lighter on technical architecture.

Specify the format when requesting: "Create a lean PRD for..." or "Generate a technical PRD for..."

---

## Writing Guidelines

### For Clarity
- Be explicit and unambiguous
- Use simple language; avoid jargon or define it
- Provide concrete examples where helpful
- Number all requirements for easy reference
- Use tables for structured data (metrics, risks, timelines)

### For Quality
- Good requirements are **SMART**: Specific, Measurable, Achievable, Relevant, Time-bound
- Replace vague terms: "fast" becomes "loads in under 2 seconds"; "easy" becomes "completable in 3 clicks or fewer"
- Focus on the "why" and "what", not the "how" -- let engineers determine implementation
- Avoid feature creep: if it is not in scope, it goes in Out of Scope or Future Considerations

### For Audience
- Executives need the Executive Summary and Metrics
- Engineers need Functional Requirements, Technical Constraints, and Acceptance Criteria
- Designers need User Personas, User Flows, and Design Requirements
- QA needs Acceptance Criteria and Non-Functional Requirements
- Write so that each audience can find what they need quickly

---

## Output

- **Format:** Markdown (`.md`)
- **Location:** Project root, `docs/`, or `tasks/` directory (confirm with user)
- **Filename:** `prd-[feature-name].md` (kebab-case)

---

## Example: Task Priority System PRD

```markdown
# PRD: Task Priority System

## Executive Summary

Add priority levels to tasks so users can focus on what matters most. Tasks can
be marked as high, medium, or low priority, with visual indicators and filtering
to help users manage their workload effectively.

## Problem Statement

Users report difficulty identifying which tasks need immediate attention. In a
list of 50+ tasks, there is no way to distinguish urgent items from routine work,
leading to missed deadlines and context-switching overhead.

## Goals

- Allow assigning priority (high/medium/low) to any task
- Provide clear visual differentiation between priority levels
- Enable filtering and sorting by priority
- Default new tasks to medium priority

## User Personas

### Alex - Project Manager
- Manages 3 teams with 100+ active tasks
- Needs to quickly identify blockers and urgent items
- Reviews task boards daily in morning standup

### Sam - Individual Contributor
- Has 15-20 tasks at any time
- Wants to focus on high-priority work first
- Uses the task list as a daily planner

## User Stories

### US-001: Add priority field to database
**Description:** As a developer, I need to store task priority so it persists
across sessions.

**Acceptance Criteria:**
- [ ] Add priority column to tasks table: 'high' | 'medium' | 'low'
      (default 'medium')
- [ ] Generate and run migration successfully
- [ ] Typecheck passes

**Priority:** P0

### US-002: Display priority indicator on task cards
**Description:** As a user, I want to see task priority at a glance so I know
what needs attention first.

**Acceptance Criteria:**
- [ ] Each task card shows colored priority badge
      (red = high, yellow = medium, gray = low)
- [ ] Priority visible without hovering or clicking
- [ ] Typecheck passes

**Priority:** P0

### US-003: Add priority selector to task edit
**Description:** As a user, I want to change a task's priority when editing it.

**Acceptance Criteria:**
- [ ] Priority dropdown in task edit modal
- [ ] Shows current priority as selected
- [ ] Saves immediately on selection change
- [ ] Typecheck passes

**Priority:** P0

### US-004: Filter tasks by priority
**Description:** As a user, I want to filter the task list to see only
high-priority items when I am focused.

**Acceptance Criteria:**
- [ ] Filter dropdown with options: All | High | Medium | Low
- [ ] Filter persists in URL params
- [ ] Empty state message when no tasks match filter
- [ ] Typecheck passes

**Priority:** P1

## Functional Requirements

- FR-1: Add `priority` field to tasks table ('high' | 'medium' | 'low',
  default 'medium')
- FR-2: Display colored priority badge on each task card
- FR-3: Include priority selector in task edit modal
- FR-4: Add priority filter dropdown to task list header
- FR-5: Sort by priority within each status column (high first)

## Non-Functional Requirements

- Page load time must not increase by more than 100ms
- Filter and sort operations must complete in under 200ms
- Priority badge must meet WCAG 2.1 AA color contrast requirements

## Scope

### In Scope
- Priority field (high/medium/low) on tasks
- Visual indicators, filtering, sorting

### Out of Scope
- Priority-based notifications or reminders
- Automatic priority assignment based on due date
- Priority inheritance for subtasks

## Success Metrics

| Metric | Baseline | Target | Method |
|--------|----------|--------|--------|
| Users setting priority | 0% | 60% within 30 days | Analytics |
| Task completion rate | 72% | 80% | Analytics |
| User satisfaction (priority feature) | N/A | 4.0/5.0 | In-app survey |

## Technical Considerations

- Reuse existing badge component with color variants
- Filter state managed via URL search params
- Priority stored in database, not computed

## Timeline

### Phase 1: Core (Week 1-2)
- [ ] Database migration and API updates
- [ ] Priority badge on task cards
- [ ] Priority selector in edit modal

### Phase 2: Enhancement (Week 3)
- [ ] Filter and sort by priority
- [ ] URL param persistence

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Color-blind users cannot distinguish badges | Medium | High | Use icons + color, test with accessibility tools |
| Performance degradation with sort | Low | Medium | Index priority column, benchmark queries |

## Open Questions

- [ ] Should priority affect task ordering within Kanban columns?
- [ ] Should we add keyboard shortcuts for priority changes?
```

---

## Troubleshooting

**PRD is too long or detailed:**
Create a Lean PRD or One-Pager instead. Reserve the full Standard PRD for major initiatives.

**Requirements are too vague:**
Add specific examples, use concrete numbers, include visual references. Replace "fast" with "loads in under 2 seconds."

**Stakeholders are not aligned:**
Share the PRD early as a draft, incorporate feedback, present it in person, and get explicit sign-off before development starts.

**Scope keeps expanding:**
Use the Out of Scope section aggressively. Create separate PRDs for future phases. Tie scope to timeline constraints.

**Engineers say it is not feasible:**
Involve engineering earlier in the discovery phase. Be flexible on solution approach. Focus on the problem, not the implementation.

---

## Best Practices Summary

1. **Start with the problem, not the solution** -- validate the problem is worth solving
2. **Write for your audience** -- executives need summaries, engineers need details
3. **Be specific and measurable** -- avoid vague language everywhere
4. **Include visuals** -- reference mockups, diagrams, and user flows
5. **Define success upfront** -- metrics before features
6. **Scope aggressively** -- MVP mentality, explicit out-of-scope list
7. **Prioritize ruthlessly** -- use MoSCoW or similar framework
8. **Collaborate, do not dictate** -- get input from engineering, design, and stakeholders
9. **Keep it updated** -- PRDs are living documents; log changes in the appendix
10. **Focus on "why" and "what", not "how"** -- let engineers determine implementation
