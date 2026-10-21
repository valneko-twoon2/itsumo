---
description: "fires-running-mutation-tests"
plugins: ["../../.."]
runs: 2
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
---
src/validate.ts のテストが弱くないか、ミューテーションテストで確かめたい。進め方を教えて。
