# Rambling Guardian — Agent Workflow

Per-ticket 5-step process for every implementation task.

---

## Per-Ticket Process

### Step 1: Plan
- Restate the goal in one sentence
- List every file to be touched (no surprises)
- Declare 2–4 skills to invoke (minimum 2, maximum 4)
- Declare expert persona (e.g., "Embedded systems engineer")
- List test requirements before writing any code

### Step 2: Implement
- Touch ONLY the files declared in Step 1
- No scope creep — if you discover something needs changing, note it as a risk
- Follow the event bus pattern — modules never call each other directly
- Min 2 skills active during implementation

### Step 3: Check
**Firmware:** `arduino-cli compile --fqbn esp32:esp32:XIAO_ESP32S3:PSRAM=opi .`
**App (React Native):** lint + test suite
- Fix any compiler errors or test failures before proceeding

### Step 4: Fix
- If Step 3 fails: read the error, form a hypothesis, fix one thing at a time
- Never blindly retry — understand what changed
- If blocked after 3 attempts, escalate with: error message, hypothesis, what you tried

### Step 5: Summarize
Format:
```
**What:** [one sentence describing what was built]
**Files:** [list of files changed]
**How to test:** [exact steps to verify it works]
**Risks:** [anything that might break or needs watching]
```

---

## Step 6: Phase Boundary (last ticket of each phase only)

**This step is MANDATORY, not optional.**

When completing the final ticket of a phase:
1. Run `revise-claude-md` skill to update CLAUDE.md with everything that changed
2. Capture: new tech stack items, new commands, new non-negotiables, new docs
3. Commit the updated CLAUDE.md
4. Mark `- [ ] Run revise-claude-md and commit` as `- [x]` in PHASE_PLAN.md
4. Commit PHASE_PLAN.md along with the updated CLAUDE.md

If you skip this step, the next session starts with stale context.

---

## Skills Per Ticket (min 2, max 4)

| Phase | Skills to choose from |
|-------|----------------------|
| A.1 | `revise-claude-md`, `brainstorming`, `verification-before-completion` |
| A.5 | `embedded-programmer`, `test-driven-development`, `solid` |
| B | `embedded-programmer`, `verification-before-completion`, `brainstorming` |
| C firmware | `embedded-programmer`, `solid`, `context7`, `verification-before-completion` |
| C app | `react-native-architecture`, `solid`, `brainstorming`, `test-driven-development` |
| D | `claude-api`, `test-driven-development`, `context7`, `solid` |
| E | `embedded-programmer`, `claude-api`, `test-driven-development`, `context7` |
| F | `embedded-programmer`, `solid`, `verification-before-completion` |

---

## Expert Personas Per Phase

Each ticket adopts the most relevant expert perspective:

- **Firmware** → Embedded systems engineer (10yr ESP32 experience)
- **BLE protocol** → Bluetooth SIG protocol specialist
- **React Native app** → Senior mobile architect (React Native + BLE)
- **AI coaching** → Behavioral psychologist + prompt engineer
- **Audio DSP** → Signal processing engineer
- **Battery management** → Power systems engineer
- **UX/UI design** → Product designer specializing in accessibility + ADHD
- **Cloud architecture** → Backend architect (serverless, streaming)

---

## Non-Negotiables

- Every task gets a git commit with conventional commit message
- Push to GitHub after every 2–3 tasks minimum
- Never skip the event bus pattern — all modules communicate via events
- Code review (`superpowers:requesting-code-review`) BEFORE flashing firmware
- PSRAM compile flag: always `--fqbn esp32:esp32:XIAO_ESP32S3:PSRAM=opi` — NEVER `--build-property`
