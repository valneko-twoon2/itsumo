---
description: "fires-running-regression-tests"
plugins: ["../../../plugins/itsumo"]
runs: 2
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
---
src/price.ts の税計算の丸め方を直した。この変更でテストはどう扱い、どれを走らせるべきか教えて。
