---
description: "fires-merging-subagent-work"
plugins: ["../../.."]
runs: 2
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
---
サブエージェントがブランチ feature-x で作業を終えて「全部できました」と報告してきた。main に取り込む前に何を確認すればいい？
