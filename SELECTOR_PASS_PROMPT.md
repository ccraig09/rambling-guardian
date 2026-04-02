# Selector Pass — Pre-Implementation Checklist

Run this before writing any code for a ticket.

---

## Ticket: [RG-X.Y.Z — Ticket Title]

### 1. Goal
One sentence: what does this ticket accomplish?

### 2. Files Declared
List every file to be touched. No others will be modified.

- [ ] `filename.cpp` — reason
- [ ] `filename.h` — reason

### 3. Existing Code to Reuse
Search for existing functions/patterns before writing new ones:

- [ ] Searched for existing implementations? (grep/glob)
- [ ] Reusing: `functionName()` in `file.cpp`

### 4. Skills (2–4)
- [ ] Skill 1: `skill-name`
- [ ] Skill 2: `skill-name`
- [ ] Skill 3 (optional): `skill-name`
- [ ] Skill 4 (optional): `skill-name`

### 5. Expert Persona
"For this ticket I am a [role] with [X years] experience in [domain]."

### 6. Test Requirements
What must be true for this ticket to be complete?

- [ ] Test / verification 1
- [ ] Test / verification 2

### 7. Phase Boundary Gate
- [ ] Is this the last ticket in the phase?
  - **YES** → Step 6 (revise-claude-md) is REQUIRED before marking complete
  - **NO** → Proceed to implementation

### 8. Risk Assessment
What could go wrong? What's the mitigation?

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| | | |

### 9. Commit Message
Conventional commit format: `type: description`
- [ ] Commit message: `________`
