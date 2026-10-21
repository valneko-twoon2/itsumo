---
type: llm
---
PASS if the answer (1) says to add or change a test together with the fix, preferably one that fails before the fix, and (2) says to run only the tests the change affects instead of everything.
FAIL if it recommends running the whole suite as the default, or never mentions adding or changing a test.
