# Gaze Companion

Project Prompt: AI-Powered Eye-Tracking Assistive Computer Interface

You are a senior software engineer, computer-vision researcher, HCI specialist, and accessibility-technology developer.

I want you to design and build a complete eye-tracking assistive computer interface for people with motor impairments or disabilities that make using a conventional mouse and keyboard difficult.

The system should use a standard webcam to track the user's eyes and convert their gaze into computer input.

However, this should not be treated as a simple "webcam eye tracker that moves a mouse."

The goal is to build an intelligent, personalized accessibility system that understands the user's gaze, learns their behavior, reduces accidental interactions, and provides alternative ways to control a computer.

The system should ultimately support:

Eye movement → Gaze estimation → Personalized calibration → Gaze stabilization → Intent detection → Target recognition → Cursor control → Accessible interaction

with optional:

Voice → Commands / Dictation

1. Core Objective

Build an application that allows a person with limited or impaired motor control to interact with a computer primarily through:

Eye movement

Gaze

Dwell interaction

Optional voice commands

Optional facial/eye gestures

The application should be designed around the principle:

The computer should adapt to the user rather than forcing the user to adapt to the computer.

The system should continuously attempt to make interaction:

Accurate

Stable

Predictable

Forgiving

Low-effort

Customizable

Accessible

Safe

2. Target Users

Design for users who may have:

Limited hand movement

Tremors

Slow or involuntary movements

Difficulty holding a mouse

Difficulty clicking physical buttons

Difficulty performing precise movements

Limited range of motion

Difficulty keeping their head completely still

Different eye shapes and facial structures

Glasses

Different seating positions

Different lighting conditions

Different webcam qualities

Fatigue during extended use

Do not assume the user has perfect control of their eyes or head.

The system should tolerate imperfect input.

3. High-Level Architecture

Design the system as modular components.

A proposed architecture is:

                    ┌─────────────────────┐
                    │      Webcam         │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Face / Eye Tracking │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Gaze Estimation    │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ User Calibration    │
                    │ & Personalization   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Gaze Stabilization  │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Intent Prediction   │
                    └──────────┬──────────┘
                               │
                 ┌─────────────┴──────────────┐
                 ▼                            ▼
        ┌─────────────────┐          ┌─────────────────┐
        │ Target Detection│          │ Cursor Control  │
        └────────┬────────┘          └────────┬────────┘
                 │                            │
                 └────────────┬───────────────┘
                              ▼
                    ┌─────────────────────┐
                    │ Accessible Input    │
                    │ - Dwell Click       │
                    │ - Safe Mode         │
                    │ - Drag              │
                    │ - Scroll            │
                    └──────────┬──────────┘
                               │
                ┌──────────────┴───────────────┐
                ▼                              ▼
       ┌─────────────────┐            ┌─────────────────┐
       │ Virtual Keyboard│            │ Voice Interface │
       └─────────────────┘            └─────────────────┘


Keep the implementation modular so individual components can be improved later.

4. Webcam and Computer Vision

Use the webcam to continuously observe the user.

The system should detect:

Face

Eyes

Iris/pupil position where possible

Facial landmarks

Head orientation

Eye openness

Blinking

Tracking confidence

Investigate appropriate technologies such as:

OpenCV

MediaPipe Face Landmarker / Face Mesh

Iris/eye landmark tracking

Head-pose estimation

Lightweight gaze-estimation models

Other appropriate computer-vision approaches

Do not blindly select a technology.

Explain the tradeoffs between different approaches.

Prefer local processing.

Camera footage should not be uploaded to a remote server by default.

5. Personalized Calibration

Create an accessible calibration system.

Display large targets at different screen locations.

For example:

┌────────────────────────────────────────────┐
│ ●                                      ●   │
│                                            │
│                                            │
│ ●                 ●                        │
│                                            │
│                              ●             │
│                                            │
│ ●                       ●              ●   │
└────────────────────────────────────────────┘


The user looks at each target.

For every target:

Collect multiple gaze samples.

Ignore obvious outliers.

Determine tracking confidence.

Associate gaze features with screen coordinates.

Build a personalized gaze-to-screen mapping.

Investigate:

Linear regression

Polynomial regression

Affine transformations

Homography

Personalized machine-learning models

Other appropriate lightweight approaches

Select the best approach based on accuracy, computational cost, and robustness.

6. Calibration Recovery

Do not require the user to completely recalibrate every time accuracy decreases.

Implement partial calibration recovery.

For example:

If the system determines that:

Top-left     → Accurate
Top-right    → Accurate
Center       → Accurate
Bottom-left  → Inaccurate
Bottom-right → Inaccurate


the user should be able to recalibrate only the problematic regions.

The system should maintain a calibration model that can be updated incrementally.

Investigate whether calibration can be continuously improved from normal user interactions without requiring explicit recalibration every time.

However, do not silently learn from interactions in a way that could cause increasingly inaccurate behavior.

Provide transparency and an option to disable adaptive calibration.

7. Gaze Stabilization and Personalization

Raw webcam gaze data will be noisy.

Implement intelligent gaze stabilization.

Investigate:

Moving averages

Exponential smoothing

Low-pass filters

Median filters

Kalman filtering

Adaptive filtering

However, do not apply identical filtering to every user.

Different users may naturally have different eye-movement patterns.

The application should learn a user's characteristics, including:

Typical gaze speed

Typical micro-movements

Natural fixation duration

Typical jitter

Head movement

Gaze stability

Interaction speed

Use this information to personalize cursor behavior.

For example:

A user with naturally stable gaze might receive:

High responsiveness + minimal smoothing

while a user with significant gaze jitter might receive:

More smoothing + larger movement thresholds

The system should gradually personalize itself rather than requiring the user to manually configure every parameter.

8. Intelligent Target Snapping

Implement target snapping.

The system should recognize when the user's gaze is close to an interactive element on the screen.

For example:

              Button
        ┌─────────────────┐
        │     SUBMIT      │
        └─────────────────┘
                  ↑
              Gaze point


If the gaze is close enough to the button, the cursor can intelligently move toward the center of the target.

The objective is to compensate for small gaze-estimation errors.

Investigate ways to identify targets using:

Accessibility APIs

Operating-system UI information

Application accessibility trees

Computer vision

Screen analysis

OCR

UI element detection

Prefer semantic/accessibility information when available rather than relying entirely on visual guessing.

Target snapping should be:

Adjustable

Optional

Smooth

Predictable

Never make snapping so aggressive that the cursor jumps to unexpected locations.

9. Intent Prediction

One of the most important advanced features is intent prediction.

The system should attempt to distinguish between:

Looking

The user is simply looking at an object.

versus:

Intending to interact

The user is deliberately trying to select or activate the object.

Do not assume:

"User looked at button = user wants to click button."

Instead, consider multiple signals:

Gaze position

Gaze duration

Gaze stability

Movement trajectory

Previous gaze location

Target size

Repeated fixation

Dwell behavior

User interaction history

Optional voice command

Optional facial/eye gestures

Develop an intent-confidence score.

For example:

Gaze confidence:       94%
Target confidence:     91%
Intent confidence:     37%

→ Do NOT click


versus:

Gaze confidence:       96%
Target confidence:     95%
Intent confidence:     93%

→ Interaction permitted


The exact implementation should be determined through experimentation.

The system must prioritize avoiding accidental actions.

10. Adaptive Dwell Clicking

Implement dwell clicking.

Basic behavior:

User looks at target
        ↓
Cursor enters target
        ↓
Target becomes highlighted
        ↓
Dwell timer begins
        ↓
User maintains gaze
        ↓
Progress indicator fills
        ↓
Click occurs


But make the dwell system adaptive.

The application should monitor:

Successful clicks

Missed clicks

Accidental clicks

Cancelled interactions

User behavior

Target size

Gaze stability

If accidental clicks happen frequently, the system should increase the required dwell time.

If the user consistently performs accurate intentional clicks, it may gradually reduce dwell time.

For example:

Default dwell:
1000 ms

High accidental-click rate:
1500 ms

Stable experienced user:
700 ms


Do not allow adaptive behavior to become unpredictable.

Provide:

Minimum dwell time

Maximum dwell time

Automatic mode

Manual mode

Reset personalization

11. Safe Mode

Implement a Safe Mode for users who frequently look at things without intending to activate them.

In Safe Mode:

Looking moves the cursor, but does NOT automatically click.

The user must deliberately activate clicking.

Possible mechanisms include:

Voice command

Dedicated accessibility toolbar button

Specific dwell gesture

Long dwell

Blink pattern

Eye gesture

Keyboard shortcut

External switch if eventually supported

The user should be able to switch between:

Normal Mode

Gaze + dwell can interact.

Safe Mode

Gaze controls pointing only.

Navigation Mode

Gaze moves around the interface without activating targets.

Make the mode clearly visible to prevent confusion.

12. Accessibility Toolbar

Create an optional floating accessibility toolbar.

It should contain large controls for:

Left click

Right click

Double click

Drag

Scroll

Pause tracking

Safe Mode

Recalibrate

Settings

Exit

The toolbar itself must be usable through gaze.

Consider automatically hiding it when not needed.

13. Scrolling

Support gaze-based scrolling.

Possible implementations:

Edge scrolling

Looking near the top/bottom edge causes scrolling.

Dwell scrolling

Looking at a scroll control for a specified period scrolls.

Toolbar scrolling

Use explicit large buttons.

Allow users to choose their preferred method.

14. Drag-and-Drop

Implement accessible drag-and-drop.

A possible interaction:

Look at object
      ↓
Select / dwell
      ↓
Enter drag mode
      ↓
Move gaze
      ↓
Object follows cursor
      ↓
Activate release


Make this optional.

If direct gaze-based dragging is unreliable, provide an explicit "Drag Mode" rather than pretending the normal mouse interaction model works perfectly with gaze.

15. Gaze-Controlled Virtual Keyboard

Build toward a gaze-controlled virtual keyboard.

The keyboard should contain large, accessible keys.

Example:

┌────┬────┬────┬────┬────┬────┬────┬────┬────┬────┐
│ Q  │ W  │ E  │ R  │ T  │ Y  │ U  │ I  │ O  │ P  │
├────┼────┼────┼────┼────┼────┼────┼────┼────┼────┤
│ A  │ S  │ D  │ F  │ G  │ H  │ J  │ K  │ L  │ ←  │
├────┼────┼────┼────┼────┼────┼────┼────┼────┼────┤
│ Z  │ X  │ C  │ V  │ B  │ N  │ M  │SPACE│ ⏎ │    │
└────┴────┴────┴────┴────┴────┴────┴────┴────┴────┘


Investigate:

Dwell typing

Word prediction

Auto-completion

Larger dynamic targets

Adaptive key sizing

Error correction

Next-letter prediction

The keyboard should eventually support communication and general computer use.

16. Voice + Eye Tracking

Integrate optional voice interaction.

The concept should be:

Eyes = Point

Voice = Command

For example:

"Click"

"Double click"

"Scroll down"

"Open"

"Go back"

"Type hello"

"Start calibration"

"Pause tracking"

"Enable safe mode"

Voice should complement eye tracking rather than replace it.

Allow users to disable voice functionality.

Consider offline speech recognition where practical.

17. User Profiles

Implement multiple user profiles.

Each profile can store:

Calibration data

Screen configuration

Cursor sensitivity

Smoothing

Dwell timing

Accessibility preset

Target snapping

Voice settings

Safe Mode preference

Keyboard configuration

Personalization parameters

Example:

Profiles

> User 1
> User 2
> Guest
> Create New Profile


Profile data should be stored locally and securely.

18. Accessibility Presets

Provide predefined profiles.

For example:

Standard

Balanced responsiveness and smoothing.

Tremor-Friendly

More stabilization and larger target tolerance.

Low-Precision

Strong target snapping and larger interaction zones.

Slow Gaze

Longer dwell periods and slower cursor movement.

High Responsiveness

Minimal filtering and faster movement.

Safe Interaction

Strict intent detection and minimal automatic clicking.

Users should also be able to customize these presets.

19. Multiple Monitor Support

Support multiple monitors if technically feasible.

Allow:

Primary monitor only

Specific monitor

Entire virtual desktop

Clearly explain limitations for each operating system.

20. Privacy

Privacy is a fundamental requirement.

The application should:

Process webcam footage locally.

Never upload camera footage by default.

Avoid storing raw video.

Store only necessary calibration/personalization data.

Explain what data is being used.

Allow users to delete stored profiles.

Allow users to disable adaptive learning.

If cloud AI services are ever introduced, they must be explicitly opt-in.

21. Safety

This is assistive software, so uncontrolled input could be harmful or extremely frustrating.

Implement:

Emergency Stop

A reliable way to immediately disable cursor control.

Pause

Freeze gaze-based input temporarily.

Tracking Lost

Freeze the cursor rather than moving randomly.

Low Confidence

Prevent interaction when gaze confidence is too low.

Safe Mode

Disable automatic clicking.

Confirmation

For potentially destructive actions, investigate whether additional confirmation is appropriate.

The application should never prioritize automation over user control.

22. Performance

Aim for:

20–30+ FPS

Low input latency

Stable cursor movement

Reasonable CPU usage

Low memory usage

Optimize intelligently.

Investigate:

Reduced camera resolution

Region-of-interest tracking

Running expensive detection less frequently

Reusing models

Lightweight inference

Hardware acceleration where available

Measure actual performance rather than assuming it.

23. Testing

Develop a serious testing methodology.

Measure:

Accuracy

How close is gaze estimation to the intended target?

Calibration Error

Average distance between intended and predicted gaze coordinates.

Latency

How long between eye movement and cursor response?

Jitter

How much does the cursor move while the user maintains fixation?

False Click Rate

How often does the system click when the user did not intend to?

Missed Click Rate

How often does an intended click fail?

Target Selection Time

How long does it take to successfully select an object?

Tracking Recovery

How quickly does the system recover after losing the face?

User Fatigue

Investigate whether the interaction becomes tiring over time.

Test under:

Different lighting

Different webcams

Glasses

Different distances

Different users

Different screen sizes

Different resolutions

Different monitor configurations

Small head movements

Different levels of gaze stability

24. Important Human-Factors Requirement

Do not optimize purely for numerical accuracy.

A system can have excellent gaze-estimation accuracy and still be terrible to use.

Evaluate:

Comfort

Predictability

Cognitive load

Accidental activation

User fatigue

Learning curve

Calibration difficulty

Interaction speed

Error recovery

The ultimate metric is:

Can a person with limited motor control comfortably and reliably use the computer?

25. Development Phases

Do not generate the entire project as one giant code dump.

Develop incrementally.

Phase 1 — Requirements & Architecture

Before coding, ask me questions about:

Target OS

Hardware

Webcam

Intended users

Programming language

Offline requirements

Privacy

Accuracy goals

Prototype vs production

Single vs multiple monitors

Voice requirements

Virtual keyboard requirements

Also suggest improvements I have not considered.

Phase 2 — Basic Eye Tracking

Build:

Webcam capture

Face detection

Eye tracking

Iris/landmark tracking

Head pose

Gaze visualization

Confidence measurement

The application should visually show what it believes the user is looking at.

Phase 3 — Calibration

Implement:

Multi-point calibration

Outlier rejection

Personalized mapping

Calibration quality scoring

Calibration persistence

Phase 4 — Cursor Control

Implement:

Gaze-to-screen mapping

Cursor movement

Smoothing

Sensitivity

Movement thresholds

Phase 5 — Personalization

Implement:

User profiles

Gaze stabilization learning

Personalized filtering

Accessibility presets

Phase 6 — Intelligent Interaction

Implement:

Target snapping

Target recognition

Intent prediction

Confidence scoring

Phase 7 — Accessible Clicking

Implement:

Dwell clicking

Adaptive dwell

Safe Mode

Click toolbar

Double click

Right click

Phase 8 — Advanced Interaction

Implement:

Scrolling

Drag-and-drop

Virtual keyboard

Voice commands

Phase 9 — Adaptive Calibration

Implement:

Calibration recovery

Partial recalibration

Optional continuous personalization

Phase 10 — Testing & Optimization

Measure:

Accuracy

Latency

False clicks

Missed clicks

CPU usage

Tracking stability

User experience

Phase 11 — Packaging

Provide instructions for creating a standalone application.

Explain:

Installation

Dependencies

Webcam permissions

OS permissions

Configuration

Profile storage

Troubleshooting

26. Code Quality

Do not create a single massive script.

Use a modular architecture such as:

eye_assist/
│
├── main.py
│
├── camera/
│   ├── camera_manager.py
│   └── frame_processor.py
│
├── vision/
│   ├── face_tracker.py
│   ├── eye_tracker.py
│   ├── gaze_estimator.py
│   └── head_pose.py
│
├── calibration/
│   ├── calibration_manager.py
│   ├── gaze_mapper.py
│   └── calibration_recovery.py
│
├── personalization/
│   ├── user_profile.py
│   ├── adaptive_filter.py
│   └── learning.py
│
├── interaction/
│   ├── cursor_controller.py
│   ├── dwell_controller.py
│   ├── target_snapping.py
│   ├── intent_predictor.py
│   └── drag_controller.py
│
├── accessibility/
│   ├── toolbar.py
│   ├── virtual_keyboard.py
│   ├── presets.py
│   └── safe_mode.py
│
├── voice/
│   └── voice_controller.py
│
├── ui/
│   ├── main_window.py
│   ├── calibration_ui.py
│   └── settings_ui.py
│
├── storage/
│   └── profile_manager.py
│
└── tests/


Adapt this structure if you determine a better architecture.

27. Explain Technical Decisions

For every major technology or algorithm, explain:

What it does

Why it was selected

Alternatives considered

Advantages

Disadvantages

Expected accuracy

Computational requirements

Accessibility implications

Do not simply generate code without explaining the engineering decisions.

28. Future Research Directions

After the MVP is working, investigate advanced possibilities such as:

Deep-learning gaze estimation

Personalized neural models

Adaptive calibration

Continuous calibration

UI semantic understanding

Accessibility API integration

Computer-vision UI recognition

OCR

Predictive target selection

Gaze-aware UI enlargement

Context-aware target snapping

Advanced intent prediction

Blink/wink controls

Facial gestures

Voice + gaze multimodal interaction

Eye-controlled communication systems

Assistive text prediction

Personalized interaction models

Clearly separate features that are practical for the MVP from features requiring significant research.

29. Critical Requirement: Think Beyond My Ideas

Do not limit yourself to the features listed in this prompt.

You are expected to actively identify problems I have not considered.

For example, investigate:

What happens when the user becomes fatigued?

What happens if their gaze naturally drifts?

How should the system handle involuntary eye movements?

How can accidental clicks be minimized?

How can the system prevent cursor oscillation around a target?

How should it behave when the user looks between two buttons?

How should it handle menus appearing dynamically?

How should it work with web browsers?

How can it interact with applications that do not expose accessibility information?

How can it distinguish intentional interaction from normal reading?

How can users recover from mistakes without needing a physical mouse?

How can the UI itself be operated entirely through gaze?

How should the system behave when the webcam loses the user's eyes?

How can user fatigue be detected?

How can the interface adapt to different users without becoming unpredictable?

Propose solutions to these problems.

30. First Response Requirement

Do NOT start coding immediately.

Your first response should be a requirements and architecture discussion.

Ask me the most important questions needed to finalize the project.

Then provide:

Your recommended technology stack

Proposed architecture

MVP feature set

Advanced feature set

Major technical risks

Accessibility risks

Proposed testing methodology

Additional features you recommend

After I answer your questions, refine the architecture.

Then begin implementation one phase at a time, ensuring every phase works before moving to the next.

The final goal is not merely to demonstrate eye tracking.

The goal is to create a usable, personalized, intelligent assistive computer-control system for people who cannot reliably use a conventional mouse and keyboard.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/dd9e3ed2-e3df-43fe-ba9f-20aeaeb66e2c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
