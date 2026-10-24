// Wolfie Butler API: Gemini chat, ElevenLabs voice, Photon profile sync, Medal previews.
import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { Readable } from "node:stream";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { askWolfie } from "./agent.js";
import { loadMenus, saveProfile, SERVICE_DATE } from "./data.js";

const app = express();
const upload = multer({ limits: { fileSize: 15 * 1024 * 1024 } });
const origins = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true }));
app.use(express.json({ limit: "1mb" }));

const eleven = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });

app.get("/api/health", (_req, res) => res.json({ ok: true, date: SERVICE_DATE, gemini: !!process.env.GEMINI_API_KEY, elevenlabs: !!process.env.ELEVENLABS_API_KEY }));
app.get("/api/menus", (_req, res) => res.json(loadMenus()));

// Website chat -> Gemini
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, context } = req.body || {};
    if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: "messages required" });
    res.json(await askWolfie({ messages, context }));
  } catch (e) { console.error(e); res.status(502).json({ error: "Gemini request failed" }); }
});

// Text -> speech (ElevenLabs), returns audio/mpeg
app.post("/api/tts", async (req, res) => {
  try {
    const text = String(req.body?.text || "").replace(/[*#•]/g, "").slice(0, 1500);
    if (!text) return res.status(400).json({ error: "text required" });
    const audio = await eleven.textToSpeech.convert(process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb", {
      text, modelId: process.env.ELEVENLABS_TTS_MODEL || "eleven_multilingual_v2", outputFormat: "mp3_44100_128",
    });
    res.set("Content-Type", "audio/mpeg");
    (typeof audio.getReader === "function" ? Readable.fromWeb(audio) : audio).pipe(res);
  } catch (e) { console.error(e); res.status(502).json({ error: "ElevenLabs TTS failed" }); }
});

// Speech -> text (ElevenLabs Scribe)
app.post("/api/stt", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "audio file required" });
    const result = await eleven.speechToText.convert({
      file: new Blob([req.file.buffer], { type: req.file.mimetype || "audio/webm" }),
      modelId: process.env.ELEVENLABS_STT_MODEL || "scribe_v2",
    });
    res.json({ text: result.text || "" });
  } catch (e) { console.error(e); res.status(502).json({ error: "ElevenLabs STT failed" }); }
});

// Website profile/plan -> shared store, so the Photon agent can personalise replies
app.post("/api/profile", (req, res) => {
  const { phone, profile, targets, plan } = req.body || {};
  if (!phone) return res.status(400).json({ error: "phone required" });
  saveProfile(phone, { profile, targets, plan: (plan || []).filter((i) => i.date === SERVICE_DATE) });
  res.json({ ok: true });
});

// Medal clip preview: resolves a medal.tv link to an embeddable iframe src via Embedly oEmbed
app.get("/api/medal/embed", async (req, res) => {
  try {
    const url = new URL(String(req.query.url || ""));
    if (url.protocol !== "https:" || !/(^|\.)medal\.tv$/i.test(url.hostname)) return res.status(400).json({ error: "medal.tv link required" });
    if (!process.env.EMBEDLY_KEY) return res.json({ src: null });
    const r = await fetch(`https://api.embed.ly/1/oembed?key=${process.env.EMBEDLY_KEY}&url=${encodeURIComponent(url.href)}`);
    const data = await r.json();
    const src = (String(data.html || "").match(/src="([^"]+)"/) || [])[1] || null;
    res.json({ src: src && src.startsWith("//") ? "https:" + src : src, title: data.title || null, thumbnail: data.thumbnail_url || null });
  } catch (e) { console.error(e); res.json({ src: null }); }
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => console.log(`Wolfie Butler API on http://localhost:${port} (menu date ${SERVICE_DATE})`));
