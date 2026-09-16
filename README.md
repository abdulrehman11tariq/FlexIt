# ⚡ Course Feedback Fast

**One click. Less clicking.**

A lightweight Chrome extension that automates repetitive university course-feedback forms.

## Features

- 🎚️ Choose your default rating once
- 💾 Preference stored locally in Chrome
- ⚡ Fast DOM-based interaction
- 🔄 Automatically follows normal feedback navigation buttons
- 🖥️ Responsive popup
- 🔒 No accounts, analytics, telemetry, external servers, cookies, or network requests
- 🛑 Starts only when the user explicitly clicks **Run Feedback**

## Install

1. Download the ZIP from GitHub Releases.
2. Extract it.
3. Open `chrome://extensions`.
4. Enable **Developer mode**.
5. Click **Load unpacked**.
6. Select the `extension` folder.
7. Open your university feedback page.
8. Click the extension and run it.

## Privacy

The extension is designed to work entirely inside the browser.

- No backend/server.
- No analytics or telemetry.
- No collection of names, IDs, passwords, cookies, or feedback responses.
- The selected rating is stored with `chrome.storage.local`.
- No `fetch`, XHR, WebSocket, or external API calls.
- No browser history, bookmarks, downloads, clipboard, or saved credentials are accessed.

## Permissions

Only the `storage` permission is requested. The content script is available to webpages because it needs to interact with the feedback page.

## Usage

Use the extension only on feedback forms you are authorized to access and in accordance with your institution's rules. The extension automates normal webpage interaction; it does not attempt to bypass authentication, permissions, or server-side access controls.

## Contributing

To add support for another university portal, open an issue with sanitized HTML or screenshots. Never share passwords, cookies, session tokens, student IDs, or other private information.

## License

MIT
