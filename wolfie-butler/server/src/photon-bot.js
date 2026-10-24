// Wolfie Butler on iMessage via Photon Spectrum (hosted). Run: npm run bot
import "dotenv/config";
import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { askWolfie } from "./agent.js";
import { getProfile, loadMenus, menuContext } from "./data.js";

const history = new Map(); // per-sender short memory

const app = await Spectrum({
  projectId: process.env.PROJECT_ID,
  projectSecret: process.env.PROJECT_SECRET,
  providers: [imessage.config()],
});
console.log("Wolfie Butler is listening on iMessage…");

for await (const [space, message] of app.messages) {
  // Field names for the sender and text can differ between Spectrum versions; check the Spectrum docs if these are undefined.
  const sender = message.sender?.id ?? message.from ?? message.author?.id ?? "";
  const text = message.text ?? message.content?.text ?? "";
  if (!text) continue;
  await space.responding(async () => {
    const turns = [...(history.get(sender) || []), { role: "user", content: text }].slice(-10);
    const saved = getProfile(sender);
    const context = {
      profile: saved?.profile ? { goal: saved.profile.goal, diet: saved.profile.diet, allergies: saved.profile.allergies } : null,
      dailyTargets: saved?.targets ?? null,
      mealPlan: saved?.plan ?? [],
      menus: menuContext(loadMenus()),
    };
    try {
      const { reply } = await askWolfie({ messages: turns, context });
      await message.reply(reply);
      history.set(sender, [...turns, { role: "assistant", content: reply }]);
    } catch (e) {
      console.error(e);
      await message.reply("Sorry, Wolfie Butler can't reach the menu right now. Try again in a minute.");
    }
  });
}
