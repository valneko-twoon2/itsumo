---
type: llm
---
PASS if the answer says to understand what each side changed and why before choosing, to keep both changes when they are compatible instead of silently dropping one, to make sure no conflict markers remain, and to run build and tests after resolving.
FAIL if it suggests blindly taking one side (for example checkout --ours or --theirs for the whole file) without reading the changes.
