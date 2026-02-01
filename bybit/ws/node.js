const axios = require("axios");
const crypto = require("crypto");

const API_KEY = process.env.BYBIT_API_KEY;
const API_SECRET = process.env.BYBIT_API_SECRET;

const timestamp = Date.now().toString();
const recvWindow = "5000";

// 🔐 строка подписи ДЛЯ GET БЕЗ BODY
const signPayload = timestamp + API_KEY + recvWindow;

const signature = crypto
  .createHmac("sha256", API_SECRET)
  .update(signPayload)
  .digest("hex");

axios.get("https://api.bybit.com/v5/account/info", {
  headers: {
    "X-BAPI-API-KEY": API_KEY,
    "X-BAPI-TIMESTAMP": timestamp,
    "X-BAPI-RECV-WINDOW": recvWindow,
    "X-BAPI-SIGN": signature,
  }
}).then(res => {
  console.log("✅ API KEY + SECRET VALID:", res.data);
}).catch(err => {
  console.error("❌ REST AUTH FAILED:", err.response?.data || err.message);
});
