# 👁️ Gaze Companion

### An Open-Source Eye-Tracking Assistive Interface

**Gaze Companion** is an open-source assistive technology project that uses a standard webcam to track eye movement and translate gaze into computer input.

The goal is simple:

> **Help people with motor impairments interact with their computer using their eyes.**

Gaze Companion combines computer vision, personalized calibration, gaze stabilization, intelligent cursor control, dwell interaction, and accessibility-focused features into a single system.

Instead of requiring users to adapt themselves to a traditional mouse and keyboard, Gaze Companion explores how a computer can **adapt to the user's abilities**.

---

## ✨ Features

### 👁️ Real-Time Eye Tracking

Gaze Companion uses a webcam to detect and track the user's eyes in real time.

The system can estimate:

* Eye position
* Iris/eye landmarks
* Gaze direction
* Head movement
* Tracking confidence

No specialized eye-tracking hardware is required.

---

### 🎯 Personalized Calibration

Everyone's eyes and natural gaze behavior are different.

Gaze Companion uses a personalized calibration process to learn the relationship between the user's gaze and their screen.

Calibration data can be stored and reused to provide a more personalized experience.

---

### 🖱️ Gaze-Controlled Cursor

Your gaze can be translated into screen coordinates and used to control the mouse cursor.

Gaze stabilization helps reduce the natural jitter associated with webcam-based eye tracking while maintaining responsive cursor movement.

---

### 🧲 Intelligent Target Snapping

Webcam-based gaze tracking is less precise than a traditional mouse.

Gaze Companion can intelligently assist the user by snapping the cursor toward nearby interactive targets.

This can make selecting buttons, links, and other interface elements easier without requiring perfect gaze precision.

---

### ⏱️ Adaptive Dwell Clicking

Gaze Companion can use **dwell clicking** instead of requiring a physical mouse button.

Look at a target for a configurable period of time and the system can activate it.

The system can adapt dwell behavior based on interaction patterns to help balance:

* Speed
* Accuracy
* User comfort
* Accidental clicks

---

### 🛡️ Safe Mode

Looking at something does not necessarily mean that the user wants to interact with it.

**Safe Mode** allows the user to move the cursor using their gaze while disabling automatic clicking.

Clicking must then be deliberately activated through an available interaction method.

This is designed to reduce accidental interactions.

---

### 🧠 Personalized Gaze Stabilization

Different users have different natural eye-movement patterns.

Gaze Companion can personalize cursor behavior based on the user's interaction characteristics.

Potential parameters include:

* Smoothing
* Sensitivity
* Movement thresholds
* Dwell duration
* Cursor responsiveness

The goal is for the system to adapt to the user rather than forcing every user to use identical settings.

---

### 👤 User Profiles

Gaze Companion supports personalized user profiles.

Profiles can store settings such as:

* Calibration data
* Cursor sensitivity
* Smoothing
* Dwell timing
* Accessibility presets
* Personalization parameters
* Voice settings

This allows different users to use the same computer with their own configurations.

---

### ♿ Accessibility Presets

Gaze Companion can provide accessibility presets designed around different interaction needs.

| Preset                  | Purpose                               |
| ----------------------- | ------------------------------------- |
| **Standard**            | Balanced responsiveness and stability |
| **Tremor-Friendly**     | Increased stabilization               |
| **Low Precision**       | Increased target tolerance            |
| **Slow Gaze**           | Slower movement and longer dwell      |
| **High Responsiveness** | Faster cursor response                |
| **Safe Interaction**    | Reduced risk of accidental activation |

Users can also customize individual settings.

---

### 🔄 Calibration Recovery

Calibration accuracy can change over time due to changes in:

* Seating position
* Webcam position
* Lighting
* User fatigue
* Camera angle

Gaze Companion is designed to support targeted recalibration instead of always requiring a complete calibration process.

---

### 🧠 Intent-Aware Interaction

One of the project's long-term goals is to distinguish between:

> **"The user is looking at something."**

and

> **"The user intends to interact with something."**

The system can consider signals such as:

* Gaze stability
* Dwell duration
* Gaze trajectory
* Target location
* Tracking confidence
* Previous interactions

The purpose is to reduce unintended actions while keeping interaction responsive.

---

### ⌨️ Gaze-Controlled Virtual Keyboard

Gaze Companion can be extended into a complete communication interface through a gaze-controlled virtual keyboard.

Potential capabilities include:

* Dwell typing
* Word prediction
* Autocomplete
* Adaptive key sizing
* Error correction

This could eventually allow users to communicate without requiring a physical keyboard.

---

### 🎙️ Voice + Eye Tracking

Gaze Companion can combine eye tracking with voice commands.

The idea is:

> **Eyes = Point**

> **Voice = Command**

For example:

```text
"Click"
"Double click"
"Scroll down"
"Go back"
"Start calibration"
"Pause tracking"
"Enable safe mode"
"Type hello"
```

Combining multiple input methods can reduce the amount of precision required from either one individually.

---

# 🧩 How It Works

At a high level:

```text
             ┌──────────────┐
             │    Webcam    │
             └──────┬───────┘
                    │
                    ▼
          ┌───────────────────┐
          │ Face / Eye Tracking│
          └─────────┬─────────┘
                    │
                    ▼
          ┌───────────────────┐
          │  Gaze Estimation  │
          └─────────┬─────────┘
                    │
                    ▼
          ┌───────────────────┐
          │    Calibration    │
          └─────────┬─────────┘
                    │
                    ▼
          ┌───────────────────┐
          │ Gaze Stabilization│
          └─────────┬─────────┘
                    │
                    ▼
          ┌───────────────────┐
          │ Target / Intent   │
          │    Detection      │
          └─────────┬─────────┘
                    │
                    ▼
          ┌───────────────────┐
          │ Cursor & Input    │
          │     Control       │
          └───────────────────┘
```

Additional interaction layers can include:

```text
        👁️ Gaze
          │
          ├──────► Cursor
          │
          ├──────► Dwell Click
          │
          ├──────► Target Selection
          │
          └──────► Virtual Keyboard

        🎙️ Voice
          │
          ├──────► Commands
          └──────► Dictation
```

---

# 🚀 Getting Started

## Requirements

You will need:

* A computer with a webcam
* Python 3.x
* A supported operating system
* Adequate lighting
* The dependencies listed in `requirements.txt`

A dedicated eye-tracking device is **not required**.

---

## Installation

Clone the repository:

```bash
git clone https://github.com/jaideea08-glitch/Gaze-Companion.git
cd Gaze-Companion
```

Create a virtual environment:

### Windows

```bash
python -m venv .venv
.venv\Scripts\activate
```

### macOS / Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

---

## ▶️ Running Gaze Companion

Start the application:

```bash
python main.py
```

Follow the on-screen calibration instructions.

Once calibration is complete, gaze can be used to control the cursor and available accessibility features.

---

# 🎯 Calibration

For best results:

1. Sit comfortably in your normal position.
2. Position the webcam so your face is clearly visible.
3. Make sure your eyes are adequately illuminated.
4. Complete the calibration process.
5. Follow each calibration target with your eyes.
6. Avoid unnecessary head movement during calibration.
7. Test the resulting gaze accuracy.

If your setup changes significantly, recalibration may improve accuracy.

---

# ⚙️ Configuration

Gaze Companion is designed to be highly customizable.

Depending on the current implementation, settings may include:

```text
Cursor Sensitivity
Gaze Smoothing
Dwell Duration
Target Snapping
Safe Mode
Tracking Confidence
Accessibility Preset
Voice Controls
```

The objective is to let users find an interaction style that works for them.

---

# 🔒 Privacy

Privacy is an important part of Gaze Companion.

The project is designed around local processing whenever possible.

The application should:

* Process webcam data locally.
* Avoid storing raw webcam footage.
* Avoid uploading camera footage.
* Store only necessary calibration information.
* Allow users to manage their profiles.
* Allow users to disable adaptive features.

Any future cloud functionality should be explicitly opt-in.

---

# ♿ Accessibility Philosophy

Gaze Companion is not intended to simply demonstrate that a webcam can track someone's eyes.

It is an exploration of **assistive human-computer interaction**.

Traditional computer interfaces assume that users can accurately control a mouse.

Gaze Companion explores a different approach:

> **What if the computer adapted to the user's physical abilities?**

The project focuses on reducing the physical precision and effort required to interact with a computer.

Core principles include:

* Reduce accidental actions
* Reduce required physical movement
* Allow personalization
* Make interactions forgiving
* Prioritize stability
* Make mistakes easy to recover from
* Keep the user in control

---

# 🧪 Project Status

**Status: ****`Experimental / Alpha`**

Gaze Companion is an actively developing project.

The current implementation should be considered an experimental prototype and **not a certified medical or clinical device**.

Performance can vary depending on:

* Webcam quality
* Lighting
* User position
* Screen size
* Eye characteristics
* Head movement
* Computer performance
* Software configuration

---

# 🗺️ Roadmap

## Core Eye Tracking

* [x] Webcam tracking
* [x] Eye detection
* [x] Gaze estimation
* [x] Calibration
* [x] Cursor control
* [x] Gaze stabilization
* [ ] Improved gaze accuracy
* [ ] Multi-monitor support

## Accessibility

* [x] Dwell clicking
* [x] Safe Mode
* [ ] Adaptive dwell
* [ ] Accessibility presets
* [ ] Advanced target snapping
* [ ] Gaze-based scrolling
* [ ] Accessible drag-and-drop

## Personalization

* [x] User profiles
* [ ] Personalized gaze filtering
* [ ] Adaptive gaze stabilization
* [ ] Calibration recovery
* [ ] Continuous calibration
* [ ] Personalized intent prediction

## Communication

* [ ] Gaze-controlled virtual keyboard
* [ ] Word prediction
* [ ] Autocomplete
* [ ] Text-to-speech
* [ ] Speech-to-text
* [ ] Voice commands

## Intelligent Interaction

* [ ] Semantic UI target detection
* [ ] Accessibility API integration
* [ ] Context-aware target snapping
* [ ] Improved intent prediction
* [ ] Personalized interaction models

---

# 🧪 Testing & Evaluation

A major goal of the project is to evaluate the system using measurable metrics.

Potential metrics include:

| Metric                | Purpose                                            |
| --------------------- | -------------------------------------------------- |
| **Gaze Accuracy**     | How accurately gaze maps to the screen             |
| **Calibration Error** | Difference between intended and predicted position |
| **Cursor Latency**    | Delay between gaze movement and cursor movement    |
| **Cursor Jitter**     | Unwanted movement during fixation                  |
| **False Click Rate**  | Unintended activations                             |
| **Missed Click Rate** | Failed intentional activations                     |
| **Selection Time**    | Time required to select a target                   |
| **Tracking Recovery** | Time required to recover from lost tracking        |

Testing should include different:

* Users
* Webcams
* Lighting conditions
* Seating distances
* Screen resolutions
* Monitor configurations
* Levels of gaze stability

---

# ⚠️ Limitations

Webcam-based eye tracking has inherent limitations.

It is generally less accurate than dedicated infrared eye-tracking hardware.

Potential challenges include:

* Poor lighting
* Reflections from glasses
* Low-quality webcams
* Head movement
* Eye occlusion
* Individual differences
* Calibration drift
* Gaze-estimation noise
* Cursor jitter
* User fatigue

These limitations are an important part of the problem Gaze Companion is attempting to solve.

---

# 🤝 Contributing

Contributions are welcome.

Areas where contributions could be particularly valuable include:

* 👁️ Computer vision
* 🧠 Machine learning
* ♿ Accessibility
* 🖥️ Human-computer interaction
* 🎨 UI/UX
* ⚡ Performance optimization
* 🧪 Testing
* 📝 Documentation
* 🖥️ Cross-platform support

If you have an idea that could make Gaze Companion more accessible, reliable, or usable, feel free to open an issue or submit a pull request.

When contributing, please keep the project's accessibility goals at the center of the design.

---

# 💡 Research & Future Ideas

Gaze Companion is also intended to serve as a platform for exploring questions around accessible human-computer interaction.

Some areas of interest include:

* Can inexpensive webcams provide sufficiently accurate gaze input?
* Can personalized models significantly improve accuracy?
* Can semantic UI understanding make gaze interaction easier?
* How can computers distinguish between looking and intending?
* How can accidental clicks be minimized?
* Can voice and gaze create a more effective multimodal interface?
* Can interfaces dynamically adapt to a user's abilities?
* Can gaze-based interaction reduce the physical effort required to use a computer?

---

# ⚖️ Disclaimer

Gaze Companion is an **open-source experimental project**.

It is **not a medical device, diagnostic tool, or certified assistive-technology product**.

Do not rely on Gaze Companion for safety-critical applications.

Users should always have a reliable method of disabling gaze-controlled input.

---

# 📄 License

This project is licensed under the **[CHOOSE LICENSE]** license.

See `LICENSE` for details.

---

# ⭐ Support Gaze Companion

If you find the project interesting:

⭐ **Star the repository**

🐛 **Report bugs**

💡 **Suggest features**

🔧 **Submit improvements**

📖 **Improve documentation**

🧪 **Test it with different hardware**

♿ **Provide accessibility feedback**

The most valuable contributions are those that help make Gaze Companion **more reliable and more usable for people who need alternative ways to interact with computers.**

---

# 👁️ Gaze Companion

### **A different way to interact with your computer.**

**Eyes → Intent → Interaction**
