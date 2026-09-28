# Course Feedback Fast

A lightweight Chrome extension (Manifest V3) that automates the repetitive
university course-feedback forms.

## How it works

1. Open the university course-feedback page.
2. Click the extension and pick your answer with the slider.
3. Press **Start** (or leave *Start automatically when opened* on).

The extension then repeats this until no "Give Feedback" button is left:

`Course list -> Give Feedback -> answer every question -> Next / Submit -> next course`

The popup shows live status (Ready, Running, Done, Stopped, Error) and a
progress bar that counts finished courses. **Stop** halts the run at any time.

## Popup

- **Slider**: five steps from Strongly Agree to Strongly Disagree. The colour
  shifts from green to red so you can see which way you are answering. Arrow
  keys work when the slider is focused.
- **Start automatically when opened**: begins a moment after the popup opens.
  Move the slider or press Cancel in that moment to adjust first.
- Follows your system light or dark theme.

## Install

1. Extract the ZIP.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the `course-feedback-fast` folder.

Requires Chrome 102 or newer.

## Privacy

- No servers, analytics, telemetry, or network requests.
- Nothing about you or your responses is collected.
- Your slider choice and the auto-start setting are stored with
  `chrome.storage.local`. Run progress is kept in `chrome.storage.session` and
  is cleared when the browser closes.

## Permissions

`activeTab` and `scripting` run the automation on the tab you start it from.
`storage` saves your settings and run progress.

## Usage

Use this only on feedback forms you are authorised to fill in, and in line with
your institution's rules. It automates normal page controls; it does not bypass
login, permissions, CAPTCHA, or any server-side access control. If the site
shows no recognisable Next or Submit button, the extension stops instead of
guessing.

## Adjusting for the site

Button and question matching lives in `content.js`. If the university changes
its HTML, that is the only file that should need changes.

## License

MIT
