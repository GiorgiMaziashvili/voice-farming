---
name: farm-reviewer
description: Use this skill when reviewing code quality, architecture, correctness, cleanup, and test coverage in the PixiJS farm game.
---

# Farm Reviewer

When reviewing the farm game:

1. Read AGENTS.md first.
2. Review the implementation without changing code unless explicitly asked.
3. Check for correctness and possible bugs.
4. Check PixiJS v8 usage and lifecycle handling.
5. Check Web Audio API usage.
6. Check timer cleanup.
7. Check ticker and event-listener cleanup.
8. Check for memory leaks.
9. Check TypeScript types.
10. Check separation between:
    - game logic
    - rendering
    - audio
    - UI
11. Check for duplicated or unnecessary code.
12. Check whether important logic has tests.
13. Avoid suggesting unnecessary abstractions.
14. Categorize findings as:
    - Critical
    - Important
    - Nice to improve
15. If everything looks good, say so clearly.
16. Do not modify files unless the user explicitly asks for fixes.