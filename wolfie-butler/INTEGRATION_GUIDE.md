# Wolfie Butler integration guide

This guide connects four services to the site: **Gemini** (the chatbot's brain), **ElevenLabs** (voice), **Photon** (Wolfie Butler on iMessage) and **Medal** (recipe videos).

## How the pieces fit

```
 Browser (index.html)                        server/ (Node, keeps all API keys)
 ─────────────────────                       ────────────────────────────────────
 Chat text  ── POST /api/chat ────────────▶  agent.js ──▶ Gemini
 Mic audio  ── POST /api/stt ─────────────▶  ElevenLabs Scribe (speech → text)
 Reply      ── POST /api/tts ─────────────▶  ElevenLabs TTS (text → speech)
 Profile    ── POST /api/profile ─────────▶  profiles.json ◀── photon-bot.js ◀── iMessage (Photon)
 Medal link ── GET  /api/medal/embed ─────▶  Embedly oEmbed ──▶ iframe preview
                                             data/*.json (Oct 23 menus) feeds both agents
```

The web chat and the iMessage agent call the same `askWolfie()` function in `server/src/agent.js` with the same Oct 23 menu data, so both give the same answers.

**Why a server?** API keys must never sit in `index.html`, because anyone can read a web page's source. The browser talks only to your server, and the server talks to Gemini, ElevenLabs and Photon.

---

## Step 0 — Run the server

Requirements: Node.js 20 or newer.

```bash
cd server
cp .env.example .env
npm install
npm start
```

Check it: open `http://localhost:8787/api/health`. You should see `{"ok":true,"date":"2026-10-23",...}`.

Point the site at it: in `index.html`, find `CONFIG` near the top of the `<script>` and set:

```js
apiBase: "http://localhost:8787",
```

Serve the site from a local web server, not by double-clicking the file, so the microphone works:

```bash
npx serve .      # from the wolfie-butler folder, then open the printed URL
```

Add that URL (for example `http://localhost:3000`) to `ALLOWED_ORIGINS` in `server/.env`.

When `apiBase` is set, the site automatically:
- sends chat messages to Gemini through the server,
- swaps the speaker button for a microphone button (voice chat),
- adds an "iMessage number or email" field to Profile and syncs the profile and meal plan for Photon,
- shows Medal clips as playable previews (if Embedly is set up).

---

## Step 1 — Gemini (chatbot brain)

1. Create an API key at **Google AI Studio** → https://aistudio.google.com/apikey
2. In `server/.env`:
   ```
   GEMINI_API_KEY=your-key
   GEMINI_MODEL=gemini-3.8-flash
   ```
3. Restart the server, open the site and send Wolfie Butler a message.

How it works (`server/src/agent.js`):
- It uses the official `@google/genai` SDK: `ai.models.generateContent({ model, contents, config })`.
- `config.systemInstruction` carries Wolfie Butler's rules plus a JSON "context" (the Oct 23 menus, the student's targets, allergies and current plan).
- `config.responseMimeType: "application/json"` makes Gemini answer as `{ "reply": "...", "actions": [...] }`. When a student says "add the tofu to lunch", Gemini returns an `add_to_meal` action and the site adds it to the planner.

Things to check:
- Model names change. If the model is rejected, pick a current one from Google's model list and update `GEMINI_MODEL`.
- Google now recommends its newer Interactions API for new projects; `generateContent` still works and is what this code uses.

---

## Step 2 — ElevenLabs voice chat

1. Create an API key at https://elevenlabs.io/app/settings/api-keys
2. Pick a voice in the ElevenLabs Voice Library and copy its **Voice ID**.
3. In `server/.env`:
   ```
   ELEVENLABS_API_KEY=your-key
   ELEVENLABS_VOICE_ID=your-voice-id
   ELEVENLABS_TTS_MODEL=eleven_multilingual_v2
   ELEVENLABS_STT_MODEL=scribe_v2
   ```
4. Restart the server and reload the site.

Using it: in the chat, tap the **microphone** button (between the text box and Send), speak, then tap it again. The browser records with `MediaRecorder` and the server transcribes with **Scribe** (`speechToText.convert`). The text goes to Gemini, and the reply is read aloud with **text-to-speech** (`textToSpeech.convert`, MP3).

Notes:
- The browser asks for microphone permission the first time. It only works on `http://localhost` or an `https://` site.
- Voice replies play automatically after a voice question. If ElevenLabs fails, the site falls back to the browser's built-in voice.
- ElevenLabs bills by characters and audio minutes, so replies are capped at about 1,500 characters.
- For live, interruptible voice conversations, ElevenLabs also has a hosted agent product (ElevenAgents). It's a bigger setup and isn't required here.

---

## Step 3 — Photon (Wolfie Butler on iMessage)

Photon has two ways to run an iMessage agent. Both reuse `askWolfie()`.

### Option A — Spectrum, hosted (recommended for a demo)
1. Sign up at https://app.photon.codes and create a project. Copy the **Project ID** and **Project Secret**.
2. In `server/.env`:
   ```
   PROJECT_ID=...
   PROJECT_SECRET=...
   ```
3. Install and run the bot (in a second terminal, next to the API server):
   ```bash
   cd server
   npm install spectrum-ts
   npm run bot
   ```
4. Text the iMessage number Photon gives your project. The bot code (`server/src/photon-bot.js`) does:
   ```js
   const app = await Spectrum({ projectId, projectSecret, providers: [imessage.config()] });
   for await (const [space, message] of app.messages) {
     await space.responding(async () => { await message.reply(reply); });
   }
   ```
   Spectrum is evolving quickly. If the sender or text comes through as `undefined`, log one `message` object and update the two field names at the top of the loop.

### Option B — imessage-kit on your own Mac
Runs on a Mac signed in to iMessage. The SDK reads the local Messages database.
1. macOS, Node 20+. Give your terminal **Full Disk Access**: System Settings → Privacy & Security → Full Disk Access.
2. Install and run:
   ```bash
   cd server
   npm install @photon-ai/imessage-kit better-sqlite3
   npm run bot:local
   ```
3. Text that Mac's iMessage address from another phone. The bot uses `sdk.startWatching({ onDirectMessage })` and replies with `sdk.send(sender, reply)`.

### Personalised iMessage replies
On the site's **Profile** page, students enter their iMessage number or email. Saving the profile, and every meal-plan change, sends their targets, allergies and plan to `POST /api/profile`. The bot looks the sender up by that handle, so its answers match what the site shows. Phone numbers are normalised, so `631 555 0100` and `+16315550100` match.

`profiles.json` is a simple file store for the hackathon. For production, swap it for a real database.

---

## Step 4 — Medal (recipe videos)

**What Medal offers developers today:** Medal's public developer API is the **Auto-Clipping API**. A game or app calls the Medal desktop app on the player's PC (`POST http://localhost:12665/api/v1/event/invoke` with a `publicKey` header) to save a clip into that player's Medal library. **Medal doesn't publish an API for uploading video files from a website or server**, or for listing a user's clips. You can't build "upload to Medal" directly into the site with their public tools.

**What works now (built into the site):**
1. **Upload in Medal.** Record or upload the cooking video with the Medal app or medal.tv, then use **Share → Copy link**.
2. **Attach in Wolfie Butler.** Recipes → **Add recipe** → paste the link into "Medal clip link". The site only accepts `https://medal.tv/...` links.
3. **Preview.** Without the server, the recipe shows a play card that opens the clip on medal.tv. With the server and an Embedly key, it shows an **in-page player**:
   - Get a key at https://embed.ly (Embedly supports `medal.tv/*` links).
   - Set `EMBEDLY_KEY=...` in `server/.env` and restart.
   - `GET /api/medal/embed?url=<medal link>` asks Embedly's oEmbed endpoint for the player, and the site swaps the play card for an `<iframe>`. Only `medal.tv` and `embed.ly` iframe sources are allowed.
4. **Thumbnails.** In the claude.ai version, editors can upload a clip screenshot as the recipe thumbnail. With Embedly, the oEmbed response also includes `thumbnail`, which you can save on the recipe.

**If you need true in-site uploads:**
- Ask Medal's developer or partnerships team (via medal.tv/developer) whether a partner upload API is available for your project. If they give you one, put the call in a new `POST /api/medal/upload` route in `server/src/index.js` and save the returned clip URL on the recipe.
- Or use a video platform with a public upload API (for example Mux, Cloudinary or YouTube's Data API) for direct uploads, and keep Medal links for clips students already have.

---

## Step 5 — Put it online

- **Site:** host the `wolfie-butler` folder on any static host (GitHub Pages, Netlify, Vercel). Set `CONFIG.apiBase` to your server's public `https://` URL.
- **Server:** deploy `server/` to a Node host (Render, Railway, Fly.io). Add the same environment variables in the host's dashboard and set `ALLOWED_ORIGINS` to your site's URL.
- **Photon Option A** (`npm run bot`) can run on the same host as a second process. **Option B** must stay on your Mac.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Chat says it "couldn't reach the server" | Is `npm start` running? Is `CONFIG.apiBase` right? Is your site's URL in `ALLOWED_ORIGINS`? |
| `/api/chat` returns 502 | Check `GEMINI_API_KEY`, and that `GEMINI_MODEL` is still a current model. |
| No mic button | `CONFIG.apiBase` is empty. |
| "Microphone access was blocked" | Allow the mic in the browser's site settings, and use `localhost` or `https://`. |
| Voice transcription fails | Check `ELEVENLABS_API_KEY` and the server log; recordings under about 0.1 seconds are rejected. |
| Medal clip shows a play card, not a player | `EMBEDLY_KEY` is missing, or Embedly couldn't resolve that link. |
| iMessage bot ignores messages | Option A: check `PROJECT_ID`/`PROJECT_SECRET`. Option B: Full Disk Access, and the Mac must be signed in to iMessage. |

## Sources
- Gemini API, getting started: https://ai.google.dev/gemini-api/docs/generate-content/get-started
- ElevenLabs quickstart: https://elevenlabs.io/docs/developer-guides/quickstart
- ElevenLabs JS SDK: https://github.com/elevenlabs/elevenlabs-js
- ElevenLabs speech-to-text cookbook: https://elevenlabs.io/docs/sv/eleven-api/guides/cookbooks/speech-to-text.md
- Photon imessage-kit: https://photon.codes/docs/opensource/imessage-kit
- Photon Spectrum: https://github.com/photon-hq/spectrum-ts
- Medal Auto-Clipping API: https://medal.tv/portal/docs/auto-clipping/api
- Embedly Medal provider: https://embed.ly/provider/medal
