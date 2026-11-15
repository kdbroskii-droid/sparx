# Sparx Reader Tutor

A separate browser-extension add-on for Sparx Reader. The existing Sparx Maths files are left untouched.

## Features
- Detects the Sparx Reader reading area.
- Adjustable auto-scroll with pause controls.
- Counts paragraphs encountered in the visible area (an estimate, not proof of reading).
- Test Gemini sends a tiny test prompt without needing a visible passage.
- Sends only one short currently visible excerpt (maximum 500 characters) to Gemini when you press Explain visible excerpt.
- Sends Gemini requests through the extension background worker, with a 25-second timeout and readable error messages.
- Displays Gemini's explanation.
- Pauses when the “I have read up to here” checkpoint approaches. You click it yourself.
- Stores your Gemini key locally using browser extension storage.
- Does not select answers or submit school questions.

## Install in Chrome, Edge or Brave
1. Download the repository.
2. Open the browser extensions page and enable Developer mode.
3. Choose Load unpacked and select this `reader-extension` folder. If it was already installed, press Reload on the extension card so the new background worker is loaded.
4. Open a Sparx Reader task. The Reader Tutor panel appears near the top-right.

## Firefox
Open `about:debugging`, choose This Firefox, then Load Temporary Add-on and select `manifest.json` in this folder. Firefox compatibility may vary by release.

## Gemini setup
1. Create your own Gemini API key in Google AI Studio.
2. Paste it into the panel and press Save key.
3. The default model is `gemini-3.8-flash`; change it if your account uses another supported text model.
4. Press Test Gemini first. It checks the API connection without needing a passage. Then scroll to a paragraph and press Explain visible excerpt.

Requests go directly to Google's Gemini API using the `x-goog-api-key` header. The key is stored in local browser extension storage, not sent to this GitHub repository or a project server. Anyone with access to your browser profile may be able to use it.

## Scope and privacy
The extension does not collect or send the whole book, accumulate successive passages, answer checkpoint questions, or click the checkpoint. It sends only the currently visible short excerpt after you press the explanation button.

Gemini model access, rate limits and pricing are controlled by Google and may change. The extension itself is free.