const crypto = require("crypto");

const apiKey = (process.env.BYBIT_API_KEY || "").trim();
const secretRaw = (process.env.BYBIT_API_SECRET || "").trim();
const expires = parseInt(process.argv[2] || (Date.now() + 10000), 10);

const payload = String(apiKey) + String(expires);
console.log({ apiKey: apiKey.slice(0, 6) + "…", secretLen: secretRaw.length, expires, payload });

function hmacWithSecret(secretBuf) {
  return crypto.createHmac("sha256", secretBuf).update(payload, "utf8").digest("hex");
}

console.log("signature (utf8):", hmacWithSecret(Buffer.from(secretRaw, "utf8")));
try { console.log("signature (hex):", hmacWithSecret(Buffer.from(secretRaw, "hex"))); } catch (e) { /* ignore */ }
try { console.log("signature (base64):", hmacWithSecret(Buffer.from(secretRaw, "base64"))); } catch (e) { /* ignore */ }

console.log("payload bytes:", Buffer.from(payload, "utf8").toString("hex"));
console.log("secret bytes (utf8 hex):", Buffer.from(secretRaw, "utf8").toString("hex"));