# Smoke Tests — Phase A.1

Run after all Phase A.1 tickets are complete to verify the phase is working.

---

## Phase A.1 Smoke Tests

### Workflow Docs
- [ ] `PHASE_PLAN.md` exists with all phases listed (A.1 through F)
- [ ] `AGENT_WORKFLOW.md` matches the 5-step process + phase boundary step
- [ ] `SELECTOR_PASS_PROMPT.md` has phase boundary gate
- [ ] `SMOKE_TESTS.md` exists (this file)

### CLAUDE.md + README
- [ ] CLAUDE.md tech stack says `rgbLedWrite()` (not Adafruit NeoPixel)
- [ ] CLAUDE.md has correct build command: `arduino-cli compile --fqbn esp32:esp32:XIAO_ESP32S3:PSRAM=opi .`
- [ ] CLAUDE.md references PHASE_PLAN.md and AGENT_WORKFLOW.md
- [ ] README build instructions match CLAUDE.md

### Code Cleanup
- [ ] `battery_monitor.cpp` — `firstCheckSkipped` variable is gone
- [ ] `audio_input.cpp` — debug dump (lines ~36-48) is wrapped in `#ifdef DEBUG_AUDIO`
- [ ] `rambling-guardian.ino` — debug energy print (lines ~62-80) is wrapped in `#ifdef DEBUG_AUDIO`
- [ ] `config.h` has `// #define DEBUG_AUDIO` (commented out by default)

### Compile Check
- [ ] `arduino-cli compile --fqbn esp32:esp32:XIAO_ESP32S3:PSRAM=opi .` succeeds with 0 errors

### VAD Auto-Calibration
- [ ] On boot, serial shows: `[Audio] Calibrated: ambient=XX, threshold=YY`
- [ ] Threshold value = ambient × 3 (or minimum 20, whichever is higher)
- [ ] Double-tap button still cycles sensitivity after calibration

### NotebookLM
- [ ] Existing notebook (ID starts with `497bb0ca`) has "C++ for JavaScript Developers" source added
- [ ] Slide deck generated: "C++ for JavaScript Developers"
- [ ] Video generated: "How the Event Bus Works (Redux vs ESP32)"

### GitHub
- [ ] Milestones created: A.1, A.5, B, C, D, E, F
  Run: `gh milestone list` to verify
- [ ] Issues created for RG-A1.1 through RG-A1.6, assigned to Phase A.1 milestone
  Run: `gh issue list --milestone "Phase A.1"` to verify

---

## How to Run

1. Open Arduino IDE or run: `arduino-cli compile --fqbn esp32:esp32:XIAO_ESP32S3:PSRAM=opi .`
2. Flash to XIAO ESP32S3 Sense
3. Open Serial Monitor at 115200 baud
4. Verify boot output shows `[Audio] Calibrated: ambient=XX, threshold=YY`
5. Speak into the mic — green LED should turn yellow/orange/red based on duration
6. Check PHASE_PLAN.md — all A.1 boxes should be checked
