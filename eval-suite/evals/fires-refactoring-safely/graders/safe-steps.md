---
type: llm
---
PASS if the answer says to make sure tests pin the current behavior first (adding them if missing), to proceed in small steps running the tests after each, and not to mix behavior changes or bug fixes into the refactoring.
FAIL if it proposes rewriting the function in one go without tests, or mixes in behavior changes.
