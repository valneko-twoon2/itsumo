---
type: llm
---
PASS if the answer says to read the changelog or release notes for breaking changes, to upgrade only that dependency (not everything at once), to update the lockfile with the package manager command, and to run build and tests afterwards.
FAIL if it proposes upgrading all dependencies at once, editing the lockfile by hand, or skipping verification.
