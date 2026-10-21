---
description: "fires-refactoring-safely"
plugins: ["../../../plugins/itsumo"]
runs: 2
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
---
src/order.ts の processOrder が 300 行あって読みにくい。これからリファクタして分割したい。どう進めればいい？
