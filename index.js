// ===============================
//      SIMBOT – FAST & CLEAN
//     Unlimited Price Alerts
// ===============================

// -------- Crash Protection --------
process.on("unhandledRejection", (err) => {
  console.log("Rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.log("Crash prevented:", err);
});
// ----------------------------------

const axios = require("axios");
require("dotenv").config();

// ENV
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const API_URL = process.env.API_URL;

const SEND_URL = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

// ---------------------------------------------------------------
// SLEEP
// ---------------------------------------------------------------
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// ---------------------------------------------------------------
// TELEGRAM SENDER (NON-BLOCKING)
// ---------------------------------------------------------------
async function sendMessage(text) {
  try {
    await axios.post(SEND_URL, {
      chat_id: CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  } catch (err) {
    const e = err.response?.data;
    console.log("Telegram Error:", e || err);

    if (e?.error_code === 429) {
      const wait = e.parameters?.retry_after || 5;
      console.log(`⏳ Telegram rate limit → waiting ${wait}s`);
      await sleep(wait * 1000);
      return sendMessage(text);
    }
  }
}

// ---------------------------------------------------------------
// MESSAGE BUILDER (UNCHANGED DESIGN)
// ---------------------------------------------------------------
function buildMessage(item, tag) {
  const asset = item.asset;

  const name = asset?.name || "Unknown";
  const quality = parseInt(name.match(/Q(\d+)/)?.[1] || 0);
  const realm = asset?.realm ?? "Unknown";
  const price = item.priceSimboosts ?? "Unknown";
  const sellerName = item.seller?.company || "Unknown";

  const border =
    quality >= 11
      ? "✨🌟✨🌟✨🌟✨🌟✨🌟✨🌟✨"
      : "────────────────────────────";

  return `
<b>${tag}</b>

🟥🟧🟨🟩🟦🟪 <b>COLLECTIBLE ALERT</b> 🟪🟦🟩🟨🟧🟥

<pre>
${border}

🆔 Sale ID: ${item.id}
📛 Name: ${name}
🎚 Quality: Q${quality}
🌍 Realm: ${realm}
💰 Price: ${price} Simboosts
🏢 Seller: ${sellerName}

${border}
</pre>

🔗 <b>Market:</b>
https://www.simcompanies.com/market/collectibles/

🕒 <i>Just Scanned</i>
`;
}

// ---------------------------------------------------------------
// FILTER (SAME LOGIC – LAST 60s ONLY)
// ---------------------------------------------------------------
function passesFilter(item) {
  const time = item.datetime ? Date.parse(item.datetime) : 0;
  if (!time) return true;

  const age = Date.now() - time;
  if (age > 60000) return false;

  return true;
}

// ---------------------------------------------------------------
// FETCH WITH RETRY & TIMEOUT
// ---------------------------------------------------------------
async function fetchData() {
  for (let i = 1; i <= 3; i++) {
    try {
      const res = await axios.get(API_URL, {
        timeout: 15000,
        headers: {
          "User-Agent": "SimBot-Agent",
          Accept: "application/json",
        },
      });
      return res.data;
    } catch (err) {
      console.log(`⚠️ Fetch failed (try ${i}) →`, err.code);

      if (
        ["ECONNRESET", "ETIMEDOUT", "ECONNABORTED", "EAI_AGAIN"].includes(
          err.code
        )
      ) {
        await sleep(300);
        continue;
      }
      throw err;
    }
  }
  throw new Error("API unreachable");
}

// ---------------------------------------------------------------
// MAIN LOOP (FAST + 60s MEMORY)
// ---------------------------------------------------------------
async function start() {
  console.log("\n🚀 SimBot (Unlimited Mode) Started...\n");

  const sent = new Map(); // saleId → timestamp

  while (true) {
    try {
      const data = await fetchData();
      const now = Date.now();

      // NEWEST FIRST
      for (let i = data.length - 1; i >= 0; i--) {
        const item = data[i];

        if (!passesFilter(item)) continue;

        const id = item.id;
        if (sent.has(id)) continue;

        let tag = "📢 New Collectible Found!";
        const seller = item.seller?.company || "";

        if (seller === "Trustee (NPC)") {
          tag = "🚨🔥 NPC Collectible Detected! 🔥🚨";
        } else if (["SAM BULL", "Shree Ram contractors"].includes(seller)) {
          tag = "😌💎 Relax, Apna Hi Item Hai (testing wala) 💎😌";
        }

        sendMessage(buildMessage(item, tag)).catch(console.error);
        sent.set(id, now);
      }

      // 🧹 CLEAN IDs OLDER THAN 60s
      for (const [id, time] of sent) {
        if (now - time > 60000) {
          sent.delete(id);
        }
      }
    } catch (err) {
      console.log("Error:", err);
    }

    await sleep(300); // FAST SCAN
  }
}

start();
