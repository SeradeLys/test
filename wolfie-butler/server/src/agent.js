// Wolfie Butler's brain: one Gemini call used by both the website chat and the Photon iMessage agent.
import { GoogleGenAI } from "@google/genai";
import { loadMenus, menuContext, SERVICE_DATE } from "./data.js";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

const RULES = `You are Wolfie Butler, the meal planning agent for Stony Brook University students.
The menu date is ${SERVICE_DATE}. Write like a friendly, concise text message: short paragraphs or a few bullets, under 140 words.
Rules:
- Use ONLY the dishes and numbers in CONTEXT. null or "not listed" means the value isn't listed: say so; never estimate or invent nutrition, dishes or availability.
- Never suggest a dish whose allergens include one of the student's allergies. If allergens are "not listed", say allergen info isn't listed and they should ask dining staff.
- Respect Vegetarian/Vegan/Halal preferences using dish labels only.
- If dailyTargets.status is "restricted", give no calorie targets or weight-change advice; suggest a doctor or registered dietitian.
- Never create weight-loss or weight-gain plans. All values are estimates, not medical advice.
Reply with JSON only: {"reply": string, "actions": [{"type":"add_to_meal","hallId":"west"|"east","dishId":string,"servings":number,"period":"Breakfast"|"Lunch"|"Dinner"}]}.
Only include actions when the student clearly asks you to add a dish to their plan; otherwise "actions": [].`;

/**
 * @param {{messages: {role:"user"|"assistant", content:string}[], context?: object}} input
 * @returns {Promise<{reply:string, actions:object[]}>}
 */
export async function askWolfie({ messages, context }) {
  const ctx = context && context.menus ? context : { ...(context || {}), menus: menuContext(loadMenus()) };
  const contents = messages.slice(-12).map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content).slice(0, 4000) }] }));
  const response = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: {
      systemInstruction: `${RULES}\nCONTEXT:\n${JSON.stringify(ctx)}`,
      responseMimeType: "application/json",
      temperature: 0.4,
    },
  });
  const raw = response.text || "";
  try {
    const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    return { reply: String(parsed.reply || ""), actions: Array.isArray(parsed.actions) ? parsed.actions : [] };
  } catch {
    return { reply: raw.trim() || "Sorry, I couldn't answer that.", actions: [] };
  }
}
