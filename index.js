// ===============================
//      SIMBOT – FAST STABLE
//     Turbo Scan + No Crash
// ===============================

// KEEP ALIVE SERVER FOR RENDER
// -------- Error Protection (Add at TOP, before anything else) --------
process.on("unhandledRejection", (err) => {
  console.log("Rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.log("Crash prevented:", err);
});
// ---------------------------------------------------------------------



const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("SimBot is running 24/7");
});

app.listen(3000, () => {
  console.log("✔ Keep-alive server running on port 3000");
});

const axios = require("axios");
const fs = require("fs");
require("dotenv").config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const API_URL = process.env.API_URL;

const SEND_URL = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
const DATA_FILE = "sent_ids.json";

// ---------------------------------------------------------------
// SLEEP
// ---------------------------------------------------------------
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));


// ---------------------------------------------------------------
// TELEGRAM SENDER (with retry)
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
// MESSAGE BUILDER
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
// FILTER
// ---------------------------------------------------------------
function passesFilter(item) {
  const seller = item.seller?.company || "";
  const name = item.asset?.name || "";
  const quality = parseInt(name.match(/Q(\d+)/)?.[1] || 0);
  const price = item.priceSimboosts;

  if (seller === "Trustee (NPC)") {
    if (quality >= 6 && quality <= 8) return price < 30;
    if (quality >= 9 && quality <= 10) return price < 60;
    if (quality >= 11) return true;
  }

  return true;
}


// ---------------------------------------------------------------
// FETCH WITH STABLE TIMEOUT + RETRY
// ---------------------------------------------------------------
async function fetchData() {
  for (let tryNum = 1; tryNum <= 3; tryNum++) {
    try {
      const res = await axios.get(API_URL, {
        timeout: 15000,   // <--- FIXED BIG TIMEOUT
        headers: {
          "User-Agent": "SimBot-Agent",
          Accept: "application/json",
        },
      });

      return res.data;

    } catch (err) {
      console.log(`⚠️ Fetch failed (try ${tryNum}) →`, err.code);

      if (
        ["ECONNRESET", "ETIMEDOUT", "ECONNABORTED", "EAI_AGAIN"].includes(
          err.code
        )
      ) {
        await sleep(1000);
        continue;
      }

      // non-network errors → throw
      throw err;
    }
  }

  throw new Error("API unreachable after 3 attempts");
}


// ---------------------------------------------------------------
// SENT STORAGE
// ---------------------------------------------------------------
function loadSent() {
  if (!fs.existsSync(DATA_FILE)) return new Set();
  try {
    return new Set(JSON.parse(fs.readFileSync(DATA_FILE, "utf8")));
  } catch {
    return new Set();
  }
}

function saveSent(set) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([...set], null, 2));
}


// ---------------------------------------------------------------
// MAIN LOOP
// ---------------------------------------------------------------
async function start() {
  console.log("\n🚀 SimBot FAST Mode Started...\n");

  let sent = loadSent();

  while (true) {
    try {
      const data = await fetchData();

      for (const item of data) {
        if (!passesFilter(item)) continue;

        const uniqueKey = item.id;
        if (sent.has(uniqueKey)) continue;

        let tag = "📢 New Collectible Found!";
        const seller = item.seller?.company || "";

        if (seller === "Trustee (NPC)") {
          tag = "🚨🔥 NPC Collectible Detected! 🔥🚨";
        } else if (["SAM BULL", "Shree Ram contractors"].includes(seller)) {
          tag = "😌💎 Relax, Apna Hi Item Hai 💎😌";
        }

        await sendMessage(buildMessage(item, tag));

        sent.add(uniqueKey);
        saveSent(sent);

        await sleep(150);
      }
    } catch (err) {
      console.log("Error:", err);
    }

    console.log("Cycle done");
    await sleep(1000);
  }
}

start();
