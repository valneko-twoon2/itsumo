---
description: "fires-managing-worktrees"
plugins: ["../../../plugins/itsumo"]
runs: 2
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
---
dev サーバーがメインのフォルダを見ているので、別のフォルダで並行して作業したい。Git のワークツリーを安全に作って、終わったら消す手順を教えて。
