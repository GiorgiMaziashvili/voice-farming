---
name: farm-coordinator
description: Use this skill to coordinate development of farm game features through Builder, Tester, and Reviewer subagents.
---

# Farm Coordinator

When implementing a feature for the PixiJS farm game:

1. Read AGENTS.md first.

2. Understand the requested feature and keep its scope small.

3. Delegate implementation to a Builder subagent.
   - Builder must use the farm-builder skill.
   - Builder should implement only the requested feature.

4. After Builder finishes, delegate verification to a Tester subagent.
   - Tester must use the farm-tester skill.
   - Tester should inspect the implementation.
   - Tester should add useful tests where appropriate.
   - Avoid fragile PixiJS rendering tests.
   - Run npm test.
   - Run npm run build.

5. After testing passes, delegate a read-only review to a Reviewer subagent.
   - Reviewer must use the farm-reviewer skill.
   - Reviewer must not modify files.
   - Reviewer should report Critical, Important, and Nice to improve findings.

6. If the Reviewer finds Critical or Important issues:
   - delegate fixes back to the Builder
   - rerun the Tester
   - rerun the Reviewer

7. Repeat until:
   - tests pass
   - build passes
   - no Critical findings remain
   - no Important findings remain

8. The main agent acts as coordinator.
   - Do not duplicate work already delegated to subagents.
   - Do not make unrelated changes.
   - Do not expand the requested feature without permission.

9. Use parallel subagents only when tasks are independent.
   Implementation, testing, and final review should normally happen in sequence.

10. Finish with a concise report containing:
    - Builder changes
    - Tester changes
    - test result
    - build result
    - Reviewer result
    - whether the feature is ready