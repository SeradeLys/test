// Shared data layer: the same Oct 23 menus feed the website chat and the iMessage agent.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(here, "../../data");
const PROFILES = path.resolve(here, "../profiles.json");
export const SERVICE_DATE = process.env.SERVICE_DATE || "2026-10-23";

export function loadMenus() {
  const menus = {};
  for (const hall of ["west", "east"]) {
    const file = path.join(DATA_DIR, `${hall}--${SERVICE_DATE}.json`);
    if (fs.existsSync(file)) {
      const doc = JSON.parse(fs.readFileSync(file, "utf8"));
      if (doc.date === SERVICE_DATE) menus[hall] = doc;
    }
  }
  return menus;
}

// Tiny file store for profiles synced from the website (keyed by iMessage handle).
const readProfiles = () => { try { return JSON.parse(fs.readFileSync(PROFILES, "utf8")); } catch { return {}; } };
export const normalizeHandle = (h) => String(h || "").trim().toLowerCase().replace(/[^\d+@.a-z]/g, "").replace(/^(\d{10})$/, "+1$1");
export function saveProfile(handle, data) {
  const all = readProfiles();
  all[normalizeHandle(handle)] = { ...data, updatedAt: new Date().toISOString() };
  fs.writeFileSync(PROFILES, JSON.stringify(all, null, 2));
}
export function getProfile(handle) { return readProfiles()[normalizeHandle(handle)] || null; }

// Compact menu context for the model. Missing values stay null, never 0.
export function menuContext(menus) {
  const out = {};
  for (const [hall, m] of Object.entries(menus)) {
    out[hall] = m.items.map((i) => ({
      id: i.id, station: i.station, name: i.name,
      kcal: i.nutr.cal, protein_g: i.nutr.protein, carbs_g: i.nutr.carbs, fat_g: i.nutr.fat, fiber_g: i.nutr.fiber,
      labels: i.labels, allergens: i.allergens.length ? i.allergens : "not listed",
    }));
  }
  return out;
}
