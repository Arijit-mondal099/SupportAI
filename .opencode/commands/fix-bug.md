---
description: Investigate the codebase, propose a fix plan for a bug, then implement it after approval
argument-hint: [bug description]
allowed-tools: Read, Grep, Glob
---

Bug to investigate: $ARGUMENTS

Follow this process exactly, in order. Do not skip the approval gate in Phase 2 —
do not write or edit any code until the user has explicitly approved the plan.

## Phase 1: Investigate

1. Search the codebase for files, functions, and call paths relevant to the bug
   description above (grep for related identifiers/error strings, follow imports,
   check tests that touch this area).
2. Trace the root cause. Don't stop at the first suspicious line — confirm it
   actually explains the reported symptom before treating it as the cause.
3. Note any code that a fix here could affect: other callers, similar patterns
   elsewhere in the codebase, existing tests covering this path.

## Phase 2: Plan (stop here and wait for approval)

Present findings in this exact format, then stop. Do not proceed to Phase 3
until the user responds.

**Root cause:** <what's actually wrong, one paragraph>
**Files to change:** <list of file paths>
**Proposed fix:** <concrete changes, file by file — no unrelated refactors>
**Risk / side effects:** <what could break, if anything>
**Test plan:** <how you'll verify the fix once applied>

If the user requests changes to the plan, revise and re-present it — still no
code changes — until they approve.

## Phase 3: Approval to implement

Ask the user: _"Approve enabling mutation tools (Bash, Edit, Write) to proceed
with implementation?"_ Wait for an explicit yes before continuing.

## Phase 4: Implement (only after explicit approval)

- Make exactly the changes described in the approved plan. Nothing more —
  no adjacent cleanup, no "while I'm here" improvements.
- Run the verification from the test plan (or point out how the user should).
- Report back only what changed, mapped to the plan. If your changes made any
  imports/variables unused, remove those; leave pre-existing dead code alone.
