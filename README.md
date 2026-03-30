# Player IDP Generator

A static web app for generating player Individual Development Plan (IDP) infographics from coach voice memo transcripts. Runs entirely in the browser — no server, no backend, no data stored anywhere except your own browser session.

## Live Site

[https://tylercasey2263.github.io/idp-generator/](https://tylercasey2263.github.io/idp-generator/)

---

## How It Works

1. A coach pastes (or types) a raw voice memo transcript into the app
2. Fills in the player name, position(s), plan duration, and focus area(s)
3. Clicks **Clean & Generate** — the app sends the transcript to the Claude API, which structures it into strengths, improvements, a 30-day plan, micro-habits, a 12-month vision, and a parent note
4. A styled dark-theme infographic renders in the browser
5. The coach downloads it as a standalone HTML file or saves it as a PDF

---

## Accessing the App

The app is password-protected so a shared API key can be used without it being publicly exposed. When you open the site you'll be prompted to enter the team access password. Contact the team admin for the password.

Once authenticated, your session stays unlocked until you close the browser tab.

---

## How to Generate an IDP

**Fill in the player details:**
- **Player name** — first and last name
- **Position(s)** — click the field to pick from the dropdown, select multiple if needed, or type a custom value and press Enter
- **Plan duration** — how long the development window covers (e.g. 12 months)
- **Focus area(s)** — click to pick from the dropdown, select multiple if needed, or type a custom phrase and press Enter

**Paste the transcript** — raw voice memo dictation, notes, or already-cleaned text all work fine. The messier the better — Claude handles cleanup.

**Choose your generation mode:**

| Button | What it does | Needs API key? |
|--------|-------------|----------------|
| **Clean & Generate** | Sends transcript to Claude to clean up grammar and extract structured data, then builds the infographic | Yes (handled by team key) |
| **Generate As-Is** | Skips AI cleanup and builds directly from your raw text | No |

### Downloading

Once the preview renders:
- **Download HTML** — saves a standalone `.html` file with all styles embedded; share it, archive it, or open it offline
- **Save as PDF** — opens the browser print dialog; set destination to **Save as PDF**, then print. Background colors are forced on so the dark theme is preserved.

---

## Example Transcript

Not sure what to put in the transcript box? Here's a sample voice memo format that works well:

> *"Alright, this is a development note for [Player Name], he plays central midfielder, U14 squad. Just wrapping up the fall season and wanted to get some thoughts down. So [Player Name] — big picture, this kid has a really high soccer IQ. He reads pressure well, knows when to switch the field, and his first touch under pressure has gotten dramatically better since August…"*

Rambling, unstructured, and full of filler words is totally fine. Claude cleans it up.

---

## Privacy & Security

- The API key is encrypted at rest and only decrypted in memory after a correct password is entered
- The decrypted key exists only in your browser session — it is never written to `localStorage` or `sessionStorage`
- All Claude API calls go directly from your browser to `api.anthropic.com` — no proxy, no middleman
- No analytics, no tracking, no data is stored or logged anywhere
- Transcript content and player data never leave your browser except as part of the direct Claude API call

---

## Customization

The entire app is a single `index.html` file. To customize:

- **Colors** — edit the CSS variables at the top of the `<style>` block
- **Position / Focus dropdown options** — edit the `TAG_OPTIONS` object near the top of the `<script>` block
- **Infographic layout** — find the `renderInfographic()` function in the `<script>` block
- **Claude prompt** — edit the `systemPrompt` variable inside `callClaude()` to change how transcripts are interpreted
- **Default micro-habits** — edit the `parseRaw()` function for the As-Is fallback defaults

---

## Requirements

- Any modern browser (Chrome, Firefox, Safari, Edge)
- Team access password
- Internet connection (for Google Fonts and the Claude API call)
