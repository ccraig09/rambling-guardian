# Personal Recording Multitool - Product Requirements Document (PRD)

## 1. Vision One-Pager

### Problem Statement

Individuals with ADHD and busy professionals struggle to capture fleeting ideas, maintain focus in conversations, and efficiently document meetings. Current solutions are either too intrusive (phones), too limited (voice recorders), or lack intelligent processing capabilities.

### Outcome Vision

A discrete, wearable AI companion that seamlessly captures, transcribes, and intelligently processes audio throughout the day, while providing gentle behavioral feedback to improve communication patterns.

### Key Differentiators

- **Ultra-minimal design**: "barely know it's there" wearability
- **Behavioral intelligence**: First device to detect and alert on rambling/digression
- **Faith-driven mission**: Designed to be shared as a blessing to help others
- **Raspberry Pi foundation**: Open-source friendly, hackable platform
- **Multi-modal feedback**: Haptic, audio, and visual alerts

## 2. Objectives & Key Results

### Primary Objective

Create a wearable recording device that enhances personal productivity and communication quality through AI-powered audio processing and behavioral feedback.

### Key Results

1. **Capture Rate**: 95% successful capture of intended ideas/conversations
2. **Rambling Reduction**: 50% decrease in rambling incidents after 30 days of use
3. **User Satisfaction**: 4.5+ star rating on ease of use and discreteness
4. **Battery Life**: Minimum 12-hour operation on single charge
5. **Processing Time**: <2 minutes from recording to processed notes

## 3. User Personas (Expanded)

### Primary: "Carlos the Creative Wanderer"

- **Age**: 30-45, technical background
- **Context**: ADHD diagnosis, active mind, multiple projects
- **Goals**: Never lose an idea, stay focused in conversations, maintain relationships
- **Frustrations**: Forgetting brilliant ideas, annoying spouse with rambling, scattered notes
- **Tech comfort**: High (builds with Raspberry Pi)
- **Success looks like**: "I captured every idea today and my wife didn't have to interrupt me once!"

### Secondary: "Sarah the Supportive Spouse"

- **Age**: 30-45, varying technical comfort
- **Context**: Lives with ADHD partner, wants harmony
- **Goals**: Gently redirect partner without confrontation
- **Frustrations**: Feeling unheard, having to constantly interrupt
- **Tech comfort**: Medium
- **Success looks like**: "The device alerted him he was rambling before I had to say anything"

### Tertiary: "Marcus the Meeting Master"

- **Age**: 25-55, professional setting
- **Context**: Back-to-back meetings, needs documentation
- **Goals**: Perfect meeting notes without typing
- **Frustrations**: Missing key points while taking notes
- **Tech comfort**: Medium-High
- **Success looks like**: "I was fully present in the meeting and still got comprehensive notes"

## 4. User Journeys

### Journey 1: First-Time Setup

1. **Unboxing**: User receives device, minimal packaging with quick-start guide
2. **Charging**: Plug in USB-C, LED indicates charging status
3. **Pairing**: Download companion app, Bluetooth pair in <30 seconds
4. **Calibration**: Record test audio, adjust sensitivity
5. **Customization**: Set rambling thresholds, alert preferences
6. **Success**: "Wow, that was easier than setting up my smartwatch!"

### Journey 2: Daily Idea Capture

1. **Trigger**: Random idea strikes while walking
2. **Activation**: Double-tap device or voice command "Note this"
3. **Recording**: Speak idea naturally, device vibrates when captured
4. **Processing**: Auto-transcribes and categorizes in background
5. **Review**: See organized notes in app later
6. **Success**: "I didn't have to stop walking or pull out my phone!"

### Journey 3: Rambling Intervention

1. **Context**: In conversation with spouse about weekend plans
2. **Detection**: Device recognizes digression pattern after 45 seconds
3. **Alert**: Gentle vibration pattern on wrist
4. **Correction**: User realizes and refocuses conversation
5. **Positive reinforcement**: App later shows improved focus metrics
6. **Success**: "I caught myself before she had to say anything!"

## 5. Feature Slices & Prioritization

### Slice 1: MVP - Basic Recording & Transcription

- Audio capture with button trigger
- Wi-Fi sync to companion app
- Cloud transcription service integration
- Basic note organization
- 8-hour battery life
- **Timeline**: 8 weeks

### Slice 2: Behavioral Intelligence

- Continuous monitoring mode
- Rambling detection algorithm (v1)
- Configurable haptic alerts
- Conversation analytics dashboard
- **Timeline**: 6 weeks

### Slice 3: Advanced Processing

- Local wake word detection
- Multi-context awareness (meeting vs casual)
- Smart summarization
- Integration with calendar/task apps
- **Timeline**: 8 weeks

### Slice 4: Social & Sharing

- Device sharing/family modes
- Anonymous rambling pattern database
- Community alert patterns
- Open-source hardware release
- **Timeline**: 4 weeks

## 6. System Context & Capability Matrix

### External Actors

- **User**: Primary device wearer
- **Conversation Partners**: People being recorded (consent required)
- **Companion App**: iOS/Android application
- **Cloud Services**: Transcription, AI processing, storage
- **Third-party Apps**: Calendar, note-taking, task management

### Capability Matrix

| Domain             | CRUD   | Workflow                      | Realtime        | AI/ML               |
| ------------------ | ------ | ----------------------------- | --------------- | ------------------- |
| Audio Capture      | Create | Record → Buffer → Store       | Yes (streaming) | Noise reduction     |
| Transcription      | Read   | Upload → Process → Retrieve   | No              | Speech-to-text      |
| Note Management    | CRUD   | Capture → Categorize → Review | No              | Summarization       |
| Rambling Detection | Read   | Monitor → Analyze → Alert     | Yes             | Pattern recognition |
| User Settings      | CRUD   | Configure → Apply → Sync      | No              | Preference learning |
| Analytics          | Read   | Collect → Aggregate → Display | No              | Trend analysis      |

## 7. User Stories & Acceptance Criteria

### Epic 1: Core Recording

**Story 1.1**: As a user, I want to quickly start recording so I can capture ideas without friction

- **Given** device is in standby mode
- **When** I double-tap the device
- **Then** recording starts within 0.5 seconds with haptic confirmation

**Story 1.2**: As a user, I want automatic recording stops so I don't waste battery

- **Given** recording is active
- **When** no speech detected for 10 seconds
- **Then** recording stops and saves automatically

### Epic 2: Rambling Detection

**Story 2.1**: As a user, I want rambling alerts so I can refocus conversations

- **Given** I'm in conversation mode
- **When** rambling pattern detected per my settings
- **Then** device vibrates with my chosen pattern

**Story 2.2**: As a spouse, I want custom alert sounds so I know when to expect redirection

- **Given** partner's device detects rambling
- **When** alert threshold reached
- **Then** my app plays chosen sound/phrase

### Epic 3: Data Management

**Story 3.1**: As a user, I want secure cloud sync so my data is safe

- **Given** device has recordings pending sync
- **When** connected to Wi-Fi
- **Then** encrypted upload completes with confirmation

## 8. Hardware Specifications & BOM

### Form Factor Requirements

- **Dimensions**: <50mm x 30mm x 10mm (bracelet) or <30mm diameter (pin)
- **Weight**: <30 grams
- **Material**: Hypoallergenic silicone/plastic
- **Water resistance**: IPX4 minimum

### Bill of Materials - Three Tiers

#### Tier 1: MVP Prototype (~$65)

| Component             | Specification            | Source   | Price | Link                                                                                        |
| --------------------- | ------------------------ | -------- | ----- | ------------------------------------------------------------------------------------------- |
| Raspberry Pi Zero 2 W | 1GHz, 512MB RAM, WiFi/BT | Adafruit | $15   | [Adafruit](https://www.adafruit.com/product/5291)                                           |
| MEMS Microphone       | SPH0645LM4H I2S          | SparkFun | $8    | [SparkFun](https://www.sparkfun.com/products/14386)                                         |
| LiPo Battery          | 500mAh 3.7V              | Adafruit | $8    | [Adafruit](https://www.adafruit.com/product/1578)                                           |
| Charging Circuit      | MicroLipo USB            | Adafruit | $7    | [Adafruit](https://www.adafruit.com/product/1904)                                           |
| Vibration Motor       | 3V Disc                  | Digi-Key | $3    | [Digi-Key](https://www.digikey.com/en/products/detail/adafruit-industries-llc/1201/5353656) |
| LED + Resistor        | Status indicator         | Local    | $1    | RadioShack/Local                                                                            |
| Enclosure             | 3D printed               | N/A      | $10   | Local makerspace                                                                            |
| Misc (wires, etc.)    | Jumpers, headers         | Various  | $13   | Various                                                                                     |

#### Tier 2: Advanced Prototype (~$95)

| Component             | Specification              | Source    | Price |
| --------------------- | -------------------------- | --------- | ----- |
| Raspberry Pi Pico W   | RP2040, WiFi, lower power  | Adafruit  | $10   |
| PDM Microphone Array  | Dual mic for better pickup | Adafruit  | $15   |
| LiPo Battery          | 1000mAh for longer life    | SparkFun  | $12   |
| Power Management IC   | Efficient charging/boost   | Mouser    | $8    |
| Haptic Driver         | DRV2605L for rich feedback | Adafruit  | $10   |
| OLED Display          | 128x32 for status          | Adafruit  | $13   |
| Professional PCB      | Custom designed            | OSH Park  | $20   |
| Injection molded case | Prototype run              | Protolabs | $50   |

#### Tier 3: Production Ready (~$45 in qty 100)

- Custom SoC with integrated audio DSP
- Advanced power management
- Multi-zone haptic feedback
- Professional enclosure with magnetic charging
- FCC/CE certification ready

### Oklahoma Supplier Recommendations

1. **Primary**: [Adafruit](https://www.adafruit.com) - Excellent tutorials, ships to OK
2. **Secondary**: [SparkFun](https://www.sparkfun.com) - Good selection, educational resources
3. **Components**: [Digi-Key](https://www.digikey.com) - Comprehensive catalog, fast shipping
4. **Specialized**: [Mouser Electronics](https://www.mouser.com) - Dallas warehouse, next-day to OK
5. **Local**: Check Oklahoma City's [Rockwell Automation](https://www.rockwellautomation.com) for industrial components

### SunFounder Kit Compatibility

Your existing SunFounder kit likely includes:

- Jumper wires (reusable)
- Breadboard (for prototyping)
- Basic resistors/LEDs (status indicators)
- Perhaps GPIO expanders or I2C devices

These can accelerate prototyping before custom PCB design.

## 9. Technical Architecture Diagrams

### System Flow Diagram Description

```
[Microphone] → [ADC/I2S Interface] → [Audio Buffer]
                                           ↓
[User Input] → [GPIO Triggers] → [Main Processor (Pi)]
                                           ↓
                                    [Local Storage]
                                           ↓
[WiFi/BT Module] ← [Sync Manager] ← [Audio Files]
        ↓                                  ↓
[Companion App] ← → [Cloud Services] → [AI Processing]
        ↓                                  ↓
[User Interface] ← [Processed Notes] ← [Analytics]
```

### Data Flow for Rambling Detection

```
Audio Stream → Sliding Window Buffer (30s)
                        ↓
            Speech-to-Text Engine
                        ↓
            Token/Pattern Analysis
                        ↓
    Rambling Score Calculator (per second)
                        ↓
         Threshold Comparison → Alert?
                                  ↓
                          Haptic Feedback
```

### Power Management State Machine

```
Deep Sleep (5μA) → Button Press → Wake & Init (50mA)
     ↑                                   ↓
     ↑                            Active Recording (200mA)
     ↑                                   ↓
     ← ← ← Idle (20mA) ← ← Process & Sync (150mA)
```

## 10. TDD Requirement Pack

### Test Categories & Coverage Targets

- **Unit Tests**: 85% coverage on business logic
- **Integration Tests**: 70% coverage on hardware interfaces
- **End-to-End Tests**: Key user journeys
- **Performance Tests**: Battery life, processing latency
- **Accessibility Tests**: Haptic pattern recognition

### Critical Test Cases

#### Hardware Tests

```gherkin
Given_DeviceInSleepMode_When_ButtonPressed_Then_WakesIn500ms
Given_AudioBufferFull_When_NewAudioArrives_Then_OldestDropped
Given_BatteryBelow10Percent_When_RecordingActive_Then_GracefulShutdown
```

#### Rambling Detection Tests

```gherkin
Given_NormalConversation_When_30SecondsElapse_Then_NoAlert
Given_RamblingPattern_When_ThresholdExceeded_Then_VibratePattern1
Given_MultipleDigressions_When_In5Minutes_Then_IncreasedAlertIntensity
```

#### Sync Tests

```gherkin
Given_5RecordingsPending_When_WiFiConnects_Then_SyncWithin30Seconds
Given_SyncInProgress_When_ConnectionLost_Then_ResumeFromCheckpoint
Given_CloudServiceDown_When_SyncAttempted_Then_QueueForRetry
```

### Non-Functional Requirements

- **Latency**: <500ms from trigger to recording start
- **Battery**: 12+ hour typical use (100 recordings)
- **Storage**: 24 hours of compressed audio
- **Sync**: Background sync without user intervention
- **Privacy**: End-to-end encryption, local consent storage
- **Accessibility**: Works with screen readers, clear haptic patterns

## 11. Risk Register & Mitigations

### Technical Risks

| Risk                          | Probability | Impact | Mitigation                                                                       |
| ----------------------------- | ----------- | ------ | -------------------------------------------------------------------------------- |
| Battery life insufficient     | High        | High   | Dual optimization: hardware (efficient components) + software (aggressive sleep) |
| Rambling detection inaccurate | High        | Medium | Start simple (time-based), iterate with user feedback, allow manual adjustment   |
| Audio quality poor            | Medium      | High   | Test multiple microphones, implement noise reduction, allow quality settings     |
| Raspberry Pi performance      | Medium      | Medium | Profile extensively, consider hardware acceleration, optimize algorithms         |

### User Experience Risks

| Risk                  | Probability | Impact | Mitigation                                                            |
| --------------------- | ----------- | ------ | --------------------------------------------------------------------- |
| Device too noticeable | Medium      | High   | Multiple form factors, user testing, minimal design iterations        |
| Alert fatigue         | High        | Medium | Smart alerting, customizable thresholds, positive reinforcement       |
| Privacy concerns      | High        | High   | Clear consent UX, local processing options, transparent data handling |

### Business/Regulatory Risks

| Risk                     | Probability | Impact   | Mitigation                                                           |
| ------------------------ | ----------- | -------- | -------------------------------------------------------------------- |
| Recording law compliance | High        | Critical | Implement consent features, research state laws, clear documentation |
| Patent infringement      | Low         | Medium   | Prior art search, unique implementation focus                        |
| Manufacturing complexity | Medium      | Medium   | Start with maker community, scale gradually                          |

## 12. Implementation Roadmap

### Phase 1 (Weeks 1-8): MVP Hardware

- [ ] Component sourcing and testing
- [ ] Breadboard prototype with basic recording
- [ ] Simple companion app (recording list)
- [ ] Battery life optimization
- [ ] 3D printed enclosure v1

### Phase 2 (Weeks 9-14): Core Intelligence

- [ ] Transcription service integration
- [ ] Rambling detection v1 (time-based)
- [ ] Haptic feedback patterns
- [ ] Enhanced companion app
- [ ] Field testing with 5 users

### Phase 3 (Weeks 15-22): Polish & Expand

- [ ] Rambling detection v2 (ML-based)
- [ ] Multi-user support
- [ ] Third-party integrations
- [ ] Hardware revision based on feedback
- [ ] Beta program launch (25 users)

### Phase 4 (Weeks 23-26): Launch Preparation

- [ ] Final hardware design
- [ ] Compliance testing
- [ ] Documentation and tutorials
- [ ] Community platform setup
- [ ] Soft launch to maker community

## 13. Success Metrics & Validation

### Quantitative Metrics

- Daily active usage rate >80%
- Average 15+ recordings per day
- <2% hardware failure rate
- 90% successful sync rate
- 4.5+ app store rating

### Qualitative Validation

- User testimonials about relationship improvement
- Reduced meeting follow-up clarifications
- Increased idea-to-implementation rate
- Community contributions to rambling detection
- Positive accessibility reviews

## 14. Open Questions for Next Session

### Product Decisions

1. Should rambling detection be speaker-dependent (trained on user) or generic?
2. Is visual feedback (LED patterns) important or is haptic sufficient?
3. Should the device support multiple user profiles on same hardware?

### Technical Clarifications

1. Preferred wake word for hands-free activation?
2. Acceptable false positive rate for rambling detection?
3. Should transcription support multiple languages initially?

### Business Model

1. Open source hardware from day 1 or after initial sales?
2. Subscription for cloud services or one-time purchase?
3. Enterprise version for meeting rooms?

## 15. Appendix: Preliminary Code Architecture

### Core Modules (Python/MicroPython)

```
recording-multitool/
├── audio/
│   ├── capture.py      # I2S/ADC interface
│   ├── buffer.py       # Circular buffer management
│   └── processing.py   # Noise reduction, VAD
├── alerts/
│   ├── haptic.py       # Vibration patterns
│   ├── led.py          # Visual feedback
│   └── audio.py        # Optional sound alerts
├── ml/
│   ├── rambling.py     # Detection algorithm
│   ├── transcribe.py   # STT integration
│   └── summarize.py    # Note processing
├── sync/
│   ├── wifi.py         # Network management
│   ├── api.py          # Cloud service client
│   └── queue.py        # Offline sync queue
├── power/
│   ├── states.py       # Power state machine
│   └── monitor.py      # Battery management
└── main.py             # Application entry
```

This PRD serves as the living document for the Personal Recording Multitool project, bridging the founder's vision with actionable implementation plans.
