// Alternative: Photon imessage-kit on your own Mac (macOS + Full Disk Access). Run: npm run bot:local
import "dotenv/config";
import { IMessageSDK } from "@photon-ai/imessage-kit";
import { askWolfie } from "./agent.js";
import { getProfile, loadMenus, menuContext } from "./data.js";

const sdk = new IMessageSDK();
const history = new Map();

await sdk.startWatching({
  onDirectMessage: async (msg) => {
    if (msg.isFromMe) return;
    const sender = msg.sender ?? msg.handle ?? "";
    const text = msg.text ?? "";
    if (!text.trim()) return;
    const turns = [...(history.get(sender) || []), { role: "user", content: text }].slice(-10);
    const saved = getProfile(sender);
    const { reply } = await askWolfie({ messages: turns, context: {
      profile: saved?.profile ?? null, dailyTargets: saved?.targets ?? null, mealPlan: saved?.plan ?? [], menus: menuContext(loadMenus()),
    } });
    await sdk.send(sender, reply);
    history.set(sender, [...turns, { role: "assistant", content: reply }]);
  },
  onError: (err) => console.error(err),
});
console.log("Wolfie Butler (local iMessage) is watching for messages…");
