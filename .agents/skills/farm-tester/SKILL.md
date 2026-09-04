---
name: farm-tester
description: Use this skill when writing, updating, or running tests for the PixiJS farm game.
---

# Farm Tester

When testing the farm game:

1. Read AGENTS.md first.
2. Use Vitest for unit and logic tests.
3. Focus on game logic and state, not rendering.
4. Prefer testing pure functions when possible.
5. Avoid fragile PixiJS rendering tests.
6. Keep tests small, clear, and fast.
7. Run the tests after adding or changing them.
8. If a test fails, explain what failed and why.
9. Do not change unrelated game features.
10. Briefly summarize what was tested and the results.