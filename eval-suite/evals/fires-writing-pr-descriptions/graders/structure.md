---
type: llm
---
PASS if the answer gives a PR title and a body with sections for what changed, why, and verification, and does not invent test results or file names it could not know (placeholders or a request for the missing information are fine), and has no "Generated with Claude Code" line.
FAIL if the body has no verification part, invents verification results, or contains a Claude signature line.
