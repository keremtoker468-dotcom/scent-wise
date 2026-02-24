---
name: brainstorming
description: Facilitate structured brainstorming and ideation sessions. Use when users need to generate ideas, explore creative solutions, ideate on product features, reframe problems, or systematically evaluate and prioritize concepts. Triggers on requests like "brainstorm", "help me think through", "generate ideas", "what if", "explore options", "ideate", "I'm thinking about", "help me decide", or "/brainstorm". Also activate when a user has a rough idea and needs to clarify, expand, or refine it before implementation.
---

# Brainstorming

## Overview

Guide users through structured ideation using research-validated frameworks. Move deliberately through divergent thinking (generate many ideas without judgment) and convergent thinking (evaluate, combine, and select the best ideas). The goal is to transform rough concepts into well-formed, validated ideas ready for planning and implementation.

**Announce at start:** "I'm using the brainstorming skill to facilitate this ideation session."

## Core Principles

- **Diverge before converging.** Generate volume first, evaluate later. Never critique during ideation.
- **One question at a time.** Avoid overwhelming the user. Prefer multiple-choice options when feasible.
- **Constraints are catalysts.** Limitations spark creativity. Introduce artificial constraints to break fixation.
- **Show reasoning.** For every idea, explain the "why" -- this increases implementability by 40%.
- **Explore alternatives.** Always present 2-3 approaches before recommending one.
- **Apply YAGNI ruthlessly.** Strip unnecessary complexity. Favor the simplest viable version.
- **Scale to complexity.** A quick feature brainstorm needs less structure than a product vision session.

## Session Flow

### Phase 1: Understand the Problem Space

Before generating ideas, establish context. Ask clarifying questions to understand:

- **The core problem.** What pain point or opportunity is being addressed?
- **The target user.** Who benefits and in what context?
- **Success criteria.** How will we know the idea worked?
- **Constraints.** Budget, timeline, technology, team size, existing systems.
- **Prior work.** What has already been tried or considered?

If the user provides a detailed brief, skip to Phase 2. If they provide a vague prompt ("brainstorm marketing ideas"), spend time here first.

**Problem Reframing Techniques:**

When the stated problem feels narrow or premature, reframe it:

- **Five Whys.** Ask "why" repeatedly to find the root cause beneath the surface problem.
- **How Might We.** Restate the problem as "How might we [desired outcome] for [user] so that [benefit]?"
- **Inversion.** Ask "What would make this problem worse?" then reverse each answer.
- **Abstraction ladder.** Move up ("What is this an example of?") or down ("What is an example of this?") to find the right level of specificity.
- **Stakeholder lens.** Restate the problem from the perspective of different stakeholders (end user, business, engineer, support team).

### Phase 2: Divergent Thinking -- Generate Ideas

Use one or more frameworks below based on the session's goal. Start with the framework most relevant to the user's context, and layer additional frameworks if the first pass yields fewer than 10 ideas.

#### Framework Selection Guide

| Goal | Recommended Framework |
|---|---|
| Improve an existing product or feature | SCAMPER |
| Explore a problem from many angles | Six Thinking Hats |
| Map relationships and find connections | Mind Mapping |
| Generate high volume of raw ideas | Brainwriting / Rapid Fire |
| Break out of conventional thinking | Random Stimulus / Forced Connections |
| Understand user needs deeply | User-Centered Ideation |
| Find gaps in the market | Competitive Analysis |
| Push boundaries of what is possible | Extreme Scaling (10x Thinking) |

#### SCAMPER

Apply each operation to the existing product, feature, or concept:

- **Substitute.** What component, material, or process could be replaced?
- **Combine.** What features, ideas, or functions could be merged?
- **Adapt.** What could be borrowed from another domain or product?
- **Modify.** What could be made larger, smaller, faster, slower, or changed in form?
- **Put to another use.** How could this serve a different audience or solve a different problem?
- **Eliminate.** What could be removed entirely? What is the minimal viable version?
- **Reverse/Rearrange.** What if the sequence, layout, or hierarchy were inverted?

Present results as a table: Operation | Idea | Reasoning | Feasibility (High/Med/Low).

#### Six Thinking Hats

Examine the problem through six distinct lenses:

- **White Hat (Facts).** What data, evidence, and information do we have? What is missing?
- **Red Hat (Emotions).** What does intuition say? What feels right or wrong? What would users love or hate?
- **Black Hat (Caution).** What could go wrong? What are the risks, weaknesses, and obstacles?
- **Yellow Hat (Optimism).** What is the best-case scenario? What are the benefits and opportunities?
- **Green Hat (Creativity).** What wild, unconventional, or provocative ideas emerge?
- **Blue Hat (Process).** What is our thinking process? Are we asking the right questions?

#### Mind Mapping

Build an idea map radiating from the central problem:

1. Place the core problem or theme at the center.
2. Branch into 4-6 primary categories (user needs, technology options, business models, distribution channels, etc.).
3. For each branch, generate 3-5 sub-ideas.
4. Look for unexpected connections between branches.
5. Present the map as a structured outline with connection annotations.

#### Brainwriting / Rapid Fire

Generate ideas at speed without filtering:

1. Set a target: "Generate 15 ideas in 3 minutes" (or equivalent scope).
2. List every idea, no matter how impractical.
3. After the burst, cluster related ideas into themes.
4. Select the most promising cluster for deeper exploration.

#### Random Stimulus / Forced Connections

Break fixation by introducing unrelated concepts:

1. Pick a random domain (hospitality, gaming, nature, space exploration, cooking).
2. Identify 3 principles or patterns from that domain.
3. Force-connect each principle to the problem at hand.
4. Evaluate which connections spark genuinely novel ideas.

#### Perspective Multiplication

Generate ideas from multiple professional or stakeholder viewpoints:

- "As a first-time user, I would want..."
- "As a power user, my frustration is..."
- "As the CEO, the strategic value is..."
- "As a support engineer, the recurring issue is..."
- "As a competitor, I would attack this by..."

Generate 3-5 ideas per perspective, then identify ideas that resonate across multiple viewpoints.

#### Analogical Transfer

Borrow proven patterns from other industries:

1. Identify the core mechanic of the problem (e.g., onboarding = teaching someone a new environment).
2. Find 3 domains that solve similar mechanics well (e.g., video game tutorials, hotel check-in, first day at school).
3. Extract the transferable principle from each.
4. Apply each principle to the original problem.

### Phase 3: User-Centered Ideation

When brainstorming product features or experiences, ground ideas in user reality:

- **Jobs to Be Done.** What job is the user hiring this product to do? Frame ideas around the job, not the feature.
- **Pain/Gain mapping.** List the user's top 3 pains and top 3 desired gains. Generate ideas that address each.
- **Day-in-the-life scenario.** Walk through a typical user's day. Where does the product intersect? What moments of friction or delight exist?
- **Extreme users.** Consider the needs of novice users, power users, and users with accessibility requirements. Ideas that serve extremes often improve the experience for everyone.
- **Emotional journey.** Map the user's emotional state across the experience (anxious, confident, frustrated, delighted). Generate ideas that shift negative emotions to positive ones.

### Phase 4: Competitive Analysis for Inspiration

When the brainstorm benefits from market context:

1. **Identify 3-5 competitors or analogous products** (direct competitors + adjacent market players).
2. **Map their strengths and weaknesses** in a comparison table.
3. **Find whitespace.** What do none of them do well? What user needs remain unmet?
4. **Borrow and improve.** Which competitor features could be adapted and made better?
5. **Differentiation matrix.** For each idea, assess: Is this a table-stakes feature, a differentiator, or a potential breakthrough?

Present as: Competitor | What They Do Well | Gap/Weakness | Idea for Our Product.

### Phase 5: Creative Constraints as Catalysts

When ideation stalls or produces generic results, introduce artificial constraints:

- **Budget constraint.** "What if we had to build this for $0 / $100 / $1M?"
- **Time constraint.** "What if we had to ship in 1 day / 1 week / 1 year?"
- **Technology constraint.** "What if we could only use a spreadsheet / only use voice / no internet?"
- **Audience constraint.** "What if the user were a child / an expert / someone who speaks a different language?"
- **Removal constraint.** "What if we removed the most important feature? What would replace it?"
- **10x constraint.** "What if we needed to serve 10x more users? What breaks and what new ideas emerge?"

Each constraint forces a different creative path. Generate 2-3 ideas per constraint.

### Phase 6: Convergent Thinking -- Evaluate and Prioritize

After generating a broad set of ideas, shift to evaluation. Never skip this phase.

#### Clustering and Theming

1. Group related ideas into 3-7 themes.
2. Name each theme clearly.
3. Identify the strongest single idea within each theme.
4. Look for "super ideas" that combine elements across themes.

#### Prioritization Frameworks

Choose the framework that fits the decision context:

**ICE Score (Impact, Confidence, Ease)**

Best for: Quick prioritization of a moderate number of ideas.

| Idea | Impact (1-10) | Confidence (1-10) | Ease (1-10) | ICE Score |
|---|---|---|---|---|
| Idea A | 8 | 7 | 5 | 280 |

Score = Impact x Confidence x Ease. Rank by total score.

**RICE Score (Reach, Impact, Confidence, Effort)**

Best for: Product feature prioritization with quantifiable reach data.

| Idea | Reach (users/quarter) | Impact (0.25-3) | Confidence (%) | Effort (person-months) | RICE Score |
|---|---|---|---|---|---|
| Idea A | 5000 | 2 | 80% | 3 | 2667 |

Score = (Reach x Impact x Confidence) / Effort.

**MoSCoW Method**

Best for: Release planning and scope negotiation.

- **Must have.** Non-negotiable for launch. Without these, the product fails.
- **Should have.** Important but not critical. Include if possible.
- **Could have.** Nice to have. Include only if time and resources allow.
- **Won't have (this time).** Explicitly out of scope. Acknowledged but deferred.

**Effort/Impact Matrix (2x2)**

Best for: Visual quick-sort when quantitative scoring feels heavy.

```
        High Impact
            |
  Quick Wins | Big Bets
  (Do first) | (Plan carefully)
  -----------+------------
  Fill-ins   | Money Pits
  (Do if     | (Avoid or
   easy)     |  reconsider)
            |
        Low Impact
   Low Effort --> High Effort
```

### Phase 7: Rapid Prototyping Concepts

For the top 2-3 ideas, sketch a lightweight prototype concept:

- **One-liner.** Describe the idea in a single sentence.
- **User story.** "As a [user], I want to [action] so that [benefit]."
- **Key interaction.** Describe the single most important moment of the experience.
- **Minimal scope.** What is the smallest version that tests the core hypothesis?
- **Validation method.** How would we know if this works? (User test, A/B test, analytics metric, survey.)
- **Biggest risk.** What assumption, if wrong, kills this idea?
- **Next step.** The single next action to move this idea forward.

### Phase 8: Validate and Refine

Before closing the session, stress-test the top ideas:

- **Pre-mortem.** "It is 6 months from now and this idea failed. What went wrong?" Generate 3-5 failure modes and identify mitigations.
- **Assumption audit.** List every assumption the idea rests on. Flag the riskiest ones.
- **Stakeholder pressure test.** Would engineering, design, marketing, and leadership each support this? Why or why not?
- **Reversibility check.** Is this decision easily reversible? If not, demand higher confidence before proceeding.
- **Second-order effects.** If this succeeds, what happens next? Does success create new problems?

## Output Formats

Adapt output to the session's needs:

- **Idea list.** Numbered list with one-line description and reasoning for each idea.
- **Comparison table.** Columns: Idea | Description | Pros | Cons | Priority.
- **Design summary.** Structured document with problem statement, top 3 ideas, validation plan, and next steps.
- **Prioritized backlog.** Ranked list with scores from the chosen prioritization framework.

Always use numbered lists over bullet points for idea tracking.

## Session Closing

End every brainstorming session with:

1. **Summary.** Restate the problem and the top 3 ideas with one sentence each.
2. **Recommended next step.** Suggest one concrete action (prototype, user interview, technical spike, write a plan).
3. **Open questions.** List any unresolved questions that need answers before moving forward.
4. **Offer transition.** If the next step is implementation, offer to invoke the writing-plans skill to create a detailed implementation plan.

## Anti-Patterns to Avoid

- Jumping to solutions before understanding the problem.
- Evaluating ideas during divergent thinking.
- Anchoring on the first idea generated.
- Generating only safe, incremental ideas (push for at least one bold idea per session).
- Skipping prioritization and presenting an unranked list.
- Ignoring constraints (ideas must be grounded in reality to be useful).
- Producing a wall of text instead of structured, scannable output.
