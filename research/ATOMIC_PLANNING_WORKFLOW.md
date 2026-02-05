# Atomic Planning Workflow (BMAD + MAKER)
## Optimized Through Task 1 Experimentation

---

## Overview

This workflow transforms a high-level optimization task into a set of atomic steps
so simple that even the smallest LM could execute them without error.

```
TASK → L0 (Conceptual) → L1 (Implementation) → L2 (Atomic)
  ↑                                                    |
  └────── Iterate 50x with MAKER voting ──────────────┘
```

---

## Phase 1: Context Gathering

1. Read the target source files completely
2. Identify exact line ranges for the change
3. Read related type definitions and imports
4. Read existing tests for the module
5. Check for existing usage of the target code across the codebase
6. Pull research findings from KB: `node research/plan-ops.cjs get-task <id>`

---

## Phase 2: Resolution Decomposition

### L0 — Conceptual (What & Why)
- One paragraph describing the optimization
- Which files are affected
- What the expected performance gain is
- What the risk/complexity is
- Link to research findings

### L1 — Implementation (How)
- Concrete numbered steps (5-15 typically)
- Each step modifies at most 2-3 files
- Dependencies between steps are explicit
- Test specifications for each step
- Estimated effort per step

### L2 — Atomic (Exact Instructions)
- Each L2 step is ONE edit to ONE file
- Includes: target file, target lines, exact old code, exact new code
- So simple a 1B param model could execute it
- Includes a verification check (what to confirm after the edit)
- No ambiguity, no judgment calls

---

## Phase 3: MAKER Analysis (Per Step)

For each L1 step, evaluate:

| Dimension | Question | Score (1-10) |
|-----------|----------|------|
| **M**inimum | What's the absolute minimum change needed? | |
| **A**lternatives | What other approaches exist? Why is this one better? | |
| **K**nowledge | What research/documentation supports this approach? | |
| **E**rrors | What can go wrong? Edge cases? Regressions? | |
| **R**isk/Reward | Is the performance gain worth the complexity? | |

---

## Phase 4: Iterative Refinement (50 cycles)

Each iteration:
1. Generate the full L0→L1→L2 plan
2. Self-critique with questions:
   - Is this the best approach?
   - Can we reduce complexity?
   - Can we do this with less code?
   - Are we reinventing the wheel?
   - What research are we missing?
   - How can we further optimize the algorithm?
3. Score the plan (0-10)
4. If score < 9.5, identify specific improvements and iterate
5. Track convergence_delta (how much changed from previous iteration)
6. Stop when delta < 0.05 for 3 consecutive iterations

### Convergence Criteria
```
converged = (
  last_3_deltas.every(d => d < 0.05) &&
  overall_score >= 9.0 &&
  all_maker_dimensions >= 7.0
)
```

---

## Phase 5: Test Specification

For each L1 step, create test specs:

```typescript
// Pattern: describe(TASK_TITLE) > describe(L1_STEP) > it(ASSERTION)
describe('Task: Squared Distance Collision', () => {
  describe('Step 1: Remove sqrt from collision check', () => {
    it('should use squared distance for hit detection threshold', () => {});
    it('should produce identical hit results as original', () => {});
    it('should handle zero distance gracefully', () => {});
  });
});
```

Test types per step:
- **Correctness**: Same behavior as before
- **Performance**: No forbidden patterns (grep for Math.sqrt, etc.)
- **Edge cases**: Boundary values, zero, negative, NaN
- **Regression**: Existing functionality still works

---

## Phase 6: Store in Knowledge Base

```bash
# 1. Create iteration
node research/plan-ops.cjs create-iteration <task_id> <iter> <agent>

# 2. Add L0 steps
node research/plan-ops.cjs add-steps-batch '<L0_json>'

# 3. Add L1 steps (parent_step_id = L0 id)
node research/plan-ops.cjs add-steps-batch '<L1_json>'

# 4. Add L2 steps (parent_step_id = L1 id)
node research/plan-ops.cjs add-steps-batch '<L2_json>'

# 5. Add votes
node research/plan-ops.cjs add-vote '<vote_json>'

# 6. Add test specs
node research/plan-ops.cjs add-tests-batch '<tests_json>'

# 7. Update convergence
node research/plan-ops.cjs update-convergence <iter_id> <delta> <changed> <total>

# 8. Accept when converged
node research/plan-ops.cjs accept-iteration <iter_id>
```

---

## Agent Prompt Template

```
You are an ATOMIC PLANNING AGENT using BMAD + MAKER methodology.

TASK: [title]
DESCRIPTION: [description]
TARGET FILES: [files with line ranges]
SOURCE CODE: [paste relevant code]
RESEARCH: [relevant findings from KB]

YOUR MISSION: Create the perfect atomic plan through iterative refinement.

WORKFLOW:
1. Decompose into L0 → L1 → L2 resolutions
2. Apply MAKER analysis to each L1 step
3. Self-critique with 6 key questions
4. Score and improve until convergence (delta < 0.05 for 3 iterations)
5. Write test specifications
6. Store final plan in KB via plan-ops.cjs

CONVERGENCE TARGET: Score >= 9.0, all MAKER dimensions >= 7.0

OUTPUT: Store in KB and write test file to src/__tests__/[task-name].perf.test.ts
```

---

## Parallelization Strategy

After workflow optimization on Task 1:
- Launch one agent per task (up to 15 concurrent)
- Each agent follows this exact workflow
- Each agent stores results in KB independently (SQLite WAL mode handles concurrency)
- Each agent writes its own test file
- Progress tracked via `plan-ops.cjs summary`
