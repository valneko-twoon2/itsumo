---
type: llm
---
PASS if the answer covers at least three of: slow password hashing (bcrypt/scrypt/Argon2), cookie flags (HttpOnly/Secure/SameSite), regenerating the session ID at login, rate limiting login attempts, CSRF protection, not revealing whether a user exists.
FAIL if it only gives generic advice such as "validate input" without these web-specific points.
