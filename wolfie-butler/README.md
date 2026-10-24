# Wolfie Butler — Oct 23, 2026 build

Stony Brook dining-hall meal planner for **Friday, October 23, 2026 only**: the West and East Nutrislice menus, a meal planner with breakfast/lunch/dinner and a ±50 kcal day plan, favourites, recipes with Medal clip links, and the Wolfie Butler chat.

## What's in this folder
| Path | What it is |
|---|---|
| `index.html` | The whole website in one file. Open it in a browser or host it on any static host. |
| `wolfie-butler-artifact.html` | The exact source of the claude.ai artifact version. |
| `data/west--2026-10-23.json`, `data/east--2026-10-23.json` | Oct 23 menus parsed from Nutrislice (133 West dishes, 148 East dishes). |
| `data/recipes.json` | Six starter recipes. |
| `server/` | Node backend for Gemini chat, ElevenLabs voice, the Photon iMessage agent and Medal previews. |
| `INTEGRATION_GUIDE.md` | Step-by-step setup for Photon, Gemini, ElevenLabs and Medal. |

## Quick start (website only)
1. Open `index.html` in a browser.
2. Dining menus → **Import menu** → paste the contents of `data/west--2026-10-23.json`, then do the same for East (pick East in the dropdown).
Without the server, data is saved in the browser and the chat shows a "can't reach" notice.

## Quick start (with the server)
```bash
cd server
cp .env.example .env      # add your keys
npm install
npm start                 # http://localhost:8787
```
Then in `index.html`, set `CONFIG.apiBase` to `"http://localhost:8787"` and serve the site from a local web server (for example `npx serve .` from this folder) so the browser can use the microphone.

The date is set in two places: `CONFIG.serviceDate` in `index.html` and `SERVICE_DATE` in `server/.env`. Both are `2026-10-23`.

Nutrition values are estimates, not medical advice.
