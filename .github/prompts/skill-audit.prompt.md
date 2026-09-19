---
description: Audit workspace skills for valid metadata, clear invocation triggers, and actionable instructions.
mode: agent
---

# Skill audit

1. Locate each workspace `SKILL.md` file and read its YAML frontmatter and body.
2. Verify that `name` is lowercase-hyphenated and matches the containing directory.
3. Verify that every description explains when the skill must be invoked and includes literal user-style trigger phrases.
4. Check that the body contains concrete numbered steps and an example output that demonstrates the skill.
5. Report each skill as pass or needs revision, including exact, minimal fixes for every failure.

## Example output

| Skill | Result | Notes |
| --- | --- | --- |
| `brand-voice` | Pass | The name matches its directory, and the description includes explicit copywriting triggers. |
| `dashboard-ui` | Needs revision | Add a literal trigger phrase such as "build a dashboard component" to the description. |
