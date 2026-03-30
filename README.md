# Player IDP Generator

A static web app for generating player Individual Development Plan infographics from voice memo transcripts. Runs entirely in the browser — no server, no backend, no data stored anywhere except your own browser.

## Live Site

Once deployed: `https://<your-username>.github.io/<repo-name>/`

---

## How to Deploy to GitHub Pages

1. **Create a new GitHub repository** (e.g. `idp-generator`)
2. **Upload `index.html`** to the root of the repo
3. Go to **Settings → Pages**
4. Under *Source*, select **Deploy from a branch → main → / (root)**
5. Hit **Save** — your site will be live in ~60 seconds

That's it. No build step, no dependencies to install.

---

## How to Use

### First time setup
1. Open the site
2. Click **Add API Key** in the top right
3. Paste your Anthropic API key (get one at [console.anthropic.com](https://console.anthropic.com))
4. Click **Save Key** — it's stored only in your browser, never sent to any server

### Generating an IDP

**Fill in the player details:**
- Player name
- Position (e.g. Defender, Attacking Midfielder)
- Plan duration (e.g. 12 months)
- Focus phrase (e.g. Assert & Progress)

**Paste the transcript** — this can be a raw voice memo, messy dictation, or already-cleaned text.

**Choose your generation mode:**

| Button | What it does | Needs API key? |
|--------|-------------|----------------|
| **Clean & Generate** | Sends transcript to Claude to clean up grammar and structure, then builds the infographic | Yes |
| **Generate As-Is** | Skips AI cleanup and builds directly from your raw text | No |

### Downloading
Once the preview renders:
- **Download HTML** — saves a standalone `.html` file you can share or archive
- **Save as PDF** — opens the browser print dialog; choose "Save as PDF" as the destination

---

## Privacy & Security

- Your API key is stored in `localStorage` in your browser only
- It is sent directly to `api.anthropic.com` and nowhere else
- No analytics, no tracking, no external services
- The app works fully offline once loaded (except for the Claude API call)

---

## Customization

The entire app is a single `index.html` file. To customize:

- **Colors** — edit the CSS variables at the top of the `<style>` block
- **Infographic layout** — find the `renderInfographic()` function in the `<script>` block
- **Claude prompt** — edit the `systemPrompt` variable inside `callClaude()` to change how transcripts are interpreted
- **Default micro-habits** — edit the `parseRaw()` function for the As-Is fallback defaults

---

## Requirements

- Any modern browser (Chrome, Firefox, Safari, Edge)
- An Anthropic API key if using **Clean & Generate** mode
- Internet connection (for Google Fonts and the Claude API call)
