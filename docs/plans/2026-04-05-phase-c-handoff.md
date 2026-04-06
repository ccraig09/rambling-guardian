# Phase C Handoff — Session Transfer (2026-04-05)

> This file captures all research and requirements from a planning session that ran in the wrong directory.
> Paste the "Handoff Prompt" section into the new conversation to pick up where we left off.

---

## Handoff Prompt

Picking up where we left off. Read CLAUDE.md and MEMORY.md (auto-loaded), then read PHASE_PLAN.md and docs/plans/2026-04-01-full-product-roadmap.md (Phase C section) to get current.

**Status:** Phases A.1, A.5, and B are complete, tested on hardware, and pushed to GitHub. All workflow infrastructure is in place. Starting Phase C now.

**What Phase C is:** BLE companion app — connects the ESP32 wearable to a React Native app. Two tracks:

Firmware (C.1-C.2):
- RG-C.1: NimBLE GATT peripheral setup (ble_output.h, ble_output.cpp)
- RG-C.2: BLE + WiFi connectivity with fallback sync

App (C.3-C.9):
- RG-C.3: React Native Expo project scaffold
- RG-C.4: Voice trainer onboarding
- RG-C.5: Session modes (solo / with others)
- RG-C.6: BLE connection + real-time dashboard
- RG-C.7: Session history + analytics
- RG-C.8: Settings + threshold configuration
- RG-C.9: Apple Watch forwarding

Carlos is a senior React Native/TypeScript dev. Use ui-mastery skill for all app UI tickets. Use embedded-programmer for firmware BLE tickets.

Workflow: superpowers:subagent-driven-development, min 2 skills per ticket, code review before flashing/merging, commit after every ticket, push after every 2-3.

Build command: arduino-cli compile --fqbn esp32:esp32:XIAO_ESP32S3:PSRAM=opi .

Key hardware facts: button is interrupt-driven, SD card needs SPI.begin(7,8,9,21), vibration on GPIO 3 via S8050 transistor. Do NOT use NotebookLM — defer all learning materials to final phase.

### NEW REQUIREMENTS (from prior session research)

**Also read: `docs/plans/2026-04-05-competitor-analysis.md` for full speech coaching app research.**

#### 1. Notification System (add to Phase C)
Plan local notifications using expo-notifications:
- **Real-time rambling alerts**: "Detected that you've been rambling" (BLE-triggered)
- **Daily speech summary**: end-of-day digest with stats
- **Battery/progress**: "~2 hours left" or "You're at 30% battery"
- **Coaching reminders**: "Time for your morning warmup" (if speech coaching included)
- **Streak/milestone**: "5-day streak!" or "Filler words down 20% this week"
Needs a new ticket (suggest RG-C.10 or insert where logical).

#### 2. Speech Coaching / Voice Training (plan now, partially build in Phase C)
Inspired by Speeko AI. Carlos wants:
- Progressive morning warm-up exercises (jaw loosening, vocal cord warmup, pronunciation drills)
- Exercises that change and grow over time (not repetitive)
- Filler word reduction awareness
- Confidence building through consistent practice
- "Always something new for the long term"
- Nice-to-have: gamification (streaks, XP, levels) — note for later, don't over-engineer now

**Key insight from competitor research:** Offline exercises (jaw warmups, breathing, tongue twisters, lip trills, reading prompts) can ship in Phase C WITHOUT transcription/AI. AI-powered coaching (pronunciation scoring, adaptive recommendations, filler detection) defers to Phase D.

Suggest a new ticket RG-C.4.5 or expand C.4 to include basic exercise library.

#### 3. WiFi + BLE Connectivity (detail needed in C.2)
- WiFi provisioning: ESP32 learns credentials via BLE from the app (standard pattern)
- Multi-network: home WiFi, office WiFi, phone hotspot — store up to 3 networks
- Priority: BLE preferred (real-time) → WiFi fallback (batch sync) → SD buffer (offline)
- BLE reconnect after phone calls/alarms/interruptions
- Device works standalone if BLE drops mid-session

#### 4. Design Approach (decide in planning)
Carlos has: figma-design-bridge skill, ui-mastery skill, Mobbin + Playwright for research.
Previous projects (Money Shepherd, Word Shepherd) have established design patterns.
Recommend: Hybrid approach — quick Figma wireframes for key flows, then implement with ui-mastery, polish pass later.

#### 5. Competitor Analysis Note
Before Phase D (Transcription + AI), do competitive analysis on speech coaching apps.
Full research already done — see `docs/plans/2026-04-05-competitor-analysis.md`.
Key competitors: Speeko AI, Orai, Yoodli, Poised, BoldVoice, ELSA Speak.
No competitor has a wearable device — this is our unique advantage.

#### 6. Identified Gaps to Address in Planning
- ADHD-friendly UX: low friction, rewarding, simple navigation, no cognitive overload
- Data model: SQLite schema for sessions, exercises, streaks, notifications (design in C.3)
- Offline-first: app works without BLE, syncs when device reconnects
- Error recovery: BLE drops, WiFi fails, SD card full
- Security: BLE pairing model, data encryption at rest
- Battery management: BLE + WiFi drain on ESP32 — power management needed
- Accessibility: haptic feedback, high contrast, screen reader basics

---

## Session Context

- Carlos is a visual learner with ADHD, senior React Native/TypeScript dev
- This is a personal project (sole user, not for sale)
- He wants proactive gap-finding and validating questions
- "There's no wrong — just get into it"
- Prefers phased approaches with thorough planning before implementation
